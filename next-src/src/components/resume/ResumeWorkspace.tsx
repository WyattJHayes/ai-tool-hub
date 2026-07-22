'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from 'react';
import { FileDown, Upload } from 'lucide-react';
import { exportResumePdf } from '@/features/resume/pdf';
import { useResumeStore } from '@/features/resume/store';
import type { ResumeDocumentV1 } from '@/features/resume/types';
import { ImportDialog } from './ImportDialog';
import { ResumeEditor } from './ResumeEditor';
import { ResumePreview } from './ResumePreview';
import { ResumeToolbar, type ResumeSaveStatus } from './ResumeToolbar';

type ResumeView = 'edit' | 'preview';

function pdfErrorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : '';
  if (message.includes('overflow-x')) {
    return 'PDF 导出已停止：预览存在横向溢出，请缩短过长内容后重试。';
  }
  if (message.includes('overflow-y')) {
    return 'PDF 导出已停止：内容超出 A4 页面，请精简内容或切换模板后重试。';
  }
  if (message.includes('empty-page')) {
    return 'PDF 导出已停止：预览中存在空白页，请补充内容后重试。';
  }
  return 'PDF 导出失败，请检查预览后重试。';
}

export function ResumeWorkspace() {
  const document = useResumeStore(state => state.document);
  const saveState = useResumeStore(state => state.saveState);
  const deferredDocument = useDeferredValue(document);
  const [view, setView] = useState<ResumeView>('edit');
  const [importOpen, setImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ResumeSaveStatus>('saved');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const savedTimerRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
  }, []);

  const handleSaveStatusChange = useCallback((status: ResumeSaveStatus) => {
    if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    if (status === 'saved') {
      savedTimerRef.current = window.setTimeout(() => setSaveStatus('saved'), 220);
      return;
    }
    setSaveStatus(status);
  }, []);

  const commitDocument = useCallback((nextDocument: ResumeDocumentV1) => {
    setSaveStatus('unsaved');
    handleSaveStatusChange('saving');
    try {
      saveState(nextDocument);
      handleSaveStatusChange('saved');
    } catch {
      handleSaveStatusChange('error');
    }
  }, [handleSaveStatusChange, saveState]);

  const handleExport = useCallback(async () => {
    if (!previewRef.current || exporting) return;
    setExportError('');
    setExporting(true);
    try {
      await exportResumePdf(previewRef.current, document.name);
    } catch (reason) {
      setExportError(pdfErrorMessage(reason));
    } finally {
      setExporting(false);
    }
  }, [document.name, exporting]);

  return (
    <main className="resume-page carbon-tool-surface">
      <ResumeToolbar
        document={document}
        saveStatus={saveStatus}
        exporting={exporting}
        onDocumentChange={commitDocument}
        onImport={() => setImportOpen(true)}
        onExport={handleExport}
      />

      <div className="resume-mobile-segments" role="group" aria-label="工作区视图">
        <button type="button" aria-pressed={view === 'edit'} onClick={() => setView('edit')}>编辑</button>
        <button type="button" aria-pressed={view === 'preview'} onClick={() => setView('preview')}>预览</button>
      </div>

      {exportError ? <p className="resume-workspace-error" role="alert">{exportError}</p> : null}

      <div className="resume-workspace">
        <section className="resume-pane resume-pane--editor" data-active={view === 'edit' ? 'true' : 'false'} aria-label="编辑面板">
          <ResumeEditor document={document} onSaveStatusChange={handleSaveStatusChange} />
        </section>
        <section className="resume-pane resume-pane--preview" data-active={view === 'preview' ? 'true' : 'false'} aria-label="预览面板">
          <ResumePreview ref={previewRef} document={deferredDocument} />
        </section>
      </div>

      <div className="resume-mobile-action" aria-label="当前视图主要操作">
        {view === 'edit' ? (
          <button type="button" onClick={() => setImportOpen(true)}><Upload aria-hidden="true" />导入简历</button>
        ) : (
          <button type="button" onClick={handleExport} disabled={exporting}><FileDown aria-hidden="true" />{exporting ? '导出中' : '导出 PDF'}</button>
        )}
      </div>

      <ImportDialog
        open={importOpen}
        currentDocument={document}
        onClose={() => setImportOpen(false)}
        onImported={() => handleSaveStatusChange('saved')}
      />
    </main>
  );
}
