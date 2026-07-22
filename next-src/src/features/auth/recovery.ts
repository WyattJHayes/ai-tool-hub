interface RecoverySession {
  user?: unknown;
}

interface RecoveryAuthClient {
  getSession: () => Promise<{ data: { session: RecoverySession | null }; error: unknown }>;
  updateUser: (attributes: { password: string }) => Promise<{ data: unknown; error: unknown }>;
  onAuthStateChange: (
    callback: (event: string, session: RecoverySession | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
}

interface PasswordRecoveryControllerOptions {
  auth: RecoveryAuthClient;
  hasRecoveryEntry: () => boolean;
  clearRecoveryEntry: () => void;
  onAuthorized: () => void;
}

export type PasswordRecoveryResult = { ok: true } | { ok: false; error: string };

export function createPasswordRecoveryController(options: PasswordRecoveryControllerOptions) {
  let authorized = false;
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  const authorize = (session: RecoverySession | null) => {
    if (disposed || !session?.user) return;
    authorized = true;
    options.onAuthorized();
  };

  return {
    async start() {
      const recoveryEntry = options.hasRecoveryEntry();
      if (recoveryEntry) options.clearRecoveryEntry();
      const { data } = options.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') authorize(session);
      });
      unsubscribe = data.subscription.unsubscribe;
      if (!recoveryEntry) return false;
      const { data: sessionData, error } = await options.auth.getSession();
      if (!error) authorize(sessionData.session);
      return authorized;
    },
    async updatePassword(password: string, confirmation: string): Promise<PasswordRecoveryResult> {
      if (password.length < 8) return { ok: false, error: '密码至少需要 8 个字符。' };
      if (password !== confirmation) return { ok: false, error: '两次输入的密码不一致。' };
      if (!authorized) return { ok: false, error: '重置链接无效或已过期，请重新申请。' };
      const { data, error: sessionError } = await options.auth.getSession();
      if (sessionError || !data.session?.user) {
        authorized = false;
        return { ok: false, error: '重置链接无效或已过期，请重新申请。' };
      }
      const { error } = await options.auth.updateUser({ password });
      if (error) return { ok: false, error: '密码更新失败，请重新申请重置链接。' };
      authorized = false;
      return { ok: true };
    },
    dispose() {
      disposed = true;
      authorized = false;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}
