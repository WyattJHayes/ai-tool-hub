import { parseJDAnalysis } from '@/features/resume/schema';
import type { JDAnalysis } from '@/features/resume/types';
import { analyzeJobDescription } from '@/server/resume/ai';
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

const MAX_JD_LENGTH = 10_000;

interface RouteLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface AnalyzeJdRouteDependencies {
  authenticate(request: Request): Promise<SupabaseUserIdentity>;
  reserve(input: ReserveQuotaInput): Promise<QuotaReservation>;
  settle(ledgerId: string, outcome: 'consumed' | 'refunded'): Promise<unknown>;
  compensate(ledgerId: string): Promise<unknown>;
  analyzeJobDescription(jdText: string, signal: AbortSignal): Promise<JDAnalysis>;
  enforceRateLimit(action: 'analyze-jd', userId: string): void;
  logger: RouteLogger;
}

const productionDependencies: AnalyzeJdRouteDependencies = {
  authenticate: requireSupabaseUser,
  reserve: reserveQuota,
  settle: settleQuota,
  compensate: compensateQuota,
  analyzeJobDescription,
  enforceRateLimit: enforceResumeRateLimit,
  logger: console,
};

function requestId(request: Request): string {
  const value = request.headers.get('x-request-id');
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : crypto.randomUUID();
}

function normalizedError(error: unknown): ResumeApiError {
  return error instanceof ResumeApiError ? error : new ResumeApiError('INTERNAL_ERROR', 500);
}

function idempotencyKey(request: Request): string {
  const value = request.headers.get('idempotency-key')?.trim();
  if (!value || value.length > 200) throw new ResumeApiError('REQUEST_INVALID', 400);
  return value;
}

export function createAnalyzeJdRoute(dependencies: AnalyzeJdRouteDependencies = productionDependencies) {
  return async function POST(request: Request): Promise<Response> {
    const id = requestId(request);
    let settlement: SettlementCoordinator | undefined;
    let resultReady = false;

    try {
      const user = await dependencies.authenticate(request);
      dependencies.enforceRateLimit('analyze-jd', user.id);
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      const jdText = body && typeof body === 'object' ? (body as { jdText?: unknown }).jdText : undefined;
      if (typeof jdText !== 'string' || !jdText.trim() || jdText.length > MAX_JD_LENGTH) {
        throw new ResumeApiError('REQUEST_INVALID', 400);
      }
      const reservation = await dependencies.reserve({
        userId: user.id,
        action: 'analyze-jd',
        idempotencyKey: idempotencyKey(request),
        requestId: id,
      });
      settlement = createSettlementCoordinator(
        outcome => dependencies.settle(reservation.ledgerId, outcome),
        () => dependencies.compensate(reservation.ledgerId),
      );
      const result = parseJDAnalysis(await dependencies.analyzeJobDescription(jdText, request.signal));
      resultReady = true;
      if (request.signal.aborted) throw new ResumeApiError('AI_CANCELLED', 499);
      await settlement.settle('consumed');
      if (request.signal.aborted) throw new ResumeApiError('AI_CANCELLED', 499);
      dependencies.logger.info({ action: 'analyze-jd', requestId: id, status: 'consumed' });
      return Response.json(result);
    } catch (error) {
      try {
        if (resultReady) await settlement?.compensate();
        else await settlement?.settle('refunded');
      } catch {
        dependencies.logger.error({ action: 'analyze-jd', requestId: id, code: 'QUOTA_UNAVAILABLE' });
      }
      const normalized = normalizedError(error);
      dependencies.logger.error({ action: 'analyze-jd', requestId: id, code: normalized.code });
      return Response.json(toResumeErrorBody(normalized, id), {
        status: normalized.status,
        headers: toResumeErrorHeaders(normalized),
      });
    }
  };
}

export const POST = createAnalyzeJdRoute();
