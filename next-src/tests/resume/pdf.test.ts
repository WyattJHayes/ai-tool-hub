import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectA4 } from '../../src/features/resume/pdf';

interface FakeElement {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
  innerText: string;
  textContent: string | null;
  querySelectorAll: (selector: string) => FakeElement[];
}

function page(overrides: Partial<FakeElement> = {}): FakeElement {
  return {
    clientWidth: 794,
    scrollWidth: 794,
    clientHeight: 1123,
    scrollHeight: 1123,
    innerText: 'Visible resume text',
    textContent: 'Visible resume text',
    querySelectorAll: () => [],
    ...overrides,
  };
}

function preview(pages: FakeElement[], overrides: Partial<FakeElement> = {}): HTMLElement {
  return {
    ...page({
      querySelectorAll: (selector) => {
        assert.equal(selector, '[data-resume-page]');
        return pages;
      },
    }),
    ...overrides,
  } as unknown as HTMLElement;
}

test('returns overflow-x when the preview is wider than its client boundary', () => {
  assert.deepEqual(inspectA4(preview([page()], { clientWidth: 794, scrollWidth: 795 })), {
    ok: false,
    reasons: ['overflow-x'],
  });
});

test('returns overflow-y when a rendered page exceeds its fixed boundary', () => {
  assert.deepEqual(inspectA4(preview([page({ clientHeight: 1123, scrollHeight: 1124 })])), {
    ok: false,
    reasons: ['overflow-y'],
  });
});

test('returns empty-page when a page has no visible text', () => {
  assert.deepEqual(inspectA4(preview([page({ innerText: '   ', textContent: '   ' })])), {
    ok: false,
    reasons: ['empty-page'],
  });
});

test('accepts bounded A4 pages that contain visible text', () => {
  assert.deepEqual(inspectA4(preview([page(), page()])), { ok: true, reasons: [] });
});
