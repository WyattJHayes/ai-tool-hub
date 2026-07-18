/**
 * app.js tests
 * Tests the loadTools function: fetch, data validation, UI rendering,
 * loading state management, error handling with retry.
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing app.js
const mockShowToast = jest.fn();
const mockEscapeHtml = jest.fn(s => s);

jest.unstable_mockModule('../../js/utils.js', () => ({
    showToast: mockShowToast,
    escapeHtml: mockEscapeHtml,
    escapeAttr: mockEscapeHtml
}));

jest.unstable_mockModule('../../js/renderer.js', () => ({
    setupCard3DEffect: jest.fn(),
    setupStatsAnimations: jest.fn()
}));

// Mock state module
const mockState = {
    tools: [],
    categories: []
};

const mockUpdateData = jest.fn((tools, categories) => {
    mockState.tools = tools;
    mockState.categories = categories;
});

jest.unstable_mockModule('../../js/state.js', () => ({
    default: mockState,
    updateData: mockUpdateData,
    PLATFORM_ICONS: { web: 'fa-globe', mobile: 'fa-mobile-alt', desktop: 'fa-desktop', local: 'fa-server' }
}));

// ui.js is dynamically imported inside loadTools, so we mock it
const mockRenderCategories = jest.fn();
const mockRenderHotTools = jest.fn();
const mockRenderStatisticsDashboard = jest.fn();
const mockRenderTools = jest.fn();

jest.unstable_mockModule('../../js/ui.js', () => ({
    renderCategories: mockRenderCategories,
    renderHotTools: mockRenderHotTools,
    renderStatisticsDashboard: mockRenderStatisticsDashboard,
    renderTools: mockRenderTools,
    loadSavedFilters: jest.fn()
}));

let loadTools;

beforeAll(async () => {
    const appModule = await import('../../js/app.js');
    loadTools = appModule.loadTools;
});

beforeEach(() => {
    jest.clearAllMocks();
    // Default fetch mock: successful response with tools data
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            tools: [
                { id: 1, name: 'Tool A', category: 'writing' },
                { id: 2, name: 'Tool B', category: 'image' }
            ],
            categories: [
                { id: 'writing', name: '写作' },
                { id: 'image', name: '图片' }
            ]
        })
    });

    // Reset DOM
    document.body.innerHTML = `
        <div id="app">
            <div id="loadingState">
                <div class="spinner">Loading...</div>
            </div>
        </div>
    `;
});

afterEach(() => {
    delete global.fetch;
});

// ---------------------------------------------------------------------------
// Load Tools - Success Path
// ---------------------------------------------------------------------------

describe('loadTools success path', () => {
    test('should fetch tools.json and update state', async () => {
        await loadTools();

        expect(global.fetch).toHaveBeenCalledWith('./tools.json?v=dev');
        expect(mockUpdateData).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 1 })]),
            expect.arrayContaining([expect.objectContaining({ id: 'writing' })])
        );
    });

    test('should set global tool count for share image', async () => {
        await loadTools();
        expect(window.__AI_TOOL_HUB_COUNT__).toBe(2);
    });

    test('should render categories, hot tools, stats, and tools', async () => {
        await loadTools();

        expect(mockRenderCategories).toHaveBeenCalled();
        expect(mockRenderHotTools).toHaveBeenCalled();
        expect(mockRenderStatisticsDashboard).toHaveBeenCalled();
        expect(mockRenderTools).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 1 })])
        );
    });

    test('should hide loading state on success', async () => {
        await loadTools();

        const loadingState = document.getElementById('loadingState');
        expect(loadingState.classList.contains('hidden')).toBe(true);
    });

    test('should handle missing loadingState element gracefully', async () => {
        document.body.innerHTML = '<div id="app"></div>';

        // Should not throw
        await expect(loadTools()).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Load Tools - Error Handling
// ---------------------------------------------------------------------------

describe('loadTools error handling', () => {
    test('should show toast on network failure', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        await loadTools();

        expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('加载失败'));
    });

    test('should show toast on non-ok response', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({})
        });

        await loadTools();

        expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('404'));
    });

    test('should show toast on invalid data structure', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ invalid: true })
        });

        await loadTools();

        expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('数据结构不正确'));
    });

    test('should reject an HTML fallback before attempting JSON parsing', async () => {
        const parseJson = jest.fn().mockRejectedValue(new SyntaxError("Unexpected token '<'"));
        global.fetch.mockResolvedValue({
            ok: true,
            headers: { get: () => 'text/html; charset=utf-8' },
            json: parseJson
        });

        await loadTools();

        expect(mockShowToast).toHaveBeenCalledWith('加载失败: 工具数据响应格式不正确');
        expect(parseJson).not.toHaveBeenCalled();
    });

    test('should show error UI with retry button on failure', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        await loadTools();

        const loadingState = document.getElementById('loadingState');
        expect(loadingState.innerHTML).toContain('重试');
        expect(loadingState.innerHTML).toContain('加载失败');
        expect(loadingState.innerHTML).toContain('Network error');
    });

    test('should handle missing loadingState during error gracefully', async () => {
        document.body.innerHTML = '<div id="app"></div>';
        global.fetch.mockRejectedValue(new Error('Network error'));

        // Should not throw
        await expect(loadTools()).resolves.toBeUndefined();
    });

    test('retry button should call loadTools again', async () => {
        global.fetch.mockRejectedValue(new Error('Network error'));

        await loadTools();

        const retryBtn = document.getElementById('retryLoadBtn');
        expect(retryBtn).toBeTruthy();

        // Setup next fetch to succeed
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [{ id: 1, name: 'Tool A', category: 'writing' }],
                categories: [{ id: 'writing', name: '写作' }]
            })
        });

        // Click retry
        retryBtn.click();

        // Allow async handlers to settle
        await new Promise(r => setTimeout(r, 10));

        // loadTools should have been called again (fetch called 2nd time)
        expect(global.fetch).toHaveBeenCalledTimes(2);
        // updateData should have been called again
        expect(mockUpdateData).toHaveBeenCalledTimes(1);
    });
});
