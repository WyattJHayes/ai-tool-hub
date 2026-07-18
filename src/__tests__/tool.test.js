/**
 * tool.js 测试文件
 * Tests openTool, rateTool
 */
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock dependencies before importing tool.js
jest.unstable_mockModule('../../js/state.js', () => ({
    default: {
        tools: [{ id: 1, name: 'Test Tool', category: 'ai-writing' }],
        categories: [{ id: 'ai-writing', name: 'AI写作' }],
        favorites: []
    },
    toggleFavorite: jest.fn(),
    recordToolClick: jest.fn(),
    getToolClickCount: jest.fn(() => 5),
    setToolRating: jest.fn(),
    getToolRating: jest.fn(() => 0),
    PLATFORM_ICONS: { web: 'fa-globe', mobile: 'fa-mobile-alt', desktop: 'fa-desktop', local: 'fa-server' }
}));

jest.unstable_mockModule('../../js/ui.js', () => ({
    renderTools: jest.fn()
}));

jest.unstable_mockModule('../../js/utils.js', () => ({
    showToast: jest.fn(),
    isValidUrl: jest.fn(),
    escapeHtml: jest.fn(s => s),
    escapeAttr: jest.fn(s => s)
}));

jest.unstable_mockModule('../../js/renderer.js', () => ({
    generateTagsHtml: jest.fn(() => '<span>tag</span>'),
    generateStatusBadgeHtml: jest.fn(() => '<span>online</span>'),
    RATING_LABELS: { 1: '1星', 2: '2星', 3: '3星', 4: '4星', 5: '5星' }
}));

// Now import the tested modules
const { showToast, isValidUrl } = await import('../../js/utils.js');
const { recordToolClick, setToolRating } = await import('../../js/state.js');
const { openTool, rateTool } = await import('../../js/tool.js');

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// openTool
// ---------------------------------------------------------------------------

describe('openTool', () => {
    beforeEach(() => {
        window.open = jest.fn();
    });

    function createEvent() {
        return { stopPropagation: jest.fn() };
    }

    test('should validate URL, record click, and open valid URL', () => {
        isValidUrl.mockReturnValue(true);
        const event = createEvent();

        openTool(1, 'https://example.com', event);

        expect(event.stopPropagation).toHaveBeenCalled();
        expect(isValidUrl).toHaveBeenCalledWith('https://example.com');
        expect(recordToolClick).toHaveBeenCalledWith(1);
        expect(window.open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer');
        expect(showToast).not.toHaveBeenCalled();
    });

    test('should show error toast for invalid URL and not record click', () => {
        isValidUrl.mockReturnValue(false);
        const event = createEvent();

        openTool(1, 'javascript:alert(1)', event);

        expect(event.stopPropagation).toHaveBeenCalled();
        expect(isValidUrl).toHaveBeenCalledWith('javascript:alert(1)');
        expect(recordToolClick).not.toHaveBeenCalled();
        expect(window.open).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('无效的工具链接');
    });

    test('should not open window for empty URL', () => {
        isValidUrl.mockReturnValue(false);
        const event = createEvent();

        openTool(1, '', event);

        expect(isValidUrl).toHaveBeenCalledWith('');
        expect(window.open).not.toHaveBeenCalled();
        expect(showToast).toHaveBeenCalledWith('无效的工具链接');
    });
});

// ---------------------------------------------------------------------------
// rateTool
// ---------------------------------------------------------------------------

describe('rateTool', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="toolStarRating" data-tool-id="1">
                <button class="star-btn"></button>
                <button class="star-btn"></button>
                <button class="star-btn"></button>
                <button class="star-btn"></button>
                <button class="star-btn"></button>
            </div>
            <span id="ratingText">点击评分</span>
        `;
    });

    test('should do nothing if star rating container is missing', () => {
        document.body.innerHTML = '';
        expect(() => rateTool(3)).not.toThrow();
    });

    test('should set rating and update star display', () => {
        rateTool(4);

        expect(setToolRating).toHaveBeenCalledWith(1, 4);

        const stars = document.querySelectorAll('.star-btn');
        expect(stars[0].classList.contains('active')).toBe(true);
        expect(stars[1].classList.contains('active')).toBe(true);
        expect(stars[2].classList.contains('active')).toBe(true);
        expect(stars[3].classList.contains('active')).toBe(true);
        expect(stars[4].classList.contains('active')).toBe(false);
    });

    test('should update rating text', () => {
        rateTool(3);

        const ratingText = document.getElementById('ratingText');
        expect(ratingText.textContent).toBe('3星');
    });

    test('should update rating text for max rating', () => {
        rateTool(5);

        const ratingText = document.getElementById('ratingText');
        expect(ratingText.textContent).toBe('5星');
    });

    test('should show toast with rating feedback', () => {
        rateTool(4);

        expect(showToast).toHaveBeenCalledWith('已评分 4 星 ⭐');
    });

    test('should do nothing if data-tool-id is missing', () => {
        const container = document.getElementById('toolStarRating');
        container.dataset.toolId = '';

        rateTool(3);

        expect(setToolRating).not.toHaveBeenCalled();
        expect(showToast).not.toHaveBeenCalled();
    });

    test('should clear previous star highlights when re-rating', () => {
        rateTool(5);
        jest.clearAllMocks();
        rateTool(2);

        const stars = document.querySelectorAll('.star-btn');
        expect(stars[0].classList.contains('active')).toBe(true);
        expect(stars[1].classList.contains('active')).toBe(true);
        expect(stars[2].classList.contains('active')).toBe(false);
        expect(stars[3].classList.contains('active')).toBe(false);
        expect(stars[4].classList.contains('active')).toBe(false);
    });
});
