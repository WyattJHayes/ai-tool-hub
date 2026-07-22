'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';
import { createPasswordRecoveryController } from '@/features/auth/recovery';
import { isSupabaseConfigured, passwordRecoveryIntent, supabase } from '@/lib/supabase';

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'saving' | 'complete';

export default function PasswordRecoveryPage() {
  const [state, setState] = useState<RecoveryState>(() => isSupabaseConfigured && supabase ? 'checking' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const controllerRef = useRef<ReturnType<typeof createPasswordRecoveryController> | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !passwordRecoveryIntent) {
      return;
    }
    const controller = createPasswordRecoveryController({
      auth: supabase.auth,
      intent: passwordRecoveryIntent,
      clearRecoveryUrl: () => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`),
      onAuthorized: () => setState('ready'),
    });
    controllerRef.current = controller;
    void controller.start().then(authorized => {
      if (!authorized) setState(current => current === 'ready' ? current : 'invalid');
    });
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!controllerRef.current || state !== 'ready') return;
    setError('');
    setState('saving');
    const result = await controllerRef.current.updatePassword(password, confirmation);
    if (result.ok) {
      setState('complete');
      return;
    }
    setError(result.error);
    setState('ready');
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--nav-height))] w-full max-w-lg items-center px-4 py-10">
      <section className="w-full border border-[var(--line)] bg-[var(--surface)] p-6" aria-labelledby="recovery-title">
        <LockKeyhole className="mb-4 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />
        <h1 id="recovery-title" className="text-xl font-semibold text-[var(--ink)]">设置新密码</h1>

        {state === 'checking' ? <p className="mt-4 text-sm text-[var(--muted)]" role="status">正在验证重置链接...</p> : null}
        {state === 'invalid' ? (
          <div className="mt-4" role="alert">
            <p className="text-sm text-[var(--signal-ink)]">重置链接无效或已过期，请重新申请。</p>
            <Link className="mt-4 inline-flex min-h-11 items-center font-medium text-[var(--accent-ink)]" href="/">返回首页</Link>
          </div>
        ) : null}
        {state === 'complete' ? (
          <div className="mt-4" role="status">
            <p className="text-sm text-[var(--ink)]">密码已更新。</p>
            <Link className="mt-4 inline-flex min-h-11 items-center font-medium text-[var(--accent-ink)]" href="/user">前往账户</Link>
          </div>
        ) : null}
        {state === 'ready' || state === 'saving' ? (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="recovery-password">新密码</label>
            <input id="recovery-password" className="h-12 w-full border border-[var(--line-strong)] bg-[var(--surface)] px-3" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} />
            <label className="block text-sm font-medium text-[var(--ink)]" htmlFor="recovery-confirmation">确认新密码</label>
            <input id="recovery-confirmation" className="h-12 w-full border border-[var(--line-strong)] bg-[var(--surface)] px-3" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} />
            {error ? <p className="text-sm text-[var(--signal-ink)]" role="alert">{error}</p> : null}
            <button className="flex min-h-12 w-full items-center justify-center bg-[var(--accent)] font-medium text-[var(--on-accent)] disabled:opacity-50" type="submit" disabled={state === 'saving'}>
              {state === 'saving' ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span className="sr-only">更新中</span></> : '更新密码'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
