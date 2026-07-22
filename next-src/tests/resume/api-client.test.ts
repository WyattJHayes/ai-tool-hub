import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ClientResumeApiError,
  createResumeApiClient,
  ResumeApiError,
  type ResumeApiClientDependencies,
} from '../../src/features/resume/api';
import type { AIOptimizationResult, ResumeDocumentV1 } from '../../src/features/resume/types';

function documentFixture(): ResumeDocumentV1 {
  return {
    schemaVersion: 1,
    id: 'resume-1',
    name: 'Resume',
    templateId: 'precision',
    profile: { id: 'profile-1', fullName: '李雷', phone: '', email: '', location: '', title: '工程师' },
    target: '',
    summary: '可靠性工程师',
    experience: [],
    projects: [],
    education: [],
    skills: ['TypeScript'],
    certificates: [],
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

function optimizationFixture(): AIOptimizationResult {
  return { level: 'light', optimizedData: documentFixture(), score: 90, suggestions: ['量化成果'] };
}

function dependencies(fetchImpl: typeof fetch, sessionCalls: string[]): ResumeApiClientDependencies {
  let id = 0;
  return {
    fetch: fetchImpl,
    getSession: async () => {
      sessionCalls.push('session');
      return { accessToken: 'current-access-token' };
    },
    randomUUID: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
  };
}

function chunkedSse(frames: string[], splitOffsets: number[]): Response {
  const encoded = new TextEncoder().encode(frames.join(''));
  const chunks: Uint8Array[] = [];
  let start = 0;
  for (const end of splitOffsets) {
    chunks.push(encoded.slice(start, end));
    start = end;
  }
  chunks.push(encoded.slice(start));
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
}

test('gets the current session for every action and attaches unique request and idempotency IDs without persistence', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const sessions: string[] = [];
  const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storageCalls: string[] = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => { storageCalls.push(`get:${key}`); return null; },
      setItem: (key: string) => storageCalls.push(`set:${key}`),
    },
  });
  const client = createResumeApiClient(dependencies(async (input, init) => {
    calls.push([input, init]);
    return Response.json(documentFixture());
  }, sessions));

  try {
    await client.parseResume('PRIVATE_RESUME_TEXT');
    await client.parseResume('PRIVATE_RESUME_TEXT');
  } finally {
    if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }

  assert.deepEqual(sessions, ['session', 'session']);
  assert.deepEqual(storageCalls, []);
  const headers = calls.map(([, init]) => new Headers(init?.headers));
  assert.deepEqual(headers.map(value => value.get('authorization')), ['Bearer current-access-token', 'Bearer current-access-token']);
  assert.notEqual(headers[0].get('idempotency-key'), headers[1].get('idempotency-key'));
  assert.notEqual(headers[0].get('x-request-id'), headers[1].get('x-request-id'));
  assert.match(String(calls[0][1]?.body), /PRIVATE_RESUME_TEXT/);
});

test('requires a current Supabase session before a protected request', async () => {
  let fetchCalls = 0;
  const client = createResumeApiClient({
    fetch: async () => { fetchCalls += 1; return Response.json({}); },
    getSession: async () => ({ accessToken: null }),
    randomUUID: () => '00000000-0000-4000-8000-000000000001',
  });

  await assert.rejects(
    () => client.parseResume('resume'),
    error => error instanceof ClientResumeApiError
      && error instanceof ResumeApiError
      && error.code === 'AUTH_REQUIRED'
      && error.status === 401,
  );
  assert.equal(fetchCalls, 0);
});

test('loads public plan availability without reading or persisting an auth session', async () => {
  const sessions: string[] = [];
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const client = createResumeApiClient(dependencies(async (input, init) => {
    calls.push([input, init]);
    return Response.json({ dailyQuota: 3, xddpay: { enabled: true } });
  }, sessions));

  assert.deepEqual(await client.getPlansAvailability(), {
    available: true,
    dailyQuota: 3,
    xddpay: { enabled: true },
  });
  assert.deepEqual(sessions, []);
  assert.equal(calls[0][0], '/api/resume/plans');
  assert.equal(new Headers(calls[0][1]?.headers).has('authorization'), false);
});

test('keeps the channel disabled while retaining effective quota from a valid plans response', async () => {
  for (const xddpay of [{ enabled: false }, {}]) {
    const client = createResumeApiClient(dependencies(async () => Response.json({ dailyQuota: 3, xddpay }), []));
    assert.deepEqual(await client.getPlansAvailability(), {
      available: true,
      dailyQuota: 3,
      xddpay: { enabled: false },
    });
  }
});

test('fails closed when the blocked plans endpoint is missing or its effective quota is malformed', async () => {
  for (const response of [
    new Response(null, { status: 404 }),
    Response.json({ dailyQuota: '3', xddpay: { enabled: true } }),
  ]) {
    const client = createResumeApiClient(dependencies(async () => response, []));
    assert.deepEqual(await client.getPlansAvailability(), {
      available: false,
      dailyQuota: null,
      xddpay: { enabled: false },
    });
  }
});

test('maps stable JSON error envelopes to ClientResumeApiError without response details', async () => {
  const client = createResumeApiClient(dependencies(async () => Response.json({
    error: { code: 'QUOTA_EXHAUSTED', message: 'No quota remains.', requestId: 'request-1' },
    private: 'PRIVATE_JD_TEXT',
  }, { status: 429 }), []));

  await assert.rejects(
    () => client.analyzeJobDescription('PRIVATE_JD_TEXT'),
    error => {
      assert.ok(error instanceof ClientResumeApiError);
      assert.equal(error.code, 'QUOTA_EXHAUSTED');
      assert.equal(error.status, 429);
      assert.equal(error.requestId, 'request-1');
      assert.doesNotMatch(String(error), /PRIVATE_JD_TEXT/);
      return true;
    },
  );
});

test('parses SSE across split event names, UTF-8 characters, and JSON boundaries and returns only valid done', async () => {
  const result = optimizationFixture();
  const frames = [
    `event: progress\ndata: ${JSON.stringify({ status: 'analyzing', level: 'light' })}\n\n`,
    `event: token\ndata: ${JSON.stringify({ content: '你好' })}\n\n`,
    `event: done\ndata: ${JSON.stringify({ ...result, ignored: 'PRIVATE_JD_TEXT' })}\n\n`,
  ];
  const joined = frames.join('');
  const utf8Start = new TextEncoder().encode(joined.slice(0, joined.indexOf('你'))).length;
  const sessions: string[] = [];
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const client = createResumeApiClient(dependencies(async (input, init) => {
    calls.push([input, init]);
    return chunkedSse(frames, [3, 9, utf8Start + 1, utf8Start + 2, utf8Start + 17]);
  }, sessions));
  const progress: unknown[] = [];
  const tokens: string[] = [];

  const done = await client.streamOptimize('light', 'PRIVATE_RESUME_TEXT', '', {
    onProgress: value => progress.push(value),
    onToken: value => tokens.push(value.content),
  });

  assert.deepEqual(progress, [{ status: 'analyzing', level: 'light' }]);
  assert.deepEqual(tokens, ['你好']);
  assert.deepEqual(done, result);
  assert.doesNotMatch(JSON.stringify(done), /ignored|PRIVATE_JD_TEXT/);
  const headers = new Headers(calls[0][1]?.headers);
  assert.equal(headers.get('authorization'), 'Bearer current-access-token');
  assert.ok(headers.get('idempotency-key'));
});

test('maps SSE error events to ClientResumeApiError', async () => {
  const response = chunkedSse([
    'event: error\n',
    `data: ${JSON.stringify({ error: { code: 'AI_UPSTREAM', message: 'AI is unavailable.', requestId: 'request-2' } })}\n\n`,
  ], [7, 21]);
  const client = createResumeApiClient(dependencies(async () => response, []));

  await assert.rejects(
    () => client.streamOptimize('light', 'resume', '', {}),
    error => error instanceof ClientResumeApiError
      && error.code === 'AI_UPSTREAM'
      && error.requestId === 'request-2',
  );
});

test('treats malformed done and EOF without done as incomplete streams', async () => {
  const responses = [
    chunkedSse([`event: done\ndata: ${JSON.stringify({ level: 'light' })}\n\n`], []),
    chunkedSse(['event: token\ndata: {"content":"partial"}\n\n'], []),
  ];

  for (const response of responses) {
    const client = createResumeApiClient(dependencies(async () => response, []));
    await assert.rejects(
      () => client.streamOptimize('light', 'resume', '', {}),
      error => error instanceof ClientResumeApiError && error.code === 'STREAM_INCOMPLETE',
    );
  }
});

test('cancels the SSE reader when the caller aborts', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: progress\ndata: {"status":"analyzing","level":"light"}\n\n'));
    },
    cancel() { cancelled = true; },
  }));
  const client = createResumeApiClient(dependencies(async () => response, []));
  const controller = new AbortController();
  const promise = client.streamOptimize('light', 'resume', '', {
    onProgress: () => controller.abort(),
  }, controller.signal);

  await assert.rejects(
    () => promise,
    error => error instanceof ClientResumeApiError && error.code === 'REQUEST_CANCELLED',
  );
  assert.equal(cancelled, true);
});
