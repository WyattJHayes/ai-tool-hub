export type A4InspectionReason = 'overflow-x' | 'overflow-y' | 'empty-page';

export interface A4Inspection {
  ok: boolean;
  reasons: A4InspectionReason[];
}

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
  if (!pages.length || pages.some(page => !(page.innerText || page.textContent || '').trim())) {
    reasons.add('empty-page');
  }

  return { ok: reasons.size === 0, reasons: [...reasons] };
}

export async function exportResumePdf(element: HTMLElement, fileName: string): Promise<void> {
  if (typeof document === 'undefined') throw new ResumePdfError('PDF 导出只能在浏览器中使用');
  await document.fonts?.ready;

  const inspection = inspectA4(element);
  if (!inspection.ok) {
    throw new ResumePdfError(`简历预览无法导出：${inspection.reasons.join(', ')}`);
  }

  const pages = Array.from(element.querySelectorAll<HTMLElement>('[data-resume-page]'));
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (const [index, page] of pages.entries()) {
    const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    if (!canvas.width || !canvas.height) throw new ResumePdfError('简历页面无法渲染');
    if (index > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
  }

  pdf.save(sanitizePdfFileName(fileName));
}

function sanitizePdfFileName(fileName: string): string {
  const sanitized = fileName.replace(/[^\p{L}\p{N}._-]/gu, '').replace(/^\.+/, '');
  if (!sanitized || !/[\p{L}\p{N}]/u.test(sanitized)) return 'resume.pdf';
  return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}
