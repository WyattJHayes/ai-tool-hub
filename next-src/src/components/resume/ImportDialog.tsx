'use client';

import { useCallback, useEffect, useReducer, useRef, type ChangeEvent, type MouseEvent } from 'react';
import { FileText, LoaderCircle, Sparkles, Upload, X } from 'lucide-react';
import {
  extractResumeFile,
  parseResumeImportWithAI,
  parseResumeTextLocally,
} from '@/features/resume/importer';
import { resumeApi } from '@/features/resume/api';
import { useResumeStore } from '@/features/resume/store';
import {
  countPopulatedResumeFields,
  createResumeImportConfirmation,
  initialImportDialogState,
  reduceImportDialogState,
  trapDialogTabKey,
  type ResumeImportMode,
} from '@/features/resume/ui';
import type { ResumeDocumentV1 } from '@/features/resume/types';
import { useUserStore } from '@/stores/useUserStore';

interface ImportDialogProps {
  open: boolean;
  currentDocument: ResumeDocumentV1;
  onClose: () => void;
  onImported: () => void;
}

export function ImportDialog({ open, currentDocument, onClose, onImported }: ImportDialogProps) {
  const stageImport = useResumeStore(state => state.stageImport);
  const acceptStagedImport = useResumeStore(state => state.acceptStagedImport);
  const isLoggedIn = useUserStore(state => state.isLoggedIn);
  const [state, dispatch] = useReducer(reduceImportDialogState, initialImportDialogState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(state.busy);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    busyRef.current = state.busy;
    onCloseRef.current = onClose;
  }, [onClose, state.busy]);

  const resetAndClose = useCallback(() => {
    dispatch({ type: 'reset' });
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      if (closeButtonRef.current && !closeButtonRef.current.disabled) {
        closeButtonRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault();
        resetAndClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) trapDialogTabKey(event, dialogRef.current);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [open, resetAndClose]);

  if (!open) return null;

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !state.busy) resetAndClose();
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    dispatch({ type: 'start' });
    try {
      const extracted = await extractResumeFile(file);
      const document = parseResumeTextLocally(extracted.text);
      dispatch({ type: 'ready', preview: { extracted, document, parseMethod: 'local', warning: '' } });
    } catch (reason) {
      dispatch({
        type: 'failure',
        error: reason instanceof Error ? reason.message : '文件解析失败，请检查文件后重试',
      });
    } finally {
      event.target.value = '';
    }
  };

  const handleAIParse = async () => {
    if (!state.preview || !isLoggedIn || state.busy) return;
    dispatch({ type: 'set-busy', busy: true });
    const result = await parseResumeImportWithAI(
      state.preview.extracted,
      text => resumeApi.parseResume(text),
    );
    dispatch({
      type: 'ready',
      preview: {
        ...state.preview,
        document: result.document,
        parseMethod: result.method,
        warning: result.warning,
      },
    });
  };

  const importConfirmation = state.preview ? createResumeImportConfirmation(
    currentDocument,
    state.preview.document,
    {
      getState: () => useResumeStore.getState(),
      stageImport,
      acceptStagedImport,
      restoreState: snapshot => useResumeStore.setState(snapshot),
    },
  ) : null;

  const confirmImport = (mode: ResumeImportMode) => {
    if (!importConfirmation || state.busy) return;
    dispatch({ type: 'set-busy', busy: true });
    const result = importConfirmation.confirm(mode);
    if (!result.ok) {
      dispatch({ type: 'failure', error: '导入保存失败，原简历已恢复。请检查浏览器存储空间后重试。' });
      return;
    }
    onImported();
    resetAndClose();
  };

  return (
    <div className="resume-dialog-backdrop" role="presentation" onMouseDown={handleBackdrop}>
      <section
        ref={dialogRef}
        className="resume-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-import-title"
        tabIndex={-1}
      >
        <header className="resume-import-dialog__header">
          <div>
            <p>LOCAL / IMPORT</p>
            <h2 id="resume-import-title">导入简历</h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={resetAndClose} className="resume-icon-control" aria-label="关闭导入窗口" title="关闭" disabled={state.busy}>
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

          {!state.preview ? (
            <button
              type="button"
              className="resume-file-picker"
              onClick={() => fileInputRef.current?.click()}
              disabled={state.busy}
            >
              {state.busy ? <LoaderCircle className="resume-spinner" aria-hidden="true" /> : <Upload aria-hidden="true" />}
              <span>{state.busy ? '正在读取文件' : '选择文件'}</span>
              <small>PDF / DOCX / TXT / HTML / MD · 10 MB</small>
            </button>
          ) : (
            <div className="resume-import-summary">
              <FileText aria-hidden="true" />
              <div>
                <strong>{state.preview.extracted.fileName}</strong>
                <span>{state.preview.extracted.kind.toUpperCase()} · {countPopulatedResumeFields(state.preview.document)} 个已识别内容字段</span>
                <span>{state.preview.parseMethod === 'ai' ? 'AI 结构化解析 · 请人工核对' : '本地规则解析 · 需要人工核对'}</span>
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}>重选</button>
            </div>
          )}

          {state.error ? <p className="resume-inline-error" role="alert">{state.error}</p> : null}
          {state.preview?.warning ? <p className="resume-inline-warning" role="status">{state.preview.warning}</p> : null}

          {state.preview ? (
            <>
              <dl className="resume-import-fields">
                <div><dt>姓名</dt><dd>{state.preview.document.profile.fullName || '未识别'}</dd></div>
                <div><dt>邮箱</dt><dd>{state.preview.document.profile.email || '未识别'}</dd></div>
                <div><dt>工作经历</dt><dd>{state.preview.document.experience.length} 项</dd></div>
                <div><dt>项目经历</dt><dd>{state.preview.document.projects.length} 项</dd></div>
                <div><dt>教育经历</dt><dd>{state.preview.document.education.length} 项</dd></div>
                <div><dt>技能</dt><dd>{state.preview.document.skills.filter(Boolean).length} 项</dd></div>
                <div><dt>证书与补充</dt><dd>{state.preview.document.certificates.filter(Boolean).length} 项</dd></div>
              </dl>

              {isLoggedIn && state.preview.parseMethod !== 'ai' ? (
                <div className="resume-import-ai">
                  <div>
                    <strong>AI 完整解析</strong>
                    <span>补全工作、项目、教育和技能结构 · 1 次额度</span>
                  </div>
                  <button
                    type="button"
                    className="resume-command--accent"
                    onClick={() => void handleAIParse()}
                    disabled={state.busy}
                  >
                    {state.busy ? <LoaderCircle className="resume-spinner" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                    {state.busy ? '解析中' : '开始解析'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="resume-import-dialog__actions">
          <button type="button" onClick={resetAndClose} disabled={state.busy}>取消</button>
          <button type="button" onClick={() => confirmImport('merge')} disabled={!state.preview || state.busy}>合并</button>
          <button type="button" className="resume-command--accent" onClick={() => confirmImport('replace')} disabled={!state.preview || state.busy}>替换</button>
        </footer>
      </section>
    </div>
  );
}
