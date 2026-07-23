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
import { resumeApi, type ResumePlansAvailability } from '@/features/resume/api';
import { exportResumePdf } from '@/features/resume/pdf';
import {
  getResumeStorageRecoveryItem,
  resolveResumeStorageWithEmptyDocument,
  retryResumeStoragePersistence,
  useResumeStorageIssue,
  useResumeStore,
} from '@/features/resume/store';
import {
  createProtectedResumeActionCoordinator,
  createSaveStatusController,
  refreshResumeAccountState,
  type PendingResumeAction,
  type ProtectedResumeActionCoordinator,
  type ProtectedResumeActionContext,
} from '@/features/resume/ui';
import type { ResumeDocumentV1, ResumeQuotaSummary } from '@/features/resume/types';
import { useUserStore } from '@/stores/useUserStore';
import { AIPanel } from './AIPanel';
import { ImportDialog } from './ImportDialog';
import { QuotaDrawer } from './QuotaDrawer';
import { ResumeEditor } from './ResumeEditor';
import { ResumePreview } from './ResumePreview';
import { ResumeStorageAlert } from './ResumeStorageAlert';
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
  const storageIssue = useResumeStorageIssue();
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
  const [availability, setAvailability] = useState<ResumePlansAvailability | null>(null);
  const [accountRefreshing, setAccountRefreshing] = useState(false);
  const [accountRefreshVersion, setAccountRefreshVersion] = useState(0);
  const [storageBusy, setStorageBusy] = useState(false);
  const [jobDescription, setJobDescription] = useState('');
  const [resumedAction, setResumedAction] = useState<{
    id: number;
    action: Exclude<PendingResumeAction, { kind: 'open-quota' }>;
    context: ProtectedResumeActionContext;
  } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const actionIdRef = useRef(0);
  const jobDescriptionRef = useRef('');
  const accountRefreshVersionRef = useRef(0);
  const accountRefreshSequenceRef = useRef(0);
  const actionCoordinatorRef = useRef<ProtectedResumeActionCoordinator | null>(null);
  const saveController = useMemo(() => createSaveStatusController(setSaveStatus, {
    setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimeout: timer => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
  }), []);

  useEffect(() => () => saveController.dispose(), [saveController]);
  const refreshAccount = useCallback(async () => {
    if (!useUserStore.getState().isLoggedIn) return;
    const sequence = ++accountRefreshSequenceRef.current;
    setAccountRefreshing(true);
    setAvailability(null);
    const result = await refreshResumeAccountState(resumeApi, accountRefreshVersionRef.current);
    if (sequence !== accountRefreshSequenceRef.current) return;
    accountRefreshVersionRef.current = result.version;
    setQuota(result.quota);
    setAvailability(result.availability);
    setAccountRefreshVersion(result.version);
    setAccountRefreshing(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void refreshAccount();
    });
    return () => { active = false; };
  }, [isLoggedIn, refreshAccount]);

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

  const dispatchProtectedAction = useCallback((
    action: PendingResumeAction,
    context: ProtectedResumeActionContext,
  ) => {
    if (action.kind === 'open-quota') {
      setQuotaOpen(true);
      return;
    }
    actionIdRef.current += 1;
    setResumedAction({ id: actionIdRef.current, action, context });
  }, []);

  useEffect(() => {
    const coordinator = createProtectedResumeActionCoordinator({
      isAuthenticated: () => useUserStore.getState().isLoggedIn,
      getDocument: () => useResumeStore.getState().document,
      getJobDescription: () => jobDescriptionRef.current,
      onAuthenticationRequired: action => {
        setAuthContext(action.kind === 'open-quota' ? '登录后查看配额与订单' : '登录后继续本次 AI 操作');
        setAuthOpen(true);
      },
      onExecute: dispatchProtectedAction,
    });
    actionCoordinatorRef.current = coordinator;
    return () => {
      coordinator.cancelPending();
      actionCoordinatorRef.current = null;
    };
  }, [dispatchProtectedAction]);

  const requestProtectedAction = useCallback((action: PendingResumeAction) => {
    actionCoordinatorRef.current?.request(action);
  }, []);

  const handleAuthenticated = useCallback(() => {
    actionCoordinatorRef.current?.onAuthenticated();
  }, []);

  const handleAuthClose = useCallback(() => {
    actionCoordinatorRef.current?.cancelPending();
    setAuthOpen(false);
    setAuthContext(undefined);
  }, []);

  const handleAccount = useCallback(() => {
    if (useUserStore.getState().isLoggedIn) {
      router.push('/user');
      return;
    }
    actionCoordinatorRef.current?.cancelPending();
    setAuthContext('登录或注册账户');
    setAuthOpen(true);
  }, [router]);

  const handleJobDescriptionChange = useCallback((value: string) => {
    jobDescriptionRef.current = value;
    setJobDescription(value);
  }, []);

  const handleStorageDownload = useCallback(async () => {
    setStorageBusy(true);
    try {
      const raw = await getResumeStorageRecoveryItem();
      if (raw === null) return;
      const url = URL.createObjectURL(new Blob([raw], { type: 'text/plain;charset=utf-8' }));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = 'weihub-resume-recovery.txt';
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setStorageBusy(false);
    }
  }, []);

  const handleStorageRetry = useCallback(async () => {
    setStorageBusy(true);
    try {
      await retryResumeStoragePersistence();
    } finally {
      setStorageBusy(false);
    }
  }, []);

  const handleStorageReset = useCallback(async () => {
    if (!window.confirm('原始本地数据将保留为恢复备份，并新建一份空白简历。是否继续？')) return;
    setStorageBusy(true);
    try {
      await resolveResumeStorageWithEmptyDocument();
    } finally {
      setStorageBusy(false);
    }
  }, []);

  const effectiveQuota = isLoggedIn ? quota : null;
  const quotaLabel = effectiveQuota?.remaining === null && effectiveQuota ? '不限' : String(effectiveQuota?.remaining ?? '--');

  if (storageIssue?.blocking) {
    return (
      <main className="resume-page carbon-tool-surface">
        <ResumeStorageAlert
          issue={storageIssue}
          busy={storageBusy}
          onDownload={() => void handleStorageDownload()}
          onRetry={() => void handleStorageRetry()}
          onReset={() => void handleStorageReset()}
        />
      </main>
    );
  }

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

      {storageIssue ? (
        <ResumeStorageAlert
          issue={storageIssue}
          busy={storageBusy}
          onDownload={() => void handleStorageDownload()}
          onRetry={() => void handleStorageRetry()}
          onReset={() => void handleStorageReset()}
        />
      ) : null}

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
            jobDescription={jobDescription}
            onJobDescriptionChange={handleJobDescriptionChange}
            onRequireAuthentication={requestProtectedAction}
            onResumedActionConsumed={id => setResumedAction(current => current?.id === id ? null : current)}
            onSettled={refreshAccount}
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
        availability={availability}
        refreshVersion={accountRefreshVersion}
        refreshing={accountRefreshing}
        onRefresh={refreshAccount}
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
