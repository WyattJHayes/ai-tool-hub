/**
 * AI Tool Hub API Client
 * Handles authentication and resume optimization via backend API
 */

class ApiClient {
    constructor(baseURL = '/api/v1') {
        this.baseURL = baseURL;
        this.legacyBaseURL = '/api';
        this.userKey = 'ai_tool_hub_user';
    }

    isAuthenticated() {
        return !!this.getUser();
    }

    getUser() {
        try {
            const data = localStorage.getItem(this.userKey);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    async register(email, password) {
        const response = await fetch(`${this.baseURL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '注册失败');
        }

        localStorage.setItem(this.userKey, JSON.stringify(data.user));
        this._notifyAuthChange();
        return data;
    }

    async login(email, password) {
        const response = await fetch(`${this.baseURL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '登录失败');
        }

        localStorage.setItem(this.userKey, JSON.stringify(data.user));
        this._notifyAuthChange();
        return data;
    }

    async logout() {
        try {
            await fetch(`${this.baseURL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } finally {
            localStorage.removeItem(this.userKey);
            this._notifyAuthChange();
        }
    }

    async getProfile() {
        const response = await fetch(`${this.baseURL}/auth/me`, {
            headers: this._getHeaders(),
            credentials: 'include'
        });

        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '获取用户信息失败');
        }

        return data;
    }

    async optimize(level, resumeText, jobDescription, callbacks = {}) {
        const { onProgress, onToken, onDone, onError } = callbacks;

        const response = await fetch(`${this.baseURL}/resume/optimize`, {
            method: 'POST',
            headers: {
                ...this._getHeaders(),
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ level, resumeText, jobDescription })
        });

        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }

        if (response.status === 429) {
            const data = await response.json();
            throw new Error(data.error || '今日优化次数已用完');
        }

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'AI优化服务暂时不可用');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult = null;
        let currentEventType = '';
        let streamedContent = '';
        let collectedLevel = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEventType = line.substring(7).trim();
                        continue;
                    }
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6).trim();
                        try {
                            const parsed = JSON.parse(data);

                            if (currentEventType === 'error') {
                                const error = new Error(parsed.message || parsed.error || 'AI优化服务出现错误');
                                if (onError) onError(error);
                                throw error;
                            }

                            if (parsed.status && onProgress) {
                                onProgress(parsed);
                            } else if (parsed.content && onToken) {
                                streamedContent += parsed.content;
                                onToken(parsed);
                            } else if (parsed.level || parsed.optimizedData || parsed.quotaRemaining !== undefined) {
                                if (parsed.level) collectedLevel = parsed.level;
                                finalResult = parsed;
                                if (onDone) onDone(parsed);
                            }
                        } catch (e) {
                            if (currentEventType === 'error') throw e;
                            // skip malformed JSON for non-error events
                        }
                        currentEventType = '';
                    }
                }
            }

            if (!finalResult) {
                finalResult = {
                    level: collectedLevel || '',
                    optimizedData: null,
                    optimizedText: streamedContent || '',
                    message: 'AI optimization completed with unexpected response format'
                };
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const remainingLines = buffer.split('\n');
                for (const line of remainingLines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const parsed = JSON.parse(line.substring(6));
                            if (parsed.quotaRemaining !== undefined && onDone) {
                                onDone(parsed);
                            }
                        } catch {
                            // skip
                        }
                    }
                }
            }
        } catch (error) {
            if (onError) {
                onError(error);
            }
            throw error;
        }

        return finalResult;
    }

    async analyzeJD(jdText) {
        const response = await fetch(`${this.baseURL}/resume/analyze-jd`, {
            method: 'POST',
            headers: {
                ...this._getHeaders(),
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ jdText })
        });

        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'JD分析失败');
        }

        return data;
    }

    async parseResume(text) {
        const response = await fetch(`${this.baseURL}/resume/parse`, {
            method: 'POST',
            headers: {
                ...this._getHeaders(),
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ text })
        });

        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }

        if (response.status === 503) {
            const data = await response.json();
            throw new Error(data.error || 'AI服务暂不可用');
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || '简历解析失败');
        }

        return data;
    }

    _getHeaders() {
        return {};
    }

    // ===== 会员与支付 =====

    async getPlans() {
        const response = await fetch(`${this.baseURL}/payment/plans`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '获取会员方案失败');
        return data;
    }

    async getMembershipStatus() {
        const response = await fetch(`${this.baseURL}/payment/status`, {
            headers: this._getHeaders(),
            credentials: 'include'
        });
        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '获取会员状态失败');
        return data;
    }

    async createOrder(plan, paymentMethod) {
        const response = await fetch(`${this.baseURL}/payment/order`, {
            method: 'POST',
            headers: {
                ...this._getHeaders(),
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ plan, paymentMethod })
        });
        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '创建订单失败');
        return data;
    }

    async getOrder(orderId) {
        const response = await fetch(`${this.baseURL}/payment/order/${orderId}`, {
            headers: this._getHeaders(),
            credentials: 'include'
        });
        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '查询订单失败');
        return data;
    }

    async getOrders() {
        const response = await fetch(`${this.baseURL}/payment/orders`, {
            headers: this._getHeaders(),
            credentials: 'include'
        });
        if (response.status === 401) {
            this.logout();
            throw new Error('登录已过期，请重新登录');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '查询订单列表失败');
        return data;
    }

    // 轮询订单状态，直到支付完成或超时
    pollOrderStatus(orderId, { interval = 3000, timeout = 300000, onStatusChange } = {}) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const poll = async () => {
                try {
                    const { order, membership } = await this.getOrder(orderId);
                    if (onStatusChange) onStatusChange(order);

                    if (order.status === 'fulfilled') {
                        resolve({ order, membership });
                        return;
                    }
                    if (order.status === 'expired' || order.status === 'refunded') {
                        reject(new Error(order.status === 'expired' ? '订单已过期' : '订单已退款'));
                        return;
                    }
                    if (Date.now() - start > timeout) {
                        reject(new Error('支付超时，请稍后在订单列表中查看'));
                        return;
                    }
                    setTimeout(poll, interval);
                } catch (error) {
                    reject(error);
                }
            };
            poll();
        });
    }

    _notifyAuthChange() {
        window.dispatchEvent(new CustomEvent('auth-change', {
            detail: { authenticated: this.isAuthenticated() }
        }));
    }
}

const apiClient = new ApiClient();

export { ApiClient, apiClient };
window.apiClient = apiClient;
