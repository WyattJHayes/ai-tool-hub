import { parseResumeDocument } from '@/features/resume/schema';
import type { ResumeDocumentV1 } from '@/features/resume/types';
import { parseResume } from '@/server/resume/ai';
import { ResumeApiError, toResumeErrorBody } from '@/server/resume/errors';
import { reserveQuota, settleQuota, type QuotaReservation, type ReserveQuotaInput } from '@/server/resume/quota';
import { requireSupabaseUser, type SupabaseUserIdentity } from '@/server/supabase-admin';

const MAX_RESUME_LENGTH = 50_000;

interface RouteLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface ParseRouteDependencies {
  authenticate(request: Request): Promise<SupabaseUserIdentity>;
  reserve(input: ReserveQuotaInput): Promise<QuotaReservation>;
  settle(ledgerId: string, outcome: 'consumed' | 'refunded'): Promise<unknown>;
  parseResume(text: string, signal: AbortSignal): Promise<ResumeDocumentV1>;
  logger: RouteLogger;
}

const productionDependencies: ParseRouteDependencies = {
  authenticate: requireSupabaseUser,
  reserve: reserveQuota,
  settle: settleQuota,
  parseResume,
  logger: console,
};

function requestId(request: Request): string {
  const value = request.headers.get('x-request-id');
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : crypto.randomUUID();
}

function apiError(error: unknown): ResumeApiError {
  return error instanceof ResumeApiError ? error : new ResumeApiError('INTERNAL_ERROR', 500);
}

function errorResponse(error: unknown, id: string): Response {
  const normalized = apiError(error);
  return Response.json(toResumeErrorBody(normalized, id), { status: normalized.status });
}

function idempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > 200) throw new ResumeApiError('REQUEST_INVALID', 400);
  return value;
}

export function createParseRoute(dependencies: ParseRouteDependencies = productionDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const id = requestId(request);
    let ledgerId: string | undefined;
    let settlementStarted = false;
    const settleOnce = async (outcome: 'consumed' | 'refunded') => {
      if (!ledgerId || settlementStarted) return;
      settlementStarted = true;
      await dependencies.settle(ledgerId, outcome);
    };

    try {
      const user = await dependencies.authenticate(request);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      const text = body && typeof body === 'object' ? (body as { text?: unknown }).text : undefined;
      if (typeof text !== 'string' || !text.trim() || text.length > MAX_RESUME_LENGTH) {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      const reservation = await dependencies.reserve({
        userId: user.id,
        action: 'parse',
        idempotencyKey: idempotencyKey(request),
        requestId: id,
      });
      ledgerId = reservation.ledgerId;
      const result = parseResumeDocument(await dependencies.parseResume(text, request.signal));
      await settleOnce('consumed');
      dependencies.logger.info({ action: 'parse', requestId: id, status: 'consumed' });
      return Response.json(result);
    } catch (error) {
      try {
        await settleOnce('refunded');
      } catch {
        dependencies.logger.error({ action: 'parse', requestId: id, code: 'QUOTA_UNAVAILABLE' });
      }
      const normalized = apiError(error);
      dependencies.logger.error({ action: 'parse', requestId: id, code: normalized.code });
      return errorResponse(normalized, id);
    }
  };
}

export const POST = createParseRoute();
