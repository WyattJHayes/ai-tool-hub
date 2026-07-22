import 'server-only';

import { getSupabaseAdminClient } from '../supabase-admin';
import { ResumeApiError } from './errors';

export { ResumeApiError, toResumeErrorBody } from './errors';

export interface ResumeRpcResult {
  data: unknown;
  error: unknown | null;
}

export interface ResumeRpcOperation extends PromiseLike<ResumeRpcResult> {
  abortSignal?(signal: AbortSignal): PromiseLike<ResumeRpcResult>;
}

export interface ResumeRpcClient {
  rpc(name: string, args: Record<string, unknown>): ResumeRpcOperation;
}

export interface ReserveQuotaInput {
  userId: string;
  action: string;
  idempotencyKey: string;
  requestId: string;
}

export type QuotaSettlementOutcome = 'consumed' | 'refunded';
export type ResumePlan = 'free' | 'basic' | 'vip';

export interface QuotaReservation {
  ledgerId: string;
  plan: ResumePlan;
  remaining: number | null;
  total: number | null;
  resetAt: string | null;
}

interface ReservationRow {
  ledger_id: string;
  plan: ResumePlan;
  remaining: number | null;
  total: number | null;
  reset_at: string | null;
}

function defaultClient(): ResumeRpcClient {
  return getSupabaseAdminClient() as unknown as ResumeRpcClient;
}

function isRpcClient(value: ResumeRpcClient | ReserveQuotaInput): value is ResumeRpcClient {
  return typeof (value as ResumeRpcClient).rpc === 'function';
}

function sqlErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function mapQuotaError(error: unknown): ResumeApiError {
  switch (sqlErrorMessage(error)) {
    case 'RESUME_QUOTA_EXHAUSTED':
      return new ResumeApiError('QUOTA_EXHAUSTED', 429);
    case 'RESUME_INVALID_RESERVATION':
    case 'RESUME_INVALID_SETTLEMENT':
    case 'RESUME_INVALID_COMPENSATION':
      return new ResumeApiError('QUOTA_INVALID_REQUEST', 400);
    case 'RESUME_LEDGER_NOT_FOUND':
      return new ResumeApiError('QUOTA_RESERVATION_NOT_FOUND', 404);
    case 'RESUME_LEDGER_ALREADY_SETTLED':
      return new ResumeApiError('QUOTA_ALREADY_SETTLED', 409);
    case 'RESUME_ACCOUNT_INVALID':
    case 'RESUME_ACCOUNT_NOT_FOUND':
      return new ResumeApiError('QUOTA_ACCOUNT_INVALID', 409);
    default:
      return new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
}

function isNullableInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

function reservationRow(data: unknown): ReservationRow | null {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<ReservationRow>;
  if (
    typeof row.ledger_id !== 'string'
    || row.ledger_id.length === 0
    || !['free', 'basic', 'vip'].includes(row.plan ?? '')
    || !isNullableInteger(row.remaining)
    || !isNullableInteger(row.total)
    || !(row.reset_at === null || typeof row.reset_at === 'string')
  ) {
    return null;
  }
  return row as ReservationRow;
}

export function reserveQuota(input: ReserveQuotaInput): Promise<QuotaReservation>;
export function reserveQuota(client: ResumeRpcClient, input: ReserveQuotaInput): Promise<QuotaReservation>;
export async function reserveQuota(
  clientOrInput: ResumeRpcClient | ReserveQuotaInput,
  injectedInput?: ReserveQuotaInput,
): Promise<QuotaReservation> {
  const client = isRpcClient(clientOrInput) ? clientOrInput : defaultClient();
  const input = isRpcClient(clientOrInput) ? injectedInput : clientOrInput;
  if (!input) throw new ResumeApiError('QUOTA_INVALID_REQUEST', 400);

  let result: ResumeRpcResult;
  try {
    result = await client.rpc('reserve_resume_quota', {
      p_user_id: input.userId,
      p_action: input.action,
      p_idempotency_key: input.idempotencyKey,
      p_request_id: input.requestId,
    });
  } catch {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  if (result.error) throw mapQuotaError(result.error);

  const row = reservationRow(result.data);
  if (!row) throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  return {
    ledgerId: row.ledger_id,
    plan: row.plan,
    remaining: row.remaining,
    total: row.total,
    resetAt: row.reset_at,
  };
}

export function settleQuota(
  ledgerId: string,
  outcome: QuotaSettlementOutcome,
  signal?: AbortSignal,
): Promise<unknown>;
export function settleQuota(
  client: ResumeRpcClient,
  ledgerId: string,
  outcome: QuotaSettlementOutcome,
  signal?: AbortSignal,
): Promise<unknown>;
export async function settleQuota(
  clientOrLedgerId: ResumeRpcClient | string,
  ledgerIdOrOutcome: string,
  outcomeOrSignal?: QuotaSettlementOutcome | AbortSignal,
  injectedSignal?: AbortSignal,
): Promise<unknown> {
  const client = typeof clientOrLedgerId === 'string' ? defaultClient() : clientOrLedgerId;
  const ledgerId = typeof clientOrLedgerId === 'string' ? clientOrLedgerId : ledgerIdOrOutcome;
  const outcome = typeof clientOrLedgerId === 'string'
    ? ledgerIdOrOutcome as QuotaSettlementOutcome
    : outcomeOrSignal as QuotaSettlementOutcome;
  const signal = typeof clientOrLedgerId === 'string'
    ? outcomeOrSignal as AbortSignal | undefined
    : injectedSignal;
  if (!outcome) throw new ResumeApiError('QUOTA_INVALID_REQUEST', 400);

  let result: ResumeRpcResult;
  try {
    let operation = client.rpc('settle_resume_quota', {
      p_ledger_id: ledgerId,
      p_outcome: outcome,
    });
    if (signal && operation.abortSignal) {
      operation = operation.abortSignal(signal) as ResumeRpcOperation;
    }
    result = await operation;
  } catch {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  if (result.error) throw mapQuotaError(result.error);
  if (!result.data || typeof result.data !== 'object') {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  return result.data;
}

export function compensateQuota(ledgerId: string): Promise<unknown>;
export function compensateQuota(client: ResumeRpcClient, ledgerId: string): Promise<unknown>;
export async function compensateQuota(
  clientOrLedgerId: ResumeRpcClient | string,
  injectedLedgerId?: string,
): Promise<unknown> {
  const client = typeof clientOrLedgerId === 'string' ? defaultClient() : clientOrLedgerId;
  const ledgerId = typeof clientOrLedgerId === 'string' ? clientOrLedgerId : injectedLedgerId;
  if (!ledgerId) throw new ResumeApiError('QUOTA_INVALID_REQUEST', 400);

  let result: ResumeRpcResult;
  try {
    result = await client.rpc('compensate_resume_quota', {
      p_ledger_id: ledgerId,
    });
  } catch {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  if (result.error) throw mapQuotaError(result.error);
  if (!result.data || typeof result.data !== 'object') {
    throw new ResumeApiError('QUOTA_UNAVAILABLE', 503);
  }
  return result.data;
}
