interface RecoverySession {
  user?: unknown;
}

interface RecoveryIntentStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface PasswordRecoveryIntentStore {
  captureUrlHash: (hash: string) => boolean;
  mark: () => void;
  isActive: () => boolean;
  clear: () => void;
}

const RECOVERY_INTENT_KEY = 'weihub-password-recovery-intent';
const RECOVERY_INTENT_TTL_MS = 15 * 60 * 1_000;

interface RecoveryAuthClient {
  getSession: () => Promise<{ data: { session: RecoverySession | null }; error: unknown }>;
  updateUser: (attributes: { password: string }) => Promise<{ data: unknown; error: unknown }>;
  onAuthStateChange: (
    callback: (event: string, session: RecoverySession | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
}

interface PasswordRecoveryControllerOptions {
  auth: RecoveryAuthClient;
  intent: PasswordRecoveryIntentStore;
  clearRecoveryUrl: () => void;
  onAuthorized: () => void;
}

export type PasswordRecoveryResult = { ok: true } | { ok: false; error: string };

export function createPasswordRecoveryIntentStore(
  storage: RecoveryIntentStorage,
  now: () => number = () => Date.now(),
): PasswordRecoveryIntentStore {
  const clear = () => {
    try {
      storage.removeItem(RECOVERY_INTENT_KEY);
    } catch {
      // Recovery remains fail-closed when browser storage is unavailable.
    }
  };

  return {
    captureUrlHash(hash) {
      const isRecovery = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('type') === 'recovery';
      if (isRecovery) this.mark();
      return isRecovery;
    },
    mark() {
      try {
        storage.setItem(RECOVERY_INTENT_KEY, String(now() + RECOVERY_INTENT_TTL_MS));
      } catch {
        // The live PASSWORD_RECOVERY callback can still authorize this page instance.
      }
    },
    isActive() {
      try {
        const expiresAt = Number(storage.getItem(RECOVERY_INTENT_KEY));
        if (Number.isFinite(expiresAt) && expiresAt > now()) return true;
      } catch {
        return false;
      }
      clear();
      return false;
    },
    clear,
  };
}

export function registerPasswordRecoveryIntentListener(
  auth: Pick<RecoveryAuthClient, 'onAuthStateChange'>,
  intent: PasswordRecoveryIntentStore,
) {
  const { data } = auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') intent.mark();
  });
  return data.subscription;
}

export function createPasswordRecoveryController(options: PasswordRecoveryControllerOptions) {
  let authorized = false;
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  const authorize = (session: RecoverySession | null) => {
    if (disposed || authorized || !session?.user) return;
    authorized = true;
    options.onAuthorized();
  };

  return {
    async start() {
      if (options.intent.isActive()) options.clearRecoveryUrl();
      const { data } = options.auth.onAuthStateChange((event, session) => {
        if (event !== 'PASSWORD_RECOVERY') return;
        options.intent.mark();
        authorize(session);
      });
      unsubscribe = data.subscription.unsubscribe;
      const { data: sessionData, error } = await options.auth.getSession();
      if (!error && options.intent.isActive()) authorize(sessionData.session);
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
      options.intent.clear();
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
