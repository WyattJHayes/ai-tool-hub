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
import { useRouter } from 'next/navigation';
import { AuthModal } from '@/components/auth/AuthModal';
import { resumeApi } from '@/features/resume/api';
import { exportResumePdf } from '@/features/resume/pdf';
import { useResumeStore } from '@/features/resume/store';
import {
  createPendingResumeActionController,
  createSaveStatusController,
  type PendingResumeAction,
} from '@/features/resume/ui';
import type { ResumeDocumentV1, ResumeQuotaSummary } from '@/features/resume/types';
import { useUserStore } from '@/stores/useUserStore';
import { AIPanel } from './AIPanel';
import { ImportDialog } from './ImportDialog';
import { QuotaDrawer } from './QuotaDrawer';
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
  const router = useRouter();
  const document = useResumeStore(state => state.document);
  const saveState = useResumeStore(state => state.saveState);
  const undo = useResumeStore(state => state.undo);
  const isLoggedIn = useUserStore(state => state.isLoggedIn);
  const deferredDocument = useDeferredValue(document);
  const [view, setView] = useState<ResumeView>('edit');
  const [importOpen, setImportOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<ResumeSaveStatus>('saved');
  const [importUndoAvailable, setImportUndoAvailable] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [authContext, setAuthContext] = useState<string | undefined>();
  const [quotaOpen, setQuotaOpen] = useState(false);
  const [quota, setQuota] = useState<ResumeQuotaSummary | null>(null);
  const [resumedAction, setResumedAction] = useState<{
    id: number;
    action: Exclude<PendingResumeAction, { kind: 'open-quota' }>;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const actionIdRef = useRef(0);
  const pendingActionController = useMemo(() => createPendingResumeActionController(), []);
  const saveController = useMemo(() => createSaveStatusController(setSaveStatus, {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
  }), []);

  useEffect(() => () => saveController.dispose(), [saveController]);
  useEffect(() => () => pendingActionController.clear(), [pendingActionController]);

  const refreshQuota = useCallback(() => {
    if (!useUserStore.getState().isLoggedIn) return;
    void resumeApi.getQuota().then(setQuota).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isLoggedIn) refreshQuota();
  }, [isLoggedIn, refreshQuota]);

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

  const dispatchProtectedAction = useCallback((action: PendingResumeAction) => {
    if (action.kind === 'open-quota') {
      setQuotaOpen(true);
      return;
    }
    actionIdRef.current += 1;
    setResumedAction({ id: actionIdRef.current, action });
  }, []);

  const requestProtectedAction = useCallback((action: PendingResumeAction) => {
    if (!useUserStore.getState().isLoggedIn) {
      pendingActionController.defer(action);
      setAuthContext(action.kind === 'open-quota' ? '登录后查看配额与订单' : '登录后继续本次 AI 操作');
      setAuthOpen(true);
      return;
    }
    dispatchProtectedAction(action);
  }, [dispatchProtectedAction, pendingActionController]);

  const handleAuthenticated = useCallback(() => {
    pendingActionController.resume(dispatchProtectedAction);
  }, [dispatchProtectedAction, pendingActionController]);

  const handleAuthClose = useCallback(() => {
    pendingActionController.clear();
    setAuthOpen(false);
    setAuthContext(undefined);
  }, [pendingActionController]);

  const handleAccount = useCallback(() => {
    if (useUserStore.getState().isLoggedIn) {
      router.push('/user');
      return;
    }
    pendingActionController.clear();
    setAuthContext('登录或注册账户');
    setAuthOpen(true);
  }, [pendingActionController, router]);

  const effectiveQuota = isLoggedIn ? quota : null;
  const quotaLabel = effectiveQuota?.remaining === null && effectiveQuota ? '不限' : String(effectiveQuota?.remaining ?? '--');

  return (
    <main className="resume-page carbon-tool-surface">
      <ResumeToolbar
        document={document}
        saveStatus={saveStatus}
        exporting={exporting}
        onDocumentChange={commitDocument}
        onImport={() => setImportOpen(true)}
        onExport={handleExport}
        onQuota={() => requestProtectedAction({ kind: 'open-quota' })}
        onAccount={handleAccount}
        quotaLabel={quotaLabel}
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
          <AIPanel
            document={document}
            authenticated={isLoggedIn}
            quota={effectiveQuota}
            resumedAction={resumedAction}
            onRequireAuthentication={requestProtectedAction}
            onResumedActionConsumed={id => setResumedAction(current => current?.id === id ? null : current)}
            onSettled={refreshQuota}
            onOpenQuota={() => requestProtectedAction({ kind: 'open-quota' })}
          />
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
      <QuotaDrawer
        open={quotaOpen}
        onClose={() => setQuotaOpen(false)}
        quota={effectiveQuota}
        onQuotaChange={setQuota}
      />
      <AuthModal
        isOpen={authOpen}
        onClose={handleAuthClose}
        onAuthenticated={handleAuthenticated}
        contextLabel={authContext}
      />
    </main>
  );
}
