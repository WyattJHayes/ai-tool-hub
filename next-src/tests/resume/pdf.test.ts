import assert from 'node:assert/strict';
import test from 'node:test';
import { exportResumePdf, inspectA4 } from '../../src/features/resume/pdf';

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

test('treats hidden text as an empty page when innerText is available', () => {
  assert.deepEqual(inspectA4(preview([page({ innerText: '', textContent: 'hidden' })])), {
    ok: false,
    reasons: ['empty-page'],
  });
});

test('accepts bounded A4 pages that contain visible text', () => {
  assert.deepEqual(inspectA4(preview([page(), page()])), { ok: true, reasons: [] });
});

test('waits for fonts then renders A4 pages in order with sanitized output names', async () => {
  let releaseFonts: (() => void) | undefined;
  const fontsReady = new Promise<void>(resolve => { releaseFonts = resolve; });
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { fonts: { ready: fontsReady } },
  });

  const calls: string[] = [];
  const firstPage = page({ innerText: 'First' });
  const secondPage = page({ innerText: 'Second' });
  const firstPageElement = firstPage as unknown as HTMLElement;
  const loadDependencies = async () => ({
    renderPage: async (element: HTMLElement, options: { scale: number }) => {
      const pageName = element === firstPageElement ? 'first' : 'second';
      calls.push(`render:${pageName}:${options.scale}`);
      return { width: 10, height: 10, toDataURL: () => `image:${pageName}` };
    },
    createPdf: (options: { orientation: string; unit: string; format: string }) => {
      calls.push(`create:${options.format}:${options.orientation}:${options.unit}`);
      return {
        addPage: (format: string, orientation: string) => calls.push(`page:${format}:${orientation}`),
        addImage: (image: string) => calls.push(`image:${image}`),
        save: (name: string) => calls.push(`save:${name}`),
      };
    },
  });

  try {
    const exported = exportResumePdf(preview([firstPage, secondPage]), '../Wei Jiahao?.pdf', loadDependencies);
    await Promise.resolve();
    assert.deepEqual(calls, []);
    releaseFonts?.();
    await exported;
    assert.deepEqual(calls, [
      'create:a4:portrait:mm',
      'render:first:2',
      'image:image:first',
      'page:a4:portrait',
      'render:second:2',
      'image:image:second',
      'save:WeiJiahao.pdf',
    ]);

    calls.length = 0;
    await exportResumePdf(preview([firstPage]), '???', loadDependencies);
    assert.equal(calls.at(-1), 'save:resume.pdf');
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('removes preview-only zoom in the html2canvas clone before rendering', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { fonts: { ready: Promise.resolve() } },
  });
  const clonedPreview = { style: { position: 'absolute', zoom: '0.68' } };

  try {
    await exportResumePdf(preview([page()]), 'resume', async () => ({
      renderPage: async (_element, options: {
        onclone?: (clonedDocument: Document) => void;
      }) => {
        options.onclone?.({
          querySelector: (selector: string) => {
            assert.equal(selector, '.resume-preview-document');
            return clonedPreview;
          },
        } as unknown as Document);
        return { width: 10, height: 10, toDataURL: () => 'image:page' };
      },
      createPdf: () => ({
        addPage: () => undefined,
        addImage: () => undefined,
        save: () => undefined,
      }),
    }));

    assert.deepEqual(clonedPreview.style, { position: 'static', zoom: '1' });
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('refuses an invalid preview before loading PDF dependencies', async () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { fonts: { ready: Promise.resolve() } },
  });

  let loaded = false;
  try {
    await assert.rejects(
      () => exportResumePdf(preview([page({ innerText: '', textContent: 'hidden' })]), '???', async () => {
        loaded = true;
        throw new Error('must not load');
      }),
      /empty-page/,
    );
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
  assert.equal(loaded, false);
});
