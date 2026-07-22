import { getServerEnv } from '@/server/env';
import { ResumeApiError, toResumeErrorBody } from '@/server/resume/errors';
import { getSupabaseAdminClient } from '@/server/supabase-admin';
import { requireSupabaseUser, type SupabaseUserIdentity } from '@/server/supabase-admin';
import type { ResumeQuotaSummary } from '@/features/resume/types';

interface RouteLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface QuotaRouteDependencies {
  authenticate(request: Request): Promise<SupabaseUserIdentity>;
  getQuota(userId: string): Promise<unknown>;
  logger: RouteLogger;
}

interface QuotaAccountRow {
  plan: 'free' | 'basic' | 'vip';
  quota_total: number;
  quota_remaining: number;
  is_unlimited: boolean;
  free_daily_used: number;
  free_usage_date: string;
}

interface QuotaQueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: QuotaAccountRow | null; error: unknown | null }>;
      };
    };
  };
}

function shanghaiDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function nextShanghaiMidnight(): string {
  const parts = shanghaiDate().split('-').map(Number);
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1) - 8 * 60 * 60 * 1000).toISOString();
}

async function productionGetQuota(userId: string): Promise<ResumeQuotaSummary> {
  const env = getServerEnv();
  const client = getSupabaseAdminClient() as unknown as QuotaQueryClient;
  let result: { data: QuotaAccountRow | null; error: unknown | null };
  try {
    result = await client.from('resume_quota_accounts')
      .select('plan,quota_total,quota_remaining,is_unlimited,free_daily_used,free_usage_date')
      .eq('user_id', userId)
      .maybeSingle();
  } catch {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  if (result.error) throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  const row = result.data;
  if (!row) return { plan: 'free', remaining: env.dailyQuota, total: env.dailyQuota, resetAt: nextShanghaiMidnight() };
  if (!['free', 'basic', 'vip'].includes(row.plan)) throw new ResumeApiError('QUOTA_ACCOUNT_INVALID', 409);
  if (row.plan === 'vip' && row.is_unlimited) return { plan: 'vip', remaining: null, total: null, resetAt: null };
  if (row.plan === 'basic') {
    return { plan: 'basic', remaining: row.quota_remaining, total: row.quota_total, resetAt: null };
  }
  const used = row.free_usage_date === shanghaiDate() ? row.free_daily_used : 0;
  return {
    plan: 'free',
    remaining: Math.max(0, env.dailyQuota - used),
    total: env.dailyQuota,
    resetAt: nextShanghaiMidnight(),
  };
}

const productionDependencies: QuotaRouteDependencies = {
  authenticate: requireSupabaseUser,
  getQuota: productionGetQuota,
  logger: console,
};

function requestId(request: Request): string {
  const value = request.headers.get('x-request-id');
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : crypto.randomUUID();
}

function quotaProjection(value: unknown): ResumeQuotaSummary {
  if (!value || typeof value !== 'object') throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  const row = value as Partial<ResumeQuotaSummary>;
  if (!['free', 'basic', 'vip'].includes(row.plan ?? '')) throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  const nullableInteger = (item: unknown) => item === null || (typeof item === 'number' && Number.isInteger(item) && item >= 0);
  if (!nullableInteger(row.remaining) || !nullableInteger(row.total) || !(row.resetAt === null || typeof row.resetAt === 'string')) {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  return { plan: row.plan!, remaining: row.remaining!, total: row.total!, resetAt: row.resetAt! };
}

export function createQuotaRoute(dependencies: QuotaRouteDependencies = productionDependencies) {
  return async function GET(request: Request): Promise<Response> {
    const id = requestId(request);
    try {
      const user = await dependencies.authenticate(request);
      return Response.json(quotaProjection(await dependencies.getQuota(user.id)));
    } catch (error) {
      const normalized = error instanceof ResumeApiError ? error : new ResumeApiError('INTERNAL_ERROR', 500);
      dependencies.logger.error({ action: 'quota', requestId: id, code: normalized.code });
      return Response.json(toResumeErrorBody(normalized, id), { status: normalized.status });
    }
  };
}

export const GET = createQuotaRoute();
