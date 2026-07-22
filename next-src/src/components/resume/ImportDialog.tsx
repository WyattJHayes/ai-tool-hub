'use client';

import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { FileText, LoaderCircle, Upload, X } from 'lucide-react';
import {
  extractResumeFile,
  parseResumeTextLocally,
  type ExtractedResumeText,
} from '@/features/resume/importer';
import { useResumeStore } from '@/features/resume/store';
import type { ResumeDocumentV1 } from '@/features/resume/types';

interface ImportDialogProps {
  open: boolean;
  currentDocument: ResumeDocumentV1;
  onClose: () => void;
  onImported: () => void;
}

interface ImportPreview {
  extracted: ExtractedResumeText;
  document: ResumeDocumentV1;
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function mergeResumeDocuments(current: ResumeDocumentV1, imported: ResumeDocumentV1): ResumeDocumentV1 {
  return {
    ...current,
    name: current.name === 'Untitled resume' ? imported.name : current.name,
    profile: {
      ...current.profile,
      fullName: current.profile.fullName || imported.profile.fullName,
      phone: current.profile.phone || imported.profile.phone,
      email: current.profile.email || imported.profile.email,
      location: current.profile.location || imported.profile.location,
      title: current.profile.title || imported.profile.title,
    },
    target: current.target || imported.target,
    summary: current.summary || imported.summary,
    experience: [...current.experience, ...imported.experience],
    projects: [...current.projects, ...imported.projects],
    education: [...current.education, ...imported.education],
    skills: uniqueText([...current.skills, ...imported.skills]),
    certificates: uniqueText([...current.certificates, ...imported.certificates]),
  };
}

function importFieldCount(document: ResumeDocumentV1): number {
  return [
    document.profile.fullName,
    document.profile.phone,
    document.profile.email,
    document.profile.location,
    document.profile.title,
    document.target,
    document.summary,
    ...document.experience,
    ...document.projects,
    ...document.education,
    ...document.skills.filter(Boolean),
    ...document.certificates.filter(Boolean),
  ].filter(Boolean).length;
}

export function ImportDialog({ open, currentDocument, onClose, onImported }: ImportDialogProps) {
  const stageImport = useResumeStore(state => state.stageImport);
  const acceptStagedImport = useResumeStore(state => state.acceptStagedImport);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onClose, open]);

  if (!open) return null;

  const resetAndClose = () => {
    setPreview(null);
    setError('');
    setBusy(false);
    onClose();
  };

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !busy) resetAndClose();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const extracted = await extractResumeFile(file);
      const document = parseResumeTextLocally(extracted.text);
      setPreview({ extracted, document });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '文件解析失败，请检查文件后重试');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const confirmImport = (mode: 'merge' | 'replace') => {
    if (!preview) return;
    const candidate = mode === 'merge'
      ? mergeResumeDocuments(currentDocument, preview.document)
      : preview.document;
    stageImport(candidate);
    acceptStagedImport();
    onImported();
    resetAndClose();
  };

  return (
    <div className="resume-dialog-backdrop" onMouseDown={handleBackdrop}>
      <section
        className="resume-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-import-title"
      >
        <header className="resume-import-dialog__header">
          <div>
            <p>LOCAL / IMPORT</p>
            <h2 id="resume-import-title">导入简历</h2>
          </div>
          <button type="button" onClick={resetAndClose} className="resume-icon-control" aria-label="关闭导入窗口" title="关闭" disabled={busy}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="resume-import-dialog__body">
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept=".pdf,.docx,.txt,.html,.htm,.md,.markdown"
            onChange={handleFile}
          />

          {!preview ? (
            <button
              type="button"
              className="resume-file-picker"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {busy ? <LoaderCircle className="resume-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              <span>{busy ? '正在读取文件' : '选择文件'}</span>
              <small>PDF / DOCX / TXT / HTML / MD · 10 MB</small>
            </button>
          ) : (
            <div className="resume-import-summary">
              <FileText aria-hidden="true" />
              <div>
                <strong>{preview.extracted.fileName}</strong>
                <span>{preview.extracted.kind.toUpperCase()} · {importFieldCount(preview.document)} 个已识别字段</span>
                <span>本地规则解析 · 需要人工核对</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}>重选</button>
            </div>
          )}

          {error ? <p className="resume-inline-error" role="alert">{error}</p> : null}

          {preview ? (
            <dl className="resume-import-fields">
              <div><dt>姓名</dt><dd>{preview.document.profile.fullName || '未识别'}</dd></div>
              <div><dt>邮箱</dt><dd>{preview.document.profile.email || '未识别'}</dd></div>
              <div><dt>工作经历</dt><dd>{preview.document.experience.length} 项</dd></div>
              <div><dt>教育经历</dt><dd>{preview.document.education.length} 项</dd></div>
              <div><dt>技能</dt><dd>{preview.document.skills.filter(Boolean).length} 项</dd></div>
            </dl>
          ) : null}
        </div>

        <footer className="resume-import-dialog__actions">
          <button type="button" onClick={resetAndClose} disabled={busy}>取消</button>
          <button type="button" onClick={() => confirmImport('merge')} disabled={!preview || busy}>合并</button>
          <button type="button" className="resume-command--accent" onClick={() => confirmImport('replace')} disabled={!preview || busy}>替换</button>
        </footer>
      </section>
    </div>
  );
}
