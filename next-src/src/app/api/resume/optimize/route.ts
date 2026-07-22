import { parseAIOptimizationResult } from '@/features/resume/schema';
import type { AIStreamEvent, OptimizationLevel } from '@/features/resume/types';
import { streamResumeOptimization } from '@/server/resume/ai';
import { ResumeApiError, toResumeErrorBody } from '@/server/resume/errors';
import { reserveQuota, settleQuota, type QuotaReservation, type ReserveQuotaInput } from '@/server/resume/quota';
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
  settle(ledgerId: string, outcome: 'consumed' | 'refunded'): Promise<unknown>;
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
      const abortController = new AbortController();
      const abortFromRequest = () => abortController.abort(request.signal.reason);
      if (request.signal.aborted) abortFromRequest();
      else request.signal.addEventListener('abort', abortFromRequest, { once: true });
      let settled = false;
      let cancelled = false;
      let generator: AsyncGenerator<AIStreamEvent> | undefined;
      const settleOnce = async (outcome: 'consumed' | 'refunded') => {
        if (settled) return;
        settled = true;
        await dependencies.settle(reservation.ledgerId, outcome);
      };

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let doneReceived = false;
          try {
            generator = dependencies.streamResumeOptimization(level, input.resumeText as string, jdText, abortController.signal);
            for await (const event of generator) {
              if (cancelled) return;
              if (event.type === 'progress') {
                controller.enqueue(sse('progress', event.data));
              } else if (event.type === 'token' && typeof event.data?.content === 'string') {
                controller.enqueue(sse('token', { content: event.data.content }));
              } else if (event.type === 'done') {
                const result = parseAIOptimizationResult(event.data);
                if (result.level !== level) throw new ResumeApiError('AI_INVALID_RESPONSE', 502);
                await settleOnce('consumed');
                if (cancelled) return;
                controller.enqueue(sse('done', { ...result, quota: {
                  plan: reservation.plan,
                  remaining: reservation.remaining,
                  total: reservation.total,
                  resetAt: reservation.resetAt,
                } }));
                doneReceived = true;
                dependencies.logger.info({ action: `optimize-${level}`, requestId: id, status: 'consumed' });
                break;
              }
            }
            if (!doneReceived && !cancelled) throw new ResumeApiError('STREAM_INCOMPLETE', 502);
            if (!cancelled) controller.close();
          } catch (error) {
            try {
              await settleOnce('refunded');
            } catch {
              dependencies.logger.error({ action: `optimize-${level}`, requestId: id, code: 'QUOTA_UNAVAILABLE' });
            }
            const normalized = normalizedError(error);
            dependencies.logger.error({ action: `optimize-${level}`, requestId: id, code: normalized.code });
            if (!cancelled) {
              controller.enqueue(sse('error', toResumeErrorBody(normalized, id)));
              controller.close();
            }
          } finally {
            request.signal.removeEventListener('abort', abortFromRequest);
          }
        },
        async cancel() {
          cancelled = true;
          abortController.abort(new DOMException('Client cancelled', 'AbortError'));
          try {
            await settleOnce('refunded');
          } catch {
            dependencies.logger.error({ action: `optimize-${level}`, requestId: id, code: 'QUOTA_UNAVAILABLE' });
          } finally {
            await generator?.return(undefined);
          }
        },
      });

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
