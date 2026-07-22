import assert from 'node:assert/strict';
import test, { before } from 'node:test';

type RecoveryModule = typeof import('../../src/features/auth/recovery');
let recovery: Partial<RecoveryModule> = {};

before(async () => {
  recovery = await import('../../src/features/auth/recovery').catch(() => ({} as Partial<RecoveryModule>));
});

function createPasswordRecoveryController(...args: Parameters<RecoveryModule['createPasswordRecoveryController']>) {
  assert.equal(typeof recovery.createPasswordRecoveryController, 'function', 'missing production helper: createPasswordRecoveryController');
  return recovery.createPasswordRecoveryController!(...args);
}

function recoveryAuth(user: object | null) {
  const updates: string[] = [];
  return {
    updates,
    auth: {
      getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
      updateUser: async ({ password }: { password: string }) => {
        updates.push(password);
        return { data: { user }, error: null };
      },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  };
}

test('invalid or expired recovery does not call updateUser', async () => {
  const client = recoveryAuth(null);
  const controller = createPasswordRecoveryController({
    auth: client.auth,
    hasRecoveryEntry: () => true,
    clearRecoveryEntry: () => undefined,
    onAuthorized: () => undefined,
  });

  await controller.start();
  const result = await controller.updatePassword('new-password', 'new-password');

  assert.equal(result.ok, false);
  assert.deepEqual(client.updates, []);
  controller.dispose();
});

test('valid recovery session updates the password and clears recovery URL data', async () => {
  const client = recoveryAuth({ id: 'user-1' });
  let cleared = 0;
  let authorized = 0;
  const controller = createPasswordRecoveryController({
    auth: client.auth,
    hasRecoveryEntry: () => true,
    clearRecoveryEntry: () => { cleared += 1; },
    onAuthorized: () => { authorized += 1; },
  });

  await controller.start();
  const result = await controller.updatePassword('new-password', 'new-password');

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(client.updates, ['new-password']);
  assert.equal(cleared, 1);
  assert.equal(authorized, 1);
  controller.dispose();
});
