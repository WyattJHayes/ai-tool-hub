import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const { normalizeResumeDocument } = await tsImport('../src/features/resume/schema.ts', import.meta.url);

test('retains the persisted v1 resume schema version', () => {
  assert.equal(normalizeResumeDocument({ schemaVersion: 1 }).schemaVersion, 1);
});

test('defines the atomic resume billing schema contract', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/002_resume_optimizer.sql', import.meta.url),
    'utf8',
  );

  for (const table of [
    'resume_quota_accounts',
    'resume_usage_ledger',
    'resume_memberships',
    'resume_orders',
    'resume_payment_events',
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? ${table}`, 'i'));
    assert.match(sql, new RegExp(`alter table ${table} enable row level security`, 'i'));
  }

  assert.match(sql, /unique\s*\(user_id,\s*idempotency_key\)/i);
  assert.match(sql, /unique\s*\(source_type,\s*source_id\)/i);
  assert.match(sql, /amount_fen\s+integer[^,]*check\s*\(amount_fen\s*>\s*0\)/i);
  assert.match(sql, /free_daily_limit\s+integer\s+not null\s+default\s+10/i);
  assert.match(sql, /when\s+'basic'\s+then\s+990/i);
  assert.match(sql, /when\s+'vip'\s+then\s+9900/i);
  assert.match(sql, /timezone\s*\(\s*'Asia\/Shanghai'/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /security definer/i);

  for (const signature of [
    /reserve_resume_quota\s*\(\s*p_user_id\s+uuid\s*,\s*p_action\s+text\s*,\s*p_idempotency_key\s+text\s*,\s*p_request_id\s+uuid\s*\)/i,
    /settle_resume_quota\s*\(\s*p_ledger_id\s+uuid\s*,\s*p_outcome\s+text\s*\)/i,
    /create_resume_order\s*\(\s*p_user_id\s+uuid\s*,\s*p_plan\s+text\s*,\s*p_order_number\s+text\s*\)/i,
    /expire_resume_order\s*\(\s*p_order_number\s+text\s*,\s*p_user_id\s+uuid\s*,\s*p_failure_reason\s+text\s*\)/i,
    /fulfill_resume_order\s*\(\s*p_order_number\s+text\s*,\s*p_channel_event_id\s+text\s*,\s*p_channel_transaction_id\s+text\s*,\s*p_amount_fen\s+integer\s*,\s*p_sanitized_payload\s+jsonb\s*\)/i,
  ]) {
    assert.match(sql, signature);
  }

  assert.match(sql, /set\s+search_path\s*=\s*''/i);
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+reserve_resume_quota\s*\(uuid,\s*text,\s*text,\s*uuid\)\s+from\s+public,\s*anon,\s*authenticated/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+reserve_resume_quota\s*\(uuid,\s*text,\s*text,\s*uuid\)\s+to\s+service_role/i);
  assert.match(sql, /grant\s+execute\s+on\s+function\s+expire_resume_order\s*\(text,\s*uuid,\s*text\)\s+to\s+authenticated,\s*service_role/i);
  assert.match(sql, /grant\s+select\s+on\s+table[\s\S]*resume_payment_events[\s\S]*to\s+authenticated,\s*service_role/i);
  assert.doesNotMatch(sql, /grant\s+(?:insert|update|delete|all)[^;]*resume_(?:quota_accounts|usage_ledger|memberships|orders|payment_events)[^;]*to\s+(?:anon|authenticated)/i);
  assert.match(sql, /auth\.uid\s*\(\s*\)/i);
  assert.match(sql, /auth\.jwt\s*\(\s*\)/i);
  assert.doesNotMatch(sql, /resume_(?:text|content)|job_description|jd_text|ai_output/i);
});

test('defines rollback-only executable billing cases', () => {
  const sql = readFileSync(
    new URL('../supabase/tests/resume_billing.sql', import.meta.url),
    'utf8',
  );

  assert.match(sql, /^begin;/im);
  assert.match(sql, /^rollback;/im);
  assert.match(sql, /duplicate free reservation/i);
  assert.match(sql, /refund restores once/i);
  assert.match(sql, /basic rejects the eleventh reservation/i);
  assert.match(sql, /vip remains unlimited/i);
  assert.match(sql, /duplicate payment identifiers grant once/i);
  assert.match(sql, /authenticated users cannot read or mutate another user's rows/i);
  assert.doesNotMatch(sql, /commit\s*;/i);
});
