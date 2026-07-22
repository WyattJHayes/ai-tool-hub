'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Sparkles, Square, X } from 'lucide-react';
import { ClientResumeApiError, resumeApi } from '@/features/resume/api';
import { normalizeResumeDocument } from '@/features/resume/schema';
import { useResumeStore } from '@/features/resume/store';
import { computeResumeChanges, type PendingResumeAction } from '@/features/resume/ui';
import type { JDAnalysis, OptimizationLevel, ResumeChange, ResumeDocumentV1, ResumeQuotaSummary } from '@/features/resume/types';

type AIState = 'idle' | 'validating' | 'reserving' | 'streaming' | 'review' | 'error';

interface ResumedAIAction {
  id: number;
  action: Exclude<PendingResumeAction, { kind: 'open-quota' }>;
}

interface AIPanelProps {
  document: ResumeDocumentV1;
  authenticated: boolean;
  quota: ResumeQuotaSummary | null;
  resumedAction: ResumedAIAction | null;
  onRequireAuthentication: (action: Exclude<PendingResumeAction, { kind: 'open-quota' }>) => void;
  onResumedActionConsumed: (id: number) => void;
  onSettled: () => void;
  onOpenQuota: () => void;
}

const LEVELS: Array<{ value: OptimizationLevel; label: string }> = [
  { value: 'light', label: '轻度优化' },
  { value: 'medium', label: '中度优化' },
  { value: 'deep', label: '深度优化' },
];

const FIELD_LABELS: Record<string, string> = {
  fullName: '姓名', phone: '电话', email: '邮箱', location: '所在地', title: '职位',
  target: '目标职位', summary: '个人总结', company: '公司', role: '角色', startDate: '开始时间',
  endDate: '结束时间', description: '内容', name: '项目', school: '学校', major: '专业', degree: '学历',
};

const COLLECTION_LABELS: Record<string, string> = {
  experience: '工作经历', projects: '项目经历', education: '教育经历', skills: '技能', certificates: '证书与补充',
};

function displayChangeValue(change: ResumeChange, value: string): string {
  if (change.field !== 'items') return value || '（空）';
  try {
    const items: unknown = JSON.parse(value);
    if (!Array.isArray(items) || items.length === 0) return '（空）';
    if (items.every(item => typeof item === 'string')) return items.join('、');
    return items.map(item => {
      if (!item || typeof item !== 'object') return String(item);
      return Object.entries(item)
        .filter(([key, fieldValue]) => key !== 'id' && typeof fieldValue === 'string' && fieldValue.trim())
        .map(([, fieldValue]) => fieldValue)
        .join(' · ');
    }).filter(Boolean).join('\n');
  } catch {
    return value || '（空）';
  }
}

function aiErrorMessage(reason: unknown): string {
  if (reason instanceof ClientResumeApiError) {
    if (reason.code === 'QUOTA_EXHAUSTED') return '当前额度不足，请查看配额。';
    if (reason.code === 'REQUEST_CANCELLED') return '本次 AI 操作已取消，当前简历未改变。';
    if (reason.code === 'STREAM_INCOMPLETE') return 'AI 输出未完成，未生成可应用的修改。';
  }
  return 'AI 操作未完成，当前简历未改变。';
}

export function AIPanel({
  document,
  authenticated,
  quota,
  resumedAction,
  onRequireAuthentication,
  onResumedActionConsumed,
  onSettled,
  onOpenQuota,
}: AIPanelProps) {
  const changes = useResumeStore(state => state.changes);
  const setChanges = useResumeStore(state => state.setChanges);
  const acceptChange = useResumeStore(state => state.acceptChange);
  const acceptAllChanges = useResumeStore(state => state.acceptAllChanges);
  const rejectChange = useResumeStore(state => state.rejectChange);
  const [state, setState] = useState<AIState>('idle');
  const [jobDescription, setJobDescription] = useState('');
  const [progress, setProgress] = useState('');
  const [tokens, setTokens] = useState('');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<JDAnalysis | null>(null);
  const [resultScore, setResultScore] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resumedIdRef = useRef<number | null>(null);
  const documentRef = useRef(document);
  const hasJobDescription = Boolean(jobDescription.trim());
  const busy = ['validating', 'reserving', 'streaming'].includes(state);
  const actionsDisabled = busy || state === 'review';
  const quotaLabel = quota?.remaining === null && quota ? '不限' : quota?.remaining ?? '--';

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  const stageCandidate = useCallback((candidate: ResumeDocumentV1, score?: number) => {
    const normalized = normalizeResumeDocument(candidate);
    const nextChanges = computeResumeChanges(documentRef.current, normalized);
    if (!nextChanges.length) {
      setState('error');
      setError('AI 已完成，但没有可审阅的字段修改。');
      return;
    }
    setChanges(nextChanges);
    setResultScore(score ?? null);
    setState('review');
  }, [setChanges]);

  const execute = useCallback(async (action: Exclude<PendingResumeAction, { kind: 'open-quota' }>) => {
    if (!authenticated) {
      onRequireAuthentication(action);
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setState('validating');
    setError('');
    setProgress('正在校验本地输入');
    setTokens('');
    try {
      if ((action.kind === 'analyze-jd' || (action.kind === 'optimize' && action.level !== 'light')) && !jobDescription.trim()) {
        throw new Error('JD_REQUIRED');
      }
      setState('reserving');
      setProgress('正在预留 1 次额度');
      if (action.kind === 'parse') {
        stageCandidate(await resumeApi.parseResume(JSON.stringify(documentRef.current), controller.signal));
      } else if (action.kind === 'analyze-jd') {
        setAnalysis(await resumeApi.analyzeJobDescription(jobDescription, controller.signal));
        setState('idle');
        setProgress('JD 分析完成');
      } else {
        const result = await resumeApi.streamOptimize(
          action.level,
          JSON.stringify(documentRef.current),
          jobDescription,
          {
            onProgress: value => {
              setState('streaming');
              setProgress(value.status === 'analyzing' ? '正在分析简历结构' : '正在生成优化建议');
            },
            onToken: value => {
              setState('streaming');
              setTokens(current => `${current}${value.content}`.slice(-600));
            },
          },
          controller.signal,
        );
        stageCandidate(result.optimizedData, result.score);
      }
    } catch (reason) {
      if (reason instanceof Error && reason.message === 'JD_REQUIRED') {
        setError('中度和深度优化需要先填写职位描述。');
      } else if (reason instanceof ClientResumeApiError && reason.code === 'AUTH_REQUIRED') {
        setState('idle');
        onRequireAuthentication(action);
        return;
      } else {
        setError(aiErrorMessage(reason));
      }
      setState('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      onSettled();
    }
  }, [authenticated, jobDescription, onRequireAuthentication, onSettled, stageCandidate]);

  useEffect(() => {
    if (!resumedAction || resumedIdRef.current === resumedAction.id) return;
    resumedIdRef.current = resumedAction.id;
    onResumedActionConsumed(resumedAction.id);
    void execute(resumedAction.action);
  }, [execute, onResumedActionConsumed, resumedAction]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const closeReview = () => {
    for (const change of useResumeStore.getState().changes) {
      if (!change.accepted) rejectChange(change.id);
    }
    setState('idle');
    setResultScore(null);
  };

  return (
    <section className="resume-ai-panel" aria-labelledby="resume-ai-title">
      <header className="resume-ai-panel__header">
        <div><p>AI ASSIST / 01</p><h2 id="resume-ai-title"><Sparkles aria-hidden="true" />AI 优化</h2></div>
        <button type="button" className="resume-ai-quota" onClick={onOpenQuota}>额度 {quotaLabel}</button>
      </header>

      <label className="resume-ai-jd">
        职位描述（JD）
        <textarea value={jobDescription} onChange={event => setJobDescription(event.target.value)} rows={4} maxLength={10_000} placeholder="粘贴目标岗位要求" />
      </label>

      <div className="resume-ai-utility-actions">
        <button type="button" onClick={() => void execute({ kind: 'parse' })} disabled={actionsDisabled}>AI 解析当前简历</button>
        <button type="button" onClick={() => void execute({ kind: 'analyze-jd' })} disabled={actionsDisabled || !hasJobDescription}>分析 JD</button>
      </div>

      <div className="resume-ai-levels" role="group" aria-label="优化级别">
        {LEVELS.map(level => (
          <button
            type="button"
            key={level.value}
            onClick={() => void execute({ kind: 'optimize', level: level.value })}
            disabled={actionsDisabled || (level.value !== 'light' && !hasJobDescription)}
          >
            <strong>{level.label}</strong><span>每次 1 次额度</span>
          </button>
        ))}
      </div>

      <div className="resume-ai-progress" aria-live="polite" aria-atomic="true" data-state={state}>
        <span>{progress || '等待操作'}</span>
        {busy ? <button type="button" onClick={() => abortRef.current?.abort()}><Square aria-hidden="true" />取消</button> : null}
      </div>
      {tokens && state === 'streaming' ? <p className="resume-ai-stream" aria-label="AI 流式进度">{tokens}</p> : null}
      {analysis ? <p className="resume-ai-analysis">已识别岗位：{analysis.jobTitle || '未命名岗位'} · {analysis.keywords.length} 个关键词</p> : null}
      {error ? <p className="resume-inline-error" role="alert">{error}</p> : null}

      {state === 'review' ? (
        <section className="resume-diff-review" aria-labelledby="resume-diff-title">
          <header><div><p>{resultScore === null ? 'AI DIFF' : `AI SCORE ${resultScore}`}</p><h3 id="resume-diff-title">修改审阅</h3></div><button type="button" onClick={closeReview} aria-label="关闭修改审阅"><X aria-hidden="true" /></button></header>
          <div className="resume-diff-actions"><button type="button" onClick={acceptAllChanges}><Check aria-hidden="true" />全部接受</button><button type="button" onClick={closeReview}>拒绝未应用修改</button></div>
          <ul>
            {changes.map(change => (
              <li key={change.id} data-accepted={change.accepted ? 'true' : 'false'}>
                <div><strong>{change.field === 'items' ? COLLECTION_LABELS[change.section] : FIELD_LABELS[change.field] ?? change.field}</strong><span>{displayChangeValue(change, change.before)}</span><span>{displayChangeValue(change, change.after)}</span></div>
                <div className="resume-diff-row-actions">
                  <button type="button" onClick={() => acceptChange(change.id)} disabled={change.accepted}>接受</button>
                  <button type="button" onClick={() => rejectChange(change.id)} disabled={change.accepted}>拒绝</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
