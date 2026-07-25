import assert from 'node:assert/strict';
import test from 'node:test';
import { ResumeApiError } from '../../src/server/resume/errors';
import { createResumeAI, type ResumeAIDependencies } from '../../src/server/resume/ai';
import type { ReserveQuotaInput } from '../../src/server/resume/quota';
import { createParseRoute } from '../../src/app/api/resume/parse/route';
import { createAnalyzeJdRoute } from '../../src/app/api/resume/analyze-jd/route';
import { createOptimizeRoute } from '../../src/app/api/resume/optimize/route';
import { createQuotaRoute } from '../../src/app/api/resume/quota/route';
import type {
  AIOptimizationResult,
  AIStreamEvent,
  JDAnalysis,
  ResumeDocumentV1,
} from '../../src/features/resume/types';

const PRIVATE_RESUME = 'PRIVATE_RESUME_TEXT';
const PRIVATE_JD = 'PRIVATE_JD_TEXT';

function documentFixture(): ResumeDocumentV1 {
  return {
    schemaVersion: 1,
    id: 'resume-1',
    name: 'Resume',
    templateId: 'precision',
    profile: {
      id: 'profile-1',
      fullName: 'Ada Lovelace',
      phone: '10086',
      email: 'ada@example.com',
      location: 'London',
      title: 'Engineer',
    },
    target: 'Platform Engineer',
    summary: 'Builds reliable systems.',
    experience: [{
      id: 'experience-1',
      company: 'Example',
      role: 'Engineer',
      startDate: '2020.01',
      endDate: 'Present',
      description: 'Built systems.',
    }],
    projects: [],
    education: [],
    skills: ['TypeScript'],
    certificates: [],
    updatedAt: '2026-07-22T00:00:00.000Z',
  };
}

function jdFixture(): JDAnalysis {
  return {
    jobTitle: 'Platform Engineer',
    requiredSkills: ['TypeScript'],
    preferredSkills: ['Postgres'],
    experienceYears: 3,
    education: 'Bachelor degree',
    responsibilities: ['Build services'],
    keywords: ['reliability'],
    industry: 'Software',
    companyType: 'Product',
    matchDifficulty: 'medium',
  };
}

function optimizationFixture(level: 'light' | 'medium' | 'deep' = 'light'): AIOptimizationResult {
  return {
    level,
    optimizedData: documentFixture(),
    score: 88,
    suggestions: ['Quantify impact'],
  };
}

function openAIJson(content: unknown): Response {
  return Response.json({
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'deepseek-test',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

function aiDependencies(fetchImpl: typeof fetch): ResumeAIDependencies {
  return {
    fetch: fetchImpl,
    env: {
      deepseekApiKey: 'private-api-key',
      deepseekBaseUrl: 'https://deepseek.example/v1/',
      deepseekModel: 'deepseek-test',
    },
    timeoutMs: 60_000,
  };
}

function assertResumeError(error: unknown, code: string, status: number): boolean {
  assert.ok(error instanceof ResumeApiError);
  assert.equal(error.code, code);
  assert.equal(error.status, status);
  return true;
}

test('parses a resume through the configured DeepSeek endpoint and returns only the allowlisted schema', async () => {
  const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push([input, init]);
    return openAIJson({ ...documentFixture(), ignoredModelField: PRIVATE_JD });
  };
  const ai = createResumeAI(aiDependencies(fetchImpl));

  const result = await ai.parseResume(PRIVATE_RESUME, new AbortController().signal);

  assert.deepEqual(result, documentFixture());
  assert.equal(calls[0][0], 'https://deepseek.example/v1/chat/completions');
  const init = calls[0][1]!;
  assert.equal(new Headers(init.headers).get('authorization'), 'Bearer private-api-key');
  const body = JSON.parse(String(init.body));
  assert.equal(body.model, 'deepseek-test');
  assert.equal(body.max_tokens, 8192);
  assert.equal(body.temperature, 0);
  assert.equal(body.seed, 20260725);
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.response_format, undefined);
  assert.match(body.messages[0].content, /untrusted quoted data/i);
  assert.match(body.messages[1].content, /PRIVATE_RESUME_TEXT/);
  assert.match(body.messages[1].content, /"schemaVersion"\s*:\s*1/);
  assert.match(body.messages[1].content, /"fullName"/);
  assert.match(body.messages[1].content, /skills[\s\S]*dedicated skills[\s\S]*one list item[\s\S]*do not infer/i);
  assert.match(body.messages[1].content, /certificates[\s\S]*awards[\s\S]*honors[\s\S]*training/i);
  assert.doesNotMatch(JSON.stringify(result), /ignoredModelField|PRIVATE_JD_TEXT/);
});

test('analyzes a JD into a strict allowlisted structure', async () => {
  const fetchImpl: typeof fetch = async () => openAIJson({ ...jdFixture(), secretEcho: PRIVATE_RESUME });
  const ai = createResumeAI(aiDependencies(fetchImpl));

  const result = await ai.analyzeJobDescription(PRIVATE_JD, new AbortController().signal);

  assert.deepEqual(result, jdFixture());
  assert.doesNotMatch(JSON.stringify(result), /secretEcho|PRIVATE_RESUME_TEXT/);
});

test('maps non-2xx, malformed JSON, and invalid structures to stable nonleaking errors', async () => {
  const cases: Array<[typeof fetch, string]> = [
    [async () => Response.json({ error: { message: PRIVATE_RESUME } }, { status: 429 }), 'AI_UPSTREAM'],
    [async () => openAIJson('{not-json'), 'AI_INVALID_RESPONSE'],
    [async () => openAIJson({ ...documentFixture(), profile: { fullName: 'incomplete' } }), 'AI_INVALID_RESPONSE'],
  ];

  for (const [fetchImpl, code] of cases) {
    const ai = createResumeAI(aiDependencies(fetchImpl));
    await assert.rejects(
      () => ai.parseResume(PRIVATE_RESUME, new AbortController().signal),
      error => {
        assertResumeError(error, code, 502);
        assert.doesNotMatch(String(error), /PRIVATE_RESUME_TEXT|PRIVATE_JD_TEXT|429/);
        return true;
      },
    );
  }
});

test('aborts an AI request after the configured timeout without exposing input', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  });
  const ai = createResumeAI({ ...aiDependencies(fetchImpl), timeoutMs: 5 });

  await assert.rejects(
    () => ai.analyzeJobDescription(PRIVATE_JD, new AbortController().signal),
    error => assertResumeError(error, 'AI_TIMEOUT', 504),
  );
});

test('streams provider progress and tokens but emits done only after strict result validation', async () => {
  const result = optimizationFixture();
  const payload = JSON.stringify(result);
  const providerFrames = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: payload.slice(0, 25) } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: payload.slice(25) } }] })}\n\n`,
    'data: [DONE]\n\n',
  ];
  const response = new Response(new ReadableStream({
    start(controller) {
      for (const frame of providerFrames) controller.enqueue(new TextEncoder().encode(frame));
      controller.close();
    },
  }), { status: 200 });
  const ai = createResumeAI(aiDependencies(async () => response));
  const events: AIStreamEvent[] = [];

  for await (const event of ai.streamResumeOptimization('light', PRIVATE_RESUME, '', new AbortController().signal)) {
    events.push(event);
  }

  assert.deepEqual(events.map(event => event.type), ['progress', 'progress', 'token', 'token', 'done']);
  assert.deepEqual(events.at(-1), { type: 'done', data: result });
});

interface RouteHarness {
  authCalls: number;
  reservations: ReserveQuotaInput[];
  settlements: Array<[string, 'consumed' | 'refunded']>;
  compensations: string[];
  logs: unknown[][];
}

function routeHarness() {
  const state: RouteHarness = {
    authCalls: 0,
    reservations: [],
    settlements: [],
    compensations: [],
    logs: [],
  };
  const dependencies = {
    authenticate: async () => {
      state.authCalls += 1;
      return { id: 'verified-user', email: null };
    },
    reserve: async (input: ReserveQuotaInput) => {
      state.reservations.push(input);
      return { ledgerId: 'ledger-1', plan: 'free' as const, remaining: 9, total: 10, resetAt: null };
    },
    settle: async (ledgerId: string, outcome: 'consumed' | 'refunded') => {
      state.settlements.push([ledgerId, outcome]);
      return {};
    },
    compensate: async (ledgerId: string) => {
      state.compensations.push(ledgerId);
      return {};
    },
    logger: {
      info: (...args: unknown[]) => state.logs.push(args),
      warn: (...args: unknown[]) => state.logs.push(args),
      error: (...args: unknown[]) => state.logs.push(args),
    },
  };
  return { state, dependencies };
}

function postRequest(path: string, body: unknown, idempotencyKey = 'idem-1', signal?: AbortSignal): Request {
  return new Request(`https://app.example.com${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-token',
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey,
      'x-request-id': '00000000-0000-4000-8000-000000000001',
    },
    body: JSON.stringify(body),
    signal,
  });
}

test('authenticates before validation and rejects missing, oversized, invalid-level, and missing-JD inputs without reserving', async () => {
  const parse = routeHarness();
  const analyze = routeHarness();
  const optimize = routeHarness();
  const parseRoute = createParseRoute({ ...parse.dependencies, parseResume: async () => documentFixture() });
  const analyzeRoute = createAnalyzeJdRoute({ ...analyze.dependencies, analyzeJobDescription: async () => jdFixture() });
  const optimizeRoute = createOptimizeRoute({
    ...optimize.dependencies,
    streamResumeOptimization: async function* () { yield { type: 'done', data: optimizationFixture() }; },
  });

  const responses = [
    await parseRoute(postRequest('/api/resume/parse', {})),
    await parseRoute(postRequest('/api/resume/parse', { text: 'x'.repeat(50_001) })),
    await analyzeRoute(postRequest('/api/resume/analyze-jd', { jdText: 'x'.repeat(10_001) })),
    await optimizeRoute(postRequest('/api/resume/optimize', { level: 'invalid', resumeText: 'resume' })),
    await optimizeRoute(postRequest('/api/resume/optimize', { level: 'medium', resumeText: 'resume', jdText: '' })),
  ];

  assert.deepEqual(responses.map(response => response.status), [400, 400, 400, 400, 400]);
  assert.equal(parse.state.authCalls, 2);
  assert.equal(analyze.state.authCalls, 1);
  assert.equal(optimize.state.authCalls, 2);
  assert.equal(parse.state.reservations.length + analyze.state.reservations.length + optimize.state.reservations.length, 0);
});

test('returns the stable login error before reading or reserving protected route input', async () => {
  const { state, dependencies } = routeHarness();
  const route = createParseRoute({
    ...dependencies,
    authenticate: async () => { throw new ResumeApiError('AUTH_REQUIRED', 401); },
    parseResume: async () => { throw new Error('must not run'); },
  });

  const response = await route(postRequest('/api/resume/parse', { text: PRIVATE_RESUME }));

  assert.equal(response.status, 401);
  assert.equal(state.reservations.length, 0);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});

test('settles parse and JD reservations consumed on success and refunded once on failure', async () => {
  const parse = routeHarness();
  const analyze = routeHarness();
  const parseRoute = createParseRoute({ ...parse.dependencies, parseResume: async () => documentFixture() });
  const analyzeRoute = createAnalyzeJdRoute({
    ...analyze.dependencies,
    analyzeJobDescription: async () => { throw new Error(`${PRIVATE_RESUME} ${PRIVATE_JD}`); },
  });

  const parsed = await parseRoute(postRequest('/api/resume/parse', { text: PRIVATE_RESUME }, 'same-key'));
  const failed = await analyzeRoute(postRequest('/api/resume/analyze-jd', { jdText: PRIVATE_JD }, 'same-key'));

  assert.equal(parsed.status, 200);
  assert.equal(failed.status, 500);
  assert.deepEqual(parse.state.settlements, [['ledger-1', 'consumed']]);
  assert.deepEqual(analyze.state.settlements, [['ledger-1', 'refunded']]);
  assert.equal(parse.state.reservations[0].idempotencyKey, 'same-key');
  assert.equal(analyze.state.reservations[0].idempotencyKey, 'same-key');
  assert.doesNotMatch(JSON.stringify([...parse.state.logs, ...analyze.state.logs]), /PRIVATE_RESUME_TEXT|PRIVATE_JD_TEXT/);
});

test('parse and JD compensate a commit-then-transport-error exactly once with Basic and VIP semantics', async () => {
  const scenarios = [
    {
      plan: 'basic' as const,
      path: '/api/resume/parse',
      body: { text: 'resume' },
      create: (overrides: Record<string, unknown>) => {
        const harness = routeHarness();
        return createParseRoute({ ...harness.dependencies, ...overrides, parseResume: async () => documentFixture() });
      },
    },
    {
      plan: 'vip' as const,
      path: '/api/resume/analyze-jd',
      body: { jdText: 'job description' },
      create: (overrides: Record<string, unknown>) => {
        const harness = routeHarness();
        return createAnalyzeJdRoute({ ...harness.dependencies, ...overrides, analyzeJobDescription: async () => jdFixture() });
      },
    },
  ];

  for (const scenario of scenarios) {
    const calls: string[] = [];
    let remaining: number | null = scenario.plan === 'basic' ? 10 : null;
    const route = scenario.create({
      reserve: async () => {
        calls.push(`reserve:${scenario.plan}`);
        if (remaining !== null) remaining -= 1;
        return { ledgerId: 'ledger-1', plan: scenario.plan, remaining, total: remaining === null ? null : 10, resetAt: null };
      },
      settle: async (_ledgerId: string, outcome: 'consumed' | 'refunded') => {
        calls.push(`settle:${outcome}`);
        if (outcome === 'consumed') {
          // The database commit succeeded, but the RPC response was lost in transit.
          throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
        }
        if (remaining !== null) remaining += 1;
        return {};
      },
      compensate: async () => {
        calls.push('compensate');
        if (remaining !== null) remaining += 1;
        return {};
      },
    });

    const response = await route(postRequest(scenario.path, scenario.body));

    assert.equal(response.status, 503);
    assert.deepEqual(calls, [`reserve:${scenario.plan}`, 'settle:consumed', 'compensate']);
    assert.equal(remaining, scenario.plan === 'basic' ? 10 : null);
  }
});

test('parse and JD compensate post-result cancellation before response delivery', async () => {
  const scenarios = [
    {
      path: '/api/resume/parse',
      body: { text: 'resume' },
      create: (overrides: Record<string, unknown>) => {
        const harness = routeHarness();
        return createParseRoute({ ...harness.dependencies, ...overrides, parseResume: async () => documentFixture() });
      },
    },
    {
      path: '/api/resume/analyze-jd',
      body: { jdText: 'job description' },
      create: (overrides: Record<string, unknown>) => {
        const harness = routeHarness();
        return createAnalyzeJdRoute({ ...harness.dependencies, ...overrides, analyzeJobDescription: async () => jdFixture() });
      },
    },
  ];

  for (const scenario of scenarios) {
    const calls: string[] = [];
    let consumeStarted!: () => void;
    let finishConsume!: () => void;
    const started = new Promise<void>(resolve => { consumeStarted = resolve; });
    const consume = new Promise<void>(resolve => { finishConsume = resolve; });
    const requestController = new AbortController();
    const route = scenario.create({
      reserve: async () => {
        calls.push('reserve');
        return { ledgerId: 'ledger-1', plan: 'basic' as const, remaining: 9, total: 10, resetAt: null };
      },
      settle: async (_ledgerId: string, outcome: 'consumed' | 'refunded') => {
        calls.push(`settle:${outcome}`);
        if (outcome === 'consumed') {
          consumeStarted();
          await consume;
        }
        return {};
      },
      compensate: async () => {
        calls.push('compensate');
        return {};
      },
    });

    const pendingResponse = route(postRequest(scenario.path, scenario.body, 'post-result-cancel', requestController.signal));
    await started;
    requestController.abort();
    finishConsume();
    const response = await pendingResponse;

    assert.equal(response.status, 499);
    assert.equal((await response.json()).error.code, 'AI_CANCELLED');
    assert.deepEqual(calls, ['reserve', 'settle:consumed', 'compensate']);
  }
});

test('optimize compensates a consumed commit with a lost RPC response and never delivers done', async () => {
  const { dependencies } = routeHarness();
  const calls: string[] = [];
  const route = createOptimizeRoute({
    ...dependencies,
    reserve: async () => {
      calls.push('reserve:basic');
      return { ledgerId: 'ledger-1', plan: 'basic', remaining: 9, total: 10, resetAt: null };
    },
    settle: async (_ledgerId, outcome) => {
      calls.push(`settle:${outcome}`);
      if (outcome === 'consumed') throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
      return {};
    },
    compensate: async () => {
      calls.push('compensate');
      return {};
    },
    streamResumeOptimization: async function* () {
      yield { type: 'done', data: optimizationFixture() };
    },
  });

  const body = await (await route(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }))).text();

  assert.match(body, /event: error[\s\S]*QUOTA_UNAVAILABLE/);
  assert.doesNotMatch(body, /event: done/);
  assert.deepEqual(calls, ['reserve:basic', 'settle:consumed', 'compensate']);
});

test('forwards duplicate idempotency keys to the atomic reservation adapter without deriving identity from input', async () => {
  const { state, dependencies } = routeHarness();
  const route = createParseRoute({ ...dependencies, parseResume: async () => documentFixture() });
  const requestBody = { text: 'resume', userId: 'spoofed-user' };

  await route(postRequest('/api/resume/parse', requestBody, 'duplicate-key'));
  await route(postRequest('/api/resume/parse', requestBody, 'duplicate-key'));

  assert.deepEqual(state.reservations.map(call => [call.userId, call.idempotencyKey]), [
    ['verified-user', 'duplicate-key'],
    ['verified-user', 'duplicate-key'],
  ]);
});

test('settles optimize consumed before done, refunds failures, and compensates cancellation', async () => {
  const successful = routeHarness();
  const failed = routeHarness();
  const incomplete = routeHarness();
  const cancelled = routeHarness();
  const successRoute = createOptimizeRoute({
    ...successful.dependencies,
    streamResumeOptimization: async function* () { yield { type: 'done', data: optimizationFixture() }; },
  });
  const failedRoute = createOptimizeRoute({
    ...failed.dependencies,
    streamResumeOptimization: async function* () { throw new Error(PRIVATE_RESUME); },
  });
  const incompleteRoute = createOptimizeRoute({
    ...incomplete.dependencies,
    streamResumeOptimization: async function* () { yield { type: 'progress', data: { status: 'analyzing', level: 'light' } }; },
  });
  const cancelledRoute = createOptimizeRoute({
    ...cancelled.dependencies,
    streamResumeOptimization: async function* (_level, _resume, _jd, signal) {
      yield { type: 'progress', data: { status: 'analyzing', level: 'light' } };
      await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
    },
  });

  const successController = new AbortController();
  const successBody = await (await successRoute(postRequest(
    '/api/resume/optimize',
    { level: 'light', resumeText: 'resume' },
    'success-before-abort',
    successController.signal,
  ))).text();
  successController.abort();
  await new Promise(resolve => setTimeout(resolve, 0));
  const failedBody = await (await failedRoute(postRequest('/api/resume/optimize', { level: 'light', resumeText: PRIVATE_RESUME }))).text();
  const incompleteBody = await (await incompleteRoute(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }))).text();
  const cancelledResponse = await cancelledRoute(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }));
  const reader = cancelledResponse.body!.getReader();
  await reader.read();
  await reader.cancel();

  assert.match(successBody, /event: done/);
  assert.match(failedBody, /event: error/);
  assert.match(incompleteBody, /STREAM_INCOMPLETE/);
  assert.deepEqual(successful.state.settlements, [['ledger-1', 'consumed']]);
  assert.deepEqual(failed.state.settlements, [['ledger-1', 'refunded']]);
  assert.deepEqual(incomplete.state.settlements, [['ledger-1', 'refunded']]);
  assert.deepEqual(cancelled.state.settlements, []);
  assert.deepEqual(successful.state.compensations, []);
  assert.deepEqual(cancelled.state.compensations, ['ledger-1']);
  assert.doesNotMatch(JSON.stringify(failed.state.logs), /PRIVATE_RESUME_TEXT|PRIVATE_JD_TEXT/);
});

test('sets the required SSE response headers', async () => {
  const { dependencies } = routeHarness();
  const route = createOptimizeRoute({
    ...dependencies,
    streamResumeOptimization: async function* () { yield { type: 'done', data: optimizationFixture() }; },
  });
  const response = await route(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }));

  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  assert.equal(response.headers.get('connection'), 'keep-alive');
  await response.text();
});

test('compensates cancellation before waiting for an abort-insensitive upstream generator to return', async () => {
  const { state, dependencies } = routeHarness();
  let releaseUpstream!: () => void;
  const upstreamReleased = new Promise<void>(resolve => { releaseUpstream = resolve; });
  const route = createOptimizeRoute({
    ...dependencies,
    streamResumeOptimization: async function* () {
      yield { type: 'progress', data: { status: 'analyzing', level: 'light' } };
      await upstreamReleased;
    },
  });
  const response = await route(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }));
  const reader = response.body!.getReader();
  await reader.read();
  const cancelling = reader.cancel();
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    assert.deepEqual(state.settlements, []);
    assert.deepEqual(state.compensations, ['ledger-1']);
  } finally {
    releaseUpstream();
    await cancelling;
  }
});

test('cancellation racing a deferred failed consume compensates once and never delivers done', async () => {
  const { state, dependencies } = routeHarness();
  const attempts: Array<'consumed' | 'refunded'> = [];
  const completed: Array<'consumed' | 'refunded'> = [];
  let consumeStarted!: () => void;
  let rejectConsume!: (error: Error) => void;
  let consumeSignal: AbortSignal | undefined;
  const started = new Promise<void>(resolve => { consumeStarted = resolve; });
  const deferredConsume = new Promise<unknown>((_resolve, reject) => { rejectConsume = reject; });
  const route = createOptimizeRoute({
    ...dependencies,
    settle: async (_ledgerId, outcome, signal?: AbortSignal) => {
      attempts.push(outcome);
      if (outcome === 'consumed') {
        consumeSignal = signal;
        consumeStarted();
        signal?.addEventListener(
          'abort',
          () => rejectConsume(new ResumeApiError('QUOTA_UNAVAILABLE', 503)),
          { once: true },
        );
        return deferredConsume;
      }
      completed.push(outcome);
      return {};
    },
    streamResumeOptimization: async function* () {
      yield { type: 'done', data: optimizationFixture() };
    },
  });
  const response = await route(postRequest('/api/resume/optimize', { level: 'light', resumeText: 'resume' }));
  const reader = response.body!.getReader();
  const pendingRead = reader.read();
  await started;
  const cancelling = reader.cancel();
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    assert.equal(consumeSignal?.aborted, true);
    const read = await pendingRead;
    await cancelling;
    assert.equal(read.done, true);
    assert.equal(read.value, undefined);
    assert.deepEqual(attempts, ['consumed']);
    assert.deepEqual(completed, []);
    assert.deepEqual(state.compensations, ['ledger-1']);
  } finally {
    if (!consumeSignal?.aborted) rejectConsume(new ResumeApiError('QUOTA_UNAVAILABLE', 503));
    await cancelling;
  }
});

test('compensates once when a deferred consume commits after cancellation and never delivers done', async () => {
  const { dependencies } = routeHarness();
  const settlementAttempts: Array<'consumed' | 'refunded'> = [];
  const settlementCompletions: Array<'consumed' | 'refunded'> = [];
  const compensations: string[] = [];
  let consumeStarted!: () => void;
  let resolveConsume!: () => void;
  let consumeSignal: AbortSignal | undefined;
  const started = new Promise<void>(resolve => { consumeStarted = resolve; });
  const deferredConsume = new Promise<void>(resolve => { resolveConsume = resolve; });
  const requestController = new AbortController();
  const route = createOptimizeRoute({
    ...dependencies,
    settle: async (_ledgerId, outcome, signal?: AbortSignal) => {
      settlementAttempts.push(outcome);
      if (outcome === 'consumed') {
        consumeSignal = signal;
        consumeStarted();
        await deferredConsume;
      }
      settlementCompletions.push(outcome);
      return {};
    },
    compensate: async (ledgerId: string) => {
      compensations.push(ledgerId);
      return {};
    },
    streamResumeOptimization: async function* () {
      yield { type: 'done', data: optimizationFixture() };
    },
  });
  const response = await route(postRequest(
    '/api/resume/optimize',
    { level: 'light', resumeText: 'resume' },
    'committed-after-cancel',
    requestController.signal,
  ));
  const reader = response.body!.getReader();
  const pendingRead = reader.read();
  await started;
  requestController.abort();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(consumeSignal?.aborted, true);
  assert.deepEqual(compensations, []);
  resolveConsume();

  const errorFrame = await pendingRead;
  assert.equal(errorFrame.done, false);
  const errorText = new TextDecoder().decode(errorFrame.value);
  assert.match(errorText, /event: error[\s\S]*AI_CANCELLED/);
  assert.doesNotMatch(errorText, /event: done/);
  assert.equal((await reader.read()).done, true);
  assert.deepEqual(settlementAttempts, ['consumed']);
  assert.deepEqual(settlementCompletions, ['consumed']);
  assert.deepEqual(compensations, ['ledger-1']);
});

test('request abort promptly compensates and terminates despite an abort-insensitive upstream generator', async () => {
  const { state, dependencies } = routeHarness();
  let releaseUpstream!: () => void;
  const upstreamReleased = new Promise<void>(resolve => { releaseUpstream = resolve; });
  const route = createOptimizeRoute({
    ...dependencies,
    streamResumeOptimization: async function* () {
      yield { type: 'progress', data: { status: 'analyzing', level: 'light' } };
      await upstreamReleased;
    },
  });
  const requestController = new AbortController();
  const response = await route(postRequest(
    '/api/resume/optimize',
    { level: 'light', resumeText: 'resume' },
    'abort-request',
    requestController.signal,
  ));
  const reader = response.body!.getReader();
  await reader.read();
  const pendingRead = reader.read();
  requestController.abort();
  await new Promise(resolve => setTimeout(resolve, 0));

  try {
    assert.deepEqual(state.settlements, []);
    assert.deepEqual(state.compensations, ['ledger-1']);
    const errorFrame = await pendingRead;
    assert.equal(errorFrame.done, false);
    assert.match(new TextDecoder().decode(errorFrame.value), /event: error[\s\S]*AI_CANCELLED/);
    assert.equal((await reader.read()).done, true);
  } finally {
    releaseUpstream();
    await pendingRead;
  }
});

test('quota route requires verified authentication and returns only an allowlisted projection', async () => {
  const route = createQuotaRoute({
    authenticate: async () => ({ id: 'verified-user', email: null }),
    getQuota: async () => ({ plan: 'free', remaining: 7, total: 10, resetAt: '2026-07-23T16:00:00.000Z', private: PRIVATE_RESUME }),
    logger: { info() {}, warn() {}, error() {} },
  });
  const response = await route(new Request('https://app.example.com/api/resume/quota', {
    headers: { authorization: 'Bearer token', 'x-request-id': '00000000-0000-4000-8000-000000000001' },
  }));

  assert.deepEqual(await response.json(), {
    plan: 'free', remaining: 7, total: 10, resetAt: '2026-07-23T16:00:00.000Z',
  });
});
