'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FileDown, Undo2, Upload } from 'lucide-react';
import { exportResumePdf } from '@/features/resume/pdf';
import { useResumeStore } from '@/features/resume/store';
import { createSaveStatusController } from '@/features/resume/ui';
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
  const undo = useResumeStore(state => state.undo);
  const deferredDocument = useDeferredValue(document);
  const [view, setView] = useState<ResumeView>('edit');
  const [importOpen, setImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ResumeSaveStatus>('saved');
  const [importUndoAvailable, setImportUndoAvailable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const saveController = useMemo(() => createSaveStatusController(setSaveStatus, {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
  }), []);

  useEffect(() => () => saveController.dispose(), [saveController]);

  const runMutation = useCallback((mutation: () => void) => {
    setImportUndoAvailable(false);
    saveController.commit(mutation);
  }, [saveController]);

  const commitDocument = useCallback((nextDocument: ResumeDocumentV1) => {
    runMutation(() => saveState(nextDocument));
  }, [runMutation, saveState]);

  const handleImportSuccess = useCallback(() => {
    setImportUndoAvailable(true);
    saveController.commit(() => undefined);
  }, [saveController]);

  const handleUndo = useCallback(() => {
    setImportUndoAvailable(false);
    saveController.commit(() => undo());
  }, [saveController, undo]);

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
      {importUndoAvailable ? (
        <div className="resume-import-undo" role="status">
          <span>简历已导入</span>
          <button type="button" onClick={handleUndo}>
            <Undo2 aria-hidden="true" />
            撤销导入
          </button>
        </div>
      ) : null}

      <div className="resume-workspace">
        <section className="resume-pane resume-pane--editor" data-active={view === 'edit' ? 'true' : 'false'} aria-label="编辑面板">
          <ResumeEditor document={document} onMutation={runMutation} />
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
        onImported={handleImportSuccess}
      />
    </main>
  );
}
