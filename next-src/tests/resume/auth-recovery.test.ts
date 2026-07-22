import assert from 'node:assert/strict';
import test, { before } from 'node:test';

type RecoveryModule = typeof import('../../src/features/auth/recovery');
type RecoverySession = { user?: object } | null;
type RecoveryCallback = (event: string, session: RecoverySession) => void;
type IntentStore = {
  captureUrlHash(hash: string): boolean;
  mark(): void;
  isActive(): boolean;
  clear(): void;
};
type ControllerOptions = {
  auth: ReturnType<typeof recoveryAuth>['auth'];
  intent: IntentStore;
  clearRecoveryUrl: () => void;
  onAuthorized: () => void;
};

let recovery: Partial<RecoveryModule> = {};

before(async () => {
  recovery = await import('../../src/features/auth/recovery').catch(() => ({} as Partial<RecoveryModule>));
});

function requireFunction(name: string): (...args: never[]) => unknown {
  const value = (recovery as Record<string, unknown>)[name];
  assert.equal(typeof value, 'function', `missing production helper: ${name}`);
  return value as (...args: never[]) => unknown;
}

function createIntentStore(storage = memoryStorage(), now = () => 1_000): IntentStore {
  const factory = requireFunction('createPasswordRecoveryIntentStore') as unknown as (
    storage: ReturnType<typeof memoryStorage>,
    now: () => number,
  ) => IntentStore;
  return factory(storage, now);
}

function createController(options: ControllerOptions) {
  const factory = requireFunction('createPasswordRecoveryController') as unknown as (
    options: ControllerOptions,
  ) => {
    start(): Promise<boolean>;
    updatePassword(password: string, confirmation: string): Promise<{ ok: boolean }>;
    dispose(): void;
  };
  return factory(options);
}

function registerIntentListener(auth: ReturnType<typeof recoveryAuth>['auth'], intent: IntentStore) {
  const register = requireFunction('registerPasswordRecoveryIntentListener') as unknown as (
    auth: ReturnType<typeof recoveryAuth>['auth'],
    intent: IntentStore,
  ) => { unsubscribe(): void };
  return register(auth, intent);
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function recoveryAuth(initialUser: object | null) {
  let user = initialUser;
  let getSessionImpl = async () => ({ data: { session: user ? { user } : null }, error: null });
  const callbacks: RecoveryCallback[] = [];
  const updates: string[] = [];
  return {
    callbacks,
    updates,
    setUser(nextUser: object | null) { user = nextUser; },
    setGetSession(next: typeof getSessionImpl) { getSessionImpl = next; },
    emit(event: string, session: RecoverySession) {
      for (const callback of [...callbacks]) callback(event, session);
    },
    auth: {
      getSession: () => getSessionImpl(),
      updateUser: async ({ password }: { password: string }) => {
        updates.push(password);
        return { data: { user }, error: null };
      },
      onAuthStateChange: (callback: RecoveryCallback) => {
        callbacks.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const index = callbacks.indexOf(callback);
                if (index >= 0) callbacks.splice(index, 1);
              },
            },
          },
        };
      },
    },
  };
}

test('invalid or expired recovery does not call updateUser', async () => {
  const client = recoveryAuth(null);
  const intent = createIntentStore();
  const controller = createController({
    auth: client.auth,
    intent,
    clearRecoveryUrl: () => undefined,
    onAuthorized: () => undefined,
  });

  assert.equal(await controller.start(), false);
  client.emit('SIGNED_IN', { user: { id: 'ordinary-user' } });
  const result = await controller.updatePassword('new-password', 'new-password');

  assert.equal(result.ok, false);
  assert.deepEqual(client.updates, []);
  controller.dispose();
});

test('event before page start preserves recovery intent for the controller', async () => {
  const client = recoveryAuth({ id: 'user-1' });
  const intent = createIntentStore();
  const globalSubscription = registerIntentListener(client.auth, intent);

  assert.equal(client.callbacks.length, 1);
  client.emit('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
  assert.equal(intent.isActive(), true);

  let authorized = 0;
  const controller = createController({
    auth: client.auth,
    intent,
    clearRecoveryUrl: () => undefined,
    onAuthorized: () => { authorized += 1; },
  });
  assert.equal(await controller.start(), true);
  assert.equal(authorized, 1);
  controller.dispose();
  globalSubscription.unsubscribe();
});

test('event during page start authorizes without waiting for URL inspection', async () => {
  const client = recoveryAuth(null);
  const intent = createIntentStore();
  let resolveSession!: (value: Awaited<ReturnType<typeof client.auth.getSession>>) => void;
  client.setGetSession(() => new Promise(resolve => { resolveSession = resolve; }));
  let authorized = 0;
  const controller = createController({
    auth: client.auth,
    intent,
    clearRecoveryUrl: () => undefined,
    onAuthorized: () => { authorized += 1; },
  });

  const starting = controller.start();
  assert.equal(client.callbacks.length, 1);
  client.emit('PASSWORD_RECOVERY', { user: { id: 'user-1' } });
  resolveSession({ data: { session: null }, error: null });

  assert.equal(await starting, true);
  assert.equal(intent.isActive(), true);
  assert.equal(authorized, 1);
  controller.dispose();
});

test('captured intent survives a consumed recovery URL without retaining tokens', async () => {
  const storage = memoryStorage();
  const intent = createIntentStore(storage);
  assert.equal(intent.captureUrlHash('#access_token=PRIVATE_TOKEN&type=recovery&refresh_token=PRIVATE_REFRESH'), true);
  assert.doesNotMatch(JSON.stringify([...storage.values]), /PRIVATE_TOKEN|PRIVATE_REFRESH/);

  const client = recoveryAuth({ id: 'user-1' });
  const controller = createController({
    auth: client.auth,
    intent,
    clearRecoveryUrl: () => undefined,
    onAuthorized: () => undefined,
  });

  assert.equal(await controller.start(), true);
  controller.dispose();
});

test('refresh keeps callback-captured recovery authorization until password update succeeds', async () => {
  const client = recoveryAuth({ id: 'user-1' });
  const intent = createIntentStore();
  const globalSubscription = registerIntentListener(client.auth, intent);
  client.emit('PASSWORD_RECOVERY', { user: { id: 'user-1' } });

  const first = createController({ auth: client.auth, intent, clearRecoveryUrl: () => undefined, onAuthorized: () => undefined });
  assert.equal(await first.start(), true);
  first.dispose();

  const refreshed = createController({ auth: client.auth, intent, clearRecoveryUrl: () => undefined, onAuthorized: () => undefined });
  assert.equal(await refreshed.start(), true);
  assert.deepEqual(await refreshed.updatePassword('new-password', 'new-password'), { ok: true });
  assert.equal(intent.isActive(), false);
  assert.deepEqual(client.updates, ['new-password']);
  refreshed.dispose();
  globalSubscription.unsubscribe();
});
