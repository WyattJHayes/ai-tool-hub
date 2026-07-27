import { parseResumeDocument } from '@/features/resume/schema';
import type { ResumeDocumentV1 } from '@/features/resume/types';
import { parseResume } from '@/server/resume/ai';
import { ResumeApiError, toResumeErrorBody, toResumeErrorHeaders } from '@/server/resume/errors';
import { enforceResumeRateLimit } from '@/server/resume/rateLimit';
import {
  compensateQuota,
  reserveQuota,
  settleQuota,
  type QuotaReservation,
  type ReserveQuotaInput,
} from '@/server/resume/quota';
import { createSettlementCoordinator, type SettlementCoordinator } from '@/server/resume/settlement';
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
  compensate(ledgerId: string): Promise<unknown>;
  parseResume(text: string, signal: AbortSignal): Promise<ResumeDocumentV1>;
  enforceRateLimit(action: 'parse', userId: string): void;
  logger: RouteLogger;
}

const productionDependencies: ParseRouteDependencies = {
  authenticate: requireSupabaseUser,
  reserve: reserveQuota,
  settle: settleQuota,
  compensate: compensateQuota,
  parseResume,
  enforceRateLimit: enforceResumeRateLimit,
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
  return Response.json(toResumeErrorBody(normalized, id), {
    status: normalized.status,
    headers: toResumeErrorHeaders(normalized),
  });
}

function idempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > 200) throw new ResumeApiError('REQUEST_INVALID', 400);
  return value;
}

export function createParseRoute(dependencies: ParseRouteDependencies = productionDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const id = requestId(request);
    let settlement: SettlementCoordinator | undefined;
    let resultReady = false;

    try {
      const user = await dependencies.authenticate(request);
      dependencies.enforceRateLimit('parse', user.id);
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
      settlement = createSettlementCoordinator(
        outcome => dependencies.settle(reservation.ledgerId, outcome),
        () => dependencies.compensate(reservation.ledgerId),
      );
      const result = parseResumeDocument(await dependencies.parseResume(text, request.signal));
      resultReady = true;
      if (request.signal.aborted) throw new ResumeApiError('AI_CANCELLED', 499);
      await settlement.settle('consumed');
      if (request.signal.aborted) throw new ResumeApiError('AI_CANCELLED', 499);
      dependencies.logger.info({ action: 'parse', requestId: id, status: 'consumed' });
      return Response.json(result);
    } catch (error) {
      try {
        if (resultReady) await settlement?.compensate();
        else await settlement?.settle('refunded');
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
