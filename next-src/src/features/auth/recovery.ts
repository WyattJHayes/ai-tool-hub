interface RecoverySession {
  user?: { id?: unknown };
}

interface RecoveryIntentStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface PasswordRecoveryIntentStore {
  captureUrlHash: (hash: string) => boolean;
  bindUser: (userId: string) => void;
  userId: () => string | null;
  isActive: () => boolean;
  clear: () => void;
}

const RECOVERY_INTENT_KEY = 'weihub-password-recovery-intent';
const RECOVERY_INTENT_TTL_MS = 15 * 60 * 1_000;

interface PersistedRecoveryIntent {
  version: 1;
  expiresAt: number;
  userId?: string;
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
  intent: PasswordRecoveryIntentStore;
  clearRecoveryUrl: () => void;
  onAuthorized: () => void;
}

export type PasswordRecoveryResult = { ok: true } | { ok: false; error: string };

export function createPasswordRecoveryIntentStore(
  storage: RecoveryIntentStorage,
  now: () => number = () => Date.now(),
): PasswordRecoveryIntentStore {
  let memoryIntent: PersistedRecoveryIntent | null = null;
  const clear = () => {
    memoryIntent = null;
    try {
      storage.removeItem(RECOVERY_INTENT_KEY);
    } catch {
      // Recovery remains fail-closed when browser storage is unavailable.
    }
  };

  const parse = (value: string | null): PersistedRecoveryIntent | null => {
    if (value === null) return null;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') return null;
      const record = parsed as Partial<PersistedRecoveryIntent>;
      if (record.version !== 1 || !Number.isFinite(record.expiresAt)) return null;
      if (record.userId !== undefined && (typeof record.userId !== 'string' || !record.userId.trim())) return null;
      return record as PersistedRecoveryIntent;
    } catch {
      return null;
    }
  };

  const activeIntent = (): PersistedRecoveryIntent | null => {
    let record = memoryIntent;
    try {
      const stored = storage.getItem(RECOVERY_INTENT_KEY);
      if (stored !== null) record = parse(stored);
    } catch {
      // A live callback can retain its in-memory binding for this page instance.
    }
    if (!record || record.expiresAt <= now()) {
      clear();
      return null;
    }
    memoryIntent = record;
    return record;
  };

  const persist = (record: PersistedRecoveryIntent) => {
    memoryIntent = record;
    try {
      storage.setItem(RECOVERY_INTENT_KEY, JSON.stringify(record));
    } catch {
      // The live PASSWORD_RECOVERY callback remains valid only in memory.
    }
  };

  return {
    captureUrlHash(hash) {
      const isRecovery = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('type') === 'recovery';
      if (isRecovery) {
        const current = activeIntent();
        persist(current?.userId
          ? current
          : { version: 1, expiresAt: now() + RECOVERY_INTENT_TTL_MS });
      }
      return isRecovery;
    },
    bindUser(userId) {
      if (!userId.trim()) return;
      persist({ version: 1, expiresAt: now() + RECOVERY_INTENT_TTL_MS, userId });
    },
    userId() {
      return activeIntent()?.userId ?? null;
    },
    isActive() {
      return activeIntent() !== null;
    },
    clear,
  };
}

export function registerPasswordRecoveryIntentListener(
  auth: Pick<RecoveryAuthClient, 'onAuthStateChange'>,
  intent: PasswordRecoveryIntentStore,
) {
  const { data } = auth.onAuthStateChange((event, session) => {
    const userId = recoveryUserId(session);
    if (event === 'PASSWORD_RECOVERY' && userId) intent.bindUser(userId);
  });
  return data.subscription;
}

export function createPasswordRecoveryController(options: PasswordRecoveryControllerOptions) {
  let authorizedUserId: string | null = null;
  let disposed = false;
  let unsubscribe: (() => void) | null = null;

  const authorize = (session: RecoverySession | null) => {
    const userId = recoveryUserId(session);
    if (disposed || !userId || options.intent.userId() !== userId) return;
    if (authorizedUserId === userId) return;
    authorizedUserId = userId;
    options.onAuthorized();
  };

  return {
    async start() {
      if (options.intent.isActive()) options.clearRecoveryUrl();
      const { data } = options.auth.onAuthStateChange((event, session) => {
        if (event !== 'PASSWORD_RECOVERY') return;
        const userId = recoveryUserId(session);
        if (!userId) return;
        options.intent.bindUser(userId);
        authorize(session);
      });
      unsubscribe = data.subscription.unsubscribe;
      const { data: sessionData, error } = await options.auth.getSession();
      if (!error) authorize(sessionData.session);
      return authorizedUserId !== null;
    },
    async updatePassword(password: string, confirmation: string): Promise<PasswordRecoveryResult> {
      if (password.length < 8) return { ok: false, error: '密码至少需要 8 个字符。' };
      if (password !== confirmation) return { ok: false, error: '两次输入的密码不一致。' };
      if (!authorizedUserId || options.intent.userId() !== authorizedUserId) {
        authorizedUserId = null;
        options.intent.clear();
        return { ok: false, error: '重置链接无效或已过期，请重新申请。' };
      }
      const { data, error: sessionError } = await options.auth.getSession();
      if (sessionError || recoveryUserId(data.session) !== authorizedUserId) {
        authorizedUserId = null;
        options.intent.clear();
        return { ok: false, error: '重置链接无效或已过期，请重新申请。' };
      }
      const { error } = await options.auth.updateUser({ password });
      if (error) return { ok: false, error: '密码更新失败，请重新申请重置链接。' };
      authorizedUserId = null;
      options.intent.clear();
      return { ok: true };
    },
    dispose() {
      disposed = true;
      authorizedUserId = null;
      unsubscribe?.();
      unsubscribe = null;
    },
  };
}

function recoveryUserId(session: RecoverySession | null): string | null {
  const id = session?.user?.id;
  return typeof id === 'string' && id.trim() ? id : null;
}
