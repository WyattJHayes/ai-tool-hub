'use client';

import { Download, FilePlus2, RefreshCw } from 'lucide-react';
import type { ResumeStorageIssue } from '@/features/resume/store';

interface ResumeStorageAlertProps {
  issue: ResumeStorageIssue;
  busy: boolean;
  onDownload: () => void;
  onRetry: () => void;
  onReset: () => void;
}

const ISSUE_MESSAGES: Record<ResumeStorageIssue['code'], string> = {
  malformed: '本地简历数据格式损坏。原始数据已保留，处理前不会被新编辑覆盖。',
  unsupported: '本地简历来自尚不支持的版本。原始数据已保留，处理前不会被新编辑覆盖。',
  'normalization-failed': '本地简历暂时无法转换。原始数据已保留，处理前不会被新编辑覆盖。',
  'read-failed': '无法读取浏览器中的本地简历。请检查浏览器存储权限后重试。',
  'write-failed': '本地保存失败。当前页面中的内容尚未安全写入浏览器。',
  'remove-failed': '无法重置浏览器中的本地简历。原始数据仍保留在浏览器中。',
};

export function ResumeStorageAlert({
  issue,
  busy,
  onDownload,
  onRetry,
  onReset,
}: ResumeStorageAlertProps) {
  const canRetry = ['read-failed', 'write-failed', 'remove-failed'].includes(issue.code);

  return (
    <section className="resume-storage-alert" role="alert" aria-labelledby="resume-storage-alert-title">
      <div>
        <p>LOCAL RECOVERY / 01</p>
        <h2 id="resume-storage-alert-title">本地简历需要处理</h2>
        <span>{ISSUE_MESSAGES[issue.code]}</span>
      </div>
      <div className="resume-storage-alert__actions">
        {canRetry ? (
          <button type="button" onClick={onRetry} disabled={busy}>
            <RefreshCw aria-hidden="true" />重试本地存储
          </button>
        ) : null}
        <button type="button" onClick={onDownload} disabled={busy || !issue.recoverable}>
          <Download aria-hidden="true" />下载原始数据
        </button>
        {issue.blocking ? (
          <button type="button" onClick={onReset} disabled={busy}>
            <FilePlus2 aria-hidden="true" />保留备份并新建
          </button>
        ) : null}
      </div>
    </section>
  );
}
