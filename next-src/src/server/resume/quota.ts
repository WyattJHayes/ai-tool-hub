import 'server-only';

import { getSupabaseAdminClient, getSupabaseAdminQueryClient } from '../supabase-admin';
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

  // Production path only (no injected client): opportunistically refund
  // reservations abandoned by a crashed process so quota is not stuck.
  if (!isRpcClient(clientOrInput)) ensureAbandonedReservationSweep();

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

export async function compensateQuota(ledgerId: string): Promise<unknown>;
export async function compensateQuota(client: ResumeRpcClient, ledgerId: string): Promise<unknown>;
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

// ---------------------------------------------------------------------------
// Abandoned-reservation sweeper [CR-2]
//
// A reservation whose process crashed before settling stays 'reserved' forever
// with its quota deducted. The sweeper refunds such ledgers after a grace
// window. It is triggered (throttled) from the production reserve path, so no
// timers run in tests or in processes that never reserve.
// ---------------------------------------------------------------------------

const ABANDONED_AFTER_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const SWEEP_BATCH_LIMIT = 100;

export interface ReservationSweeper {
  listAbandonedReservationIds(olderThanMs: number): Promise<string[]>;
  compensateReservation(ledgerId: string): Promise<unknown>;
}

function defaultSweeper(): ReservationSweeper {
  return {
    async listAbandonedReservationIds(olderThanMs) {
      const cutoff = new Date(Date.now() - olderThanMs).toISOString();
      const query = getSupabaseAdminQueryClient();
      const { data, error } = await query
        .from('resume_usage_ledger')
        .select('id')
        .eq('status', 'reserved')
        .lt('created_at', cutoff)
        .limit(SWEEP_BATCH_LIMIT);
      if (error || !Array.isArray(data)) return [];
      return data
        .map((row) => (row && typeof (row as { id?: unknown }).id === 'string'
          ? (row as { id: string }).id
          : ''))
        .filter((id) => id.length > 0);
    },
    compensateReservation(ledgerId) {
      return compensateQuota(ledgerId);
    },
  };
}

/** Refunds every abandoned 'reserved' ledger older than the grace window. */
export async function sweepAbandonedReservations(
  sweeper: ReservationSweeper = defaultSweeper(),
  olderThanMs: number = ABANDONED_AFTER_MS,
): Promise<number> {
  let ids: string[] = [];
  try {
    ids = await sweeper.listAbandonedReservationIds(olderThanMs);
  } catch {
    return 0;
  }
  let compensated = 0;
  for (const id of ids) {
    try {
      await sweeper.compensateReservation(id);
      compensated += 1;
    } catch {
      // A ledger that fails compensation (e.g. already settled by a late
      // process) is retried on the next sweep; keep going.
    }
  }
  return compensated;
}

let lastSweepAt = 0;

/** Fire-and-forget, throttled to one attempt per sweep interval. */
export function ensureAbandonedReservationSweep(now: number = Date.now()): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;
  void sweepAbandonedReservations().catch(() => undefined);
}
