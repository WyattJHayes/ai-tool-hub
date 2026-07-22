# weihub.cloud Production Deployment

`weihub.cloud` is served by the Next.js application container. The existing
`dgc-nginx` container is the only public entrypoint on ports 80 and 443.
`dramagenai.cloud` remains a separate virtual host and is not modified by this
deployment. The existing static memorial page remains available at `/love/`.

## Prerequisites

- Docker Engine and Docker Compose v2 on `101.43.35.235`.
- Docker Buildx plugin for BuildKit-backed Compose builds.
- Existing external Docker network `dramagenai-cloud_dgc-net`.
- Existing `dgc-nginx` container with the repository's certificate volume.
- TLS files under `/etc/letsencrypt/live/weihub.cloud` inside `dgc-nginx`.
- A secret environment file at `/opt/ai-tool-hub/.env`, mode `0600`.

The environment file must contain the application's production variables. Do
not commit or print it. Verify keys by name and presence only. The required
names are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`, and `DAILY_QUOTA`;
`DAILY_QUOTA` must be exactly `10`. Values are loaded only through the
mode-0600 runtime env file and are never Docker build arguments.

`XDDPAY_APP_ID`, `XDDPAY_SECRET`, and `XDDPAY_GATEWAY` are documented runtime
names, not current requirements. `XDDPAY_NOTIFY_URL` uses `/api/resume/payments/xddpay/notify` when enabled.
Do not add placeholder values. Payment
remains fail-closed until the provider supplies an authoritative signed fixture
and the payment release gate is rerun; while disabled, callback and order APIs
must remain absent and return 404.

## Release Gates

Run the billing migration and rollback-only billing fixture against an
isolated Supabase-compatible Postgres first. This is the executable gate for
`002_resume_optimizer.sql` and `resume_billing.sql`, including Basic/VIP quota
and compensation behavior. Never point this command at production:

```bash
SUPABASE_TEST_DB_URL="$SUPABASE_TEST_DB_URL" \
  deploy/tencent-cloud/quick-deploy.sh sql-preflight
```

Only after that succeeds, and only with an authorized direct production
connection, apply the additive schema in a read-only application window:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f next-src/supabase/migrations/002_resume_optimizer.sql
```

There is no recoverable legacy quota source or authoritative legacy schema.
Do not create `/secure/resume-migration/quota.json`, a checksum, dry-run/apply
totals, or a migration `verify` report. The supported zero-source path is the
aggregate-only `preflight` below. It reports `aggregate_transport_*`,
`aggregate_query_*`, and `aggregate_result_*` separately for Auth, profiles,
quota accounts, usage, memberships, orders, and payment events. A transport or
query failure is a hard failure and is never interpreted as a zero count.

The candidate currently contains the public resume entry, so there is no safe
partially exposed deployment. After isolated SQL, production schema, aggregate
reconciliation, and an authenticated controlled API check pass, approve the
exact revision explicitly:

```bash
revision="$(git rev-parse HEAD)"
export RESUME_ISOLATED_SQL_VERIFIED_REVISION="$revision"
export RESUME_PRODUCTION_SCHEMA_VERIFIED_REVISION="$revision"
export RESUME_AUTHENTICATED_API_VERIFIED_REVISION="$revision"
export RESUME_PUBLIC_ENTRY_APPROVED_REVISION="$revision"
deploy/tencent-cloud/quick-deploy.sh preflight
```

Use a short-lived controlled access token without printing or persisting it to
verify the authenticated quota API before setting the authenticated-API
approval:

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $RESUME_RELEASE_ACCESS_TOKEN" \
  https://weihub.cloud/api/resume/quota >/dev/null
```

The source revision approvals are process gates, not substitutes for evidence.
Set them only after the named checks pass for that exact commit.

## Deploy

From the repository root:

```bash
deploy/tencent-cloud/quick-deploy.sh full
```

The script refuses to upload or replace anything until every revision-bound
approval and the live zero-source preflight pass. It then uploads `next-src`,
builds the image on the server, replaces the application transactionally,
validates Nginx, and verifies both domains. It does not publish port 3100 on
the host. Nginx reaches the application through the `weihub-app` alias on the
external Docker network.

Post-deploy verification requires `/resume/` HTTP 200, a permanent legacy
`/resume-optimizer/` redirect, payment/order API 404s, zero privacy log scan
matches, Compose ownership by `weihub`, and exact running/source revision
equality. Any failure restores the prior image and Nginx configuration. After
the new service is healthy, the script disables the obsolete
`ai-resume-optimizer.service` unit that previously recreated a host-published
container. Successful deployments remove that retired unit and retain only
the newest three rollback image tags and ten timestamped backup directories.

Useful commands:

```bash
deploy/tencent-cloud/quick-deploy.sh status
deploy/tencent-cloud/quick-deploy.sh logs
```

Confirm the exact Git revision running in production:

```bash
ssh root@101.43.35.235 \
  "docker inspect -f '{{ index .Config.Labels \"org.opencontainers.image.revision\" }}' weihub-app"
```

Deployments reject uncommitted or untracked files under `next-src` so this
revision always identifies the source used to build the image. Release-path
changes under `deploy/tencent-cloud`, `.github/workflows/deploy.yml`, and
`scripts/review-regressions.mjs` are rejected too.

Override the default target when needed:

```bash
SERVER_HOST=root@101.43.35.235 deploy/tencent-cloud/quick-deploy.sh full
```

## Domain Verification

```bash
curl -I https://weihub.cloud/
curl -I https://www.weihub.cloud/
curl -I https://dramagenai.cloud/
```

Expected results:

- `weihub.cloud` and `www.weihub.cloud` return the AI Tool Hub application.
- `weihub.cloud/love/` returns the preserved static memorial page.
- `dramagenai.cloud` returns DramagenAI Cloud.
- `docker inspect ai-resume-optimizer` has no host binding for port 3100.

Timestamped backups are stored under `/opt/ai-tool-hub/backups/` on the server.

## Privacy And Monitoring

The automated privacy log scan checks only the count of forbidden resume/JD
field and sentinel matches; matching content is never printed. Do not print
raw application logs during release investigation. After opening the entry,
monitor for at least 24 hours: route/API errors, AI success-to-refund ratio,
reserved-ledger age, pending/review orders, duplicate events, callback
verification failures, and aggregate reconciliation deltas. Callback metrics
must be reported as payment-disabled until the provider fixture gate passes.

For application rollback, hide the public entry first when possible, restore
the prior image, keep additive billing tables intact, and do not delete payment
events or reverse paid entitlements. Re-run order/quota reconciliation before
reopening. The callback route must remain available when payment is eventually
enabled; the current disabled release has no callback ownership to preserve.
