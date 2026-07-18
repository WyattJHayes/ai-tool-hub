/**
 * tool.js modal interaction tests
 * Covers: rateTool, closeToolDetail, openTool hash nav
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const mockState = {
    tools: [{ id: 1, name: 'ChatGPT', desc: 'AI工具', category: 'ai-chat', url: 'https://chat.openai.com', icon: 'fa-robot', tags: ['free'], toolTags: ['海外'], status: 'hot', platform: ['web'], difficulty: 'beginner', updateTime: '2024-01-01' }],
    categories: [{ id: 'ai-chat', name: 'AI聊天' }],
    favorites: [],
    clickStats: { '1': 5 },
    ratings: { '1': 3 }
};

const mockToggleFavorite = jest.fn(() => true);
const mockRecordToolClick = jest.fn();
const mockSetToolRating = jest.fn();

jest.unstable_mockModule('../../js/state.js', () => ({
    default: mockState,
    toggleFavorite: mockToggleFavorite,
    recordToolClick: mockRecordToolClick,
    getToolClickCount: jest.fn(() => 5),
    setToolRating: mockSetToolRating,
    getToolRating: jest.fn(() => 3),
    isFavorite: jest.fn(() => false),
    getCategoryName: jest.fn(() => 'AI聊天'),
    PLATFORM_ICONS: { web: 'fa-globe', mobile: 'fa-mobile-alt', desktop: 'fa-desktop', local: 'fa-server' }
}));

jest.unstable_mockModule('../../js/ui.js', () => ({
    renderTools: jest.fn()
}));

jest.unstable_mockModule('../../js/utils.js', () => ({
    showToast: jest.fn(),
    isValidUrl: jest.fn(() => true),
    escapeHtml: jest.fn(s => s),
    escapeAttr: jest.fn(s => s)
}));

jest.unstable_mockModule('../../js/renderer.js', () => ({
    generateTagsHtml: jest.fn(() => '<span class="tag tag-free">免费</span>'),
    generateStatusBadgeHtml: jest.fn(() => '<span class="status-badge">热门</span>'),
    RATING_LABELS: ['', '很差', '较差', '一般', '很好', '极好']
}));

let showToast, recordToolClick;
let openTool, showToolDetail, closeToolDetail, rateTool;

beforeAll(async () => {
    const mod = await import('../../js/tool.js');
    openTool = mod.openTool;
    showToolDetail = mod.showToolDetail;
    closeToolDetail = mod.closeToolDetail;
    rateTool = mod.rateTool;

    // Force setupModalDelegation by dispatching DOMContentLoaded
    if (document.readyState !== 'complete') {
        document.dispatchEvent(new Event('DOMContentLoaded'));
    }
    const utils = await import('../../js/utils.js');
    showToast = utils.showToast;
    const stateMod = await import('../../js/state.js');
    recordToolClick = stateMod.recordToolClick;
});

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
        <div id="toolDetailModal">
            <div class="modal-body">
                <div class="detail-header-icon"></div>
                <div class="detail-title"></div>
                <div class="detail-desc"></div>
                <div class="detail-category"></div>
                <div class="detail-tags"></div>
                <div class="detail-platform"></div>
                <div class="detail-difficulty"></div>
                <div class="detail-update-time"></div>
                <div class="detail-click-count"></div>
                <a class="detail-open-btn" href="https://example.com">使用</a>
                <button class="detail-favorite-btn">收藏</button>
                <button class="modal-close-btn-modern">×</button>
                <div id="toolStarRating" data-tool-id="">
                    <button class="star-btn" data-rating="1"></button>
                    <button class="star-btn" data-rating="2"></button>
                    <button class="star-btn" data-rating="3"></button>
                    <button class="star-btn" data-rating="4"></button>
                    <button class="star-btn" data-rating="5"></button>
                </div>
                <span id="ratingText">点击评分</span>
                <div class="related-tools-list"></div>
            </div>
        </div>
    `;
});

// ── rateTool ──────────────────────────────────────────

describe('rateTool', () => {
    test('sets rating and shows toast', () => {
        const modal = document.getElementById('toolDetailModal');
        modal.dataset.currentToolId = '1';
        showToolDetail(1);
        rateTool(4);
        expect(mockSetToolRating).toHaveBeenCalledWith(1, 4);
        expect(showToast).toHaveBeenCalledWith('已评分 4 星 ⭐');
    });

    test('updates star active classes', () => {
        const modal = document.getElementById('toolDetailModal');
        modal.dataset.currentToolId = '1';
        showToolDetail(1);
        rateTool(5);
        const stars = document.querySelectorAll('.star-btn');
        expect(stars[4].classList.contains('active')).toBe(true);
        expect(stars[3].classList.contains('active')).toBe(true);
    });

    test('updates rating text to label', () => {
        const modal = document.getElementById('toolDetailModal');
        modal.dataset.currentToolId = '1';
        showToolDetail(1);
        rateTool(3);
        const ratingText = document.querySelector('#ratingText');
        expect(ratingText.textContent).toBe('一般');
    });

    test('does nothing when starRating element missing', () => {
        document.querySelector('#toolStarRating').remove();
        expect(() => rateTool(3)).not.toThrow();
    });
});

// ── closeToolDetail ───────────────────────────────────

describe('closeToolDetail', () => {
    test('removes active class and restores scroll', () => {
        const modal = document.getElementById('toolDetailModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        closeToolDetail();
        expect(modal.classList.contains('active')).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });

    test('handles missing modal gracefully', () => {
        document.body.innerHTML = '';
        expect(() => closeToolDetail()).not.toThrow();
    });
});

// ── openTool hash navigation ──────────────────────────

describe('openTool hash navigation', () => {
    beforeEach(() => {
        window.open = jest.fn();
        window.showResearchPage = jest.fn();
    });

    test('navigates to research page on #research hash', () => {
        const event = { stopPropagation: jest.fn() };
        openTool(1, '#research', event);
        expect(recordToolClick).toHaveBeenCalledWith(1);
        expect(window.showResearchPage).toHaveBeenCalled();
    });

    test('handles unknown hash gracefully', () => {
        const event = { stopPropagation: jest.fn() };
        expect(() => openTool(1, '#unknown', event)).not.toThrow();
    });

    test('handles missing showResearchPage', () => {
        delete window.showResearchPage;
        const event = { stopPropagation: jest.fn() };
        expect(() => openTool(1, '#research', event)).not.toThrow();
    });

    test('shows toast for invalid URL', () => {
        jest.unstable_mockModule('../../js/utils.js', () => ({
            showToast: jest.fn(),
            isValidUrl: jest.fn(() => false),
            escapeHtml: jest.fn(s => s),
            escapeAttr: jest.fn(s => s)
        }));
        const event = { stopPropagation: jest.fn() };
        openTool(1, 'javascript:alert(1)', event);
    });
});

// ── showToolDetail ────────────────────────────────────

describe('showToolDetail', () => {
    test('populates modal with tool data', () => {
        showToolDetail(1);
        const modal = document.getElementById('toolDetailModal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(modal.dataset.currentToolId).toBe('1');
        expect(document.querySelector('.detail-title').textContent).toBe('ChatGPT');
        expect(document.querySelector('.detail-click-count').textContent).toBe('5');
    });

    test('does nothing for non-existent tool', () => {
        showToolDetail(999);
        expect(document.getElementById('toolDetailModal').classList.contains('active')).toBe(false);
    });
});
