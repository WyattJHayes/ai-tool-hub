/**
 * Auth Modal Component
 * Login/Register dialog for AI optimization service
 */

import { apiClient } from '../lib/apiClient.js';
import { showNotification } from '../lib/utils.js';

class AuthModal {
    constructor() {
        this.container = null;
        this.onAuthSuccess = null;
        this._initialized = false;
    }

    show(callback) {
        this.onAuthSuccess = callback;
        if (!this._initialized) {
            this._createModal();
            this._initialized = true;
        }
        this.container.classList.remove('hidden');
        this._switchTab('login');
        this._updateQuotaDisplay();
    }

    hide() {
        if (this.container) {
            this.container.classList.add('hidden');
        }
    }

    updateUI() {
        const user = apiClient.getUser();
        const isAuthenticated = apiClient.isAuthenticated();

        const authSection = document.getElementById('authSection');
        if (!authSection) return;

        if (isAuthenticated && user) {
            authSection.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-user-circle text-indigo-400"></i>
                        <span class="text-sm text-gray-300">${this._escapeHtml(user.email)}</span>
                    </div>
                    <button id="logoutBtn" class="text-xs text-gray-400 hover:text-red-400 transition-colors">
                        <i class="fas fa-sign-out-alt mr-1"></i>退出
                    </button>
                </div>
                <div id="quotaDisplay" class="text-xs text-gray-500 mt-1">
                    <i class="fas fa-bolt mr-1"></i>加载中...
                </div>
            `;
            document.getElementById('logoutBtn')?.addEventListener('click', () => {
                apiClient.logout();
                this.updateUI();
                showNotification('已退出登录', 'info');
            });
            this._loadQuota();
        } else {
            authSection.innerHTML = `
                <div class="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="fas fa-rocket text-yellow-400"></i>
                        <span class="text-sm font-medium text-gray-200">AI智能优化</span>
                    </div>
                    <p class="text-xs text-gray-400 mb-3">登录后可使用AI大模型优化简历，每天10次免费额度</p>
                    <button id="loginBtn" class="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">
                        <i class="fas fa-sign-in-alt mr-1"></i>登录 / 注册
                    </button>
                </div>
            `;
            document.getElementById('loginBtn')?.addEventListener('click', () => {
                this.show();
            });
        }
    }

    async _loadQuota() {
        const quotaDisplay = document.getElementById('quotaDisplay');
        if (!quotaDisplay) return;

        try {
            const { quota } = await apiClient.getProfile();
            quotaDisplay.innerHTML = `<i class="fas fa-bolt mr-1"></i>今日剩余: <span class="text-indigo-400 font-medium">${quota.remaining}</span>/${quota.total} 次`;
        } catch {
            quotaDisplay.innerHTML = `<i class="fas fa-bolt mr-1"></i><span class="text-gray-400">获取额度信息失败</span>`;
        }
    }

    _updateQuotaDisplay() {
        this._loadQuota();
    }

    _createModal() {
        this.container = document.createElement('div');
        this.container.id = 'authModalContainer';
        this.container.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-50 hidden';
        this.container.innerHTML = `
            <div class="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full mx-4 p-6 shadow-2xl">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-bold text-white">
                        <i class="fas fa-rocket text-indigo-400 mr-2"></i>AI简历优化
                    </h3>
                    <button id="authModalClose" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>

                <div class="flex mb-6 bg-gray-800 rounded-lg p-1">
                    <button id="tabLogin" class="flex-1 py-2 text-sm font-medium rounded-md transition-colors bg-indigo-600 text-white">
                        登录
                    </button>
                    <button id="tabRegister" class="flex-1 py-2 text-sm font-medium rounded-md transition-colors text-gray-400 hover:text-white">
                        注册
                    </button>
                </div>

                <div id="authError" class="hidden mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm"></div>

                <form id="authForm" class="space-y-4">
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">邮箱</label>
                        <input type="email" id="authEmail" required
                            class="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                            placeholder="your@email.com">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-400 mb-1">密码</label>
                        <input type="password" id="authPassword" required minlength="8"
                            class="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
                            placeholder="至少8位">
                    </div>
                    <button type="submit" id="authSubmitBtn"
                        class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors text-white">
                        <span id="authBtnText">登录</span>
                        <span id="authBtnLoading" class="hidden">
                            <i class="fas fa-spinner fa-spin mr-1"></i>处理中...
                        </span>
                    </button>
                </form>

                <p class="text-xs text-gray-500 mt-4 text-center">
                    登录后可使用AI大模型优化简历，每天10次免费额度
                </p>
            </div>
        `;

        document.body.appendChild(this.container);

        document.getElementById('authModalClose')?.addEventListener('click', () => this.hide());
        document.getElementById('tabLogin')?.addEventListener('click', () => this._switchTab('login'));
        document.getElementById('tabRegister')?.addEventListener('click', () => this._switchTab('register'));
        document.getElementById('authForm')?.addEventListener('submit', (e) => this._handleSubmit(e));
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.hide();
        });
    }

    _switchTab(tab) {
        const tabLogin = document.getElementById('tabLogin');
        const tabRegister = document.getElementById('tabRegister');
        const btnText = document.getElementById('authBtnText');

        if (tab === 'login') {
            tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors bg-indigo-600 text-white';
            tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors text-gray-400 hover:text-white';
            btnText.textContent = '登录';
        } else {
            tabRegister.className = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors bg-indigo-600 text-white';
            tabLogin.className = 'flex-1 py-2 text-sm font-medium rounded-md transition-colors text-gray-400 hover:text-white';
            btnText.textContent = '注册';
        }

        this.container.dataset.tab = tab;
        this._hideError();
    }

    async _handleSubmit(e) {
        e.preventDefault();

        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const tab = this.container.dataset.tab || 'login';

        const btnText = document.getElementById('authBtnText');
        const btnLoading = document.getElementById('authBtnLoading');
        const submitBtn = document.getElementById('authSubmitBtn');

        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        submitBtn.disabled = true;
        this._hideError();

        try {
            const result = tab === 'login'
                ? await apiClient.login(email, password)
                : await apiClient.register(email, password);

            showNotification(tab === 'login' ? '登录成功！' : '注册成功！', 'success');
            this.hide();
            this.updateUI();

            if (this.onAuthSuccess) {
                this.onAuthSuccess(result);
            }
        } catch (error) {
            this._showError(error.message);
        } finally {
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    _showError(message) {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    _hideError() {
        const errorEl = document.getElementById('authError');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const authModal = new AuthModal();

export { AuthModal, authModal };
window.authModal = authModal;
