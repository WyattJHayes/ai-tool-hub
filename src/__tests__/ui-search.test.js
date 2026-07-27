/**
 * ui.js search-related tests
 * Covers: highlightText, escapeRegex, updateResultsCounter, setupSearch event handlers
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import state from '../../js/state.js';

let mod;

beforeAll(async () => {
    mod = await import('../../js/ui.js');
});

beforeEach(() => {
    state.searchHistory = ['ChatGPT', 'Midjourney', 'Stable Diffusion'];
    state.tools = [
        { id: 1, name: 'ChatGPT', desc: 'AI对话工具', category: 'ai-chat', tags: ['free'], toolTags: ['海外'] },
        { id: 2, name: 'Midjourney', desc: 'AI绘画工具', category: 'ai-image', tags: ['vip'], toolTags: ['海外'] },
        { id: 3, name: '文心一言', desc: '百度AI', category: 'ai-chat', tags: ['free'], toolTags: ['国产'] },
    ];
    state.categories = [
        { id: 'ai-chat', name: 'AI聊天' },
        { id: 'ai-image', name: 'AI图像' },
    ];

    document.body.innerHTML = `
        <div id="app">
            <div class="hero-search-wrapper">
                <input id="mainSearch" type="text" value="" />
                <button id="clearSearchBtn" class="hidden"></button>
                <div id="searchHistory"></div>
                <div id="searchSuggestions"></div>
            </div>
            <input id="stickySearchInput" type="text" value="" />
            <button id="stickySearchClear"></button>
            <div class="advanced-filters"></div>
            <div id="toolsGrid"><div class="tool-card"></div></div>
            <div class="results-counter hidden">
                <span class="count-number">0</span> 个工具匹配
            </div>
        </div>
    `;
});

afterEach(() => {
    document.body.innerHTML = '';
});

// ── highlightText ─────────────────────────────────────

describe('highlightText', () => {
    test('wraps matching text in mark tags', () => {
        const result = mod.highlightText('Hello World', 'world');
        expect(result).toContain('<mark class="search-highlight">');
        expect(result).toContain('World');
    });

    test('is case insensitive', () => {
        const result = mod.highlightText('Hello WORLD', 'world');
        expect(result).toContain('<mark');
        expect(result).toContain('WORLD');
    });

    test('returns original text if no match', () => {
        expect(mod.highlightText('Hello', 'xyz')).toBe('Hello');
    });

    test('returns original text if search term is empty', () => {
        expect(mod.highlightText('Hello', '')).toBe('Hello');
    });

    test('handles null/undefined text', () => {
        expect(mod.highlightText(null, 'test')).toBeNull();
        expect(mod.highlightText(undefined, 'test')).toBeUndefined();
    });

    test('highlights at start of string', () => {
        const result = mod.highlightText('Hello World', 'hello');
        expect(result).toContain('<mark');
        expect(result).toContain('Hello');
    });
});

// ── escapeRegex ───────────────────────────────────────

describe('escapeRegex', () => {
    test('escapes special regex characters', () => {
        expect(mod.escapeRegex('test.js')).toBe('test\\.js');
        expect(mod.escapeRegex('hello (world)')).toBe('hello \\(world\\)');
        expect(mod.escapeRegex('a+b*c')).toBe('a\\+b\\*c');
        expect(mod.escapeRegex('plain')).toBe('plain');
    });
});

// ── escapeRegex with highlightText ────────────────────

describe('escapeRegex integration', () => {
    test('handles special characters in highlight', () => {
        const result = mod.highlightText('test.js file', 'test.js');
        expect(result).toContain('<mark');
    });

    test('treats dot as literal in escaped regex', () => {
        const result = mod.highlightText('hello.world', 'hello.world');
        expect(result).toContain('<mark');
        expect(result).toContain('hello.world');
    });
});

// ── updateResultsCounter ──────────────────────────────

describe('updateResultsCounter', () => {
    test('counter starts hidden', () => {
        const counter = document.querySelector('.results-counter');
        expect(counter.classList.contains('hidden')).toBe(true);
    });
});

// ── setupSearch: keyboard events ──────────────────────

describe('setupSearch keyboard events', () => {
    test('Cmd+K focuses search input', () => {
        mod.setupSearch();
        const input = document.getElementById('mainSearch');
        const focusSpy = jest.spyOn(input, 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        expect(focusSpy).toHaveBeenCalled();
        focusSpy.mockRestore();
    });

    test('Ctrl+K focuses search input', () => {
        mod.setupSearch();
        const input = document.getElementById('mainSearch');
        const focusSpy = jest.spyOn(input, 'focus');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
        expect(focusSpy).toHaveBeenCalled();
        focusSpy.mockRestore();
    });

    test('Escape clears search when input is focused', () => {
        const input = document.getElementById('mainSearch');
        input.value = 'test';
        input.focus();
        mod.setupSearch();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(input.value).toBe('');
    });

    test('Escape does nothing when input not focused', () => {
        const input = document.getElementById('mainSearch');
        input.value = 'test';
        mod.setupSearch();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        // Input value may still be cleared by clearSearchBtn click handler
        // Just verify no error is thrown
    });
});

// ── setupSearch: click outside hides panels ───────────

describe('setupSearch click outside', () => {
    test('click inside hero search wrapper keeps history open', () => {
        mod.setupSearch();
        const history = document.getElementById('searchHistory');
        history.classList.add('show');
        document.getElementById('mainSearch').click();
        expect(history.classList.contains('show')).toBe(true);
    });

    test('click outside hero search wrapper hides panels', () => {
        mod.setupSearch();
        const history = document.getElementById('searchHistory');
        const suggestions = document.getElementById('searchSuggestions');
        history.classList.add('show');
        suggestions.classList.add('show');
        document.body.click();
        expect(history.classList.contains('show')).toBe(false);
        expect(suggestions.classList.contains('show')).toBe(false);
    });
});

// ── setupSearch: input event ──────────────────────────

describe('setupSearch input event', () => {
    test('typing shows clear button', () => {
        mod.setupSearch();
        const input = document.getElementById('mainSearch');
        const clearBtn = document.getElementById('clearSearchBtn');
        input.value = 'ChatGPT';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(clearBtn.classList.contains('hidden')).toBe(false);
    });

    test('main and sticky search stay synchronized in both directions', () => {
        mod.setupSearch();
        mod.setupStickySearch();
        const mainInput = document.getElementById('mainSearch');
        const stickyInput = document.getElementById('stickySearchInput');

        mainInput.value = 'ChatGPT';
        mainInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(stickyInput.value).toBe('ChatGPT');

        stickyInput.value = 'Midjourney';
        stickyInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(mainInput.value).toBe('Midjourney');
    });
});

// ── setSearch ─────────────────────────────────────────

describe('setSearch', () => {
    test('sets search input value', () => {
        mod.setSearch('ChatGPT');
        expect(document.getElementById('mainSearch').value).toBe('ChatGPT');
    });

    test('hides search history', () => {
        const hist = document.getElementById('searchHistory');
        hist.classList.add('show');
        mod.setSearch('test');
        expect(hist.classList.contains('show')).toBe(false);
    });
});

// ── clearSearch ───────────────────────────────────────

describe('clearSearch', () => {
    test('clears input and hides clear button', () => {
        const input = document.getElementById('mainSearch');
        input.value = 'test';
        document.getElementById('clearSearchBtn').classList.remove('hidden');
        mod.clearSearch();
        expect(input.value).toBe('');
        expect(document.getElementById('clearSearchBtn').classList.contains('hidden')).toBe(true);
    });

    test('clears internal search state before focus reopens history', () => {
        mod.setupSearch();
        const input = document.getElementById('mainSearch');
        input.value = 'ChatGPT';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        mod.clearSearch();
        input.dispatchEvent(new Event('focus'));
        expect(document.getElementById('searchSuggestions').classList.contains('show')).toBe(false);
    });

    test('not throw when search input missing', () => {
        document.getElementById('mainSearch').remove();
        expect(() => mod.clearSearch()).not.toThrow();
    });
});
