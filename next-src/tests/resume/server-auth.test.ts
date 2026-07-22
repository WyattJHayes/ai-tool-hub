import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSupabaseAdminClient,
  requireSupabaseUser,
  ResumeApiError,
} from '../../src/server/supabase-admin';
import { getServerEnv, getXddpayEnv, type ServerEnvSource } from '../../src/server/env';

function validEnvironment(): ServerEnvSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-value',
    DEEPSEEK_API_KEY: 'deepseek-value',
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_MODEL: 'deepseek-chat',
    DAILY_QUOTA: '10',
  };
}

function validPaymentEnvironment(): ServerEnvSource {
  return {
    XDDPAY_APP_ID: 'xdd-app',
    XDDPAY_SECRET: 'xdd-secret-value',
    XDDPAY_GATEWAY: 'https://pay.example.com/gateway',
    XDDPAY_NOTIFY_URL: 'https://app.example.com/api/resume/payments/xddpay/notify',
  };
}

function assertResumeError(error: unknown, code: string, status: number): boolean {
  assert.ok(error instanceof ResumeApiError);
  assert.equal(error.code, code);
  assert.equal(error.status, status);
  return true;
}

test('parses complete server configuration without defaults', () => {
  assert.deepEqual(getServerEnv(validEnvironment()), {
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-value',
    deepseekApiKey: 'deepseek-value',
    deepseekBaseUrl: 'https://api.deepseek.com',
    deepseekModel: 'deepseek-chat',
    dailyQuota: 10,
  });
});

test('parses payment configuration only when its disabled boundary is explicitly requested', () => {
  assert.deepEqual(getXddpayEnv(validPaymentEnvironment()), {
    xddpayAppId: 'xdd-app',
    xddpaySecret: 'xdd-secret-value',
    xddpayGateway: 'https://pay.example.com/gateway',
    xddpayNotifyUrl: 'https://app.example.com/api/resume/payments/xddpay/notify',
  });
});

test('rejects every missing private server setting', () => {
  for (const name of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_BASE_URL',
    'DEEPSEEK_MODEL',
    'DAILY_QUOTA',
  ]) {
    const source = validEnvironment();
    delete source[name];
    assert.throws(() => getServerEnv(source), /Invalid server configuration/);
  }
});

test('rejects every missing payment setting when the payment boundary is requested', () => {
  for (const name of ['XDDPAY_APP_ID', 'XDDPAY_SECRET', 'XDDPAY_GATEWAY', 'XDDPAY_NOTIFY_URL']) {
    const source = validPaymentEnvironment();
    delete source[name];
    assert.throws(() => getXddpayEnv(source), /Invalid server configuration/);
  }
});

test('rejects noninteger, nonpositive, and missing daily quota instead of defaulting', () => {
  for (const value of [undefined, '', '0', '-1', '1.5', 'ten', '9007199254740992']) {
    const source = validEnvironment();
    source.DAILY_QUOTA = value;
    assert.throws(() => getServerEnv(source), /Invalid server configuration/);
  }
});

test('rejects private secret names exposed through NEXT_PUBLIC without leaking values', () => {
  for (const publicName of [
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_DEEPSEEK_API_KEY',
    'NEXT_PUBLIC_XDDPAY_SECRET',
    'NEXT_PUBLIC_ACCIDENTAL_SECRET',
  ]) {
    const source = { ...validEnvironment(), ...validPaymentEnvironment(), [publicName]: 'DO_NOT_EXPOSE_THIS_VALUE' };
    assert.throws(
      () => getServerEnv(source),
      error => {
        assert.doesNotMatch(String(error), /DO_NOT_EXPOSE_THIS_VALUE|service-role-value|deepseek-value|xdd-secret-value/);
        return true;
      },
    );
  }
});

test('creates the admin client with the service role and disabled session persistence', () => {
  const env = getServerEnv(validEnvironment());
  const calls: unknown[][] = [];
  const fakeClient = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } };
  const client = createSupabaseAdminClient(env, ((...args: unknown[]) => {
    calls.push(args);
    return fakeClient;
  }) as never);

  assert.equal(client, fakeClient);
  assert.deepEqual(calls, [[
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ]]);
});

test('rejects missing, blank, malformed, and duplicate bearer credentials', async () => {
  let verifications = 0;
  const admin = {
    auth: {
      getUser: async () => {
        verifications += 1;
        return { data: { user: null }, error: null };
      },
    },
  };
  const headers = [
    undefined,
    '',
    'Bearer',
    'Bearer   ',
    'Basic token',
    'Bearer one two',
    'Bearer one, Bearer two',
  ];

  for (const authorization of headers) {
    const request = new Request('https://app.example.com/api/resume/quota', {
      headers: authorization === undefined ? undefined : { authorization },
    });
    await assert.rejects(
      () => requireSupabaseUser(request, admin),
      error => assertResumeError(error, 'AUTH_REQUIRED', 401),
    );
  }
  assert.equal(verifications, 0);
});

test('maps rejected and failed token verification to a nonleaking AUTH_INVALID error', async () => {
  const rejected = {
    auth: {
      getUser: async () => ({
        data: { user: null },
        error: new Error('TOKEN_AND_INTERNAL_AUTH_DETAIL'),
      }),
    },
  };
  const failed = {
    auth: {
      getUser: async () => {
        throw new Error('TOKEN_AND_NETWORK_DETAIL');
      },
    },
  };

  for (const admin of [rejected, failed]) {
    await assert.rejects(
      () => requireSupabaseUser(
        new Request('https://app.example.com', { headers: { authorization: 'Bearer private-token' } }),
        admin,
      ),
      error => {
        assertResumeError(error, 'AUTH_INVALID', 401);
        assert.doesNotMatch(String(error), /private-token|TOKEN_AND_/);
        return true;
      },
    );
  }
});

test('verifies the bearer token and returns only the verified user id and email', async () => {
  const seenTokens: string[] = [];
  const admin = {
    auth: {
      getUser: async (token: string) => {
        seenTokens.push(token);
        return {
          data: {
            user: {
              id: 'verified-user',
              email: 'verified@example.com',
              phone: 'not-returned',
              user_metadata: { role: 'not-returned' },
            },
          },
          error: null,
        };
      },
    },
  };
  const request = new Request('https://app.example.com/api/resume/quota', {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-token',
      'x-user-id': 'spoofed-header-user',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ userId: 'spoofed-body-user', email: 'spoofed@example.com' }),
  });

  const user = await requireSupabaseUser(request, admin);

  assert.deepEqual(seenTokens, ['verified-token']);
  assert.deepEqual(user, { id: 'verified-user', email: 'verified@example.com' });
  assert.deepEqual(Object.keys(user), ['id', 'email']);
});
