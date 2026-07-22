'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Lock, Mail, X } from 'lucide-react';
import { trapDialogTabKey } from '@/features/resume/ui';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
  contextLabel?: string;
}

export function AuthModal({ isOpen, onClose, onAuthenticated, contextLabel }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const login = useUserStore((state) => state.login);
  const migrateFromLocalStorage = useUserStore((state) => state.migrateFromLocalStorage);
  const authenticatedRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    authenticatedRef.current = false;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) trapDialogTabKey(event, dialogRef.current);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      openerRef.current?.focus();
      openerRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    if (!isSupabaseConfigured || !supabase) {
      setError('云同步当前不可用，请稍后重试。');
      setLoading(false);
      return;
    }

    try {
      if (mode === 'register') {
        const { error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) { setError(authError.message); return; }
        setSuccess('注册成功，请查收邮箱确认链接。');
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) { setError(authError.message); return; }
        login();
        migrateFromLocalStorage();
        setSuccess('登录成功');
        if (!authenticatedRef.current) {
          authenticatedRef.current = true;
          onAuthenticated?.();
        }
        closeTimerRef.current = window.setTimeout(() => onCloseRef.current(), 800);
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    setError('');
    setSuccess('');
    const normalizedEmail = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError('请先输入有效邮箱。');
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('云同步当前不可用，请稍后重试。');
      return;
    }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/user`;
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (authError) {
        setError('暂时无法发送重置邮件，请稍后重试。');
        return;
      }
      setSuccess('如果账号存在，重置邮件已发送');
    } catch {
      setError('暂时无法发送重置邮件，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" role="presentation">
      <div ref={dialogRef} className="relative w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.2)]" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1}>
        <button ref={closeButtonRef} type="button" onClick={() => onCloseRef.current()} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" aria-label="关闭登录窗口"><X className="h-4 w-4" /></button>

        <div className="mb-6 pr-10">
          <h2 id="auth-title" className="text-xl font-semibold text-[var(--ink)]">{mode === 'login' ? '登录' : '注册'}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{contextLabel ?? (mode === 'login' ? '同步你的收藏、评分和对比记录' : '创建账号以启用云同步')}</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] p-3 text-xs text-[var(--signal-ink)]"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>云同步服务当前不可用，仍可继续使用本地收藏和评分。</p></div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="auth-email">邮箱</label>
          <div className="relative -mt-2"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-subtle)]" /><input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" /></div>

          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="auth-password">密码</label>
          <div className="relative -mt-2"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-subtle)]" /><input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" /></div>

          {error ? <p className="rounded-md border border-[var(--signal-ink)] bg-[var(--signal-soft)] px-3 py-2 text-xs text-[var(--signal-ink)]">{error}</p> : null}
          {success ? <p className="rounded-md bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--ink)]">{success}</p> : null}

          <button type="submit" disabled={loading || !isSupabaseConfigured} className={cn('flex min-h-12 w-full items-center justify-center rounded-md text-sm font-medium text-[var(--on-accent)]', isSupabaseConfigured ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50' : 'cursor-not-allowed bg-[var(--muted-subtle)]')}>
            {loading ? <><Loader2 className="h-4 w-4" aria-hidden="true" /><span className="sr-only">处理中</span></> : mode === 'login' ? '登录' : '注册'}
          </button>
          {mode === 'login' ? (
            <button type="button" onClick={handlePasswordRecovery} disabled={loading || !isSupabaseConfigured} className="min-h-11 w-full text-sm font-medium text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:text-[var(--muted-subtle)]">
              设置或找回密码
            </button>
          ) : null}
        </form>

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          {mode === 'login' ? '没有账号？' : '已有账号？'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }} className="min-h-11 font-medium text-[var(--accent-ink)] hover:text-[var(--accent-hover)]">{mode === 'login' ? '注册' : '登录'}</button>
        </p>
      </div>
    </div>
  );
}
