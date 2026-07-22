import { parseAIOptimizationResult, parseJDAnalysis, parseResumeDocument } from './schema';
import type {
  AIOptimizationResult,
  AIProgress,
  JDAnalysis,
  OptimizationLevel,
  ResumeDocumentV1,
  ResumeQuotaSummary,
} from './types';

export class ClientResumeApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(code: string, status: number, message: string, requestId: string | null = null) {
    super(message);
    this.name = 'ClientResumeApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export { ClientResumeApiError as ResumeApiError };

export interface ResumeApiClientDependencies {
  fetch: typeof fetch;
  getSession(): Promise<{ accessToken: string | null }>;
  randomUUID(): string;
}

export interface StreamOptimizeCallbacks {
  onProgress?(progress: AIProgress): void;
  onToken?(token: { content: string }): void;
  onDone?(result: AIOptimizationResult): void;
}

export interface ResumePlansAvailability {
  available: boolean;
  dailyQuota: number | null;
  xddpay: { enabled: boolean };
}

export type ResumePurchasablePlan = 'basic' | 'vip';
export type ResumePaymentOrderStatus = 'pending' | 'fulfilled' | 'expired' | 'review';

/** UI-facing boundary for the blocked Task 6 adapter. No production wire parser is implied. */
export interface ResumePaymentOrder {
  id: string;
  plan: ResumePurchasablePlan;
  status: ResumePaymentOrderStatus;
  paymentUrl: string | null;
  createdAt?: string;
}

export interface ResumePaymentClient {
  listOrders(signal?: AbortSignal): Promise<ResumePaymentOrder[]>;
  createOrder(plan: ResumePurchasablePlan, signal?: AbortSignal): Promise<ResumePaymentOrder>;
  getOrder(orderId: string, signal?: AbortSignal): Promise<ResumePaymentOrder>;
}

export interface ResumeApiClient {
  parseResume(text: string, signal?: AbortSignal): Promise<ResumeDocumentV1>;
  analyzeJobDescription(jdText: string, signal?: AbortSignal): Promise<JDAnalysis>;
  streamOptimize(
    level: OptimizationLevel,
    resumeText: string,
    jdText: string,
    callbacks?: StreamOptimizeCallbacks,
    signal?: AbortSignal,
  ): Promise<AIOptimizationResult>;
  getQuota(signal?: AbortSignal): Promise<ResumeQuotaSummary>;
  getPlansAvailability(signal?: AbortSignal): Promise<ResumePlansAvailability>;
}

async function currentSession(): Promise<{ accessToken: string | null }> {
  const { supabase } = await import('@/lib/supabase');
  if (!supabase) return { accessToken: null };
  const { data } = await supabase.auth.getSession();
  return { accessToken: data.session?.access_token ?? null };
}

const productionDependencies: ResumeApiClientDependencies = {
  fetch: globalThis.fetch,
  getSession: currentSession,
  randomUUID: () => crypto.randomUUID(),
};

function stableEnvelope(value: unknown): { code: string; message: string; requestId: string } | null {
  if (!value || typeof value !== 'object') return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return null;
  const record = error as { code?: unknown; message?: unknown; requestId?: unknown };
  return typeof record.code === 'string'
    && typeof record.message === 'string'
    && typeof record.requestId === 'string'
    ? { code: record.code, message: record.message, requestId: record.requestId }
    : null;
}

async function responseError(response: Response): Promise<ClientResumeApiError> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    value = null;
  }
  const envelope = stableEnvelope(value);
  return envelope
    ? new ClientResumeApiError(envelope.code, response.status, envelope.message, envelope.requestId)
    : new ClientResumeApiError('RESPONSE_INVALID', response.status, 'The server returned an invalid response.');
}

function quotaSummary(value: unknown): ResumeQuotaSummary {
  if (!value || typeof value !== 'object') throw new Error('invalid quota');
  const record = value as Partial<ResumeQuotaSummary>;
  const nullableInteger = (item: unknown) => item === null || (typeof item === 'number' && Number.isInteger(item) && item >= 0);
  if (
    !['free', 'basic', 'vip'].includes(record.plan ?? '')
    || !nullableInteger(record.remaining)
    || !nullableInteger(record.total)
    || !(record.resetAt === null || typeof record.resetAt === 'string')
  ) throw new Error('invalid quota');
  return { plan: record.plan!, remaining: record.remaining!, total: record.total!, resetAt: record.resetAt! };
}

function progressValue(value: unknown): AIProgress | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<AIProgress>;
  return ['analyzing', 'optimizing'].includes(record.status ?? '')
    && ['light', 'medium', 'deep'].includes(record.level ?? '')
    ? { status: record.status!, level: record.level! }
    : null;
}

const DISABLED_PLANS: ResumePlansAvailability = {
  available: false,
  dailyQuota: null,
  xddpay: { enabled: false },
};

function plansAvailability(value: unknown): ResumePlansAvailability {
  if (!value || typeof value !== 'object') return DISABLED_PLANS;
  const record = value as { dailyQuota?: unknown; xddpay?: unknown };
  const xddpay = record.xddpay && typeof record.xddpay === 'object'
    ? record.xddpay as { enabled?: unknown }
    : null;
  if (
    typeof record.dailyQuota !== 'number'
    || !Number.isInteger(record.dailyQuota)
    || record.dailyQuota < 0
  ) return DISABLED_PLANS;
  return {
    available: true,
    dailyQuota: record.dailyQuota,
    xddpay: { enabled: xddpay?.enabled === true },
  };
}

export function createResumeApiClient(dependencies: ResumeApiClientDependencies = productionDependencies): ResumeApiClient {
  const request = (input: RequestInfo | URL, init?: RequestInit) => dependencies.fetch.call(globalThis, input, init);

  async function headers(billed: boolean): Promise<Headers> {
    const session = await dependencies.getSession();
    if (!session.accessToken) {
      throw new ClientResumeApiError('AUTH_REQUIRED', 401, 'Authentication is required.');
    }
    const result = new Headers({
      authorization: `Bearer ${session.accessToken}`,
      'x-request-id': dependencies.randomUUID(),
    });
    if (billed) {
      result.set('content-type', 'application/json');
      result.set('idempotency-key', dependencies.randomUUID());
    }
    return result;
  }

  async function jsonAction<T>(
    path: string,
    body: unknown,
    parser: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await request(path, {
        method: 'POST',
        headers: await headers(true),
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw new ClientResumeApiError('REQUEST_CANCELLED', 499, 'The request was cancelled.');
      throw error;
    }
    if (!response.ok) throw await responseError(response);
    let value: unknown;
    try {
      value = await response.json();
      return parser(value);
    } catch {
      throw new ClientResumeApiError('RESPONSE_INVALID', 502, 'The server returned an invalid response.');
    }
  }

  return {
    parseResume(text, signal) {
      return jsonAction('/api/resume/parse', { text }, parseResumeDocument, signal);
    },

    analyzeJobDescription(jdText, signal) {
      return jsonAction('/api/resume/analyze-jd', { jdText }, parseJDAnalysis, signal);
    },

    async streamOptimize(level, resumeText, jdText, callbacks = {}, signal) {
      let response: Response;
      try {
        response = await request('/api/resume/optimize', {
          method: 'POST',
          headers: await headers(true),
          body: JSON.stringify({ level, resumeText, jdText }),
          signal,
        });
      } catch (error) {
        if (signal?.aborted) throw new ClientResumeApiError('REQUEST_CANCELLED', 499, 'The request was cancelled.');
        throw error;
      }
      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new ClientResumeApiError('STREAM_INCOMPLETE', 502, 'The AI stream ended before completion.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let doneResult: AIOptimizationResult | null = null;
      let streamError: ClientResumeApiError | null = null;
      const cancelReader = () => { void reader.cancel(); };
      signal?.addEventListener('abort', cancelReader, { once: true });

      const dispatch = (block: string) => {
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of block.split(/\r?\n/)) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) return;
        let value: unknown;
        try {
          value = JSON.parse(dataLines.join('\n'));
        } catch {
          return;
        }
        if (eventName === 'progress') {
          const progress = progressValue(value);
          if (progress) callbacks.onProgress?.(progress);
        } else if (eventName === 'token') {
          const content = value && typeof value === 'object' ? (value as { content?: unknown }).content : undefined;
          if (typeof content === 'string') callbacks.onToken?.({ content });
        } else if (eventName === 'done') {
          try {
            const parsed = parseAIOptimizationResult(value);
            if (parsed.level === level) {
              doneResult = parsed;
              callbacks.onDone?.(parsed);
            }
          } catch {
            // An invalid final payload is indistinguishable from an incomplete stream.
          }
        } else if (eventName === 'error') {
          const envelope = stableEnvelope(value);
          streamError = envelope
            ? new ClientResumeApiError(envelope.code, 502, envelope.message, envelope.requestId)
            : new ClientResumeApiError('RESPONSE_INVALID', 502, 'The server returned an invalid response.');
        }
      };

      try {
        while (!doneResult && !streamError) {
          const next = await reader.read();
          if (next.done) break;
          buffer += decoder.decode(next.value, { stream: true });
          let boundary = /\r?\n\r?\n/.exec(buffer);
          while (boundary) {
            dispatch(buffer.slice(0, boundary.index));
            buffer = buffer.slice(boundary.index + boundary[0].length);
            if (doneResult || streamError) break;
            boundary = /\r?\n\r?\n/.exec(buffer);
          }
        }
        buffer += decoder.decode();
        if (!doneResult && !streamError && buffer.trim()) dispatch(buffer.trim());
        if (signal?.aborted) throw new ClientResumeApiError('REQUEST_CANCELLED', 499, 'The request was cancelled.');
        if (streamError) throw streamError;
        if (!doneResult) throw new ClientResumeApiError('STREAM_INCOMPLETE', 502, 'The AI stream ended before completion.');
        return doneResult;
      } finally {
        signal?.removeEventListener('abort', cancelReader);
        await reader.cancel().catch(() => undefined);
      }
    },

    async getQuota(signal) {
      const response = await request('/api/resume/quota', { headers: await headers(false), signal });
      if (!response.ok) throw await responseError(response);
      try {
        return quotaSummary(await response.json());
      } catch {
        throw new ClientResumeApiError('RESPONSE_INVALID', 502, 'The server returned an invalid response.');
      }
    },

    async getPlansAvailability(signal) {
      try {
        const response = await request('/api/resume/plans', {
          headers: { 'x-request-id': dependencies.randomUUID() },
          signal,
        });
        if (!response.ok) return DISABLED_PLANS;
        return plansAvailability(await response.json());
      } catch {
        return DISABLED_PLANS;
      }
    },
  };
}

export const resumeApi = createResumeApiClient();
