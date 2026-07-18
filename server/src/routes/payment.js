import express from 'express';
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { quotaService } from '../services/quota.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = Router();

// ===== 会员方案查询 =====

router.get('/plans', (req, res) => {
    const plans = config.MEMBERSHIP_PLANS;
    res.json({
        plans: Object.entries(plans).map(([key, plan]) => ({
            id: key,
            name: plan.name,
            price: plan.price,
            priceLabel: plan.priceLabel || (plan.price === 0 ? '免费' : `¥${plan.price}`),
            description: plan.description || (plan.price === 0 ? `每日${plan.dailyQuota}次` : ''),
            dailyQuota: plan.dailyQuota,
            totalQuota: plan.totalQuota,
            permanent: plan.permanent || false,
        })),
        paymentMethods: [
            { id: 'alipay', name: '支付宝', enabled: !!config.ALIPAY_APP_ID },
            { id: 'wechat', name: '微信支付', enabled: false },
        ],
    });
});

// ===== 查询当前会员状态 =====

router.get('/status', authMiddleware, (req, res) => {
    try {
        const membership = quotaService.getMembership(req.user.id);
        const quota = quotaService.checkQuota(req.user.id);
        res.json({
            membership: membership || { plan: 'free', status: 'active' },
            quota,
        });
    } catch (error) {
        logger.error('Get membership status error:', error);
        res.status(500).json({ error: '获取会员状态失败' });
    }
});

// ===== 创建订单 =====

router.post('/order', authMiddleware, (req, res) => {
    try {
        const { plan, paymentMethod } = req.body;

        if (!plan || !paymentMethod) {
            return res.status(400).json({ error: '缺少必要参数: plan 和 paymentMethod' });
        }

        if (!['basic', 'vip'].includes(plan)) {
            return res.status(400).json({ error: '无效的会员方案，可选: basic, vip' });
        }

        if (!['alipay', 'wechat'].includes(paymentMethod)) {
            return res.status(400).json({ error: '无效的支付方式，可选: alipay, wechat' });
        }

        if (paymentMethod === 'wechat') {
            return res.status(501).json({ error: '微信支付服务端统一下单尚未接入' });
        }

        // 检查支付渠道是否可用
        if (paymentMethod === 'alipay' && !config.ALIPAY_APP_ID) {
            return res.status(400).json({ error: '支付宝支付暂未开通' });
        }

        // 检查是否已是同等级或更高等级会员
        const currentMembership = quotaService.getMembership(req.user.id);
        if (currentMembership && currentMembership.status === 'active') {
            if (currentMembership.plan === 'vip') {
                return res.status(400).json({ error: '您已是永久VIP，无需再次购买' });
            }
            if (currentMembership.plan === 'basic' && plan === 'basic') {
                const remaining = currentMembership.totalQuota - (currentMembership.usedQuota || 0);
                if (remaining > 0) {
                    return res.status(400).json({ error: `您的基础会员还有${remaining}次，用完再购买` });
                }
            }
        }

        // 创建订单
        const order = quotaService.createOrder(req.user.id, plan, paymentMethod);
        logger.info(`Order created: ${order.id}, user=${req.user.id}, plan=${plan}, method=${paymentMethod}`);

        // 根据支付方式生成支付参数
        let paymentParams = null;
        try {
            if (paymentMethod === 'alipay') {
                paymentParams = createAlipayOrder(order);
            } else if (paymentMethod === 'wechat') {
                paymentParams = createWechatOrder(order);
            }
        } catch (error) {
            logger.error('Create payment params error:', error);
            return res.status(500).json({ error: '创建支付订单失败，请稍后重试' });
        }

        res.json({
            order: {
                id: order.id,
                plan: order.plan,
                amount: order.amount,
                paymentMethod: order.paymentMethod,
                status: order.status,
                createdAt: order.createdAt,
                expiredAt: order.expiredAt,
            },
            payment: paymentParams,
        });
    } catch (error) {
        logger.error('Create order error:', error);
        res.status(500).json({ error: '创建订单失败，请稍后重试' });
    }
});

// ===== 查询订单状态 =====

router.get('/order/:orderId', authMiddleware, (req, res) => {
    try {
        const order = quotaService.getOrder(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: '订单不存在' });
        }
        if (order.userId !== req.user.id) {
            return res.status(403).json({ error: '无权查看此订单' });
        }
        const membership = quotaService.getMembership(req.user.id);
        res.json({ order, membership });
    } catch (error) {
        logger.error('Get order error:', error);
        res.status(500).json({ error: '查询订单失败' });
    }
});

// ===== 查询用户订单列表 =====

router.get('/orders', authMiddleware, (req, res) => {
    try {
        const orders = quotaService.getOrdersByUser(req.user.id);
        res.json({ orders });
    } catch (error) {
        logger.error('Get orders error:', error);
        res.status(500).json({ error: '查询订单列表失败' });
    }
});

// ===== 支付宝异步通知回调 =====

router.post('/notify/alipay', express.raw({ type: '*/*' }), (req, res) => {
    try {
        const params = new URLSearchParams(req.body.toString());
        const sign = params.get('sign');
        const signType = params.get('sign_type');

        // 验签
        if (!verifyAlipaySign(params, sign)) {
            logger.warn('Alipay notify: signature verification failed');
            return res.send('fail');
        }

        const tradeStatus = params.get('trade_status');
        const outTradeNo = params.get('out_trade_no');   // 我们的订单号
        const tradeNo = params.get('trade_no');           // 支付宝交易号
        const totalAmount = parseFloat(params.get('total_amount') || '0');

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
            const order = quotaService.getOrder(outTradeNo);
            if (!order) {
                logger.warn(`Alipay notify: order ${outTradeNo} not found`);
                return res.send('fail');
            }

            if (order.amount !== totalAmount) {
                logger.warn(`Alipay notify: amount mismatch, expected=${order.amount}, actual=${totalAmount}`);
                return res.send('fail');
            }

            if (order.status === 'pending') {
                const result = quotaService.fulfillOrder(outTradeNo, tradeNo);
                logger.info(`Alipay payment fulfilled: order=${outTradeNo}, tradeNo=${tradeNo}`);
            }
        }

        res.send('success');
    } catch (error) {
        logger.error('Alipay notify error:', error);
        res.send('fail');
    }
});

// ===== 微信支付异步通知回调 =====

router.post('/notify/wechat', express.raw({ type: '*/*' }), (req, res) => {
    try {
        // 微信通知为 XML 格式
        const xml = req.body.toString();
        const data = parseWechatXml(xml);

        if (!verifyWechatSign(data)) {
            logger.warn('Wechat notify: signature verification failed');
            return res.send(buildWechatFailXml('签名验证失败'));
        }

        if (data.result_code === 'SUCCESS' && data.return_code === 'SUCCESS') {
            const outTradeNo = data.out_trade_no;
            const transactionId = data.transaction_id;
            const totalFee = parseInt(data.total_fee || '0') / 100; // 分转元

            const order = quotaService.getOrder(outTradeNo);
            if (!order) {
                logger.warn(`Wechat notify: order ${outTradeNo} not found`);
                return res.send(buildWechatFailXml('订单不存在'));
            }

            if (Math.abs(order.amount - totalFee) > 0.01) {
                logger.warn(`Wechat notify: amount mismatch, expected=${order.amount}, actual=${totalFee}`);
                return res.send(buildWechatFailXml('金额不匹配'));
            }

            if (order.status === 'pending') {
                quotaService.fulfillOrder(outTradeNo, transactionId);
                logger.info(`Wechat payment fulfilled: order=${outTradeNo}, transactionId=${transactionId}`);
            }
        }

        res.send(buildWechatSuccessXml());
    } catch (error) {
        logger.error('Wechat notify error:', error);
        res.send(buildWechatFailXml('处理失败'));
    }
});

// ===== 支付参数生成 =====

function createAlipayOrder(order) {
    if (!config.ALIPAY_APP_ID) {
        throw new Error('Alipay not configured');
    }

    const planInfo = config.MEMBERSHIP_PLANS[order.plan];
    const subject = `AI Tool Hub - ${planInfo.name}`;
    const bizContent = {
        out_trade_no: order.id,
        total_amount: order.amount.toFixed(2),
        subject,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        time_expire: order.expiredAt,
    };

    // 构建支付宝请求参数
    const params = {
        app_id: config.ALIPAY_APP_ID,
        method: 'alipay.trade.page.pay',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        version: '1.0',
        notify_url: config.ALIPAY_NOTIFY_URL,
        biz_content: JSON.stringify(bizContent),
    };

    // 签名
    params.sign = signAlipayParams(params);

    // 生成支付跳转 URL
    const queryString = Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    const payUrl = `${config.ALIPAY_GATEWAY}?${queryString}`;

    return {
        type: 'redirect',
        payUrl,
        orderId: order.id,
    };
}

function createWechatOrder(order) {
    if (!config.WECHAT_MCH_ID) {
        throw new Error('Wechat Pay not configured');
    }

    const planInfo = config.MEMBERSHIP_PLANS[order.plan];
    const body = `AI Tool Hub - ${planInfo.name}`;

    // 微信 Native 支付参数（扫码支付）
    const params = {
        appid: config.WECHAT_APP_ID,
        mch_id: config.WECHAT_MCH_ID,
        nonce_str: crypto.randomBytes(16).toString('hex'),
        body,
        out_trade_no: order.id,
        total_fee: Math.round(order.amount * 100), // 元转分
        spbill_create_ip: '127.0.0.1',
        notify_url: config.WECHAT_NOTIFY_URL,
        trade_type: 'NATIVE',
        product_id: order.plan,
        time_expire: order.expiredAt.replace(/\.\d{3}Z/, '').replace(/[-:T]/g, '').substring(0, 14),
    };

    params.sign = signWechatParams(params);

    // 生成 XML 请求体并请求微信统一下单接口
    // 此处返回参数结构，实际 HTTP 请求由前端或 BFF 层发起
    return {
        type: 'qrcode',
        params,
        orderId: order.id,
        // 实际部署时需要调微信统一下单接口获取 code_url
        // codeUrl: 'weixin://wxpay/...',
    };
}

// ===== 签名与验签 =====

function signAlipayParams(params) {
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && params[k]).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr, 'utf8');
    return sign.sign(config.ALIPAY_PRIVATE_KEY, 'base64');
}

function verifyAlipaySign(params, sign) {
    if (!config.ALIPAY_PUBLIC_KEY || !sign) return false;
    const sortedKeys = [...params.keys()].filter(k => k !== 'sign' && k !== 'sign_type' && params.get(k)).sort();
    const signStr = sortedKeys.map(k => `${k}=${params.get(k)}`).join('&');
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signStr, 'utf8');
    return verify.verify(config.ALIPAY_PUBLIC_KEY, sign, 'base64');
}

function signWechatParams(params) {
    const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && params[k]).sort();
    const signStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&') + `&key=${config.WECHAT_API_KEY}`;
    return crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
}

function verifyWechatSign(data) {
    if (!config.WECHAT_API_KEY || !data.sign) return false;
    const expectedSign = data.sign;
    const sortedKeys = Object.keys(data).filter(k => k !== 'sign' && data[k]).sort();
    const signStr = sortedKeys.map(k => `${k}=${data[k]}`).join('&') + `&key=${config.WECHAT_API_KEY}`;
    const calculatedSign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
    return expectedSign === calculatedSign;
}

function parseWechatXml(xml) {
    const data = {};
    const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>(.*?)<\/\3>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        const key = match[1] || match[3];
        const value = match[2] || match[4];
        data[key] = value;
    }
    return data;
}

function buildWechatSuccessXml() {
    return '<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>';
}

function buildWechatFailXml(msg) {
    return `<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[${msg}]]></return_msg></xml>`;
}

export default router;
