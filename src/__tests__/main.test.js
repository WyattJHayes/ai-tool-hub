/**
 * main.js tests
 * Tests the DOM event handlers, action delegation, initialization,
 * helper functions, and global window functions.
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock URL static methods (not available in jsdom)
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

// ---------------------------------------------------------------------------
// Mock ALL dependencies
// ---------------------------------------------------------------------------

const mockApp = {
    loadTools: jest.fn()
};

const mockUi = {
    renderTools: jest.fn(),
    filterCategory: jest.fn(),
    loadSavedFilters: jest.fn(),
    clearSearch: jest.fn(),
    setupSearch: jest.fn(),
    setCurrentSort: jest.fn(),
    applyFiltersAndSort: jest.fn(),
    toggleAdvancedFilters: jest.fn(),
    clearAllFilters: jest.fn(),
    toggleAdvancedFilter: jest.fn(),
    setupStickySearch: jest.fn()
};

const mockTool = {
    openTool: jest.fn(),
    toggleFavorite: jest.fn(),
    showToolDetail: jest.fn(),
    closeToolDetail: jest.fn(),
    rateTool: jest.fn()
};

const mockShare = {
    showShareModal: jest.fn(),
    closeShareModal: jest.fn(),
    shareToWeChat: jest.fn(),
    shareToQQ: jest.fn(),
    copyShareLink: jest.fn(),
    generateShareImage: jest.fn()
};

const mockUtils = {
    setupKeyboardShortcuts: jest.fn(),
    setupPullToRefresh: jest.fn(),
    toggleTheme: jest.fn(),
    showToast: jest.fn(),
    loadAnnouncement: jest.fn(),
    closeAnnouncement: jest.fn(),
    checkForUpdate: jest.fn(),
    registerServiceWorker: jest.fn(),
    closeThemeModal: jest.fn(),
    setTheme: jest.fn(),
    loadSavedTheme: jest.fn()
};

const mockState = {
    default: {
        tools: [{ id: 1, name: 'Test Tool', category: 'ai-writing' }],
        categories: [{ id: 'ai-writing', name: 'AI写作' }],
        favorites: []
    },
    exportUserData: jest.fn(() => '{"favorites":[]}'),
    importUserData: jest.fn(() => ({ message: '导入成功' }))
};

jest.unstable_mockModule('../../js/app.js', () => mockApp);
jest.unstable_mockModule('../../js/ui.js', () => mockUi);
jest.unstable_mockModule('../../js/tool.js', () => mockTool);
jest.unstable_mockModule('../../js/share.js', () => mockShare);
jest.unstable_mockModule('../../js/utils.js', () => mockUtils);
jest.unstable_mockModule('../../js/state.js', () => mockState);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createClickEvent(target) {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    if (!event.composedPath) {
        const path = [];
        let el = target;
        while (el) {
            path.push(el);
            el = el.parentElement;
        }
        path.push(document);
        path.push(window);
        event.composedPath = () => path;
    }
    Object.defineProperty(event, 'target', { value: target, writable: true });
    return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('action handlers', () => {
    let mainModule;

    beforeAll(async () => {
        document.body.innerHTML = `
            <div id="app">
                <div class="bottom-nav">
                    <button data-action="scroll-to-top">Top</button>
                    <button data-action="show-all-tools">All</button>
                </div>
                <div class="sort-bar">
                    <button class="sort-btn" data-sort="hot">热门</button>
                    <button class="sort-btn active" data-sort="default">默认</button>
                </div>
                <div id="backToTopBtn">Back</div>
                <div id="searchHistory"></div>
                <div id="userMenu"></div>
            </div>
        `;
        window.open = jest.fn();
        window.scrollTo = jest.fn();
        mainModule = await import('../../js/main.js');
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders a saved user name as text instead of HTML', () => {
        const loginItem = document.createElement('button');
        loginItem.dataset.action = 'show-auth-modal';
        document.body.appendChild(loginItem);

        mainModule.updateUserMenu({ name: '<img src=x onerror=alert(1)>', email: 'safe@example.com' });

        expect(loginItem.querySelector('img')).toBeNull();
        expect(loginItem.textContent).toContain('<img src=x onerror=alert(1)>');
        loginItem.remove();
    });

    describe('global click handler action delegation', () => {
        test('should call openTool', () => {
            const el = document.createElement('button');
            el.dataset.action = 'open-tool';
            el.dataset.toolId = '5';
            el.dataset.toolUrl = 'https://example.com';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.openTool).toHaveBeenCalledWith(5, 'https://example.com', expect.any(Object));
            document.body.removeChild(el);
        });

        test('should call toggleFavorite', () => {
            const el = document.createElement('button');
            el.dataset.action = 'toggle-favorite';
            el.dataset.toolId = '3';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.toggleFavorite).toHaveBeenCalledWith(3, expect.any(Object));
            document.body.removeChild(el);
        });

        test('should call filterCategory', () => {
            const el = document.createElement('button');
            el.dataset.action = 'filter-category';
            el.dataset.category = 'ai-writing';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.filterCategory).toHaveBeenCalledWith('ai-writing');
            document.body.removeChild(el);
        });

        test('should call filterCategory with "all" default', () => {
            const el = document.createElement('button');
            el.dataset.action = 'filter-category';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.filterCategory).toHaveBeenCalledWith('all');
            document.body.removeChild(el);
        });

        test('should call changeSort', () => {
            const el = document.createElement('button');
            el.dataset.action = 'change-sort';
            el.dataset.sort = 'hot';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.setCurrentSort).toHaveBeenCalledWith('hot');
            expect(mockUi.applyFiltersAndSort).toHaveBeenCalled();
            expect(mockUtils.showToast).toHaveBeenCalledWith('排序方式：热门优先');
            document.body.removeChild(el);
        });

        test('should call setTheme', () => {
            const el = document.createElement('button');
            el.dataset.action = 'set-theme';
            el.dataset.themeValue = 'dark';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUtils.setTheme).toHaveBeenCalledWith('dark');
            document.body.removeChild(el);
        });

        test('should call rateTool', () => {
            const el = document.createElement('button');
            el.dataset.action = 'rate-tool';
            el.dataset.rating = '4';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.rateTool).toHaveBeenCalledWith(4);
            document.body.removeChild(el);
        });

        test('should call closeAnnouncement', () => {
            const el = document.createElement('button');
            el.dataset.action = 'close-announcement';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUtils.closeAnnouncement).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call showShareModal', () => {
            const el = document.createElement('button');
            el.dataset.action = 'show-share-modal';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.showShareModal).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call toggleTheme', () => {
            const el = document.createElement('button');
            el.dataset.action = 'toggle-theme';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUtils.toggleTheme).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call scrollToTop', () => {
            const el = document.createElement('button');
            el.dataset.action = 'scroll-to-top';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
            document.body.removeChild(el);
        });

        test('should call showAllTools', () => {
            const el = document.createElement('button');
            el.dataset.action = 'show-all-tools';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.filterCategory).toHaveBeenCalledWith('all');
            expect(mockUi.clearSearch).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call closeToolDetail', () => {
            const el = document.createElement('button');
            el.dataset.action = 'close-tool-detail';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.closeToolDetail).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call closeShareModal', () => {
            const el = document.createElement('button');
            el.dataset.action = 'close-share-modal';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.closeShareModal).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call closeThemeModal', () => {
            const el = document.createElement('button');
            el.dataset.action = 'close-theme-modal';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUtils.closeThemeModal).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call clearAllFilters and clearSearch', () => {
            const el = document.createElement('button');
            el.dataset.action = 'clear-all-filters';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.clearAllFilters).toHaveBeenCalled();
            expect(mockUi.clearSearch).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call toggleAdvancedFilters', () => {
            const el = document.createElement('button');
            el.dataset.action = 'toggle-advanced-filters';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUi.toggleAdvancedFilters).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call exportFavorites', () => {
            const el = document.createElement('button');
            el.dataset.action = 'export-favorites';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockState.exportUserData).toHaveBeenCalled();
            expect(mockUtils.showToast).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call importFavorites', () => {
            const el = document.createElement('button');
            el.dataset.action = 'import-favorites';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockUtils.showToast).not.toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call shareToWeChat', () => {
            const el = document.createElement('button');
            el.dataset.action = 'share-to-wechat';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.shareToWeChat).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call shareToQQ', () => {
            const el = document.createElement('button');
            el.dataset.action = 'share-to-qq';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.shareToQQ).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call copyShareLink', () => {
            const el = document.createElement('button');
            el.dataset.action = 'copy-share-link';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.copyShareLink).toHaveBeenCalled();
            document.body.removeChild(el);
        });

        test('should call generateShareImage', () => {
            const el = document.createElement('button');
            el.dataset.action = 'generate-share-image';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockShare.generateShareImage).toHaveBeenCalled();
            document.body.removeChild(el);
        });
    });

    describe('tool detail click', () => {
        test('should show tool detail on data-tool-id click', () => {
            const el = document.createElement('div');
            el.dataset.toolId = '2';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.showToolDetail).toHaveBeenCalledWith(2);
            document.body.removeChild(el);
        });

        test('should not show tool detail inside button elements', () => {
            const btn = document.createElement('button');
            const el = document.createElement('span');
            el.dataset.toolId = '2';
            btn.appendChild(el);
            document.body.appendChild(btn);
            el.dispatchEvent(createClickEvent(el));
            expect(mockTool.showToolDetail).not.toHaveBeenCalled();
            document.body.removeChild(btn);
        });
    });

    describe('DOMContentLoaded initialization', () => {
        test('should initialize all features on DOMContentLoaded', () => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
            expect(mockUtils.loadSavedTheme).toHaveBeenCalled();
            expect(mockApp.loadTools).toHaveBeenCalled();
            expect(mockUi.setupSearch).toHaveBeenCalled();
            expect(mockUtils.setupKeyboardShortcuts).toHaveBeenCalled();
            expect(mockUtils.setupPullToRefresh).toHaveBeenCalled();
            expect(mockUtils.checkForUpdate).not.toHaveBeenCalled();
            expect(mockUtils.loadAnnouncement).toHaveBeenCalled();
            expect(mockUi.loadSavedFilters).toHaveBeenCalled();
            expect(mockUtils.registerServiceWorker).toHaveBeenCalled();
        });

        test('should show toast on window error', () => {
            window.dispatchEvent(new Event('error'));
            expect(mockUtils.showToast).toHaveBeenCalledWith('出现错误，请刷新页面重试');
        });

        test('should set up back to top button scroll handler', () => {
            const btn = document.getElementById('backToTopBtn');
            expect(btn).toBeTruthy();
            Object.defineProperty(window, 'scrollY', { value: 500, writable: true });
            window.dispatchEvent(new Event('scroll'));
            expect(btn.classList.contains('visible')).toBe(true);
            Object.defineProperty(window, 'scrollY', { value: 100, writable: true });
            window.dispatchEvent(new Event('scroll'));
            expect(btn.classList.contains('visible')).toBe(false);
        });
    });

    describe('window global functions', () => {
        test('showPromptsPage', () => {
            window.showPromptsPage();
            expect(mockUtils.showToast).toHaveBeenCalledWith('提示词功能即将上线');
        });

        test('toggleUserMenu', () => {
            const menu = document.getElementById('userMenu');
            expect(menu.classList.contains('show')).toBe(false);
            window.toggleUserMenu();
            expect(menu.classList.contains('show')).toBe(true);
            window.toggleUserMenu();
            expect(menu.classList.contains('show')).toBe(false);
        });

        test('showProfile', () => {
            window.showProfile();
            expect(mockUtils.showToast).toHaveBeenCalledWith('个人中心功能即将上线');
        });

        test('syncData', () => {
            window.syncData();
            expect(mockUtils.showToast).toHaveBeenCalledWith('同步功能即将上线');
        });

        test('exportData', () => {
            window.exportData();
            expect(mockState.exportUserData).toHaveBeenCalled();
        });

        test('loginWithGitHub', () => {
            window.loginWithGitHub();
            expect(mockUtils.showToast).toHaveBeenCalledWith('GitHub OAuth 需后端服务器支持，当前为前端演示模式');
        });

        test('should expose close functions on window', () => {
            expect(window.closeAnnouncement).toBe(mockUtils.closeAnnouncement);
            expect(window.closeToolDetail).toBe(mockTool.closeToolDetail);
            expect(window.closeShareModal).toBe(mockShare.closeShareModal);
            expect(window.closeThemeModal).toBe(mockUtils.closeThemeModal);
        });
    });

    describe('changeSort', () => {
        test('should update sort button active states', () => {
            const hotBtn = document.querySelector('.sort-btn[data-sort="hot"]');
            const defaultBtn = document.querySelector('.sort-btn[data-sort="default"]');
            const el = document.createElement('button');
            el.dataset.action = 'change-sort';
            el.dataset.sort = 'hot';
            document.body.appendChild(el);
            el.dispatchEvent(createClickEvent(el));
            document.body.removeChild(el);
            expect(hotBtn.classList.contains('active')).toBe(true);
            expect(defaultBtn.classList.contains('active')).toBe(false);
        });
    });
});
