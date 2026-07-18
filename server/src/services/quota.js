import config from '../config.js';
import { promises as fsp, existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

function hashPassword(password) {
    const salt = randomBytes(16);
    const derivedKey = scryptSync(password + config.PASSWORD_PEPPER, salt, 64);
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

function verifyPasswordHash(password, storedHash) {
    try {
        const [saltHex, keyHex] = storedHash.split(':');
        if (!saltHex || !keyHex) return false;
        const salt = Buffer.from(saltHex, 'hex');
        const derivedKey = scryptSync(password + config.PASSWORD_PEPPER, salt, 64);
        return timingSafeEqual(Buffer.from(keyHex, 'hex'), derivedKey);
    } catch {
        return false;
    }
}

const __dirname = dirname(fileURLToPath(import.meta.url));

class QuotaService {
    /**
     * @param {string} [dataPath] - Optional custom data path (for testing)
     */
    constructor(dataPath) {
        this.dataPath = dataPath || join(__dirname, '../../data', 'quota.json');
        this.data = null;
        // Promise chain that serializes all write operations so concurrent
        // mutations (e.g. two incrementUsage calls) never race on the file.
        this._writeQueue = Promise.resolve();
        this._ensureDataDir();
        this._load();
    }

    _ensureDataDir() {
        const dir = dirname(this.dataPath);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }

    _load() {
        try {
            if (existsSync(this.dataPath)) {
                this.data = JSON.parse(readFileSync(this.dataPath, 'utf8'));
                // 兼容旧数据：补充 membership 和 orders 字段
                if (!this.data.memberships) this.data.memberships = {};
                if (!this.data.orders) this.data.orders = [];
                if (!this.data.usage) this.data.usage = {};
            } else {
                this.data = { users: [], usage: {}, memberships: {}, orders: [] };
                this._enqueueWrite();
            }
        } catch {
            this.data = { users: [], usage: {}, memberships: {}, orders: [] };
            this._enqueueWrite();
        }
    }

    /**
     * Enqueue an atomic file write on the serialization promise chain.
     * Async, non-blocking -- the caller does not have to await this.
     * Write errors are logged and silently swallowed since the in-memory
     * state is the source of truth during this server's lifetime.
     */
    /**
     * Await the write queue to flush all pending writes to disk.
     * Used by tests to verify persistence before cleanup.
     */
    async flush() {
        await this._writeQueue;
    }

    _enqueueWrite() {
        const dataPath = this.dataPath;
        const serialized = JSON.stringify(this.data, null, 2);
        this._writeQueue = this._writeQueue.then(async () => {
            const tmpPath = dataPath + '.tmp';
            await fsp.writeFile(tmpPath, serialized, 'utf8');
            await fsp.rename(tmpPath, dataPath);
        });
        this._writeQueue.catch(err => {
            // ENOENT is benign (temp dir cleaned up before async write).
            if (err.code !== 'ENOENT') {
                console.error('[QuotaService] Write error:', err);
            }
        });
    }

    _generateUserId() {
        return Date.now().toString(36) + randomBytes(4).toString('hex');
    }

    _findUser(email) {
        return this.data.users.find(u => u.email === email);
    }

    register(email, password) {
        if (this._findUser(email)) {
            return { error: '该邮箱已注册' };
        }

        const hashedPassword = hashPassword(password);

        const user = {
            id: this._generateUserId(),
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };
        this.data.users.push(user);
        this._enqueueWrite();
        return { user: { id: user.id, email: user.email } };
    }

    verifyPassword(email, password) {
        const user = this._findUser(email);
        if (!user) return null;

        const isValid = verifyPasswordHash(password, user.password);

        return isValid ? user : null;
    }

    getUserById(id) {
        const user = this.data.users.find(u => u.id === id);
        if (!user) return null;
        const { password: _, ...safeUser } = user;
        return safeUser;
    }

    _todayKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    _usageKey(userId) {
        return `${userId}_${this._todayKey()}`;
    }

    checkQuota(userId) {
        const key = this._usageKey(userId);
        const used = this.data.usage[key] || 0;

        const membership = this.getMembership(userId);

        // VIP 永久无限
        if (membership && membership.plan === 'vip' && membership.status === 'active') {
            return {
                used,
                remaining: 99999,
                total: 99999,
                plan: 'vip',
                planName: config.MEMBERSHIP_PLANS.vip.name,
                resetAt: null,
            };
        }

        // 基础会员：一次性配额
        if (membership && membership.plan === 'basic' && membership.status === 'active') {
            const totalBought = membership.totalQuota || config.MEMBERSHIP_PLANS.basic.totalQuota;
            const usedTotal = membership.usedQuota || 0;
            const remaining = Math.max(0, totalBought - usedTotal);
            return {
                used: usedTotal,
                remaining,
                total: totalBought,
                plan: 'basic',
                planName: config.MEMBERSHIP_PLANS.basic.name,
                resetAt: null,
            };
        }

        // 免费用户：每日配额
        return {
            used,
            remaining: Math.max(0, config.DAILY_QUOTA - used),
            total: config.DAILY_QUOTA,
            plan: 'free',
            planName: config.MEMBERSHIP_PLANS.free.name,
            resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        };
    }

    incrementUsage(userId) {
        const membership = this.getMembership(userId);

        // VIP: 无需计数限制
        if (membership && membership.plan === 'vip' && membership.status === 'active') {
            const key = this._usageKey(userId);
            this.data.usage[key] = (this.data.usage[key] || 0) + 1;
            this._enqueueWrite();
            return this.checkQuota(userId);
        }

        // 基础会员：消耗一次性配额
        if (membership && membership.plan === 'basic' && membership.status === 'active') {
            membership.usedQuota = (membership.usedQuota || 0) + 1;
            this._enqueueWrite();
            return this.checkQuota(userId);
        }

        // 免费用户：每日配额
        const key = this._usageKey(userId);
        this.data.usage[key] = (this.data.usage[key] || 0) + 1;
        this._enqueueWrite();
        return this.checkQuota(userId);
    }

    tryConsumeQuota(userId) {
        const quota = this.checkQuota(userId);
        if (quota.remaining <= 0) return { allowed: false, quota };
        return { allowed: true, quota: this.incrementUsage(userId) };
    }

    refundUsage(userId) {
        const membership = this.getMembership(userId);
        if (membership && membership.plan === 'basic' && membership.status === 'active') {
            membership.usedQuota = Math.max(0, (membership.usedQuota || 0) - 1);
        } else {
            const key = this._usageKey(userId);
            this.data.usage[key] = Math.max(0, (this.data.usage[key] || 0) - 1);
        }
        this._enqueueWrite();
        return this.checkQuota(userId);
    }

    // ===== 会员管理 =====

    getMembership(userId) {
        return this.data.memberships[userId] || null;
    }

    activateMembership(userId, plan, orderId) {
        const plans = config.MEMBERSHIP_PLANS;
        if (!plans[plan]) throw new Error(`Unknown plan: ${plan}`);

        const existing = this.data.memberships[userId];

        // 升级：basic → vip，保留已用次数记录
        if (existing && existing.plan === 'basic' && plan === 'vip') {
            existing.plan = 'vip';
            existing.status = 'active';
            existing.activatedAt = new Date().toISOString();
            existing.orderId = orderId;
            existing.permanent = true;
            this._enqueueWrite();
            return existing;
        }

        const membership = {
            userId,
            plan,
            status: 'active',
            activatedAt: new Date().toISOString(),
            orderId,
        };

        if (plan === 'basic') {
            membership.totalQuota = plans.basic.totalQuota;
            membership.usedQuota = 0;
            membership.permanent = false;
        }

        if (plan === 'vip') {
            membership.permanent = true;
        }

        this.data.memberships[userId] = membership;
        this._enqueueWrite();
        return membership;
    }

    // ===== 订单管理 =====

    createOrder(userId, plan, paymentMethod) {
        const plans = config.MEMBERSHIP_PLANS;
        if (!plans[plan] || plan === 'free') throw new Error(`Invalid plan: ${plan}`);
        if (!['alipay', 'wechat'].includes(paymentMethod)) throw new Error(`Invalid payment method: ${paymentMethod}`);

        const order = {
            id: 'ORD' + Date.now().toString(36) + randomBytes(4).toString('hex'),
            userId,
            plan,
            paymentMethod,
            amount: plans[plan].price,
            status: 'pending',
            createdAt: new Date().toISOString(),
            paidAt: null,
            expiredAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            transactionId: null,
        };

        this.data.orders.push(order);
        this._enqueueWrite();
        return order;
    }

    getOrder(orderId) {
        return this.data.orders.find(o => o.id === orderId) || null;
    }

    getOrdersByUser(userId) {
        return this.data.orders.filter(o => o.userId === userId);
    }

    fulfillOrder(orderId, transactionId) {
        const order = this.getOrder(orderId);
        if (!order) throw new Error('Order not found');
        if (order.status !== 'pending') throw new Error(`Order status is ${order.status}, not pending`);

        order.status = 'paid';
        order.paidAt = new Date().toISOString();
        order.transactionId = transactionId;

        // 激活会员
        const membership = this.activateMembership(order.userId, order.plan, order.id);
        order.status = 'fulfilled';

        this._enqueueWrite();
        return { order, membership };
    }

    expireOrders() {
        const now = new Date().toISOString();
        let expired = 0;
        for (const order of this.data.orders) {
            if (order.status === 'pending' && order.expiredAt < now) {
                order.status = 'expired';
                expired++;
            }
        }
        if (expired > 0) this._enqueueWrite();
        return expired;
    }
}

const quotaService = new QuotaService();
export { QuotaService, quotaService };
