/**
 * state.js 测试文件
 * Tests state management, favorites, ratings, data import/export
 */
import { jest } from '@jest/globals';

// Polyfill for TextEncoder/TextDecoder in jsdom environment
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import state, {
    updateData,
    getTools,
    getCategoryName,
    isFavorite,
    toggleFavorite,
    addToSearchHistory,
    recordToolClick,
    getToolClickCount,
    getPopularTools,
    setToolRating,
    getToolRating,
    getAverageRating,
    getRatedToolsCount,
    exportUserData,
    importUserData,
    safeJsonParse,
    migrateState
} from '../../js/state.js';

// Sample test data
const sampleTools = [
    { id: 1, name: 'Tool A', category: 'writing', icon: 'fa-pen' },
    { id: 2, name: 'Tool B', category: 'writing', icon: 'fa-pen' },
    { id: 3, name: 'Tool C', category: 'image', icon: 'fa-image' },
    { id: 4, name: 'Tool D', category: 'code', icon: 'fa-code' }
];

const sampleCategories = [
    { id: 'writing', name: '写作' },
    { id: 'image', name: '图片' },
    { id: 'code', name: '编程' }
];

// Reset state before each test
beforeEach(() => {
    state.tools = [];
    state.categories = [];
    state.currentCategory = 'all';
    state.favorites = [];
    state.clickStats = {};
    state.ratings = {};
    state.searchHistory = [];
    localStorage.clear();
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// updateData & getTools
// ---------------------------------------------------------------------------

describe('updateData and getTools', () => {
    test('updateData should set tools and categories', () => {
        updateData(sampleTools, sampleCategories);
        expect(state.tools).toHaveLength(4);
        expect(state.categories).toHaveLength(3);
    });

    test('getTools should return all tools when category is "all"', () => {
        updateData(sampleTools, sampleCategories);
        expect(getTools('all')).toHaveLength(4);
        expect(getTools()).toHaveLength(4);
    });

    test('getTools should filter by category', () => {
        updateData(sampleTools, sampleCategories);
        expect(getTools('writing')).toHaveLength(2);
        expect(getTools('image')).toHaveLength(1);
        expect(getTools('code')).toHaveLength(1);
    });

    test('getTools should return empty array for non-existent category', () => {
        updateData(sampleTools, sampleCategories);
        expect(getTools('nonexistent')).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// getCategoryName
// ---------------------------------------------------------------------------

describe('getCategoryName', () => {
    test('should return category name by ID', () => {
        updateData(sampleTools, sampleCategories);
        expect(getCategoryName('writing')).toBe('写作');
        expect(getCategoryName('image')).toBe('图片');
        expect(getCategoryName('code')).toBe('编程');
    });

    test('should return empty string for non-existent category', () => {
        updateData(sampleTools, sampleCategories);
        expect(getCategoryName('unknown')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

describe('favorites', () => {
    beforeEach(() => {
        updateData(sampleTools, sampleCategories);
    });

    test('isFavorite should return false initially', () => {
        expect(isFavorite(1)).toBe(false);
    });

    test('toggleFavorite should add tool to favorites', () => {
        const result = toggleFavorite(1);
        expect(result).toBe(true);
        expect(isFavorite(1)).toBe(true);
        expect(state.favorites).toContain(1);
    });

    test('toggleFavorite should remove tool from favorites', () => {
        toggleFavorite(1);
        expect(isFavorite(1)).toBe(true);

        const result = toggleFavorite(1);
        expect(result).toBe(false);
        expect(isFavorite(1)).toBe(false);
        expect(state.favorites).not.toContain(1);
    });

    test('toggleFavorite should persist to localStorage', () => {
        toggleFavorite(1);
        const saved = JSON.parse(localStorage.getItem('ai-tool-hub-favorites'));
        expect(saved).toContain(1);
    });

    test('should handle multiple favorites', () => {
        toggleFavorite(1);
        toggleFavorite(2);
        toggleFavorite(3);
        expect(state.favorites).toHaveLength(3);
        expect(isFavorite(1)).toBe(true);
        expect(isFavorite(2)).toBe(true);
        expect(isFavorite(3)).toBe(true);
        expect(isFavorite(4)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Search History
// ---------------------------------------------------------------------------

describe('searchHistory', () => {
    beforeEach(() => {
        state.searchHistory = [];
    });

    test('addToSearchHistory should add a term', () => {
        addToSearchHistory('AI 写作');
        expect(state.searchHistory).toContain('AI 写作');
    });

    test('addToSearchHistory should not add duplicates', () => {
        addToSearchHistory('chatgpt');
        addToSearchHistory('chatgpt');
        expect(state.searchHistory).toHaveLength(1);
    });

    test('addToSearchHistory should persist to localStorage', () => {
        addToSearchHistory('test term');
        const saved = JSON.parse(localStorage.getItem('ai-tool-hub-search-history'));
        expect(saved).toContain('test term');
    });

    test('addToSearchHistory should limit to 10 items', () => {
        for (let i = 0; i < 15; i++) {
            addToSearchHistory(`term${i}`);
        }
        expect(state.searchHistory.length).toBeLessThanOrEqual(10);
        // Should keep the newest (last 10)
        expect(state.searchHistory[0]).toBe('term14');
    });
});

// ---------------------------------------------------------------------------
// Click Statistics
// ---------------------------------------------------------------------------

describe('click statistics', () => {
    beforeEach(() => {
        updateData(sampleTools, sampleCategories);
    });

    test('recordToolClick should increment click count', () => {
        recordToolClick(1);
        expect(getToolClickCount(1)).toBe(1);
    });

    test('recordToolClick should increment on multiple clicks', () => {
        recordToolClick(1);
        recordToolClick(1);
        recordToolClick(1);
        expect(getToolClickCount(1)).toBe(3);
    });

    test('getToolClickCount should return 0 for unclicked tools', () => {
        expect(getToolClickCount(999)).toBe(0);
    });

    test('getPopularTools should sort by click count', () => {
        recordToolClick(1);
        recordToolClick(1);
        recordToolClick(1);
        recordToolClick(3);
        recordToolClick(3);

        const popular = getPopularTools();
        expect(popular[0].id).toBe(1);
        expect(popular[1].id).toBe(3);
    });

    test('recordToolClick should save to localStorage on every 5th click', () => {
        jest.useFakeTimers();

        for (let i = 0; i < 5; i++) {
            recordToolClick(1);
        }

        const saved = JSON.parse(localStorage.getItem('ai-tool-hub-click-stats'));
        expect(saved['1']).toBe(5);
    });

    test('recordToolClick should debounce non-batch saves', () => {
        jest.useFakeTimers();

        recordToolClick(1);
        recordToolClick(1);

        // Should not have saved yet (debounced)
        let saved = localStorage.getItem('ai-tool-hub-click-stats');
        expect(saved).toBeNull();

        // Advance time to trigger debounced save
        jest.advanceTimersByTime(2500);
        saved = JSON.parse(localStorage.getItem('ai-tool-hub-click-stats'));
        expect(saved['1']).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

describe('ratings', () => {
    beforeEach(() => {
        updateData(sampleTools, sampleCategories);
    });

    test('getToolRating should return 0 for unrated tools', () => {
        expect(getToolRating(1)).toBe(0);
    });

    test('setToolRating should set rating', () => {
        const result = setToolRating(1, 4);
        expect(result).toBe(4);
        expect(getToolRating(1)).toBe(4);
    });

    test('setToolRating should clamp out-of-range ratings', () => {
        setToolRating(1, 0);
        expect(getToolRating(1)).toBe(1);
        setToolRating(2, 6);
        expect(getToolRating(2)).toBe(5);
    });

    test('setToolRating should save to localStorage (debounced)', () => {
        jest.useFakeTimers();

        setToolRating(1, 5);
        jest.advanceTimersByTime(1000);

        const saved = JSON.parse(localStorage.getItem('ai-tool-hub-ratings'));
        expect(saved['1']).toBe(5);
    });

    test('getAverageRating should calculate correctly', () => {
        setToolRating(1, 5);
        setToolRating(2, 3);
        setToolRating(3, 4);

        expect(getAverageRating()).toBe(4); // (5+3+4)/3 = 4.0
    });

    test('getAverageRating should return 0 when no ratings exist', () => {
        expect(getAverageRating()).toBe(0);
    });

    test('getRatedToolsCount should return correct count', () => {
        expect(getRatedToolsCount()).toBe(0);
        setToolRating(1, 4);
        expect(getRatedToolsCount()).toBe(1);
        setToolRating(2, 5);
        expect(getRatedToolsCount()).toBe(2);
    });
});

// ---------------------------------------------------------------------------
// Data Export / Import
// ---------------------------------------------------------------------------

describe('data export and import', () => {
    beforeEach(() => {
        updateData(sampleTools, sampleCategories);
        state.favorites = [1, 3];
        state.ratings = { 2: 4, 4: 5 };
        state.clickStats = { 1: 10, 2: 5 };
        state.searchHistory = ['tool1', 'tool2'];
    });

    test('exportUserData should produce valid JSON', () => {
        const json = exportUserData();
        const parsed = JSON.parse(json);
        expect(parsed.version).toBe('2.0');
        expect(parsed.favorites).toEqual([1, 3]);
        expect(parsed.ratings).toEqual({ 2: 4, 4: 5 });
        expect(parsed.exportDate).toBeDefined();
    });

    test('importUserData should merge favorites', () => {
        const testData = JSON.stringify({
            version: '2.0',
            favorites: [2, 4],
            ratings: {},
            clickStats: {},
            searchHistory: []
        });

        const result = importUserData(testData);
        expect(result.success).toBe(true);
        expect(state.favorites).toEqual([1, 3, 2, 4]);
    });

    test('importUserData should merge ratings', () => {
        const testData = JSON.stringify({
            version: '2.0',
            favorites: [],
            ratings: { 1: 3, 3: 5 },
            clickStats: {},
            searchHistory: []
        });

        importUserData(testData);
        expect(state.ratings).toEqual({ 1: 3, 2: 4, 3: 5, 4: 5 });
    });

    test('importUserData should reject invalid data', () => {
        const result = importUserData('not json');
        expect(result.success).toBe(false);
        expect(result.message).toContain('失败');
    });

    test('importUserData should reject data without version', () => {
        const result = importUserData(JSON.stringify({ favorites: [] }));
        expect(result.success).toBe(false);
    });

    test('importUserData should filter invalid ratings', () => {
        const testData = JSON.stringify({
            version: '2.0',
            favorites: [],
            ratings: { 1: 'bad', 2: 999, 3: 3 },
            clickStats: {},
            searchHistory: []
        });

        importUserData(testData);
        // 3 is valid, 1 and 2 should be filtered out
        expect(state.ratings[3]).toBe(3);
        // 1 had rating 'bad' (string) -> filtered out, stays undefined
        expect(state.ratings[1]).toBe(undefined);
        // 2 had rating 999 (out of range) -> filtered out, keeps original 4 from beforeEach
        expect(state.ratings[2]).toBe(4);
    });

    test('importUserData should merge click stats', () => {
        const testData = JSON.stringify({
            version: '2.0',
            favorites: [],
            ratings: {},
            clickStats: { 1: 5, 3: 20 },
            searchHistory: []
        });

        importUserData(testData);
        // Import keeps the higher local click count when the import has an older value.
        // 3 had 0, import has 20 -> becomes 20
        expect(getToolClickCount(1)).toBe(10);
        expect(getToolClickCount(3)).toBe(20);
    });
});

// ---------------------------------------------------------------------------
// safeJsonParse
// ---------------------------------------------------------------------------

describe('safeJsonParse', () => {
    test('should parse valid JSON from localStorage', () => {
        localStorage.setItem('test-key', JSON.stringify({ a: 1 }));
        const result = safeJsonParse('test-key', {});
        expect(result).toEqual({ a: 1 });
    });

    test('should return default for missing key', () => {
        const result = safeJsonParse('non-existent', []);
        expect(result).toEqual([]);
    });

    test('should return default for invalid JSON', () => {
        localStorage.setItem('bad-key', 'not json');
        const result = safeJsonParse('bad-key', 'fallback');
        expect(result).toBe('fallback');
    });

    test('should clean up corrupted data on parse failure', () => {
        localStorage.setItem('corrupt', '{broken');
        safeJsonParse('corrupt', null);
        expect(localStorage.getItem('corrupt')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// migrateState
// ---------------------------------------------------------------------------

describe('migrateState', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should migrate from v0 to v2, cleaning invalid click-stats', () => {
        // Set up v0 data (no version marker)
        localStorage.setItem('ai-tool-hub-favorites', JSON.stringify([1, 2, 'invalid']));
        localStorage.setItem('ai-tool-hub-ratings', JSON.stringify({ 1: 5, 2: 'bad' }));
        localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify({ 1: 10, 2: -5, 3: 0 }));

        migrateState();

        expect(localStorage.getItem('ai-tool-hub-state-version')).toBe('2');
        // v1 migration: favorites converted (keeps all items, even 'invalid')
        // v2 migration: click-stats cleaned (filters out non-numbers and negatives)
        const savedStats = JSON.parse(localStorage.getItem('ai-tool-hub-click-stats'));
        expect(savedStats[1]).toBe(10);  // valid, kept
        expect(savedStats[2]).toBeUndefined();  // -5, filtered out
        expect(savedStats[3]).toBe(0);  // 0, kept
    });

    test('should migrate from v1 to v2, cleaning click-stats', () => {
        localStorage.setItem('ai-tool-hub-state-version', '1');
        localStorage.setItem('ai-tool-hub-favorites', JSON.stringify([1, 2]));
        localStorage.setItem('ai-tool-hub-ratings', JSON.stringify({}));
        localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify({ 1: 10, 2: -5, 3: 'abc' }));

        migrateState();

        expect(localStorage.getItem('ai-tool-hub-state-version')).toBe('2');
        const savedStats = JSON.parse(localStorage.getItem('ai-tool-hub-click-stats'));
        expect(savedStats[1]).toBe(10);
        expect(savedStats[2]).toBeUndefined();  // negative, filtered out
        expect(savedStats[3]).toBeUndefined();  // string, filtered out
    });

    test('should not re-migrate if already at current version', () => {
        localStorage.setItem('ai-tool-hub-state-version', '2');
        localStorage.setItem('ai-tool-hub-click-stats', JSON.stringify({ 1: 999, 2: -99 }));

        migrateState();

        // No migration should happen - negative values should be preserved
        const savedStats = JSON.parse(localStorage.getItem('ai-tool-hub-click-stats'));
        expect(savedStats[2]).toBe(-99);  // preserved because no migration
    });
});
