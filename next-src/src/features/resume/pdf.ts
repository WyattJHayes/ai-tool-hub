export type A4InspectionReason = 'overflow-x' | 'overflow-y' | 'empty-page';

export interface A4Inspection {
  ok: boolean;
  reasons: A4InspectionReason[];
}

export interface ResumePdfCanvas {
  width: number;
  height: number;
  toDataURL: (type: string) => string;
}

export interface ResumePdfDocument {
  addPage: (format: 'a4', orientation: 'portrait') => void;
  addImage: (image: string, format: 'PNG', x: number, y: number, width: number, height: number) => void;
  save: (fileName: string) => void;
}

export interface ResumePdfDependencies {
  renderPage: (
    page: HTMLElement,
    options: {
      scale: number;
      backgroundColor: string;
      useCORS: boolean;
      onclone: (clonedDocument: Document) => void;
    },
  ) => Promise<ResumePdfCanvas>;
  createPdf: (options: { orientation: 'portrait'; unit: 'mm'; format: 'a4' }) => ResumePdfDocument;
}

export type ResumePdfDependencyLoader = () => Promise<ResumePdfDependencies>;

export class ResumePdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumePdfError';
  }
}

export function inspectA4(element: HTMLElement): A4Inspection {
  const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-resume-page]'));
  const reasons = new Set<A4InspectionReason>();

  if (element.scrollWidth > element.clientWidth || pages.some(page => page.scrollWidth > page.clientWidth)) {
    reasons.add('overflow-x');
  }
  if (pages.some(page => page.scrollHeight > page.clientHeight)) reasons.add('overflow-y');
  if (!pages.length || pages.some(page => !visiblePageText(page).trim())) {
    reasons.add('empty-page');
  }

  return { ok: reasons.size === 0, reasons: [...reasons] };
}

function visiblePageText(page: HTMLElement): string {
  const innerText = (page as HTMLElement & { innerText?: string }).innerText;
  return typeof innerText === 'string' ? innerText : page.textContent ?? '';
}

function preparePdfClone(clonedDocument: Document): void {
  const previewDocument = clonedDocument.querySelector<HTMLElement>('.resume-preview-document');
  if (!previewDocument) return;
  previewDocument.style.position = 'static';
  previewDocument.style.transform = 'none';
}

export async function exportResumePdf(
  element: HTMLElement,
  fileName: string,
  loadDependencies: ResumePdfDependencyLoader = loadResumePdfDependencies,
): Promise<void> {
  if (typeof document === 'undefined') throw new ResumePdfError('PDF 导出只能在浏览器中使用');
  await document.fonts?.ready;

  const inspection = inspectA4(element);
  if (!inspection.ok) {
    throw new ResumePdfError(`简历预览无法导出：${inspection.reasons.join(', ')}`);
  }

  const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-resume-page]'));
  const dependencies = await loadDependencies();
  const pdf = dependencies.createPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (const [index, page] of pages.entries()) {
    if (index > 0) pdf.addPage('a4', 'portrait');
    const canvas = await dependencies.renderPage(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      onclone: preparePdfClone,
    });
    if (!canvas.width || !canvas.height) throw new ResumePdfError('简历页面无法渲染');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
  }

  pdf.save(sanitizePdfFileName(fileName));
}

async function loadResumePdfDependencies(): Promise<ResumePdfDependencies> {
  // Browser-only libraries remain behind this callable boundary for SSR safety.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  return {
    renderPage: (page, options) => html2canvas(page, options),
    createPdf: options => new jsPDF(options),
  };
}

function sanitizePdfFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^\p{L}\p{N}._-]/gu, '').replace(/^\.+/, '');
  if (!sanitized || !/[\p{L}\p{N}]/u.test(sanitized)) return 'resume.pdf';
  return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}
