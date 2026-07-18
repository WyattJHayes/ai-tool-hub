
/**
 * tool.js 补充测试文件
 * Tests showToolDetail, closeToolDetail, hash navigation in openTool
 */
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const mockState = {
    tools: [
        {
            id: 1, name: 'ChatGPT', desc: 'AI对话工具', category: 'ai-writing',
            url: 'https://chat.openai.com', icon: 'fa-robot', tags: ['free', 'hot'],
            toolTags: ['海外', '无需登录'], status: 'hot', platform: ['web', 'mobile'],
            difficulty: 'beginner', updateTime: '2024-01-01'
        },
        {
            id: 2, name: 'Midjourney', desc: 'AI绘画工具', category: 'ai-image',
            url: 'https://midjourney.com', icon: 'fa-palette', tags: ['vip'],
            toolTags: ['海外'], status: 'stable', platform: ['web'],
            difficulty: 'intermediate', updateTime: '2024-02-01'
        }
    ],
    categories: [
        { id: 'ai-writing', name: 'AI写作' },
        { id: 'ai-image', name: 'AI绘画' }
    ],
    favorites: [1],
    clickStats: { '1': 10, '2': 5 },
    ratings: {}
};

jest.unstable_mockModule('../../js/state.js', () => ({
    default: mockState,
    toggleFavorite: jest.fn(() => false),
    recordToolClick: jest.fn(),
    getToolClickCount: jest.fn((id) => mockState.clickStats[String(id)] || 0),
    setToolRating: jest.fn(),
    getToolRating: jest.fn(() => 0),
    isFavorite: jest.fn((id) => mockState.favorites.includes(id)),
    getCategoryName: jest.fn((id) => {
        const cat = mockState.categories.find(c => c.id === id);
        return cat ? cat.name : '';
    }),
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
    generateTagsHtml: jest.fn(() => '<span class="tag tag-free">免费</span><span class="tag tag-hot">热门</span>'),
    generateStatusBadgeHtml: jest.fn((s) => s === 'hot' ? '<span class="status-badge status-hot">热门推荐</span>' : ''),
    RATING_LABELS: ['', '很差', '较差', '一般', '很好', '极好']
}));

const { showToast } = await import('../../js/utils.js');
const { recordToolClick } = await import('../../js/state.js');
const { renderTools } = await import('../../js/ui.js');
const { openTool, showToolDetail, closeToolDetail } = await import('../../js/tool.js');

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
        <div id="toolsGrid"></div>
        <div id="toolDetailModal">
            <div class="modal-header">
                <div class="detail-header-icon"></div>
            </div>
            <div class="modal-body">
                <div class="detail-title"></div>
                <div class="detail-desc"></div>
                <div class="detail-category"></div>
                <div class="detail-tags"></div>
                <div class="detail-platform"></div>
                <div class="detail-difficulty"></div>
                <div class="detail-update-time"></div>
                <div class="detail-click-count"></div>
                <div class="detail-open-btn"></div>
                <div class="detail-favorite-btn"></div>
                <div id="toolStarRating" data-tool-id="">
                    <button class="star-btn"></button>
                    <button class="star-btn"></button>
                    <button class="star-btn"></button>
                    <button class="star-btn"></button>
                    <button class="star-btn"></button>
                </div>
                <span id="ratingText">点击评分</span>
                <div class="related-tools-list"></div>
            </div>
        </div>
    `;
});

describe('showToolDetail', () => {
    test('should do nothing for non-existent tool', () => {
        showToolDetail(999);
        expect(document.getElementById('toolDetailModal').classList.contains('active')).toBe(false);
        expect(recordToolClick).not.toHaveBeenCalled();
    });

    test('should populate modal with tool data', () => {
        showToolDetail(1);
        const modal = document.getElementById('toolDetailModal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(modal.dataset.currentToolId).toBe('1');
        expect(recordToolClick).toHaveBeenCalledWith(1);
        expect(document.querySelector('.detail-title').textContent).toBe('ChatGPT');
        expect(document.querySelector('.detail-click-count').textContent).toBe('10');
    });

    test('should set body overflow to hidden', () => {
        showToolDetail(1);
        expect(document.body.style.overflow).toBe('hidden');
    });

    test('should show active favorite button for favorited tool', () => {
        showToolDetail(1);
        expect(document.querySelector('.detail-favorite-btn').classList.contains('active')).toBe(true);
    });

    test('should show inactive favorite button for non-favorited tool', () => {
        showToolDetail(2);
        expect(document.querySelector('.detail-favorite-btn').classList.contains('active')).toBe(false);
    });
});

describe('closeToolDetail', () => {
    test('should remove active class and restore overflow', () => {
        const modal = document.getElementById('toolDetailModal');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        closeToolDetail();
        expect(modal.classList.contains('active')).toBe(false);
        expect(document.body.style.overflow).toBe('');
    });

    test('should not throw if modal is missing', () => {
        document.body.innerHTML = '';
        expect(() => closeToolDetail()).not.toThrow();
    });
});

describe('openTool hash navigation', () => {
    beforeEach(() => {
        window.open = jest.fn();
        window.showResearchPage = jest.fn();
    });

    function createEvent() {
        return { stopPropagation: jest.fn() };
    }

    test('should handle #research hash', () => {
        const event = createEvent();
        openTool(1, '#research', event);
        expect(recordToolClick).toHaveBeenCalledWith(1);
        expect(window.showResearchPage).toHaveBeenCalled();
        expect(window.open).not.toHaveBeenCalled();
    });

    test('should handle unknown hash gracefully', () => {
        const event = createEvent();
        expect(() => openTool(1, '#unknown', event)).not.toThrow();
    });

    test('should handle missing showResearchPage', () => {
        delete window.showResearchPage;
        const event = createEvent();
        expect(() => openTool(1, '#research', event)).not.toThrow();
    });
});
