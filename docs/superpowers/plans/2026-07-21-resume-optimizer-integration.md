# AI Resume Optimizer Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the complete AI resume optimizer at `/resume/` inside the production Next.js application, with local-only resume documents, Supabase authentication, atomic Postgres quota accounting, XDDPAY billing, full legacy entitlement migration, and all approved navigation entries.

**Architecture:** Build one typed resume domain model shared by a native React editor, importer, A4 preview, PDF exporter, and AI diff workflow. Protect Next Route Handlers with Supabase access tokens, keep resume/JD content request-scoped, and put quota reservations plus payment fulfillment behind transactional Postgres RPCs. Migrate legacy identities and entitlements through an idempotent dry-run-first script, then expose the feature only after reconciliation and production smoke checks pass.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS 3, Zustand 5, Supabase Auth/Postgres/RLS, DeepSeek-compatible chat completions, Server-Sent Events, XDDPAY, pdfjs-dist, mammoth, html2canvas, jsPDF, Lucide React, Node test runner with tsx, Playwright.

## Global Constraints

- Canonical route is `/resume/`; old `/tools/resume-optimizer` variants permanently redirect to it.
- Resume content, JD content, uploaded files, and AI output are never stored in Postgres, logs, Sentry, or analytics.
- Anonymous users can edit, preview, persist locally, import locally, and export PDF; AI, quota, orders, and payment require Supabase login.
- Every successful parse, JD analysis, light optimization, medium optimization, or deep optimization costs exactly one quota unit; failures, invalid results, timeouts, and disconnects cost zero.
- Light optimization accepts no JD; medium and deep optimization require a JD.
- Free quota reads the single production `DAILY_QUOTA` value and resets on `Asia/Shanghai` calendar days; Basic is 10 uses for CNY 9.90; permanent VIP is unlimited for CNY 99.00.
- All money is integer fen. Client-supplied prices never determine an order amount.
- XDDPAY callback signature, app ID, amount, currency, order ID, channel transaction ID, and state must all validate before fulfillment.
- XDDPAY signing must pass an official or production-sanitized fixture before payment can be enabled; an inferred signing algorithm is not acceptable.
- Use the approved Precision Instrument Console tokens. No gray-green palette, gradients, glow, glass, background decoration grid, scanline, card nesting, or ordinary radius above 6px.
- Use existing Geist and Lucide; add no second UI, icon, state, or authentication library.
- Support `1440x900`, `1024x768`, `390x844`, and `320x844` without overlap, clipping, covered content, or page-level horizontal overflow.
- Every interactive target is at least 44x44px, every icon-only action has an accessible name and tooltip, and reduced motion removes nonessential transitions.
- Do not commit production secrets, legacy `quota.json`, migration exports, reconciliation reports, payment fixtures containing personal data, generated PDFs, browser screenshots, or `.superpowers/` contents.

---

## File Map

**Create: resume domain and browser services**

- `next-src/src/features/resume/types.ts`: canonical resume, import, AI diff, quota, plan, and order types.
- `next-src/src/features/resume/schema.ts`: runtime normalization and version migrations for local resume documents.
- `next-src/src/features/resume/store.ts`: Zustand editor state, versioned local persistence, undo, import staging, and AI diff acceptance.
- `next-src/src/features/resume/importer.ts`: file validation and browser extraction dispatch.
- `next-src/src/features/resume/pdf.ts`: A4 export and overflow checks.
- `next-src/src/features/resume/api.ts`: Supabase-authenticated JSON/SSE client and typed error mapping.

**Create: resume UI**

- `next-src/src/app/resume/page.tsx`: route metadata and page entry.
- `next-src/src/components/resume/ResumeWorkspace.tsx`: desktop/mobile workspace orchestration.
- `next-src/src/components/resume/ResumeToolbar.tsx`: name, save, import, template, export, quota, and account controls.
- `next-src/src/components/resume/ResumeEditor.tsx`: section editor and ordered repeatable entries.
- `next-src/src/components/resume/ResumePreview.tsx`: stable A4 preview surface.
- `next-src/src/components/resume/ImportDialog.tsx`: local extraction and staged merge/replace flow.
- `next-src/src/components/resume/AIPanel.tsx`: parse, JD analysis, three optimization levels, stream state, and diffs.
- `next-src/src/components/resume/QuotaDrawer.tsx`: quota, plans, order creation, polling, and history.

**Create: server boundaries**

- `next-src/src/server/env.ts`: strict private environment parsing and public plan projection.
- `next-src/src/server/supabase-admin.ts`: server-only Supabase client and bearer-session verification.
- `next-src/src/server/resume/quota.ts`: typed wrappers around quota RPCs.
- `next-src/src/server/resume/ai.ts`: request-scoped DeepSeek parsing, JD analysis, and streamed optimization.
- `next-src/src/server/resume/xddpay.ts`: channel request, canonical signing, callback verification, and fixture parser.
- `next-src/src/server/resume/orders.ts`: order ownership, creation, polling, and payment fulfillment wrappers.
- `next-src/src/app/api/resume/{parse,analyze-jd,optimize,quota,plans}/route.ts`: resume API handlers.
- `next-src/src/app/api/resume/orders/route.ts`: create/list orders.
- `next-src/src/app/api/resume/orders/[id]/route.ts`: owned order status.
- `next-src/src/app/api/resume/payments/xddpay/notify/route.ts`: raw callback verification and idempotent fulfillment.

**Create: database, migration, and QA**

- `next-src/supabase/migrations/002_resume_optimizer.sql`: resume billing tables, RLS, indexes, and transactional functions.
- `next-src/supabase/tests/resume_billing.sql`: concurrent/idempotent quota and payment SQL checks.
- `next-src/scripts/migrate-resume-data.ts`: dry-run-first legacy data mapper and importer.
- `next-src/tests/resume/*.test.ts`: domain, import, auth, AI, quota wrapper, XDDPAY, and migration tests.
- `next-src/tests/fixtures/resume-migration.json`: synthetic legacy users, usage, memberships, and orders.
- `next-src/tests/resume-schema.test.mjs`: static schema/RLS/function contract.
- `scripts/resume-ui-guard.mjs`: Playwright route, interaction, privacy, layout, and PDF guard.

**Modify**

- `next-src/package.json` and `next-src/package-lock.json`: runtime and test dependencies/scripts.
- `next-src/src/app/globals.css`: scoped resume workspace, A4, diff, drawer, and responsive utilities.
- `next-src/src/components/auth/AuthModal.tsx`: optional success callback and resume-aware copy without changing existing callers.
- `next-src/src/components/layout/Navbar.tsx`: desktop resume entry.
- `next-src/src/components/layout/BottomNav.tsx`: mobile resume entry and five-column stable geometry.
- `next-src/src/app/api/search/route.ts`: separate textual match score from hot ranking bonus.
- `next-src/public/data/tools.json`: restore tool ID 95 with canonical internal URL and current data shape.
- `next-src/next.config.mjs`: permanent legacy redirects and any worker/CSP directives required by local PDF parsing.
- `.github/workflows/deploy.yml`: focused tests, SQL contract, and browser guard.
- `deploy/tencent-cloud/docker-compose.prod.yml`: required private environment variables.
- `deploy/tencent-cloud/quick-deploy.sh`: migration preflight, data gate, `/resume/` health verification, and rollback-safe entry opening.
- `deploy/tencent-cloud/README.md`: exact environment, migration, reconciliation, payment fixture, and rollback commands.
- `scripts/review-regressions.mjs`: lock deployment and secret-handling requirements.

---

### Task 0: Capture the Legacy and Production Baseline

**Files:**

- Read only: `server/data/quota.json` on the production server, `/opt/ai-tool-hub/.env`, current Supabase counts, and current application revision.
- Generated outside Git: `/opt/ai-tool-hub/backups/<timestamp>/resume-migration/` and `/tmp/resume-baseline/`.

**Interfaces:**

- Consumes: current production data and the committed design at `docs/superpowers/specs/2026-07-21-resume-optimizer-integration-design.md`.
- Produces: source SHA256, nonsecret configuration inventory, row/count totals, and screenshots used by Tasks 7 and 11.

- [ ] **Step 1: Verify a clean application baseline**

Run:

```bash
git status --short
git rev-parse HEAD
npm --prefix next-src run build
```

Expected: build succeeds; only known user-owned untracked files appear; record the 40-character revision.

- [ ] **Step 2: Record production revision and nonsecret feature configuration**

Run through the approved SSH target without printing secret values:

```bash
ssh -o BatchMode=yes root@101.43.35.235 \
  "docker inspect -f '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' weihub-app; \
   test -s /opt/ai-tool-hub/.env; \
   for key in NEXT_PUBLIC_SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY DEEPSEEK_API_KEY DAILY_QUOTA XDDPAY_APP_ID XDDPAY_SECRET; do \
     if grep -q \"^\${key}=.\+\" /opt/ai-tool-hub/.env; then echo \"\${key}=configured\"; else echo \"\${key}=missing\"; fi; \
   done"
```

Expected: revision is printed; every key is `configured`; no value is printed.

- [ ] **Step 3: Create a restricted immutable source snapshot**

Run on production:

```bash
ssh -o BatchMode=yes root@101.43.35.235 \
  "stamp=\$(date +%Y%m%d%H%M%S); dir=/opt/ai-tool-hub/backups/\$stamp/resume-migration; \
   install -d -m 0700 \"\$dir\"; \
   install -m 0600 /opt/ai-tool-hub/data/quota.json \"\$dir/quota.json\"; \
   sha256sum \"\$dir/quota.json\" | tee \"\$dir/SHA256SUMS\""
```

Expected: one checksum line. If the source path differs, locate the mounted legacy file with `docker inspect` and repeat the same `install` plus `sha256sum`; do not continue without a snapshot.

- [ ] **Step 4: Capture current broken-route evidence**

Run:

```bash
mkdir -p /tmp/resume-baseline
curl -sS -o /dev/null -w '%{http_code}\n' https://weihub.cloud/resume/
curl -sS -o /dev/null -w '%{http_code}\n' https://weihub.cloud/api/resume/quota
```

Expected before implementation: `/resume/` is not a functional editor and the API does not return an authenticated quota response. Save no personal response bodies.

---

### Task 1: Establish the Resume Domain, Versioning, and Local Persistence

**Files:**

- Create: `next-src/src/features/resume/types.ts`
- Create: `next-src/src/features/resume/schema.ts`
- Create: `next-src/src/features/resume/store.ts`
- Test: `next-src/tests/resume/domain.test.ts`
- Modify: `next-src/package.json`, `next-src/package-lock.json`

**Interfaces:**

- Produces: `ResumeDocumentV1`, `ResumeSectionKey`, `ResumeChange`, `createEmptyResume()`, `normalizeResumeDocument(input)`, `useResumeStore`, and storage key `weihub-resume-v1`.
- Consumes: no server state; localStorage is the only persistent document store.

- [ ] **Step 1: Install only the required runtime and test packages**

Run:

```bash
npm --prefix next-src install pdfjs-dist@5 mammoth@1 html2canvas@1 jspdf@3
npm --prefix next-src install --save-dev tsx@4
```

Add scripts to `next-src/package.json`:

```json
{
  "scripts": {
    "test:resume": "tsx --test tests/resume/*.test.ts && node --test tests/resume-schema.test.mjs"
  }
}
```

Expected: lockfile updates and `npm --prefix next-src ls` reports no invalid dependency.

- [ ] **Step 2: Write the failing domain tests**

Create `next-src/tests/resume/domain.test.ts` with cases that assert:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyResume, normalizeResumeDocument } from '../../src/features/resume/schema';

test('creates a versioned empty resume with stable repeatable arrays', () => {
  const value = createEmptyResume(() => 'fixed-id');
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.templateId, 'precision');
  assert.deepEqual(value.experience, []);
  assert.equal(value.profile.id, 'fixed-id');
});

test('normalizes unknown local data without accepting executable or prototype fields', () => {
  const value = normalizeResumeDocument({
    schemaVersion: 1,
    name: '<script>alert(1)</script>',
    __proto__: { polluted: true },
    profile: { id: 'p1', fullName: 'Wei' },
    experience: [{ id: 'same', company: 'A' }, { id: 'same', company: 'B' }],
  });
  assert.equal(value.name, '<script>alert(1)</script>');
  assert.equal(value.experience.length, 2);
  assert.notEqual(value.experience[0].id, value.experience[1].id);
  assert.equal((value as Record<string, unknown>).polluted, undefined);
});
```

Add tests for reorder, duplicate, delete, a 20-entry undo cap, staged import not replacing current data, single-change accept, accept-all, reject, and reset preserving an exportable backup.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm --prefix next-src run test:resume
```

Expected: FAIL because the resume modules do not exist.

- [ ] **Step 4: Implement the exact domain contracts**

Define discriminated and explicit types in `types.ts`:

```ts
export type ResumeSectionKey = 'profile' | 'target' | 'summary' | 'experience' | 'projects' | 'education' | 'skills' | 'certificates';
export type OptimizationLevel = 'light' | 'medium' | 'deep';
export interface ResumeItem { id: string }
export interface ResumeProfile extends ResumeItem { fullName: string; phone: string; email: string; location: string; title: string }
export interface ResumeExperience extends ResumeItem { company: string; role: string; startDate: string; endDate: string; description: string }
export interface ResumeProject extends ResumeItem { name: string; role: string; startDate: string; endDate: string; description: string }
export interface ResumeEducation extends ResumeItem { school: string; major: string; degree: string; startDate: string; endDate: string }
export interface ResumeDocumentV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  templateId: 'precision' | 'classic';
  profile: ResumeProfile;
  target: string;
  summary: string;
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  skills: string[];
  certificates: string[];
  updatedAt: string;
}
export interface ResumeChange { id: string; section: ResumeSectionKey; itemId?: string; field: string; before: string; after: string; accepted: boolean }
```

Implement `schema.ts` with allowlisted property reads, string length limits, unique ID regeneration through `crypto.randomUUID()`, and a `schemaVersion` switch that rejects future versions with `ResumeSchemaError`.

Implement `store.ts` with Zustand `persist`, partialized state containing only `document`, storage key `weihub-resume-v1`, explicit `saveState`, staged import, diff actions, and a maximum 20 immutable undo snapshots. Never persist `jdText`, stream tokens, quota, payment state, or auth tokens.

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm --prefix next-src run test:resume
npm --prefix next-src run lint
git add next-src/package.json next-src/package-lock.json next-src/src/features/resume next-src/tests/resume/domain.test.ts
git commit -m "feat: add resume domain and local persistence"
```

Expected: tests and lint pass; commit includes no generated localStorage or resume data.

---

### Task 2: Build Local Import, Preview, and PDF Services

**Files:**

- Create: `next-src/src/features/resume/importer.ts`
- Create: `next-src/src/features/resume/pdf.ts`
- Test: `next-src/tests/resume/importer.test.ts`
- Test: `next-src/tests/resume/pdf.test.ts`

**Interfaces:**

- Consumes: `ResumeDocumentV1`, `normalizeResumeDocument`, browser `File`, and an A4 preview `HTMLElement`.
- Produces: `extractResumeFile(file): Promise<ExtractedResumeText>`, `parseResumeTextLocally(text)`, `inspectA4(element)`, and `exportResumePdf(element, fileName)`.

- [ ] **Step 1: Write validation and dispatch tests**

Test exact behavior:

```ts
test('rejects old DOC, oversized, and empty extraction without changing editor state', async () => {
  await assert.rejects(() => extractResumeFile(fakeFile('cv.doc', 10)), /另存为 \.docx/);
  await assert.rejects(() => extractResumeFile(fakeFile('cv.pdf', 10 * 1024 * 1024 + 1)), /10 MB/);
  await assert.rejects(() => extractResumeFile(fakeFile('cv.txt', 0, '')), /没有可提取文本/);
});

test('dispatches PDF, DOCX, TXT, HTML, and Markdown to browser extractors', async () => {
  for (const name of ['cv.pdf', 'cv.docx', 'cv.txt', 'cv.html', 'cv.md']) {
    assert.equal((await extractResumeFile(fixture(name))).fileName, name);
  }
});
```

Add local-parser fixtures that extract email, phone, experience, education, and skills without sending a request.

- [ ] **Step 2: Write A4 inspection tests and verify RED**

Assert `inspectA4` returns `{ ok: false, reasons: ['overflow-x'] }` when `scrollWidth > clientWidth`,
`overflow-y` when the last rendered page exceeds its fixed boundary, and `empty-page` for pages with no visible text.

Run `npm --prefix next-src run test:resume` and expect missing-module failures.

- [ ] **Step 3: Implement browser-only extraction**

In `importer.ts`, keep all imports behind functions used from client components:

```ts
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = new Set(['pdf', 'docx', 'txt', 'html', 'htm', 'md', 'markdown']);

export async function extractResumeFile(file: File): Promise<ExtractedResumeText> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'doc') throw new ResumeImportError('请将 .doc 文件另存为 .docx 后重试');
  if (!ACCEPTED.has(extension)) throw new ResumeImportError('支持 PDF、DOCX、TXT、HTML 和 Markdown');
  if (file.size > MAX_FILE_BYTES) throw new ResumeImportError('文件不能超过 10 MB');
  const text = await extractByExtension(file, extension);
  if (!text.trim()) throw new ResumeImportError('文件没有可提取文本；扫描版 PDF 请先进行 OCR');
  return { fileName: file.name, kind: extension as ExtractedResumeText['kind'], text: text.slice(0, 50_000) };
}
```

Use pdfjs-dist with a bundled worker URL, mammoth `extractRawText` for DOCX, `DOMParser` plus `textContent` for HTML, and plain `File.text()` for TXT/Markdown. Do not send the `File` object to any API.

- [ ] **Step 4: Implement deterministic A4 export**

`inspectA4` must inspect elements marked `[data-resume-page]`. `exportResumePdf` must await `document.fonts.ready`, call `inspectA4`, reject on any reason, render each page with html2canvas at scale 2, and add each canvas to jsPDF using `a4`, `portrait`, and millimeters. Sanitize the filename to `[\p{L}\p{N}._-]`, defaulting to `resume.pdf`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm --prefix next-src run test:resume
npm --prefix next-src run build
git add next-src/src/features/resume/importer.ts next-src/src/features/resume/pdf.ts next-src/tests/resume
git commit -m "feat: add local resume import and PDF services"
```

Expected: focused tests and production build pass.

---

### Task 3: Add Atomic Resume Billing Schema and RLS

**Files:**

- Create: `next-src/supabase/migrations/002_resume_optimizer.sql`
- Create: `next-src/supabase/tests/resume_billing.sql`
- Create: `next-src/tests/resume-schema.test.mjs`

**Interfaces:**

- Produces RPCs `reserve_resume_quota(uuid,text,text,uuid)`, `settle_resume_quota(uuid,text)`, `create_resume_order(uuid,text,text)`, `expire_resume_order(text,uuid,text)`, and `fulfill_resume_order(text,text,text,integer,jsonb)`.
- Produces tables `resume_quota_accounts`, `resume_usage_ledger`, `resume_memberships`, `resume_orders`, and `resume_payment_events`.

- [ ] **Step 1: Write the static schema contract first**

Create a Node test that reads `002_resume_optimizer.sql` and requires:

```js
for (const table of ['resume_quota_accounts','resume_usage_ledger','resume_memberships','resume_orders','resume_payment_events']) {
  assert.match(sql, new RegExp(`create table(?: if not exists)? ${table}`, 'i'));
  assert.match(sql, new RegExp(`alter table ${table} enable row level security`, 'i'));
}
assert.match(sql, /unique\s*\(user_id,\s*idempotency_key\)/i);
assert.match(sql, /amount_fen\s+integer[^,]*check\s*\(amount_fen\s*>\s*0\)/i);
assert.match(sql, /timezone\s*\(\s*'Asia\/Shanghai'/i);
assert.match(sql, /for update/i);
assert.match(sql, /security definer/i);
assert.doesNotMatch(sql, /resume_(?:text|content)|job_description|jd_text|ai_output/i);
```

Run `node --test next-src/tests/resume-schema.test.mjs`; expect missing migration failure.

- [ ] **Step 2: Create tables and constraints**

Use UUID primary keys, `auth.users(id)` foreign keys, integer quota/money columns, timestamptz timestamps, and check constraints for these states:

```sql
plan in ('free','basic','vip')
ledger status in ('reserved','consumed','refunded')
order status in ('pending','paid','fulfilled','expired','review','refunded')
membership status in ('active','inactive')
```

Add unique constraints on `(user_id,idempotency_key)`, `(source_type,source_id)` where migration IDs exist,
`channel_transaction_id` where non-null, and `channel_event_id` where non-null. Add partial unique index allowing one active membership per user.

- [ ] **Step 3: Implement quota functions as one transaction each**

`reserve_resume_quota` must:

1. create/lock the account with `FOR UPDATE`;
2. return the prior reservation for the same user/idempotency key;
3. reset free usage when `current_date` in `Asia/Shanghai` changes;
4. reject exhausted free/basic accounts with SQLSTATE `P0001` and message `RESUME_QUOTA_EXHAUSTED`;
5. insert a `reserved` ledger row and increment the correct counter exactly once;
6. return ledger ID, plan, remaining, total, and reset time.

`settle_resume_quota` must lock the ledger and account; `consumed` makes no counter change, `refunded` reverses
exactly one prior reservation, and repeating the same outcome is a no-op. A conflicting terminal outcome raises
`RESUME_LEDGER_ALREADY_SETTLED`.

- [ ] **Step 4: Implement order and fulfillment functions**

`create_resume_order` accepts user, plan, and generated order ID; it selects price inside SQL (`basic=990`,
`vip=9900`), rejects active VIP and Basic with remaining quota, and expires after 30 minutes.

`expire_resume_order` requires the order owner or service role, locks a pending order, records a fixed failure reason,
and marks it expired so it cannot be fulfilled without entering manual review.

`fulfill_resume_order` locks by order number, validates exact integer amount and pending/fulfilled states, inserts
the payment event with conflict-safe uniqueness, marks the order paid, marks the current active membership inactive,
inserts the new membership, updates the quota account (`basic` gets 10 remaining, `vip` gets unlimited), and marks the
order fulfilled in the same transaction. Repeating a validated event returns the already-fulfilled order without
adding entitlement.

- [ ] **Step 5: Add executable SQL cases**

In `resume_billing.sql`, wrap fixtures in a transaction and assert through `DO $$` blocks:

- free reservation decrements once and duplicate idempotency does not decrement twice;
- refund restores once;
- Basic consumes exactly 10 and rejects the 11th;
- VIP records usage but remains unlimited;
- duplicate payment event and transaction ID do not grant twice;
- another authenticated user cannot select or mutate protected rows.

Run against an isolated Supabase/Postgres database:

```bash
psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 -f next-src/supabase/migrations/002_resume_optimizer.sql
psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 -f next-src/supabase/tests/resume_billing.sql
```

Expected: both commands exit 0 and the test transaction rolls back.

- [ ] **Step 6: Run static test and commit**

```bash
node --test next-src/tests/resume-schema.test.mjs
git add next-src/supabase next-src/tests/resume-schema.test.mjs
git commit -m "feat: add atomic resume billing schema"
```

Expected: schema test passes and no real database URL is committed.

---

### Task 4: Add Server Authentication, Environment, and Quota Adapters

**Files:**

- Create: `next-src/src/server/env.ts`
- Create: `next-src/src/server/supabase-admin.ts`
- Create: `next-src/src/server/resume/quota.ts`
- Test: `next-src/tests/resume/server-auth.test.ts`
- Test: `next-src/tests/resume/quota.test.ts`

**Interfaces:**

- Produces `getServerEnv()`, `requireSupabaseUser(request)`, `reserveQuota(input)`, and `settleQuota(ledgerId,outcome)`.
- Consumes Authorization header `Bearer <Supabase access token>` and Task 3 RPCs.

- [ ] **Step 1: Write failing authentication and environment tests**

Test missing/empty bearer tokens return `ResumeApiError('AUTH_REQUIRED',401)`, invalid tokens return
`AUTH_INVALID`, and successful `auth.getUser(token)` returns only `{ id, email }`. Test environment parsing rejects
missing service role, DeepSeek, XDDPAY, noninteger quota, and a public variable name containing a private secret.

- [ ] **Step 2: Write failing quota adapter tests**

Inject a fake Supabase client and assert exact RPC names/arguments:

```ts
await reserveQuota(client, {
  userId: 'u1', action: 'parse', idempotencyKey: 'k1', requestId: '00000000-0000-4000-8000-000000000001'
});
assert.deepEqual(calls[0], ['reserve_resume_quota', {
  p_user_id: 'u1', p_action: 'parse', p_idempotency_key: 'k1', p_request_id: '00000000-0000-4000-8000-000000000001'
}]);
```

Assert `RESUME_QUOTA_EXHAUSTED` maps to HTTP 429 without leaking SQL text.

- [ ] **Step 3: Implement server-only modules**

Mark private modules with `import 'server-only'`. Build the Supabase admin client with
`persistSession:false`, `autoRefreshToken:false`, and the service role key. `requireSupabaseUser` must never trust
a client-provided user ID and must call `admin.auth.getUser(token)`.

Environment output must include:

```ts
interface ServerEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  dailyQuota: number;
  xddpayAppId: string;
  xddpaySecret: string;
  xddpayGateway: string;
  xddpayNotifyUrl: string;
}
```

All user-facing errors use `{ error: { code, message, requestId } }`; logs receive request IDs and opaque user
hashes, never bearer tokens or request bodies.

- [ ] **Step 4: Run and commit**

```bash
npm --prefix next-src run test:resume
npm --prefix next-src run lint
git add next-src/src/server next-src/tests/resume
git commit -m "feat: add resume server auth and quota adapters"
```

Expected: all focused tests pass.

---

### Task 5: Port AI Parsing, JD Analysis, and Streamed Optimization

**Files:**

- Create: `next-src/src/server/resume/ai.ts`
- Create: `next-src/src/app/api/resume/parse/route.ts`
- Create: `next-src/src/app/api/resume/analyze-jd/route.ts`
- Create: `next-src/src/app/api/resume/optimize/route.ts`
- Create: `next-src/src/app/api/resume/quota/route.ts`
- Create: `next-src/src/features/resume/api.ts`
- Test: `next-src/tests/resume/ai.test.ts`
- Test: `next-src/tests/resume/api-client.test.ts`

**Interfaces:**

- Consumes: Task 4 auth/quota adapters, DeepSeek-compatible `/chat/completions`, resume max 50,000 characters, JD max 10,000 characters.
- Produces: validated structured resume/JD responses, SSE events `progress|token|done|error`, and an authenticated browser client.

- [ ] **Step 1: Write validation and privacy tests**

Cover missing input, limits, invalid level, JD requirement, login requirement, duplicate idempotency, upstream
non-2xx, timeout, malformed JSON, client cancellation, and structure validation. Inject logger/fetch/quota adapters
and assert no logged argument contains fixture strings `PRIVATE_RESUME_TEXT` or `PRIVATE_JD_TEXT`.

- [ ] **Step 2: Write the SSE client contract**

Given chunk boundaries that split event names, UTF-8 characters, and JSON lines, assert `streamOptimize` emits
progress/tokens, returns only a valid `done`, maps `error` to `ResumeApiError`, and treats EOF without `done` as
`STREAM_INCOMPLETE`. Assert Authorization and `Idempotency-Key` headers are present and resume text is not saved.

- [ ] **Step 3: Implement request-scoped AI methods**

Port the intent of `server/src/services/llm.js` into three focused methods:

```ts
parseResume(text, signal): Promise<ResumeDocumentV1>
analyzeJobDescription(jdText, signal): Promise<JDAnalysis>
streamResumeOptimization(level, resumeText, jdText, signal): AsyncGenerator<AIStreamEvent>
```

Use POST JSON to `${deepseekBaseUrl}/chat/completions`, model from environment, abort timeout 60 seconds, and
system prompts that state resume/JD are untrusted quoted data. Parse model JSON into allowlisted runtime schemas;
never return raw prompt envelopes or upstream errors.

- [ ] **Step 4: Implement route lifecycle exactly once**

For parse and JD routes: authenticate, validate, reserve, call AI, validate result, settle `consumed`, and return.
Every catch after reservation settles `refunded` before returning.

For optimize: reserve before constructing the stream; close over `settled=false`; on valid `done`, settle consumed
then enqueue `done`; on upstream error, timeout, invalid result, or `cancel()`, settle refunded exactly once. Set:

```ts
{
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
  'Connection': 'keep-alive'
}
```

- [ ] **Step 5: Implement the browser API client**

Fetch the current Supabase session per request, attach its access token, generate `crypto.randomUUID()` request and
idempotency IDs per user action, parse stable error envelopes, and expose typed methods. Do not cache request bodies,
tokens, stream chunks, or results in localStorage.

- [ ] **Step 6: Run and commit**

```bash
npm --prefix next-src run test:resume
npm --prefix next-src run lint
npm --prefix next-src run build
git add next-src/src/server/resume/ai.ts next-src/src/app/api/resume next-src/src/features/resume/api.ts next-src/tests/resume
git commit -m "feat: add authenticated resume AI APIs"
```

Expected: tests, lint, and build pass.

---

### Task 6: Implement XDDPAY Orders and Idempotent Fulfillment

**Files:**

- Create: `next-src/src/server/resume/xddpay.ts`
- Create: `next-src/src/server/resume/orders.ts`
- Create: `next-src/src/app/api/resume/plans/route.ts`
- Create: `next-src/src/app/api/resume/orders/route.ts`
- Create: `next-src/src/app/api/resume/orders/[id]/route.ts`
- Create: `next-src/src/app/api/resume/payments/xddpay/notify/route.ts`
- Test: `next-src/tests/resume/xddpay.test.ts`
- Test: `next-src/tests/resume/orders.test.ts`
- Local secret fixture: `/tmp/xddpay-fixture.json` (never commit).

**Interfaces:**

- Consumes: XDDPAY official request/callback field contract, Task 3 order RPCs, Task 4 server auth/env.
- Produces: `createXddpayPayment(order)`, `verifyXddpayCallback(rawBody,headers)`, public plans, owned orders, and callback acknowledgement.

- [ ] **Step 1: Acquire and sanitize a real channel fixture before code**

Export one official sandbox sample or one production callback with email, IP, names, open IDs, and tokens removed.
Keep only field names, deterministic sample IDs, amount, state, and a test-only secret/signature in
`/tmp/xddpay-fixture.json`. Record the provider documentation revision in the test name, not credentials.

Expected: the fixture can independently prove valid signature, invalid signature, field order independence, and
amount representation. If no authoritative fixture is available, mark payment launch blocked while continuing
nonpayment tasks; do not infer the algorithm.

- [ ] **Step 2: Write fixture-first signing tests**

Tests load the path from `XDDPAY_FIXTURE_PATH`, skip only when the environment variable is absent in ordinary local
runs, and fail in CI/release mode when `REQUIRE_XDDPAY_FIXTURE=1`. Assert valid fixture passes; changed amount,
app ID, transaction ID, state, or signature fails; reordering fields still passes when the official protocol says
order-independent.

- [ ] **Step 3: Write order ownership and amount tests**

Assert only `basic|vip` are accepted, server sends 990/9900 fen, active VIP cannot buy, Basic with remaining quota
cannot rebuy, another user receives 404 for an order, and repeated callbacks invoke fulfillment once.

- [ ] **Step 4: Implement channel adapter from the verified fixture**

Canonicalize exactly the official included fields and encoding demonstrated by the fixture. Compare signatures with
`timingSafeEqual` over equal-length buffers. Parse amounts to integer fen without floating arithmetic. Return:

```ts
interface VerifiedXddpayEvent {
  eventId: string;
  orderId: string;
  transactionId: string;
  amountFen: number;
  currency: 'CNY';
  state: 'paid';
  sanitizedPayload: Record<string, string>;
}
```

`sanitizedPayload` allowlists only reconciliation fields and excludes signatures, secrets, identity, and network data.

- [ ] **Step 5: Implement routes and acknowledgment behavior**

Plans return effective `dailyQuota`, Basic 990, VIP 9900, and `xddpay.enabled`. Order creation ignores client amount,
creates the DB order, then creates a channel payment link. Failure to create a channel payment marks the order
expired/nonfulfillable through the server adapter.

The callback reads the raw body once, verifies before JSON/form normalization, invokes `fulfill_resume_order`, and
returns the exact provider success token for both first and duplicate valid callbacks. Invalid callbacks return the
provider failure token and an HTTP status that permits retry. Never redirect a callback to UI.

- [ ] **Step 6: Run fixture gate and commit**

```bash
XDDPAY_FIXTURE_PATH=/tmp/xddpay-fixture.json REQUIRE_XDDPAY_FIXTURE=1 npm --prefix next-src run test:resume
npm --prefix next-src run build
git add next-src/src/server/resume next-src/src/app/api/resume next-src/tests/resume
git commit -m "feat: add idempotent XDDPAY resume billing"
```

Expected: authoritative fixture, duplicate callback, ownership, and build checks pass.

---

### Task 7: Build Idempotent Legacy User and Entitlement Migration

**Files:**

- Create: `next-src/scripts/migrate-resume-data.ts`
- Test: `next-src/tests/resume/migration.test.ts`
- Test fixture: `next-src/tests/fixtures/resume-migration.json`
- Modify: `next-src/package.json`, `deploy/tencent-cloud/README.md`

**Interfaces:**

- Consumes: legacy `quota.json`, Supabase Admin API, Task 3 source uniqueness, CLI modes `dry-run|apply|verify`.
- Produces: user mapping, imported ledger/memberships/orders, conflict CSV, and aggregate JSON report outside Git.

- [ ] **Step 1: Write migration fixture tests**

Create `next-src/tests/fixtures/resume-migration.json` with synthetic existing user, missing user, invalid email,
duplicate normalized email, Basic remaining
quota, VIP, inactive membership, current-day free usage, fulfilled/pending/expired orders, duplicate source IDs, and
rerun. Assert dry-run performs zero writes and exact totals; apply rerun performs zero new inserts; fulfilled orders
do not grant entitlement again.

- [ ] **Step 2: Implement strict input validation and normalization**

Reject nonobject roots, missing `users|usage|memberships|orders`, password output, negative counters, unknown plan or
order states, nonfinite amounts, and dates that cannot parse. Normalize email with trim/lowercase only; never guess
aliases. Hash source user IDs in reports with SHA-256 and a run-specific salt.

- [ ] **Step 3: Implement three explicit modes**

Add package script:

```json
"migrate:resume": "tsx scripts/migrate-resume-data.ts"
```

CLI contract:

```bash
npm --prefix next-src run migrate:resume -- dry-run --input /secure/quota.json --report /secure/dry-run.json
npm --prefix next-src run migrate:resume -- apply --input /secure/quota.json --report /secure/apply.json
npm --prefix next-src run migrate:resume -- verify --input /secure/quota.json --report /secure/verify.json
```

Require `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `MIGRATION_RUN_ID` for apply. New legacy users are created as
unconfirmed Supabase users with a random server-generated credential and no outbound email. They establish a new
password only by explicitly requesting the standard Supabase recovery flow from AuthModal. Never import `password`.
Conflicts write `conflicts.csv` with source hash, reason, and safe next action.

- [ ] **Step 4: Produce exact reconciliation totals**

Reports contain source checksum, run ID, started/finished time, source/imported counts for users, active Basic, active
VIP, remaining Basic quota total, current-day free usage, orders by state, amount fen by state, unmatched count, and
errors. `verify` exits nonzero for any unexplained delta.

- [ ] **Step 5: Test and commit**

```bash
npm --prefix next-src run test:resume
npm --prefix next-src run migrate:resume -- dry-run --input next-src/tests/fixtures/resume-migration.json --report /tmp/resume-dry-run.json
git add next-src/scripts/migrate-resume-data.ts next-src/tests/resume/migration.test.ts next-src/tests/fixtures/resume-migration.json next-src/package.json next-src/package-lock.json deploy/tencent-cloud/README.md
git commit -m "feat: add resume entitlement migration"
```

Expected: tests pass, dry-run reports zero writes, and no report/fixture containing real data is staged.

---

### Task 8: Build the Native Resume Editor, Preview, Import, and PDF UI

**Files:**

- Create: `next-src/src/app/resume/page.tsx`
- Create: `next-src/src/components/resume/ResumeWorkspace.tsx`
- Create: `next-src/src/components/resume/ResumeToolbar.tsx`
- Create: `next-src/src/components/resume/ResumeEditor.tsx`
- Create: `next-src/src/components/resume/ResumePreview.tsx`
- Create: `next-src/src/components/resume/ImportDialog.tsx`
- Modify: `next-src/src/app/globals.css`
- Test: `next-src/tests/resume-ui-contract.test.mjs`

**Interfaces:**

- Consumes: Tasks 1-2 store/import/PDF services and existing semantic CSS tokens.
- Produces: anonymous functional `/resume/` editor with desktop split view and mobile edit/preview segments.

- [ ] **Step 1: Write a source contract before components**

Require page metadata/canonical, one `ResumeWorkspace`, editor section labels, stable `data-resume-page`, import
merge/replace confirmation, PDF overflow errors, mobile segmented control with `aria-pressed`, toolbar save states,
44px controls, Lucide icons, and absence of raw green/purple/gradient/glow classes.

Run `node --test next-src/tests/resume-ui-contract.test.mjs`; expect missing component failure.

- [ ] **Step 2: Implement page and workspace orchestration**

`page.tsx` exports title `AI 简历优化 - AI Tool Hub`, description, and canonical `/resume/`. `ResumeWorkspace`
holds only ephemeral view state (`edit|preview`, dialog open flags); document state stays in `useResumeStore`.
Desktop uses `minmax(320px, 0.9fr) minmax(540px, 1.1fr)` and mobile shows one pane at a time.

- [ ] **Step 3: Implement toolbar and editor**

Toolbar order: back, editable document name, fixed-width save status, import, template segmented control, export,
quota/account. Use icon-only controls where familiar and tooltips. Editor modules are profile, target, summary,
experience, projects, education, skills, certificates; repeatable rows expose reorder, duplicate, delete with explicit
names and keep geometry stable during focus/hover.

- [ ] **Step 4: Implement semantic A4 preview and import confirmation**

Render fields as React text nodes, never `dangerouslySetInnerHTML`. Preview pages use fixed 210:297 geometry,
screen scaling that does not change print dimensions, and explicit empty-module omission. Import dialog extracts
locally, shows filename/type/field summary, runs local fallback, and requires Merge or Replace confirmation before
calling store actions.

- [ ] **Step 5: Add scoped Precision Instrument Console styling**

Use existing `--page`, `--surface`, `--surface-subtle`, `--line`, `--line-strong`, `--ink`, `--muted`, `--accent`, and
`--signal` variables. Add no new hue family. Keep A4 white/light-paper regardless of app theme with accessible dark
ink, normal controls at 6px radius, and reduced-motion override. Reserve mobile bottom padding using existing
`--mobile-nav-block-size`.

- [ ] **Step 6: Run and commit**

```bash
node --test next-src/tests/resume-ui-contract.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
git add next-src/src/app/resume next-src/src/components/resume next-src/src/app/globals.css next-src/tests/resume-ui-contract.test.mjs
git commit -m "feat: add native resume editor workspace"
```

Expected: source contract, lint, and build pass.

---

### Task 9: Connect AI Diffs, Supabase Login, Quota, and Payment UI

**Files:**

- Create: `next-src/src/components/resume/AIPanel.tsx`
- Create: `next-src/src/components/resume/QuotaDrawer.tsx`
- Modify: `next-src/src/components/resume/ResumeWorkspace.tsx`
- Modify: `next-src/src/components/resume/ResumeToolbar.tsx`
- Modify: `next-src/src/components/auth/AuthModal.tsx`
- Modify: `next-src/src/features/resume/api.ts`
- Test: `next-src/tests/resume-ui-contract.test.mjs`
- Test: `next-src/tests/resume/api-client.test.ts`

**Interfaces:**

- Consumes: existing Supabase AuthModal, Task 5 AI/quota client, Task 6 plan/order endpoints, Task 1 diff actions.
- Produces: resumable auth action, complete AI diff workflow, quota display, XDDPAY redirect, polling, and order history.

- [ ] **Step 1: Extend failing contracts**

Assert unauthenticated protected action opens AuthModal and resumes exactly once after `onAuthenticated`; a migrated
user can explicitly request a Supabase password recovery email; level
buttons show one-unit cost; medium/deep disable without JD; stream progress is `aria-live`; partial stream cannot be
applied; diff rows expose accept/reject; order UI distinguishes pending/fulfilled/expired/review; polling stops on
unmount and does not create another order.

- [ ] **Step 2: Extend AuthModal compatibly**

Add optional `onAuthenticated?: () => void` and `contextLabel?: string`. Existing callers remain valid. Add a
user-initiated “设置或找回密码” action that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })` only
after a valid email is entered and displays the non-enumerating response “如果账号存在，重置邮件已发送”. After a
successful Supabase sign-in, call `onAuthenticated` once before close; never store a pending resume body in the auth
component. ResumeWorkspace keeps a callback describing only the action kind and reads current editor content after
login.

- [ ] **Step 3: Implement AI state machine**

Use explicit states `idle|validating|reserving|streaming|review|error`. Keep JD, progress, tokens, and results in
component state only. On `done`, normalize the candidate, compute field changes against the current document, and
stage them. Accepting changes uses Task 1 store actions; closing review rejects unapplied changes.

- [ ] **Step 4: Implement quota and order drawer**

Load quota/plans on open and after settled AI calls. Show effective free daily value, Basic 10 uses/CNY 9.90, VIP
unlimited/CNY 99.00. Create one order on explicit confirmation, open its payment URL, then poll the same order every
3 seconds up to 5 minutes. Timeout leaves `pending` with a manual Query button. `fulfilled` refreshes quota; `review`
shows support/reconciliation state without claiming failure.

- [ ] **Step 5: Verify and commit**

```bash
npm --prefix next-src run test:resume
node --test next-src/tests/resume-ui-contract.test.mjs
npm --prefix next-src run build
git add next-src/src/components/resume next-src/src/components/auth/AuthModal.tsx next-src/src/features/resume/api.ts next-src/tests
git commit -m "feat: connect resume AI quota and payment UI"
```

Expected: focused tests and build pass.

---

### Task 10: Restore Entries, Canonical Redirects, Tool Data, and Search Correctness

**Files:**

- Modify: `next-src/src/components/layout/Navbar.tsx`
- Modify: `next-src/src/components/layout/BottomNav.tsx`
- Modify: `next-src/public/data/tools.json`
- Modify: `next-src/src/app/api/search/route.ts`
- Modify: `next-src/next.config.mjs`
- Test: `next-src/tests/resume-entry.test.mjs`
- Test: `next-src/tests/search-suggestions.test.mjs`

**Interfaces:**

- Consumes: existing nav and tool data shapes.
- Produces: desktop/mobile/home/catalog/search entries and permanent redirects to `/resume/`.

- [ ] **Step 1: Write entry and search regression tests**

Assert tool ID 95 exists once, uses `/resume/`, follows current fields, and appears for `简历` and `简历优化`.
Assert a hot tool with zero textual match is excluded. Assert desktop and mobile nav recognize `/resume` active state,
mobile grid is five stable columns, and Next redirects both trailing/nontrailing legacy paths with status 308.

- [ ] **Step 2: Verify the existing hot-score failure**

Run the focused search test and expect a hot unrelated tool to appear because `status === 'hot'` currently adds 3
before filtering.

- [ ] **Step 3: Separate relevance from ranking bonus**

Refactor scoring to return `{ matchScore, rankScore }`. Name/description/category/categories/tags/toolTags/valueTag
contribute only to `matchScore`; hot contributes only `rankScore`. Filter `matchScore > 0`, then sort by
`matchScore + rankScore`, with stable ID tie-break.

- [ ] **Step 4: Restore canonical entries**

Add ID 95 using current JSON shape, `url: "/resume/"`, categories/pricing/valueTag/highlights consistent with
effective plans, and `requires_login:false` because local editor/export work anonymously. Add `简历优化` to desktop
nav and a FileText resume item to BottomNav; preserve 64px/safe-area geometry. Add permanent redirects in
`next.config.mjs` for `/tools/resume-optimizer` and `/tools/resume-optimizer/` to `/resume/`.

- [ ] **Step 5: Verify and commit**

```bash
node --test next-src/tests/resume-entry.test.mjs next-src/tests/search-suggestions.test.mjs
npm --prefix next-src run build
git add next-src/src/components/layout next-src/public/data/tools.json next-src/src/app/api/search/route.ts next-src/next.config.mjs next-src/tests
git commit -m "fix: restore resume optimizer entries and search relevance"
```

Expected: tests and build pass.

---

### Task 11: Add Browser, Privacy, Accessibility, and PDF Acceptance

**Files:**

- Create: `scripts/resume-ui-guard.mjs`
- Modify: `.github/workflows/deploy.yml`
- Modify: `next-src/tests/resume-ui-contract.test.mjs`
- Modify: `next-src/tests/api-regressions.test.mjs`

**Interfaces:**

- Consumes: built Next standalone server and deterministic mocked Supabase/AI/XDDPAY responses.
- Produces: CI gate and screenshots under `/tmp/resume-ui-qa/` only.

- [ ] **Step 1: Build a deterministic browser guard**

The guard must route/mock only external Supabase, DeepSeek, and XDDPAY calls while exercising real local Next APIs
where possible. Cover anonymous edit/refresh, import TXT/HTML/Markdown plus fixture PDF/DOCX, local fallback, preview,
PDF download, auth interruption/resume, all AI levels, diff accept/undo, exhausted quota, Basic purchase, pending
order recovery, duplicate callback, nav entry, search, and legacy redirect.

- [ ] **Step 2: Add viewport and pixel checks**

For `1440x900`, `1024x768`, `390x844`, `320x844` in dark and light themes, assert page is nonblank, document scroll
width does not exceed viewport, visible controls do not overlap, A4 has nonzero pixels, fixed UI does not cover the
last editor action, and mobile edit/preview switching preserves content. Save screenshots outside Git.

- [ ] **Step 3: Add privacy and accessibility assertions**

Use sentinel text and assert it is absent from console messages, `/api` error bodies, Sentry requests, analytics
requests, localStorage keys other than `weihub-resume-v1`, and all order/quota responses. Run axe-equivalent manual
checks available in Playwright: named landmarks/dialogs, unique labels, visible focus, keyboard-only edit/preview,
Escape close, 44px bounding boxes, and reduced-motion computed duration.

- [ ] **Step 4: Wire the exact CI sequence**

Add before deployment:

```bash
npm --prefix next-src run test:resume
node --test next-src/tests/resume-ui-contract.test.mjs next-src/tests/resume-entry.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
RESUME_UI_URL=http://127.0.0.1:4181 RESUME_QA_DIR=/tmp/resume-ui-qa node scripts/resume-ui-guard.mjs
node scripts/review-regressions.mjs
git diff --check
```

CI payment tests set `REQUIRE_XDDPAY_FIXTURE=1` and obtain the sanitized fixture from encrypted CI secret/file,
never from the repository.

- [ ] **Step 5: Run the full local acceptance and commit**

Start the standalone server on 4181, run the exact CI sequence, inspect desktop/mobile dark/light screenshots and
one generated PDF, then stop the exact server PID.

```bash
git add scripts/resume-ui-guard.mjs .github/workflows/deploy.yml next-src/tests
git commit -m "test: cover complete resume optimizer flow"
```

Expected: all gates pass and generated artifacts remain untracked/outside the repository.

---

### Task 12: Harden Deployment, Migrate Production, and Open the Entry

**Files:**

- Modify: `deploy/tencent-cloud/docker-compose.prod.yml`
- Modify: `deploy/tencent-cloud/quick-deploy.sh`
- Modify: `deploy/tencent-cloud/README.md`
- Modify: `scripts/review-regressions.mjs`

**Interfaces:**

- Consumes: approved and tested commits, Task 0 snapshot, Task 7 migration command, production Supabase/XDDPAY config.
- Produces: reconciled production data, healthy `/resume/`, working AI/payment paths, and a revision-verifiable release.

- [ ] **Step 1: Add deployment regression expectations first**

Require compose/README/preflight to reference `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, `DAILY_QUOTA`,
`XDDPAY_APP_ID`, `XDDPAY_SECRET`, `XDDPAY_GATEWAY`, and `XDDPAY_NOTIFY_URL` without literal values. Require deployment
verification for `/resume/`, authenticated API test command, migration `verify`, payment callback URL, source revision,
and privacy log scan. Run `node scripts/review-regressions.mjs`; expect failure before script edits.

- [ ] **Step 2: Extend deployment without exposing ports or secrets**

Pass private variables only through the existing mode-0600 env file; do not add build args for secrets. Before
container replacement, verify variables are nonempty by name only. Keep port 3100 internal. Healthcheck `/` remains,
and post-deploy checks add `/resume/` HTTP 200 plus permanent legacy redirect.

- [ ] **Step 3: Run migration preflight and dry-run on the server**

Against the Task 0 snapshot:

```bash
npm --prefix /opt/ai-tool-hub/source run migrate:resume -- dry-run \
  --input /secure/resume-migration/quota.json \
  --report /secure/resume-migration/dry-run.json
```

Expected: zero writes, zero unexplained errors, source checksum matches Task 0, and totals are signed off before any
public entry is opened.

- [ ] **Step 4: Apply schema and migrate during a read-only window**

Apply `002_resume_optimizer.sql`, make the old quota source read-only, run `apply`, then `verify`. Expected: verify
exits 0; user, Basic, VIP, remaining quota, usage, order-state, and amount totals have no unexplained differences.
Keep conflicts closed from entitlement activation until manually resolved.

- [ ] **Step 5: Deploy application with entry initially gated**

Deploy the exact committed revision. Validate `/resume/`, Supabase login, quota/plans, one controlled AI parse and
optimization, XDDPAY sandbox/minimum-value payment, duplicate callback, order polling, PDF export, and absence of
sentinel content from logs/database/Sentry. Confirm running OCI revision equals `git rev-parse HEAD`.

- [ ] **Step 6: Open entries and monitor**

Enable the already-deployed nav/tool entry only after Steps 3-5 pass. Monitor for at least 24 hours after opening:
route/API error rate, AI success/refund ratio, reserved-ledger age, callback verification failures, pending/review
orders, duplicate events, and reconciliation deltas.

- [ ] **Step 7: Exercise rollback without losing callbacks**

If application rollback is required, remove/hide public entry while keeping payment callback and owned order status
available, restore the prior image, and leave additive database tables intact. Do not reverse paid entitlements or
delete payment events. Re-run order and quota reconciliation before reopening.

- [ ] **Step 8: Run final checks and commit deployment changes**

```bash
node scripts/review-regressions.mjs
npm --prefix next-src run test:resume
npm --prefix next-src run build
git diff --check
git add deploy/tencent-cloud .github/workflows/deploy.yml scripts/review-regressions.mjs
git commit -m "ops: deploy integrated resume optimizer safely"
```

Expected: all local gates pass, production reports target revision, and no secret/report/generated artifact is staged.

---

## Final Verification Gate

Run from a clean checkout of the release revision:

```bash
npm --prefix next-src ci
npm --prefix next-src run test:resume
node --test next-src/tests/resume-ui-contract.test.mjs next-src/tests/resume-entry.test.mjs next-src/tests/api-regressions.test.mjs
npm --prefix next-src run lint
npm --prefix next-src run build
node scripts/review-regressions.mjs
git diff --check
```

With the built server running on port 4181:

```bash
RESUME_UI_URL=http://127.0.0.1:4181 RESUME_QA_DIR=/tmp/resume-ui-final node scripts/resume-ui-guard.mjs
```

Production release is complete only when:

- `/resume/` returns the editor and old paths permanently redirect.
- Desktop navigation, mobile navigation, homepage/catalog data, and search expose the same canonical entry.
- Anonymous edit/import/preview/PDF and authenticated parse/JD/three-level optimization work end to end.
- Supabase is the only user identity and Postgres is the only quota/order source of truth.
- Legacy users, active memberships, remaining quota, and orders reconcile with no unexplained delta.
- Failed or interrupted AI calls refund once; repeated requests and callbacks do not double-charge or double-grant.
- An authoritative XDDPAY fixture and a controlled live/sandbox payment pass.
- Resume/JD/AI sentinel text is absent from server persistence and telemetry.
- Required desktop/mobile/theme screenshots are nonblank and free of overlap, clipping, and overflow.
- Running production revision equals the approved release commit.
