import { normalizeResumeDocument } from './schema';
import type { ResumeDocumentV1 } from './types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 50_000;
const ACCEPTED = new Set(['pdf', 'docx', 'txt', 'html', 'htm', 'md', 'markdown']);

export type ExtractedResumeKind = 'pdf' | 'docx' | 'txt' | 'html' | 'htm' | 'md' | 'markdown';

export interface ExtractedResumeText {
  fileName: string;
  kind: ExtractedResumeKind;
  text: string;
}

export type ResumeTextExtractor = (file: File) => Promise<string>;
export type ResumeTextExtractors = Record<ExtractedResumeKind, ResumeTextExtractor>;

export class ResumeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResumeImportError';
  }
}

export async function extractResumeFile(
  file: File,
  extractors: ResumeTextExtractors = browserExtractors,
): Promise<ExtractedResumeText> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'doc') throw new ResumeImportError('请将 .doc 文件另存为 .docx 后重试');
  if (!ACCEPTED.has(extension)) throw new ResumeImportError('支持 PDF、DOCX、TXT、HTML 和 Markdown');
  if (file.size > MAX_FILE_BYTES) throw new ResumeImportError('文件不能超过 10 MB');

  const text = await extractors[extension as ExtractedResumeKind](file);
  if (!text.trim()) throw new ResumeImportError('文件没有可提取文本；扫描版 PDF 请先进行 OCR');

  return {
    fileName: file.name,
    kind: extension as ExtractedResumeKind,
    text: text.slice(0, MAX_EXTRACTED_CHARACTERS),
  };
}

const browserExtractors: ResumeTextExtractors = {
  pdf: extractPdfText,
  docx: extractDocxText,
  txt: file => file.text(),
  html: extractHtmlText,
  htm: extractHtmlText,
  md: file => file.text(),
  markdown: file => file.text(),
};

async function extractPdfText(file: File): Promise<string> {
  // This module and its worker are loaded only after a user selects a PDF in the browser.
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });

  try {
    const document = await loadingTask.promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
    }
    return pages.join('\n');
  } finally {
    await loadingTask.destroy();
  }
}

async function extractDocxText(file: File): Promise<string> {
  // mammoth extracts raw text rather than rendering document markup.
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

async function extractHtmlText(file: File): Promise<string> {
  if (typeof DOMParser === 'undefined') {
    throw new ResumeImportError('HTML 简历只能在浏览器中导入');
  }
  const document = new DOMParser().parseFromString(await file.text(), 'text/html');
  return document.body.textContent ?? '';
}

const SECTION_HEADINGS = /^(experience|work experience|professional experience|employment|工作经历|工作经验|经历|education|教育背景|教育经历|skills?|technical skills?|技能|专业技能|certificates?|证书)$/i;
const EXPERIENCE_HEADINGS = /^(experience|work experience|professional experience|employment|工作经历|工作经验|经历)$/i;
const EDUCATION_HEADINGS = /^(education|教育背景|教育经历)$/i;
const SKILLS_HEADINGS = /^(skills?|technical skills?|技能|专业技能)$/i;
const DATE_RANGE = /(\d{4}[./-]\d{1,2}|\d{4}|present|current|至今)\s*(?:-|–|—|~|至)\s*(\d{4}[./-]\d{1,2}|\d{4}|present|current|至今)/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/;

/** Converts inert, locally extracted text into the canonical resume document without network access. */
export function parseResumeTextLocally(text: string): ResumeDocumentV1 {
  const lines = text
    .slice(0, MAX_EXTRACTED_CHARACTERS)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const email = text.match(EMAIL)?.[0] ?? '';
  const phone = text.match(PHONE)?.[0] ?? '';
  const fullName = lines.find(line => (
    !EMAIL.test(line) && !PHONE.test(line) && !SECTION_HEADINGS.test(line) && line.length <= 80
  )) ?? '';

  return normalizeResumeDocument({
    schemaVersion: 1,
    name: fullName ? `${fullName} 的简历` : 'Imported resume',
    profile: { fullName, email, phone },
    experience: parseExperience(sectionLines(lines, EXPERIENCE_HEADINGS)),
    education: parseEducation(sectionLines(lines, EDUCATION_HEADINGS)),
    skills: parseSkills(sectionLines(lines, SKILLS_HEADINGS)),
  });
}

function sectionLines(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex(line => heading.test(line));
  if (start < 0) return [];
  const endOffset = lines.slice(start + 1).findIndex(line => SECTION_HEADINGS.test(line));
  return endOffset < 0 ? lines.slice(start + 1) : lines.slice(start + 1, start + 1 + endOffset);
}

function parseDateRange(value: string): [string, string] {
  const match = value.match(DATE_RANGE);
  return match ? [match[1], match[2]] : ['', ''];
}

function parseExperience(lines: string[]): Array<Record<string, string>> {
  const entries: Array<Record<string, string>> = [];
  for (const line of lines) {
    const parts = line.split('|').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const [startDate, endDate] = parseDateRange(parts.join(' '));
      entries.push({
        company: parts[0],
        role: parts[1],
        startDate,
        endDate,
        description: parts.slice(3).join(' '),
      });
    } else if (entries.length) {
      const previous = entries.at(-1)!;
      previous.description = [previous.description, line].filter(Boolean).join('\n');
    }
  }
  return entries;
}

function parseEducation(lines: string[]): Array<Record<string, string>> {
  return lines.flatMap(line => {
    const parts = line.split('|').map(part => part.trim()).filter(Boolean);
    if (parts.length < 2) return [];
    const [startDate, endDate] = parseDateRange(parts.join(' '));
    return [{ school: parts[0], major: parts[1], degree: parts[2] ?? '', startDate, endDate }];
  });
}

function parseSkills(lines: string[]): string[] {
  return lines
    .flatMap(line => line.split(/[,，;；|]/))
    .map(skill => skill.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 100);
}
