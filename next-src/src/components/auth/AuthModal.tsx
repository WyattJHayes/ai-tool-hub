'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, Lock, Mail, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const login = useUserStore((state) => state.login);
  const migrateFromLocalStorage = useUserStore((state) => state.migrateFromLocalStorage);

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
        window.setTimeout(onClose, 800);
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4" role="presentation">
      <div className="relative w-full max-w-md rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.2)]" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]" aria-label="关闭登录窗口"><X className="h-4 w-4" /></button>

        <div className="mb-6 pr-10">
          <h2 id="auth-title" className="text-xl font-semibold text-[var(--ink)]">{mode === 'login' ? '登录' : '注册'}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{mode === 'login' ? '同步你的收藏、评分和对比记录' : '创建账号以启用云同步'}</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-[var(--warning)] dark:border-amber-950 dark:bg-amber-950/40"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>云同步服务当前不可用，仍可继续使用本地收藏和评分。</p></div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="auth-email">邮箱</label>
          <div className="relative -mt-2"><Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-subtle)]" /><input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" /></div>

          <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="auth-password">密码</label>
          <div className="relative -mt-2"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-subtle)]" /><input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} className="h-12 w-full rounded-md border border-[var(--line-strong)] bg-[var(--surface)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]" /></div>

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-[var(--danger)] dark:bg-red-950/40">{error}</p> : null}
          {success ? <p className="rounded-md bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">{success}</p> : null}

          <button type="submit" disabled={loading || !isSupabaseConfigured} className={cn('flex min-h-12 w-full items-center justify-center rounded-md text-sm font-medium text-white', isSupabaseConfigured ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50' : 'cursor-not-allowed bg-[var(--muted-subtle)]')}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          {mode === 'login' ? '没有账号？' : '已有账号？'}{' '}
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setSuccess(''); }} className="min-h-11 font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">{mode === 'login' ? '注册' : '登录'}</button>
        </p>
      </div>
    </div>
  );
}
