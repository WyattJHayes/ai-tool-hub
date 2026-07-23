'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  FileDown,
  Gauge,
  Upload,
  UserRound,
} from 'lucide-react';
import type { ResumeDocumentV1 } from '@/features/resume/types';

export type ResumeSaveStatus = 'unsaved' | 'saving' | 'saved' | 'error';

const SAVE_STATUS_LABELS: Record<ResumeSaveStatus, string> = {
  unsaved: '未保存',
  saving: '保存中',
  saved: '已保存',
  error: '保存失败',
};

interface ResumeToolbarProps {
  document: ResumeDocumentV1;
  saveStatus: ResumeSaveStatus;
  exporting: boolean;
  onDocumentChange: (document: ResumeDocumentV1) => void;
  onImport: () => void;
  onExport: () => void;
  onQuota: () => void;
  onAccount: () => void;
  quotaLabel: string;
}

export function ResumeToolbar({
  document,
  saveStatus,
  exporting,
  onDocumentChange,
  onImport,
  onExport,
  onQuota,
  onAccount,
  quotaLabel,
}: ResumeToolbarProps) {
  const updateTemplate = (templateId: ResumeDocumentV1['templateId']) => {
    if (templateId !== document.templateId) onDocumentChange({ ...document, templateId });
  };

  return (
    <header className="resume-toolbar" aria-label="简历工具栏">
      <div className="resume-toolbar__identity">
        <Link href="/" className="resume-icon-control" aria-label="返回首页" title="返回首页">
          <ArrowLeft aria-hidden="true" />
        </Link>
        <label className="resume-name-field">
          <span className="sr-only">简历名称</span>
          <input
            value={document.name}
            onChange={(event) => onDocumentChange({ ...document, name: event.target.value })}
            maxLength={120}
            aria-label="简历名称"
          />
        </label>
        <output
          className="resume-save-status"
          data-status={saveStatus}
          aria-live="polite"
        >
          {SAVE_STATUS_LABELS[saveStatus]}
        </output>
      </div>

      <div className="resume-toolbar__actions">
        <button type="button" className="resume-command" onClick={onImport} title="导入简历">
          <Upload aria-hidden="true" />
          <span>导入</span>
        </button>

        <div className="resume-template-control" role="group" aria-label="简历模板">
          <button
            type="button"
            aria-pressed={document.templateId === 'precision'}
            onClick={() => updateTemplate('precision')}
          >
            精密
          </button>
          <button
            type="button"
            aria-pressed={document.templateId === 'classic'}
            onClick={() => updateTemplate('classic')}
          >
            经典
          </button>
        </div>

        <button
          type="button"
          className="resume-command resume-command--accent"
          onClick={onExport}
          disabled={exporting}
          title="导出 PDF"
        >
          <FileDown aria-hidden="true" />
          <span>{exporting ? '导出中' : 'PDF'}</span>
        </button>

        <button
          type="button"
          className="resume-shell-control"
          aria-label={`查看配额，当前 ${quotaLabel}`}
          onClick={onQuota}
          title="配额"
        >
          <Gauge aria-hidden="true" />
          <span>{quotaLabel}</span>
        </button>
        <button
          type="button"
          className="resume-icon-control"
          aria-label="账户"
          onClick={onAccount}
          title="账户"
        >
          <UserRound aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
