import { parseAIOptimizationResult } from '@/features/resume/schema';
import type { AIStreamEvent, OptimizationLevel } from '@/features/resume/types';
import { streamResumeOptimization } from '@/server/resume/ai';
import { ResumeApiError, toResumeErrorBody } from '@/server/resume/errors';
import { reserveQuota, settleQuota, type QuotaReservation, type ReserveQuotaInput } from '@/server/resume/quota';
import { createSettlementCoordinator } from '@/server/resume/settlement';
import { requireSupabaseUser, type SupabaseUserIdentity } from '@/server/supabase-admin';

const MAX_RESUME_LENGTH = 50_000;
const MAX_JD_LENGTH = 10_000;
const encoder = new TextEncoder();

interface RouteLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface OptimizeRouteDependencies {
  authenticate(request: Request): Promise<SupabaseUserIdentity>;
  reserve(input: ReserveQuotaInput): Promise<QuotaReservation>;
  settle(ledgerId: string, outcome: 'consumed' | 'refunded', signal?: AbortSignal): Promise<unknown>;
  streamResumeOptimization(
    level: OptimizationLevel,
    resumeText: string,
    jdText: string,
    signal: AbortSignal,
  ): AsyncGenerator<AIStreamEvent>;
  logger: RouteLogger;
}

const productionDependencies: OptimizeRouteDependencies = {
  authenticate: requireSupabaseUser,
  reserve: reserveQuota,
  settle: settleQuota,
  streamResumeOptimization,
  logger: console,
};

function requestId(request: Request): string {
  const value = request.headers.get('x-request-id');
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : crypto.randomUUID();
}

function idempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > 200) throw new ResumeApiError('REQUEST_INVALID', 400);
  return value;
}

function normalizedError(error: unknown): ResumeApiError {
  return error instanceof ResumeApiError ? error : new ResumeApiError('INTERNAL_ERROR', 500);
}

function sse(type: AIStreamEvent['type'], data: unknown): Uint8Array {
  return encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function createOptimizeRoute(dependencies: OptimizeRouteDependencies = productionDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const id = requestId(request);
    let user: SupabaseUserIdentity;
    let body: unknown;
    try {
      user = await dependencies.authenticate(request);
      try {
        body = await request.json();
      } catch {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      if (!body || typeof body !== 'object') throw new ResumeApiError('REQUEST_INVALID', 400);
      const input = body as { level?: unknown; resumeText?: unknown; jdText?: unknown };
      if (!['light', 'medium', 'deep'].includes(String(input.level))) {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      if (typeof input.resumeText !== 'string' || !input.resumeText.trim() || input.resumeText.length > MAX_RESUME_LENGTH) {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      if (input.jdText !== undefined && typeof input.jdText !== 'string') throw new ResumeApiError('REQUEST_INVALID', 400);
      const jdText = input.jdText ?? '';
      if (jdText.length > MAX_JD_LENGTH || (input.level !== 'light' && !jdText.trim())) {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }

      const level = input.level as OptimizationLevel;
      const reservation = await dependencies.reserve({
        userId: user.id,
        action: `optimize-${level}`,
        idempotencyKey: idempotencyKey(request),
        requestId: id,
      });
      const upstreamController = new AbortController();
      const consumeSettlementController = new AbortController();
      const settlement = createSettlementCoordinator(outcome => dependencies.settle(
        reservation.ledgerId,
        outcome,
        outcome === 'consumed' ? consumeSettlementController.signal : undefined,
      ));
      type StreamPhase = 'open' | 'consuming' | 'terminating' | 'done' | 'closed';
      let phase: StreamPhase = 'open';
      let consumerCancelled = false;
      let generator: AsyncGenerator<AIStreamEvent> | undefined;
      let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
      let termination: Promise<void> | undefined;

      const detachRequestAbort = () => request.signal.removeEventListener('abort', abortFromRequest);
      const stopGenerator = () => {
        upstreamController.abort(new DOMException('Request cancelled', 'AbortError'));
        consumeSettlementController.abort(new DOMException('Request cancelled', 'AbortError'));
        void generator?.return(undefined).catch(() => undefined);
      };
      const closeStream = () => {
        if (phase === 'closed' || consumerCancelled) return;
        phase = 'closed';
        streamController?.close();
      };
      const terminate = (error: ResumeApiError, emitError: boolean): Promise<void> => {
        if (phase === 'done' || phase === 'closed') return Promise.resolve();
        if (termination) return termination;
        phase = 'terminating';
        stopGenerator();
        termination = (async () => {
          try {
            await settlement.settle('refunded');
          } catch {
            dependencies.logger.error({ action: `optimize-${level}`, requestId: id, code: 'QUOTA_UNAVAILABLE' });
          }
          dependencies.logger.error({ action: `optimize-${level}`, requestId: id, code: error.code });
          detachRequestAbort();
          if (emitError && !consumerCancelled) {
            streamController?.enqueue(sse('error', toResumeErrorBody(error, id)));
          }
          closeStream();
        })();
        return termination;
      };
      const abortFromRequest = () => {
        void terminate(new ResumeApiError('AI_CANCELLED', 499), true);
      };

      const pump = async () => {
        let doneReceived = false;
        try {
          generator = dependencies.streamResumeOptimization(level, input.resumeText as string, jdText, upstreamController.signal);
          for await (const event of generator) {
            if (phase !== 'open') return;
            if (event.type === 'progress') {
              streamController?.enqueue(sse('progress', event.data));
            } else if (event.type === 'token' && typeof event.data?.content === 'string') {
              streamController?.enqueue(sse('token', { content: event.data.content }));
            } else if (event.type === 'done') {
              const result = parseAIOptimizationResult(event.data);
              if (result.level !== level) throw new ResumeApiError('AI_INVALID_RESPONSE', 502);
              phase = 'consuming';
              await settlement.settle('consumed');
              if (phase !== 'consuming') return;
              phase = 'done';
              streamController?.enqueue(sse('done', { ...result, quota: {
                plan: reservation.plan,
                remaining: reservation.remaining,
                total: reservation.total,
                resetAt: reservation.resetAt,
              } }));
              doneReceived = true;
              dependencies.logger.info({ action: `optimize-${level}`, requestId: id, status: 'consumed' });
              detachRequestAbort();
              streamController?.close();
              break;
            }
          }
          if (!doneReceived && phase === 'open') {
            throw new ResumeApiError('STREAM_INCOMPLETE', 502);
          }
        } catch (error) {
          await terminate(normalizedError(error), !consumerCancelled);
        }
      };

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
          void pump();
        },
        async cancel() {
          consumerCancelled = true;
          await terminate(new ResumeApiError('AI_CANCELLED', 499), false);
        },
      });

      if (request.signal.aborted) abortFromRequest();
      else request.signal.addEventListener('abort', abortFromRequest, { once: true });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Accel-Buffering': 'no',
          'Connection': 'keep-alive',
        },
      });
    } catch (error) {
      const normalized = normalizedError(error);
      dependencies.logger.error({ action: 'optimize', requestId: id, code: normalized.code });
      return Response.json(toResumeErrorBody(normalized, id), { status: normalized.status });
    }
  };
}

export const POST = createOptimizeRoute();
