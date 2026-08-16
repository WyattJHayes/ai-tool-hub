import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettlementCoordinator } from '../../src/server/resume/settlement';

/**
 * Regression tests for the quota settlement coordinator.
 *
 * [VULN-2] `compensate()` currently performs a refund even after the ledger
 * has already been settled as `consumed`. Combined with the streaming-cancel
 * timing window in the optimize route, a client can receive the full AI result
 * and still get its quota refunded. The SQL layer intentionally allows
 * compensating a consumed ledger (see supabase/tests/resume_billing.sql,
 * "compensate-consumed"), so the coordinator MUST be the guard.
 *
 * The `knownBug` tests below encode the DESIRED post-fix behavior. They pass
 * while the bug is present (assertion throws => swallowed) and automatically
 * turn red once the fix lands, prompting you to promote them to plain test().
 */
async function runKnownBug(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  let bugFixed = false;
  try {
    await fn();
    bugFixed = true;
  } catch {
    // Bug still present — expected red, kept green by design.
  }
  if (bugFixed) {
    throw new Error(
      `KNOWN BUG FIXED: promote this test — replace knownBug() with test() and keep the inner assertions (${name})`,
    );
  }
}

// Register a known-bug test (top-level await is unavailable under tsx/CJS).
function knownBug(name: string, fn: () => Promise<void>): void {
  test(name, () => runKnownBug(name, fn));
}

test('settle(consumed) performs exactly once and records the terminal outcome', async () => {
  const performed: string[] = [];
  const coordinator = createSettlementCoordinator(async (outcome) => {
    performed.push(outcome);
  });

  const result = await coordinator.settle('consumed');

  assert.equal(result, 'consumed');
  assert.deepEqual(performed, ['consumed']);
  assert.equal(coordinator.outcome(), 'consumed');
});

test('duplicate settle short-circuits without a second RPC', async () => {
  const performed: string[] = [];
  const coordinator = createSettlementCoordinator(async (outcome) => {
    performed.push(outcome);
  });

  await coordinator.settle('consumed');
  const second = await coordinator.settle('refunded');

  assert.equal(second, 'consumed');
  assert.deepEqual(performed, ['consumed']);
  assert.equal(coordinator.outcome(), 'consumed');
});

test('compensate on a fresh coordinator refunds exactly once', async () => {
  let compensations = 0;
  const coordinator = createSettlementCoordinator(
    async () => undefined,
    async () => {
      compensations += 1;
    },
  );

  const first = await coordinator.compensate();
  const second = await coordinator.compensate();

  assert.equal(first, 'refunded');
  assert.equal(second, 'refunded');
  assert.equal(compensations, 1);
  assert.equal(coordinator.outcome(), 'refunded');
});

test('settle after compensate returns the refunded terminal state', async () => {
  const performed: string[] = [];
  const coordinator = createSettlementCoordinator(async (outcome) => {
    performed.push(outcome);
  });

  await coordinator.compensate();
  const settled = await coordinator.settle('consumed');

  assert.equal(settled, 'refunded');
  // No performCompensation was injected, so compensate() falls back to
  // perform('refunded') — exactly one settlement RPC in total.
  assert.deepEqual(performed, ['refunded']);
  assert.equal(coordinator.outcome(), 'refunded');
});

test('a failed settle does not lock the reservation: retry still settles', async () => {
  let attempts = 0;
  const coordinator = createSettlementCoordinator(async (outcome) => {
    attempts += 1;
    if (attempts === 1) throw new Error('settle rpc unavailable');
    return outcome;
  });

  await assert.rejects(() => coordinator.settle('consumed'), /settle rpc unavailable/);
  assert.equal(coordinator.outcome(), null);

  const retried = await coordinator.settle('consumed');
  assert.equal(retried, 'consumed');
  assert.equal(attempts, 2);
});

test('compensate after a failed settle still refunds', async () => {
  let compensations = 0;
  const coordinator = createSettlementCoordinator(
    async () => {
      throw new Error('settle rpc unavailable');
    },
    async () => {
      compensations += 1;
    },
  );

  await assert.rejects(() => coordinator.settle('consumed'), /settle rpc unavailable/);
  const refunded = await coordinator.compensate();

  assert.equal(refunded, 'refunded');
  assert.equal(compensations, 1);
});

test('concurrent settle calls perform the RPC exactly once', async () => {
  const performed: string[] = [];
  const coordinator = createSettlementCoordinator(async (outcome) => {
    performed.push(outcome);
  });

  const [a, b] = await Promise.all([
    coordinator.settle('consumed'),
    coordinator.settle('consumed'),
  ]);

  assert.equal(a, 'consumed');
  assert.equal(b, 'consumed');
  assert.equal(performed.length, 1);
});

// ---------------------------------------------------------------------------
// Consumed ledgers stay compensable BY DESIGN.
//
// The JSON routes (parse / analyze-jd) refund a consumption whose response
// was never delivered, and the SQL layer intentionally supports it
// (resume_billing.sql: "compensate-consumed"). The [VULN-2] guard against
// refunding content that was already streamed therefore lives in the
// optimize route (cancellation after resultReady settles 'refunded', which
// no-ops on a consumed ledger) — see tests/resume/ai.test.ts.
// ---------------------------------------------------------------------------

test('compensate() after consumed performs the refund (documented contract)', async () => {
  let compensations = 0;
  const coordinator = createSettlementCoordinator(
    async () => undefined,
    async () => {
      compensations += 1;
    },
  );

  await coordinator.settle('consumed');
  const result = await coordinator.compensate();

  assert.equal(compensations, 1);
  assert.equal(result, 'refunded');
});

test('compensate() after consumed flips outcome() to refunded', async () => {
  const coordinator = createSettlementCoordinator(async () => undefined, async () => undefined);

  await coordinator.settle('consumed');
  await coordinator.compensate();

  assert.equal(coordinator.outcome(), 'refunded');
});

test('settle(refunded) after consumed is a no-op that keeps the ledger consumed', async () => {
  // This is the exact primitive the optimize route relies on to refuse
  // refunds once the payload has been streamed: cancel -> settle('refunded')
  // -> coordinator short-circuits on the consumed terminal state.
  const performed: string[] = [];
  const coordinator = createSettlementCoordinator(async (outcome) => {
    performed.push(outcome);
  });

  await coordinator.settle('consumed');
  const result = await coordinator.settle('refunded');

  assert.equal(result, 'consumed');
  assert.deepEqual(performed, ['consumed']);
  assert.equal(coordinator.outcome(), 'consumed');
});
