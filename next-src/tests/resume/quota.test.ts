import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reserveQuota,
  ResumeApiError,
  settleQuota,
  toResumeErrorBody,
  type ResumeRpcClient,
} from '../../src/server/resume/quota';

test('reserves quota with the exact Task 3 RPC name and arguments', async () => {
  const calls: unknown[][] = [];
  const client: ResumeRpcClient = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return {
        data: [{
          ledger_id: 'ledger-1',
          plan: 'free',
          remaining: 9,
          total: 10,
          reset_at: '2026-07-23T16:00:00.000Z',
        }],
        error: null,
      };
    },
  };

  const reservation = await reserveQuota(client, {
    userId: 'u1',
    action: 'parse',
    idempotencyKey: 'k1',
    requestId: '00000000-0000-4000-8000-000000000001',
  });

  assert.deepEqual(calls[0], ['reserve_resume_quota', {
    p_user_id: 'u1',
    p_action: 'parse',
    p_idempotency_key: 'k1',
    p_request_id: '00000000-0000-4000-8000-000000000001',
  }]);
  assert.deepEqual(reservation, {
    ledgerId: 'ledger-1',
    plan: 'free',
    remaining: 9,
    total: 10,
    resetAt: '2026-07-23T16:00:00.000Z',
  });
});

test('settles quota with the exact Task 3 RPC name and arguments', async () => {
  const calls: unknown[][] = [];
  const settledRow = { id: 'ledger-1', status: 'refunded', quota_delta: -1 };
  const client: ResumeRpcClient = {
    rpc: async (name, args) => {
      calls.push([name, args]);
      return { data: settledRow, error: null };
    },
  };

  const result = await settleQuota(client, 'ledger-1', 'refunded');

  assert.deepEqual(calls, [['settle_resume_quota', {
    p_ledger_id: 'ledger-1',
    p_outcome: 'refunded',
  }]]);
  assert.equal(result, settledRow);
});

test('maps quota exhaustion to a stable 429 error without SQL details', async () => {
  const client: ResumeRpcClient = {
    rpc: async () => ({
      data: null,
      error: {
        code: 'P0001',
        message: 'RESUME_QUOTA_EXHAUSTED',
        details: 'PRIVATE SQL: select * from resume_usage_ledger',
        hint: 'internal database hint',
      },
    }),
  };

  await assert.rejects(
    () => reserveQuota(client, {
      userId: 'u1', action: 'parse', idempotencyKey: 'k1', requestId: 'request-1',
    }),
    error => {
      assert.ok(error instanceof ResumeApiError);
      assert.equal(error.code, 'QUOTA_EXHAUSTED');
      assert.equal(error.status, 429);
      assert.doesNotMatch(String(error), /PRIVATE SQL|resume_usage_ledger|database hint|P0001/);
      assert.deepEqual(toResumeErrorBody(error, 'request-1'), {
        error: {
          code: 'QUOTA_EXHAUSTED',
          message: 'No resume quota remains for this request.',
          requestId: 'request-1',
        },
      });
      return true;
    },
  );
});

test('maps unknown RPC and thrown client failures to a stable nonleaking error', async () => {
  const clients: ResumeRpcClient[] = [
    {
      rpc: async () => ({
        data: null,
        error: { message: 'PRIVATE SQL STATEMENT', details: 'PRIVATE_RESUME_TEXT' },
      }),
    },
    {
      rpc: async () => {
        throw new Error('private service role and PRIVATE_JD_TEXT');
      },
    },
  ];

  for (const client of clients) {
    await assert.rejects(
      () => settleQuota(client, 'ledger-1', 'consumed'),
      error => {
        assert.ok(error instanceof ResumeApiError);
        assert.equal(error.code, 'QUOTA_UNAVAILABLE');
        assert.equal(error.status, 503);
        assert.doesNotMatch(String(error), /PRIVATE|service role|SQL/);
        return true;
      },
    );
  }
});

test('rejects a malformed successful reservation response without exposing it', async () => {
  const client: ResumeRpcClient = {
    rpc: async () => ({ data: [{ ledger_id: 'PRIVATE_RESUME_TEXT' }], error: null }),
  };

  await assert.rejects(
    () => reserveQuota(client, {
      userId: 'u1', action: 'parse', idempotencyKey: 'k1', requestId: 'request-1',
    }),
    error => {
      assert.ok(error instanceof ResumeApiError);
      assert.equal(error.code, 'QUOTA_UNAVAILABLE');
      assert.equal(error.status, 503);
      assert.doesNotMatch(String(error), /PRIVATE_RESUME_TEXT/);
      return true;
    },
  );
});
