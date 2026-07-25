import { loadTools } from './app.js';
import { renderTools, filterCategory, loadSavedFilters, clearSearch, setupSearch, setCurrentSort, applyFiltersAndSort, toggleAdvancedFilters, clearAllFilters, toggleAdvancedFilter, setupStickySearch } from './ui.js';
import { openTool, toggleFavorite, showToolDetail, closeToolDetail, rateTool } from './tool.js';
import { showShareModal, closeShareModal, shareToWeChat, shareToQQ, copyShareLink, generateShareImage } from './share.js';
import { setupKeyboardShortcuts, setupPullToRefresh, toggleTheme, showToast, loadAnnouncement, closeAnnouncement, registerServiceWorker, closeThemeModal, setTheme, loadSavedTheme } from './utils.js';
import state, { exportUserData, importUserData } from './state.js';
import { initEffects } from './effects.js';

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    document.querySelector('.bottom-nav button[data-action="scroll-to-top"]')?.classList.add('active');
}

function showAllTools() {
    filterCategory('all');
    clearSearch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    document.querySelector('.bottom-nav button[data-action="show-all-tools"]')?.classList.add('active');
}

function changeSort(sortBy) {
    setCurrentSort(sortBy);
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.sort === sortBy) btn.classList.add('active');
    });

    const sortLabels = {
        'default': '默认排序',
        'hot': '热门优先',
        'free-first': '免费优先',
        'domestic': '国产优先',
        'name-asc': '名称 A-Z',
        'name-desc': '名称 Z-A'
    };

    applyFiltersAndSort();
    showToast(`排序方式：${sortLabels[sortBy] || sortBy}`);
}

function exportFavorites() {
    const data = exportUserData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-tool-hub-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('数据导出成功！已下载JSON文件 📥');
}

function importFavorites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const result = importUserData(event.target.result);
            showToast(result.message);
            renderTools(state.tools);
        };
        reader.readAsText(file);
    };
    input.click();
}

const actionHandlers = {
    'open-tool': (e, el) => {
        openTool(parseInt(el.dataset.toolId), el.dataset.toolUrl, e);
    },
    'toggle-favorite': (e, el) => {
        toggleFavorite(parseInt(el.dataset.toolId), e);
    },
    'filter-category': (e, el) => {
        filterCategory(el.dataset.category || 'all');
    },
    'change-sort': (e, el) => {
        changeSort(el.dataset.sort);
    },
    'set-theme': (e, el) => {
        setTheme(el.dataset.themeValue);
    },
    'rate-tool': (e, el) => {
        rateTool(parseInt(el.dataset.rating));
    },
    'close-announcement': () => closeAnnouncement(),
    'show-share-modal': () => showShareModal(),
    'toggle-theme': () => toggleTheme(),
    'scroll-to-top': () => scrollToTop(),
    'show-all-tools': () => showAllTools(),
    'close-tool-detail': () => closeToolDetail(),
    'close-share-modal': (e) => closeShareModal(e),
    'close-theme-modal': (e) => closeThemeModal(e),
    'clear-all-filters': () => { clearAllFilters(); clearSearch(); },
    'clear-search': () => clearSearch(),
    'clear-search-history': () => { localStorage.removeItem('ai-tool-hub-search-history'); document.getElementById('searchHistory')?.classList.remove('show'); showToast('搜索历史已清除'); },
    'toggle-advanced-filters': () => toggleAdvancedFilters(),
    'export-favorites': () => exportFavorites(),
    'import-favorites': () => importFavorites(),
    'share-to-wechat': () => shareToWeChat(),
    'share-to-qq': () => shareToQQ(),
    'copy-share-link': () => copyShareLink(),
    'generate-share-image': () => generateShareImage(),
    'share-tool': () => showShareModal(),
    'show-research': () => showToast('研究功能即将上线'),
    'show-prompts': () => showToast('提示词功能即将上线'),
    'toggle-user-menu': () => { const menu = document.getElementById('userMenu'); if (menu) menu.classList.toggle('show'); },
    'show-profile': () => showToast('个人中心功能即将上线'),
    'sync-data': () => showToast('同步功能即将上线'),
    'export-data': () => exportFavorites(),
    'show-auth-modal': () => showAuthModal(),
    'close-auth-modal': () => closeAuthModal(),
    'show-register': (e) => { e.preventDefault(); showAuthForm('register'); },
    'show-login': (e) => { e.preventDefault(); showAuthForm('login'); },
    'do-login': () => doLogin(),
    'do-register': () => doRegister(),
    'do-logout': () => doLogout(),
    'focus-search': () => document.getElementById('mainSearch')?.focus(),
    'scroll-search': () => {
        document.getElementById('mainSearch')?.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('mainSearch')?.focus();
    },
};

Object.assign(window, {
    showToolDetail,
    closeAnnouncement,
    closeToolDetail,
    closeShareModal,
    closeThemeModal,
    showPromptsPage: () => showToast('提示词功能即将上线'),
    toggleUserMenu: () => actionHandlers['toggle-user-menu'](),
    showProfile: () => showToast('个人中心功能即将上线'),
    syncData: () => showToast('同步功能即将上线'),
    exportData: () => exportFavorites(),
    loginWithGitHub: () => showToast('GitHub OAuth 需后端服务器支持，当前为前端演示模式')
});

document.addEventListener('click', function globalClickHandler(e) {
    const path = e.composedPath ? e.composedPath() : [e.target];
    for (const el of path) {
        if (!el?.getAttribute) continue;
        const action = el.dataset?.action;
        if (action && actionHandlers[action]) {
            actionHandlers[action](e, el);
            return;
        }
        const toolId = el.dataset?.toolId;
        if (toolId && !e.target.closest('button,[data-action],#searchSuggestions,#searchHistory')) {
            showToolDetail(parseInt(toolId));
            return;
        }
    }
});

function setupBackToTopButton() {
    const btn = document.getElementById('backToTopBtn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) btn.classList.add('visible');
        else btn.classList.remove('visible');
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    initEffects();
    window.addEventListener('error', () => {
        showToast('出现错误，请刷新页面重试');
    });
    window.addEventListener('unhandledrejection', (e) => {
        // eslint-disable-next-line no-console -- preserve diagnostics for uncaught async failures
        console.warn('Unhandled promise rejection:', e.reason);
    });
    loadSavedTheme();
    loadTools();
    setupSearch();
    setupStickySearch();
    setupKeyboardShortcuts({
        onEscape: () => {
            clearSearch();
            const searchHistory = document.getElementById('searchHistory');
            if (searchHistory) searchHistory.classList.remove('show');
            closeShareModal();
        }
    });
    setupPullToRefresh();
    loadAnnouncement();
    loadSavedFilters();
    registerServiceWorker();
    setupBackToTopButton();

    // Close user menu when clicking outside
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('userMenu');
        const btn = document.getElementById('userBtn');
        if (menu && menu.classList.contains('show') && menu !== e.target && !menu.contains(e.target) && btn !== e.target && !btn.contains(e.target)) {
            menu.classList.remove('show');
        }
    });

    // Delegated change handler for advanced filter checkboxes (replaces inline onchange)
    document.addEventListener('change', (e) => {
        const input = e.target;
        if (input.matches('.advanced-filters input[type="checkbox"][data-filter-category]')) {
            toggleAdvancedFilter(input.dataset.filterCategory, input.dataset.filterValue, input.checked);
        }
    });
});

function showAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) { showAuthForm('login'); modal.classList.add('active'); }
}
function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('active');
}
function showAuthForm(type) {
    const loginForm = document.getElementById('authLoginForm');
    const registerForm = document.getElementById('authRegisterForm');
    const title = document.getElementById('authModalTitle');
    if (type === 'register') {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (title) title.textContent = '注册';
    } else {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (title) title.textContent = '登录';
    }
}
// ── Local Auth (UI placeholder — NOT production-grade security) ──
// WARNING: Stores user data in localStorage for demo purposes only.
// Production auth should use the backend JWT-based API (/api/v1/auth).
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'ai-tool-hub-client-salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function doRegister() {
    const name = document.getElementById('registerName')?.value?.trim();
    const email = document.getElementById('registerEmail')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value;
    if (!name || !email || !password) { showToast('请填写所有字段'); return; }
    if (password.length < 8) { showToast('密码至少8位'); return; }
    const passwordHash = await hashPassword(password);
    const users = JSON.parse(localStorage.getItem('ai-tool-hub-users') || '[]');
    if (users.find(u => u.email === email)) { showToast('该邮箱已注册'); return; }
    const user = { id: Date.now(), name, email, passwordHash, createdAt: new Date().toISOString() };
    users.push(user);
    localStorage.setItem('ai-tool-hub-users', JSON.stringify(users));
    localStorage.setItem('ai-tool-hub-current-user', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
    closeAuthModal();
    updateUserMenu(user);
    showToast('注册成功，欢迎 ' + name);
}
async function doLogin() {
    const email = document.getElementById('loginEmail')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) { showToast('请填写邮箱和密码'); return; }
    const users = JSON.parse(localStorage.getItem('ai-tool-hub-users') || '[]');
    const user = users.find(u => u.email === email);
    if (!user) { showToast('邮箱或密码不正确'); return; }
    if (user.passwordHash) {
        const inputHash = await hashPassword(password);
        if (inputHash !== user.passwordHash) { showToast('邮箱或密码不正确'); return; }
    }
    localStorage.setItem('ai-tool-hub-current-user', JSON.stringify({ id: user.id, name: user.name, email: user.email }));
    closeAuthModal();
    updateUserMenu(user);
    showToast('登录成功，欢迎回来 ' + user.name);
}
function doLogout() {
    localStorage.removeItem('ai-tool-hub-current-user');
    updateUserMenu(null);
    showToast('已退出登录');
}
export function updateUserMenu(user) {
    const loginItem = document.querySelector('[data-action="show-auth-modal"]');
    const logoutItem = document.querySelector('[data-action="do-logout"]');
    const userNameEl = document.getElementById('userName');
    const menuUserNameEl = document.getElementById('menuUserName');
    const menuUserEmailEl = document.getElementById('menuUserEmail');
    const userAvatarEl = document.getElementById('userAvatar');
    const userIconEl = document.getElementById('userIcon');
    if (user) {
        if (loginItem) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-user';
            loginItem.replaceChildren(icon, document.createTextNode(` ${user.name}`));
        }
        if (logoutItem) logoutItem.style.display = '';
        if (userNameEl) userNameEl.textContent = user.name;
        if (menuUserNameEl) menuUserNameEl.textContent = user.name;
        if (menuUserEmailEl) menuUserEmailEl.textContent = user.email;
        if (userAvatarEl) userAvatarEl.classList.add('hidden');
        if (userIconEl) userIconEl.classList.remove('hidden');
    } else {
        if (loginItem) {
            const icon = document.createElement('i');
            icon.className = 'fas fa-sign-in-alt';
            loginItem.replaceChildren(icon, document.createTextNode(' 登录 / 注册'));
        }
        if (logoutItem) logoutItem.style.display = 'none';
        if (userNameEl) userNameEl.textContent = '游客';
        if (menuUserNameEl) menuUserNameEl.textContent = '游客';
        if (menuUserEmailEl) menuUserEmailEl.textContent = '未登录';
        if (userAvatarEl) userAvatarEl.classList.add('hidden');
        if (userIconEl) userIconEl.classList.remove('hidden');
    }
}

// Load saved session (only id/name/email — no password hash)
const savedUser = JSON.parse(localStorage.getItem('ai-tool-hub-current-user') || 'null');
if (savedUser) updateUserMenu(savedUser);
