/**
 * research.js DOM-dependent tests
 * Covers: initResearchPage, UI rendering, fetch with mocked calls
 */
import { jest, describe, test, expect, beforeAll, beforeEach } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (!AbortSignal.timeout) {
    AbortSignal.timeout = (ms) => {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), ms);
        return ctrl.signal;
    };
}

const mockShowToast = jest.fn();
jest.unstable_mockModule('../../js/utils.js', () => ({
    showToast: mockShowToast,
    escapeHtml: jest.fn(s => s)
}));

let mod;
let __setFetch;

beforeAll(async () => {
    mod = await import('../../js/research.js');
    __setFetch = mod.__setFetch;
});

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
        <div id="mainContent"></div>
        <div id="toast"><span id="toastMsg"></span></div>
        <textarea id="exportResearchBtn"></textarea>
    `;
});

// ── initResearchPage ─────────────────────────────────────

describe('initResearchPage', () => {
    test('renders research page form into mainContent', () => {
        mod.initResearchPage();
        const content = document.getElementById('mainContent');
        expect(content.innerHTML).toContain('Deep Research');
        expect(content.innerHTML).toContain('fa-microscope');
    });

    test('can be called multiple times without error', () => {
        mod.initResearchPage();
        expect(() => mod.initResearchPage()).not.toThrow();
    });
});

// ── Research page UI elements ────────────────────────────

describe('research page UI elements', () => {
    test('renders topic input field', () => {
        mod.initResearchPage();
        const input = document.getElementById('researchTopicInput');
        expect(input).toBeTruthy();
        expect(input.placeholder).toBeTruthy();
    });

    test('renders start research button', () => {
        mod.initResearchPage();
        const btn = document.getElementById('researchStartBtn');
        expect(btn).toBeTruthy();
        expect(btn.textContent).toContain('开始研究');
    });

    test('renders category and depth selects', () => {
        mod.initResearchPage();
        expect(document.getElementById('researchCategorySelect')).toBeTruthy();
        expect(document.getElementById('researchDepthSelect')).toBeTruthy();
    });

    test('renders example topic buttons', () => {
        mod.initResearchPage();
        const exampleBtns = document.querySelectorAll('.research-example-btn');
        expect(exampleBtns.length).toBeGreaterThan(0);
    });
});

describe('research result security', () => {
    test('sanitizes untrusted result markup before inserting it into the DOM', () => {
        document.body.innerHTML = '<div id="researchResults"></div>';
        mod.renderResearchResults({
            topic: '<img src=x onerror=alert(1)>',
            depth: 'quick',
            report: {
                dateStr: '<img src=x onerror=alert(1)>',
                execSummary: '<img src=x onerror=alert(1)>',
                keyFindings: [],
                sections: [],
            },
            sources: [{ title: 'source', type: 'web', url: 'javascript:alert(1)' }],
        });

        const results = document.getElementById('researchResults');
        expect(results.querySelector('[onerror]')).toBeNull();
        expect(results.querySelector('a')?.getAttribute('href') || '').not.toMatch(/^javascript:/i);
    });
});

// ── Research page event handlers ─────────────────────────

describe('research page event handlers', () => {
    test('clear button clears topic input', () => {
        mod.initResearchPage();
        const input = document.getElementById('researchTopicInput');
        const clearBtn = document.getElementById('researchClearBtn');
        input.value = 'test topic';
        clearBtn.click();
        expect(input.value).toBe('');
    });

    test('Enter key in topic input triggers research', () => {
        mod.initResearchPage();
        const input = document.getElementById('researchTopicInput');
        input.value = 'Quantum Computing';
        // Should not throw
        expect(() => {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        }).not.toThrow();
    });

    test('start with empty topic shows error message', () => {
        mod.initResearchPage();
        const startBtn = document.getElementById('researchStartBtn');
        startBtn.click();
        const errorMsg = document.getElementById('researchErrorMessage');
        expect(errorMsg.textContent).toBe('请输入研究主题');
    });
});

// ── fetchWikipedia with mocked responses ─────────────

describe('fetchWikipedia with mocked responses', () => {
    test('handles disambiguation type response', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ type: 'disambiguation' })
        }));
        const result = await mod.fetchWikipedia('Test');
        expect(result).toBeNull();
    });

    test('handles missing content_urls', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                title: 'Test',
                extract: 'Extract',
                content_urls: null
            })
        }));
        const result = await mod.fetchWikipedia('Test');
        expect(result).toBeTruthy();
        expect(result.url).toContain('en.wikipedia.org');
    });

    test('handles null thumbnail', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                title: 'Test',
                extract: 'Extract',
                content_urls: { desktop: { page: 'https://wiki.com/Test' } },
                thumbnail: null
            })
        }));
        const result = await mod.fetchWikipedia('Test');
        expect(result.thumbnail).toBeNull();
    });
});

describe('fetchWikipediaSearch edge cases', () => {
    test('handles missing query.search', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ query: {} })
        }));
        const result = await mod.fetchWikipediaSearch('Test');
        expect(result).toEqual([]);
    });

    test('handles snippet with HTML tags', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                query: {
                    search: [{ title: 'Result', snippet: '<b>bold</b> text', pageid: 1 }]
                }
            })
        }));
        const result = await mod.fetchWikipediaSearch('Test');
        expect(result[0].snippet).toBe('bold text');
    });
});

describe('fetchDuckDuckGo edge cases', () => {
    test('handles empty RelatedTopics', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                AbstractText: 'Abstract',
                AbstractSource: 'Source',
                AbstractURL: 'https://source.com',
                RelatedTopics: []
            })
        }));
        const result = await mod.fetchDuckDuckGo('Test');
        expect(result.relatedTopics).toEqual([]);
    });

    test('handles missing infobox', async () => {
        __setFetch(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
                AbstractText: 'Abstract',
                Infobox: null
            })
        }));
        const result = await mod.fetchDuckDuckGo('Test');
        expect(result.infobox).toBeNull();
    });
});

// ── generateSubtopics ──────────────────────────────────

describe('generateSubtopics edge cases', () => {
    test('returns 6 subtopics for all categories', () => {
        mod.RESEARCH_CATEGORIES.forEach(cat => {
            const result = mod.generateSubtopics('AI', cat.id);
            expect(result).toHaveLength(6);
        });
    });

    test('generates subtopics with topic prefix', () => {
        const result = mod.generateSubtopics('Quantum Computing', 'technology');
        result.forEach(sub => {
            expect(sub).toContain('Quantum Computing');
        });
    });
});

// ── synthesizeReport (deeper coverage) ─────────────────

describe('synthesizeReport deeper coverage', () => {
    test('produces dateStr in correct format', () => {
        const report = mod.synthesizeReport('AI', null, [], [], null);
        expect(report.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('generates key findings from subtopic findings', () => {
        const findings = [
            { type: 'subtopic', subtopic: 'History', content: 'Long history spanning decades of research and development.' },
            { type: 'subtopic', subtopic: 'Applications', content: 'Many applications across healthcare, finance, and education.' }
        ];
        const report = mod.synthesizeReport('AI', null, findings, [], null);
        expect(report.keyFindings.length).toBeGreaterThan(0);
        expect(report.sections.length).toBeGreaterThan(0);
    });

    test('includes DDG abstract and answer in analysis', () => {
        const report = mod.synthesizeReport(
            'AI',
            'AI overview.',
            [],
            [],
            { abstract: 'DDG abstract', answer: '42', definition: 'Definition', source: 'DDG' }
        );
        expect(report.sections.length).toBeGreaterThan(0);
    });

    test('includes findings from abstract type', () => {
        const report = mod.synthesizeReport(
            'AI',
            null,
            [{ type: 'abstract', content: 'Abstract finding content here.', source: 'Wiki' }],
            [{ title: 'Wiki', url: 'https://wiki.com', type: 'Wikipedia' }],
            null
        );
        expect(report.execSummary).toBeTruthy();
    });
});

// ── generateFullTextReport ─────────────────────────────

describe('generateFullTextReport extended', () => {
    test('handles multiple key findings', () => {
        const result = {
            topic: 'Test',
            depth: 'deep',
            report: {
                dateStr: '2025-01-01',
                execSummary: 'Summary',
                keyFindings: [
                    { label: 'F1', text: 'T1' },
                    { label: 'F2', text: 'T2' },
                    { label: 'F3', text: 'T3' }
                ],
                sections: [{ title: 'S1', content: 'C1' }]
            },
            sources: [
                { title: 'Src1', url: 'https://src1.com', type: 'Wikipedia' }
            ]
        };
        const text = mod.generateFullTextReport(result);
        expect(text).toContain('F1');
        expect(text).toContain('F2');
        expect(text).toContain('F3');
        expect(text).toContain('Src1');
        expect(text).toContain('Deep Research Agent');
    });

    test('handles empty sources array', () => {
        const result = {
            topic: 'Test',
            depth: 'quick',
            report: {
                dateStr: '2025-01-01',
                execSummary: 'Summary',
                keyFindings: [],
                sections: []
            },
            sources: []
        };
        const text = mod.generateFullTextReport(result);
        expect(text).toContain('Test');
    });
});

// ── formatReportContent ────────────────────────────────

describe('formatReportContent edge cases', () => {
    test('handles empty string', () => {
        expect(mod.formatReportContent('')).toBe('');
    });

    test('handles multiple bold markers', () => {
        expect(mod.formatReportContent('**A** and **B** and **C**'))
            .toBe('<strong>A</strong> and <strong>B</strong> and <strong>C</strong>');
    });

    test('handles text without markdown', () => {
        expect(mod.formatReportContent('Plain text')).toBe('Plain text');
    });
});

// ── Init button export ─────────────────────────────────

describe('export default', () => {
    test('default export has initResearchPage', () => {
        expect(mod.default).toHaveProperty('initResearchPage');
        expect(typeof mod.default.initResearchPage).toBe('function');
    });
});
