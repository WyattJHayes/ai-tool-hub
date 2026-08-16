import 'server-only';

import { createClient } from '@supabase/supabase-js';
import { getServerEnv, type ServerEnv } from './env';
import { ResumeApiError } from './resume/errors';

export { ResumeApiError, toResumeErrorBody } from './resume/errors';

interface VerifiedAuthUser {
  id: string;
  email?: string | null;
}

export interface SupabaseAdminClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: VerifiedAuthUser | null };
      error: unknown | null;
    }>;
  };
}

export interface SupabaseUserIdentity {
  id: string;
  email: string | null;
}

export type SupabaseAdminClientFactory = (
  url: string,
  serviceRoleKey: string,
  options: { auth: { persistSession: false; autoRefreshToken: false } },
) => SupabaseAdminClient;

export function createSupabaseAdminClient(
  env: ServerEnv = getServerEnv(),
  factory: SupabaseAdminClientFactory = createClient as unknown as SupabaseAdminClientFactory,
): SupabaseAdminClient {
  return factory(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let productionAdminClient: SupabaseAdminClient | undefined;

export function getSupabaseAdminClient(): SupabaseAdminClient {
  productionAdminClient ??= createSupabaseAdminClient();
  return productionAdminClient;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

export async function requireSupabaseUser(
  request: Request,
  admin: SupabaseAdminClient = getSupabaseAdminClient(),
): Promise<SupabaseUserIdentity> {
  const token = bearerToken(request);
  if (!token) throw new ResumeApiError('AUTH_REQUIRED', 401);

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user?.id) throw new ResumeApiError('AUTH_INVALID', 401);
    return { id: data.user.id, email: data.user.email ?? null };
  } catch {
    throw new ResumeApiError('AUTH_INVALID', 401);
  }
}

export interface SupabaseAdminQueryResult {
  data: unknown | null;
  error: unknown | null;
}

export interface SupabaseAdminQueryBuilder extends PromiseLike<SupabaseAdminQueryResult> {
  select(columns: string): SupabaseAdminQueryBuilder;
  eq(column: string, value: unknown): SupabaseAdminQueryBuilder;
  lt(column: string, value: unknown): SupabaseAdminQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseAdminQueryBuilder;
  limit(count: number): SupabaseAdminQueryBuilder;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown | null }>;
  upsert(values: Record<string, unknown>, options?: { onConflict?: string }): Promise<SupabaseAdminQueryResult>;
  delete(): SupabaseAdminQueryBuilder;
  match(criteria: Record<string, unknown>): Promise<SupabaseAdminQueryResult>;
}

export interface SupabaseAdminQueryClient {
  from(table: string): SupabaseAdminQueryBuilder;
}

export function getSupabaseAdminQueryClient(): SupabaseAdminQueryClient {
  return getSupabaseAdminClient() as unknown as SupabaseAdminQueryClient;
}
