/**
 * app.js extra tests
 * Covers: newToolsCount badge, tools with 'new' tag
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

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

const mockState = { tools: [], categories: [] };
const mockUpdateData = jest.fn((tools, cats) => {
    mockState.tools = tools;
    mockState.categories = cats;
});
jest.unstable_mockModule('../../js/state.js', () => ({
    default: mockState,
    updateData: mockUpdateData,
    PLATFORM_ICONS: { web: 'fa-globe', mobile: 'fa-mobile-alt', desktop: 'fa-desktop', local: 'fa-server' }
}));

jest.unstable_mockModule('../../js/ui.js', () => ({
    renderCategories: jest.fn(),
    renderHotTools: jest.fn(),
    renderStatisticsDashboard: jest.fn(),
    renderTools: jest.fn(),
    loadSavedFilters: jest.fn()
}));

let loadTools;

beforeAll(async () => {
    const appModule = await import('../../js/app.js');
    loadTools = appModule.loadTools;
});

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
        <div id="app">
            <div class="new-tools-badge">
                <span class="new-tools-dot"></span>
                <span>上新 <span id="newToolsCount">0</span> 款</span>
            </div>
            <div id="loadingState"><div class="spinner">Loading...</div></div>
        </div>
    `;
});

afterEach(() => {
    delete global.fetch;
});

describe('newToolsCount badge', () => {
    test('updates count with new tools', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [
                    { id: 1, name: 'Tool A', category: 'writing', tags: ['new'] },
                    { id: 2, name: 'Tool B', category: 'image', tags: ['free'] },
                    { id: 3, name: 'Tool C', category: 'image', tags: ['new', 'hot'] },
                ],
                categories: [{ id: 'writing', name: '写作' }, { id: 'image', name: '图片' }]
            })
        });

        await loadTools();
        const countEl = document.getElementById('newToolsCount');
        expect(countEl.textContent).toBe('2');
    });

    test('shows 0 when no new tools', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [
                    { id: 1, name: 'Tool A', category: 'writing', tags: ['free'] },
                ],
                categories: [{ id: 'writing', name: '写作' }]
            })
        });

        await loadTools();
        const countEl = document.getElementById('newToolsCount');
        expect(countEl.textContent).toBe('0');
    });

    test('hides badge when count is 0', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [{ id: 1, name: 'Tool A', category: 'writing', tags: [] }],
                categories: [{ id: 'writing', name: '写作' }]
            })
        });

        await loadTools();
        const badge = document.querySelector('.new-tools-badge');
        expect(badge.style.display).toBe('none');
    });

    test('shows badge when count > 0', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [
                    { id: 1, name: 'Tool A', category: 'writing', tags: ['new'] },
                    { id: 2, name: 'Tool B', category: 'image', tags: ['new'] },
                ],
                categories: [{ id: 'writing', name: '写作' }, { id: 'image', name: '图片' }]
            })
        });

        await loadTools();
        const badge = document.querySelector('.new-tools-badge');
        expect(badge.style.display).toBe('');
    });

    test('gracefully handles missing newToolsCount element', async () => {
        document.getElementById('newToolsCount').remove();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [{ id: 1, name: 'Tool A', category: 'writing', tags: ['new'] }],
                categories: [{ id: 'writing', name: '写作' }]
            })
        });

        await expect(loadTools()).resolves.toBeUndefined();
    });

    test('handles tools without tags property', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [
                    { id: 1, name: 'Tool A', category: 'writing' },
                    { id: 2, name: 'Tool B', category: 'image', tags: ['new'] },
                ],
                categories: [{ id: 'writing', name: '写作' }, { id: 'image', name: '图片' }]
            })
        });

        await loadTools();
        const countEl = document.getElementById('newToolsCount');
        expect(countEl.textContent).toBe('1');
    });
});

describe('app.js edge cases', () => {
    test('handles missing .new-tools-badge element', async () => {
        document.body.innerHTML = `
            <div id="app">
                <span id="newToolsCount">0</span>
                <div id="loadingState"></div>
            </div>
        `;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                tools: [{ id: 1, name: 'Tool A', category: 'writing', tags: ['new'] }],
                categories: [{ id: 'writing', name: '写作' }]
            })
        });
        await expect(loadTools()).resolves.toBeUndefined();
        const countEl = document.getElementById('newToolsCount');
        expect(countEl.textContent).toBe('1');
    });

    test('retry button click handler works', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        await loadTools();
        const retryBtn = document.getElementById('retryLoadBtn');
        expect(retryBtn).toBeTruthy();
        // Clicking retry button should call loadTools again
        retryBtn.click();
        // fetch should have been called twice (original + retry)
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
