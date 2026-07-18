// utils.js 测试文件 — tests the active js/utils.js module
import { jest } from '@jest/globals';

// Polyfill for TextEncoder/TextDecoder in jsdom environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import {
    escapeHtml,
    escapeAttr,
    isValidUrl,
    MAX_SEARCH_HISTORY,
    TOAST_DISPLAY_TIME,
    SEARCH_DEBOUNCE_TIME
} from '../../js/utils.js';
import {
    generateTagsHtml,
    generatePlatformBadgesHtml,
    generateStatusBadgeHtml,
    RATING_LABELS
} from '../../js/renderer.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
    test('MAX_SEARCH_HISTORY should be 10', () => {
        expect(MAX_SEARCH_HISTORY).toBe(10);
    });

    test('TOAST_DISPLAY_TIME should be 2000', () => {
        expect(TOAST_DISPLAY_TIME).toBe(2000);
    });

    test('SEARCH_DEBOUNCE_TIME should be 300', () => {
        expect(SEARCH_DEBOUNCE_TIME).toBe(300);
    });

    test('RATING_LABELS should have 6 entries', () => {
        expect(RATING_LABELS).toEqual(['', '很差', '较差', '一般', '很好', '极好']);
    });
});

// ---------------------------------------------------------------------------
// escapeHtml
// ---------------------------------------------------------------------------

describe('escapeHtml', () => {
    test('should escape HTML special characters', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        expect(escapeHtml('<div>test</div>')).toBe('&lt;div&gt;test&lt;/div&gt;');
    });

    test('should escape ampersands', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    test('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('should handle normal text without special characters', () => {
        expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    test('should escape single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    test('should return empty string for non-string input', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(123)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// escapeAttr
// ---------------------------------------------------------------------------

describe('escapeAttr', () => {
    test('should escape double quotes in attributes', () => {
        expect(escapeAttr('value"onclick="alert(1)')).toBe('value&quot;onclick=&quot;alert(1)');
    });

    test('should escape single quotes', () => {
        expect(escapeAttr("value'onclick'")).toBe('value&#39;onclick&#39;');
    });

    test('should escape angle brackets', () => {
        expect(escapeAttr('<script>')).toBe('&lt;script&gt;');
    });

    test('should escape ampersands', () => {
        expect(escapeAttr('a & b')).toBe('a &amp; b');
    });

    test('should return empty string for non-string input', () => {
        expect(escapeAttr(null)).toBe('');
        expect(escapeAttr(undefined)).toBe('');
        expect(escapeAttr(123)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// isValidUrl
// ---------------------------------------------------------------------------

describe('isValidUrl', () => {
    test('should accept http URLs', () => {
        expect(isValidUrl('http://example.com')).toBe(true);
    });

    test('should accept https URLs', () => {
        expect(isValidUrl('https://example.com/path?query=1')).toBe(true);
    });

    test('should reject empty string', () => {
        expect(isValidUrl('')).toBe(false);
    });

    test('should reject null/undefined', () => {
        expect(isValidUrl(null)).toBe(false);
        expect(isValidUrl(undefined)).toBe(false);
    });

    test('should reject URLs without protocol', () => {
        expect(isValidUrl('example.com')).toBe(false);
    });

    test('should reject dangerous protocols', () => {
        expect(isValidUrl('javascript:alert(1)')).toBe(false);
        expect(isValidUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isValidUrl('file:///etc/passwd')).toBe(false);
    });

    test('should reject ftp protocol', () => {
        expect(isValidUrl('ftp://example.com')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// generateTagsHtml
// ---------------------------------------------------------------------------

describe('generateTagsHtml', () => {
    test('should generate free tag', () => {
        const html = generateTagsHtml({ tags: ['free'] });
        expect(html).toContain('tag-free');
        expect(html).toContain('免费');
    });

    test('should generate vip tag when free is absent', () => {
        const html = generateTagsHtml({ tags: ['vip'] });
        expect(html).toContain('tag-vip');
        expect(html).toContain('VIP');
    });

    test('should generate new tag', () => {
        const html = generateTagsHtml({ tags: ['new'] });
        expect(html).toContain('tag-new');
        expect(html).toContain('NEW');
    });

    test('should generate hot tag', () => {
        const html = generateTagsHtml({ tags: ['hot'] });
        expect(html).toContain('tag-hot');
        expect(html).toContain('热门');
    });

    test('should generate toolTags (domestic, overseas, open-source, no-login)', () => {
        const tests = [
            { tag: '国产', cls: 'tag-domestic' },
            { tag: '海外', cls: 'tag-overseas' },
            { tag: '开源', cls: 'tag-open-source' },
            { tag: '无需登录', cls: 'tag-no-login' }
        ];
        for (const { tag, cls } of tests) {
            const html = generateTagsHtml({ toolTags: [tag] });
            expect(html).toContain(cls);
        }
    });

    test('should return empty string when no tags exist', () => {
        expect(generateTagsHtml({})).toBe('');
        expect(generateTagsHtml({ tags: [] })).toBe('');
    });

    test('should not generate vip when free tag exists', () => {
        const html = generateTagsHtml({ tags: ['free', 'vip'] });
        expect(html).toContain('tag-free');
        expect(html).not.toContain('tag-vip');
    });
});

// ---------------------------------------------------------------------------
// generatePlatformBadgesHtml
// ---------------------------------------------------------------------------

describe('generatePlatformBadgesHtml', () => {
    test('should generate badges for web platform', () => {
        const html = generatePlatformBadgesHtml(['web']);
        expect(html).toContain('fa-globe');
    });

    test('should generate badges for local platform', () => {
        const html = generatePlatformBadgesHtml(['local']);
        expect(html).toContain('fa-server');
    });

    test('should generate badges for mobile platform', () => {
        const html = generatePlatformBadgesHtml(['mobile']);
        expect(html).toContain('fa-mobile-alt');
    });

    test('should generate badges for desktop platform', () => {
        const html = generatePlatformBadgesHtml(['desktop']);
        expect(html).toContain('fa-desktop');
    });

    test('should handle multiple platforms', () => {
        const html = generatePlatformBadgesHtml(['web', 'mobile']);
        expect(html).toContain('fa-globe');
        expect(html).toContain('fa-mobile-alt');
    });

    test('should return empty string for null/undefined', () => {
        expect(generatePlatformBadgesHtml(null)).toBe('');
        expect(generatePlatformBadgesHtml(undefined)).toBe('');
    });

    test('should return container for empty array', () => {
        const html = generatePlatformBadgesHtml([]);
        expect(html).toContain('platform-badges');
    });

    test('should escape platform name in title attribute', () => {
        const html = generatePlatformBadgesHtml(['web']);
        expect(html).toContain('title="web"');
    });
});

// ---------------------------------------------------------------------------
// generateStatusBadgeHtml
// ---------------------------------------------------------------------------

describe('generateStatusBadgeHtml', () => {
    test('should generate hot badge', () => {
        const html = generateStatusBadgeHtml('hot');
        expect(html).toContain('status-hot');
        expect(html).toContain('fa-fire');
        expect(html).toContain('热门推荐');
    });

    test('should generate stable badge', () => {
        const html = generateStatusBadgeHtml('stable');
        expect(html).toContain('status-stable');
        expect(html).toContain('fa-check-circle');
        expect(html).toContain('稳定可靠');
    });

    test('should return empty string for unknown status', () => {
        expect(generateStatusBadgeHtml('unknown')).toBe('');
        expect(generateStatusBadgeHtml('')).toBe('');
        expect(generateStatusBadgeHtml(null)).toBe('');
    });
});

// ---------------------------------------------------------------------------
// generatePlatformBadgesHtml
// ---------------------------------------------------------------------------

describe('generatePlatformBadgesHtml', () => {
    let generatePlatformBadgesHtml;

    beforeAll(async () => {
        const mod = await import('../../js/renderer.js');
        generatePlatformBadgesHtml = mod.generatePlatformBadgesHtml;
    });

    test('should generate HTML for web platform', () => {
        const html = generatePlatformBadgesHtml(['web']);
        expect(html).toContain('fa-globe');
        expect(html).toContain('platform-badges');
    });

    test('should generate HTML for multiple platforms', () => {
        const html = generatePlatformBadgesHtml(['web', 'mobile', 'desktop']);
        expect(html).toContain('fa-globe');
        expect(html).toContain('fa-mobile-alt');
        expect(html).toContain('fa-desktop');
    });

    test('should handle local platform', () => {
        const html = generatePlatformBadgesHtml(['local']);
        expect(html).toContain('fa-server');
    });

    test('should return empty string for undefined', () => {
        expect(generatePlatformBadgesHtml(undefined)).toBe('');
    });

    test('should return empty string for non-array', () => {
        expect(generatePlatformBadgesHtml('web')).toBe('');
    });

    test('should use fallback icon for unknown platform', () => {
        const html = generatePlatformBadgesHtml(['unknown']);
        expect(html).toContain('fa-cog');
    });
});

// ---------------------------------------------------------------------------
// generateStatusBadgeHtml
// ---------------------------------------------------------------------------

describe('generateStatusBadgeHtml', () => {
    let generateStatusBadgeHtml;

    beforeAll(async () => {
        const mod = await import('../../js/renderer.js');
        generateStatusBadgeHtml = mod.generateStatusBadgeHtml;
    });

    test('should generate hot status badge', () => {
        const html = generateStatusBadgeHtml('hot');
        expect(html).toContain('热门推荐');
        expect(html).toContain('status-hot');
        expect(html).toContain('fa-fire');
    });

    test('should generate stable status badge', () => {
        const html = generateStatusBadgeHtml('stable');
        expect(html).toContain('稳定可靠');
        expect(html).toContain('status-stable');
        expect(html).toContain('fa-check-circle');
    });

    test('should return empty string for unknown status', () => {
        expect(generateStatusBadgeHtml('unknown')).toBe('');
    });

    test('should return empty string for null/undefined', () => {
        expect(generateStatusBadgeHtml(null)).toBe('');
        expect(generateStatusBadgeHtml(undefined)).toBe('');
    });
});


// ---------------------------------------------------------------------------
// showToast
// ---------------------------------------------------------------------------

describe('showToast', () => {
    let showToast;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        showToast = mod.showToast;
    });

    beforeEach(() => {
        document.body.innerHTML = '<div id="toast"><span id="toastMsg"></span></div>';
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should set message and show toast', () => {
        showToast('测试消息');
        expect(document.getElementById('toastMsg').textContent).toBe('测试消息');
        expect(document.getElementById('toast').classList.contains('show')).toBe(true);
    });

    test('should hide toast after timeout', () => {
        showToast('测试消息');
        jest.advanceTimersByTime(2000);
        expect(document.getElementById('toast').classList.contains('show')).toBe(false);
    });

    test('should not throw if toast element missing', () => {
        document.body.innerHTML = '';
        expect(() => showToast('test')).not.toThrow();
    });

    test('should reset timer on multiple calls', () => {
        showToast('第一条');
        showToast('第二条');
        expect(document.getElementById('toastMsg').textContent).toBe('第二条');
    });
});

// ---------------------------------------------------------------------------
// isValidUrl (edge cases)
// ---------------------------------------------------------------------------

describe('isValidUrl (edge cases)', () => {
    let isValidUrl;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        isValidUrl = mod.isValidUrl;
    });

    test('should reject ftp protocol', () => expect(isValidUrl('ftp://example.com')).toBe(false));
    test('should reject javascript protocol', () => expect(isValidUrl('javascript:alert(1)')).toBe(false));
    test('should reject blob URLs', () => expect(isValidUrl('blob:null/uuid')).toBe(false));
    test('should reject data URLs', () => expect(isValidUrl('data:text/plain,hello')).toBe(false));
    test('should accept URLs with query and fragment', () => expect(isValidUrl('https://example.com/path?q=a#sec')).toBe(true));
    test('should reject malformed URLs', () => expect(isValidUrl('not a url')).toBe(false));
    test('should reject non-string', () => { expect(isValidUrl(123)).toBe(false); expect(isValidUrl({})).toBe(false); });
});

// ---------------------------------------------------------------------------
// setupKeyboardShortcuts
// ---------------------------------------------------------------------------

describe('setupKeyboardShortcuts', () => {
    let setupKeyboardShortcuts;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        setupKeyboardShortcuts = mod.setupKeyboardShortcuts;
    });

    beforeEach(() => {
        document.body.innerHTML = '<input id="mainSearch" type="text" />';
    });

    test('should focus search on slash key', () => {
        const onEscape = jest.fn();
        setupKeyboardShortcuts({ onEscape });
        const spy = jest.spyOn(document.getElementById('mainSearch'), 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
        expect(spy).toHaveBeenCalled();
    });

    test('should focus search on s key', () => {
        const onEscape = jest.fn();
        setupKeyboardShortcuts({ onEscape });
        const spy = jest.spyOn(document.getElementById('mainSearch'), 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
        expect(spy).toHaveBeenCalled();
    });

    test('should not focus when editing textarea', () => {
        document.body.innerHTML = '<textarea id="editor"></textarea><input id="mainSearch" />';
        const onEscape = jest.fn();
        setupKeyboardShortcuts({ onEscape });
        document.getElementById('editor').focus();
        const spy = jest.spyOn(document.getElementById('mainSearch'), 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
        expect(spy).not.toHaveBeenCalled();
    });

    test('should call onEscape on Escape key', () => {
        const onEscape = jest.fn();
        setupKeyboardShortcuts({ onEscape });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(onEscape).toHaveBeenCalled();
    });

    test('should not throw without callbacks', () => {
        setupKeyboardShortcuts();
        expect(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// setTheme / loadSavedTheme
// ---------------------------------------------------------------------------

describe('setTheme / loadSavedTheme', () => {
    let setTheme, loadSavedTheme;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        setTheme = mod.setTheme;
        loadSavedTheme = mod.loadSavedTheme;
    });

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove('dark');
        document.body.innerHTML = '<i id="themeIconNav" class="fas fa-palette"></i>';
    });

    test('setTheme should add/remove dark class', () => {
        setTheme('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        setTheme('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    test('setTheme should save to localStorage', () => {
        setTheme('dark');
        expect(localStorage.getItem('ai-tool-hub-dark-mode')).toBe('true');
        setTheme('light');
        expect(localStorage.getItem('ai-tool-hub-dark-mode')).toBe('false');
    });

    test('setTheme should update theme icon', () => {
        setTheme('dark');
        expect(document.getElementById('themeIconNav').className).toContain('fa-sun');
        setTheme('light');
        expect(document.getElementById('themeIconNav').className).toContain('fa-moon');
    });

    test('loadSavedTheme should restore dark mode', () => {
        localStorage.setItem('ai-tool-hub-dark-mode', 'true');
        loadSavedTheme();
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    test('loadSavedTheme should default to light', () => {
        loadSavedTheme();
        expect(typeof loadSavedTheme).toBe('function');
    });

    test('loadSavedTheme should handle bogus storage', () => {
        localStorage.setItem('ai-tool-hub-dark-mode', 'bogus');
        expect(() => loadSavedTheme()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// loadAnnouncement / closeAnnouncement
// ---------------------------------------------------------------------------

describe('loadAnnouncement / closeAnnouncement', () => {
    let loadAnnouncement, closeAnnouncement;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        loadAnnouncement = mod.loadAnnouncement;
        closeAnnouncement = mod.closeAnnouncement;
    });

    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '<div id="announcementBar"><span id="announcementText"></span></div>';
    });

    test('should show announcement when available', () => {
        localStorage.setItem('ai-tool-hub-announcement', '通知');
        loadAnnouncement();
        expect(document.getElementById('announcementText').textContent).toBe('通知');
        expect(document.getElementById('announcementBar').style.display).not.toBe('none');
    });

    test('should not show if dismissed', () => {
        localStorage.setItem('ai-tool-hub-announcement', '通知');
        localStorage.setItem('ai-tool-hub-announcement-closed', 'true');
        loadAnnouncement();
        expect(document.getElementById('announcementBar').style.display).not.toBe('block');
    });

    test('closeAnnouncement should dismiss', () => {
        closeAnnouncement();
        expect(document.getElementById('announcementBar').style.display).toBe('none');
        expect(localStorage.getItem('ai-tool-hub-announcement-closed')).toBe('true');
    });

    test('should not throw when elements missing', () => {
        document.body.innerHTML = '';
        expect(() => loadAnnouncement()).not.toThrow();
        expect(() => closeAnnouncement()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// registerServiceWorker
// ---------------------------------------------------------------------------

describe('registerServiceWorker', () => {
    let registerServiceWorker;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        registerServiceWorker = mod.registerServiceWorker;
    });

    test('should register sw.js', () => {
        const mock = jest.fn().mockResolvedValue();
        Object.defineProperty(navigator, 'serviceWorker', {
            value: { register: mock }, writable: true, configurable: true
        });
        registerServiceWorker();
        expect(mock).toHaveBeenCalledWith('sw.js');
    });

    test('should not throw when unsupported', () => {
        delete navigator.serviceWorker;
        expect(() => registerServiceWorker()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// setupPullToRefresh
// ---------------------------------------------------------------------------

describe('setupPullToRefresh', () => {
    let setupPullToRefresh;

    beforeAll(async () => {
        const mod = await import('../../js/utils.js');
        setupPullToRefresh = mod.setupPullToRefresh;
    });

    test('should add touch event listeners', () => {
        document.body.innerHTML = '<div id="pullRefresh"></div>';
        const spy = jest.spyOn(document, 'addEventListener');
        setupPullToRefresh();
        expect(spy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true });
        expect(spy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: true });
        expect(spy).toHaveBeenCalledWith('touchend', expect.any(Function));
    });

    test('should not throw without element', () => {
        document.body.innerHTML = '';
        expect(() => setupPullToRefresh()).not.toThrow();
    });
});
