#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SERVER_HOST="${SERVER_HOST:-root@101.43.35.235}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-tool-hub}"
DGC_ROOT="${DGC_ROOT:-/opt/dramagenai/dramagenai-cloud}"
COMPOSE_SOURCE="$SCRIPT_DIR/docker-compose.prod.yml"
NGINX_SOURCE="$SCRIPT_DIR/nginx.conf"

usage() {
    printf 'Usage: %s {build|sql-preflight|preflight|upload|deploy|full|status|logs}\n' "$0"
}

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        printf 'Required command is missing: %s\n' "$1" >&2
        exit 1
    fi
}

build_local() {
    require_command npm
    npm --prefix "$PROJECT_ROOT/next-src" ci
    npm --prefix "$PROJECT_ROOT/next-src" run build
}

run_isolated_sql() {
    require_command psql

    if [ -z "${SUPABASE_TEST_DB_URL:-}" ]; then
        echo "SUPABASE_TEST_DB_URL is required for the isolated SQL gate." >&2
        exit 1
    fi

    psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 \
        -f "$PROJECT_ROOT/next-src/supabase/migrations/002_resume_optimizer.sql"
    psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 \
        -f "$PROJECT_ROOT/next-src/supabase/tests/resume_billing.sql"
}

get_source_revision() {
    require_command git

    if ! git -C "$PROJECT_ROOT" diff --quiet HEAD -- next-src; then
        echo "Refusing to deploy uncommitted next-src changes." >&2
        exit 1
    fi
    if [ -n "$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard -- next-src)" ]; then
        echo "Refusing to deploy untracked next-src files." >&2
        exit 1
    fi
    if ! git -C "$PROJECT_ROOT" diff --quiet HEAD -- \
        next-src deploy/tencent-cloud .github/workflows/deploy.yml scripts/review-regressions.mjs; then
        echo "Refusing to deploy uncommitted release-path changes." >&2
        exit 1
    fi
    if [ -n "$(git -C "$PROJECT_ROOT" ls-files --others --exclude-standard -- \
        next-src deploy/tencent-cloud .github/workflows/deploy.yml scripts/review-regressions.mjs)" ]; then
        echo "Refusing to deploy untracked release-path files." >&2
        exit 1
    fi

    git -C "$PROJECT_ROOT" rev-parse HEAD
}

verify_payment_boundary() {
    local route
    for route in \
        "$PROJECT_ROOT/next-src/src/app/api/resume/orders" \
        "$PROJECT_ROOT/next-src/src/app/api/resume/payments/xddpay/notify" \
        "$PROJECT_ROOT/next-src/src/app/api/resume/payment/callback"; do
        if [ -e "$route" ]; then
            echo "payment_boundary must remain disabled until the provider fixture gate passes." >&2
            exit 1
        fi
    done
}

require_release_authority() {
    local source_revision="$1"
    local variable
    for variable in \
        RESUME_ISOLATED_SQL_VERIFIED_REVISION \
        RESUME_PRODUCTION_SCHEMA_VERIFIED_REVISION \
        RESUME_AUTHENTICATED_API_VERIFIED_REVISION \
        RESUME_PUBLIC_ENTRY_APPROVED_REVISION; do
        if [ "${!variable:-}" != "$source_revision" ]; then
            printf '%s must equal the exact source revision before release.\n' "$variable" >&2
            exit 1
        fi
    done
}

preflight_remote() {
    local source_revision="$1"

    require_command ssh
    ssh "$SERVER_HOST" bash -s -- "$REMOTE_ROOT" "$source_revision" <<'REMOTE_PREFLIGHT'
set -euo pipefail

remote_root="$1"
source_revision="$2"
env_file="$remote_root/.env"

if [ ! -s "$env_file" ]; then
    echo "production_env=missing" >&2
    exit 1
fi
if [ "$(stat -c '%a' "$remote_root/.env")" != 600 ]; then
    echo "production_env_mode=invalid" >&2
    exit 1
fi

env_value() {
    awk -v wanted="$1" '
        /^[[:space:]]*#/ { next }
        {
            line=$0
            sub(/^[[:space:]]*export[[:space:]]+/, "", line)
            split(line, parts, "=")
            key=parts[1]
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", key)
            if (key == wanted) {
                sub(/^[^=]*=/, "", line)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
                print line
                exit
            }
        }
    ' "$env_file"
}

for key in \
    NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY \
    DEEPSEEK_API_KEY; do
    if [ -z "$(env_value "$key")" ]; then
        printf 'required_env_%s=missing\n' "$key" >&2
        exit 1
    fi
    printf 'required_env_%s=present\n' "$key"
done
if [ "$(env_value DAILY_QUOTA)" != 10 ]; then
    echo "required_env_DAILY_QUOTA=not_exactly_10" >&2
    exit 1
fi
echo "required_env_DAILY_QUOTA=present_exact_10"

# Inspect payment names without requiring placeholders. The candidate remains
# disabled until a provider-signed fixture resolves the provider contract.
for key in XDDPAY_APP_ID XDDPAY_SECRET XDDPAY_GATEWAY XDDPAY_NOTIFY_URL; do
    if [ -n "$(env_value "$key")" ]; then
        printf 'optional_env_%s=present\n' "$key"
    else
        printf 'optional_env_%s=absent\n' "$key"
    fi
done
echo "payment_boundary=disabled"

if ! docker container inspect weihub-app >/dev/null 2>&1; then
    echo "aggregate_transport=current_container_missing" >&2
    exit 1
fi

aggregate_output="$(docker exec weihub-app node -e '
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const results = [];
async function count(label, path, auth = false) {
  if (!base || !key) { results.push({ label, transport: false, query: false }); return; }
  try {
    const headers = auth
      ? { apikey: key, Authorization: `Bearer ${key}` }
      : { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact", Range: "0-0" };
    const response = await fetch(`${base}${path}`, { method: auth ? "GET" : "HEAD", headers });
    const raw = auth ? response.headers.get("x-total-count") : (response.headers.get("content-range") || "").split("/").at(-1);
    const total = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
    results.push({ label, transport: true, query: response.ok && Number.isSafeInteger(total), total });
  } catch { results.push({ label, transport: false, query: false }); }
}
await count("auth_users", "/auth/v1/admin/users?page=1&per_page=1", true);
for (const table of ["profiles", "resume_quota_accounts", "resume_usage_ledger", "resume_memberships", "resume_orders", "resume_payment_events"]) {
  await count(table, `/rest/v1/${table}?select=id`);
}
for (const result of results) {
  console.log(`aggregate_transport_${result.label}=${result.transport ? "pass" : "fail"}`);
  console.log(`aggregate_query_${result.label}=${result.query ? "pass" : "fail"}`);
  if (result.query) console.log(`aggregate_result_${result.label}=${result.total === 0 ? "zero" : "nonzero"} count=${result.total}`);
}
')"
printf '%s\n' "$aggregate_output"
if grep -Eq 'aggregate_(transport|query)_[^=]+=fail' <<<"$aggregate_output"; then
    echo "zero_source_reconciliation=failed" >&2
    exit 1
fi
if [ "$(grep -c '^aggregate_result_' <<<"$aggregate_output")" -ne 7 ]; then
    echo "zero_source_reconciliation=incomplete" >&2
    exit 1
fi
echo "zero_source_reconciliation=passed"
echo "preflight_source_revision=$source_revision"
REMOTE_PREFLIGHT
}

preflight_release() {
    local source_revision
    source_revision="$(get_source_revision)"
    verify_payment_boundary
    require_release_authority "$source_revision"
    preflight_remote "$source_revision"
}

upload_sources() {
    local source_revision

    preflight_release
    require_command rsync
    require_command ssh
    require_command scp
    source_revision="$(get_source_revision)"

    ssh "$SERVER_HOST" "install -d -m 0755 '$REMOTE_ROOT/source'"
    rsync -az --delete \
        --exclude '.env' \
        --exclude '.env.*' \
        --exclude '.next' \
        --exclude 'node_modules' \
        "$PROJECT_ROOT/next-src/" "$SERVER_HOST:$REMOTE_ROOT/source/"
    scp "$COMPOSE_SOURCE" "$SERVER_HOST:$REMOTE_ROOT/docker-compose.yml.new"
    scp "$NGINX_SOURCE" "$SERVER_HOST:$REMOTE_ROOT/weihub.cloud.conf.new"
    printf '%s\n' "$source_revision" \
        | ssh "$SERVER_HOST" "install -m 0644 /dev/stdin '$REMOTE_ROOT/source-revision.new'"
}

deploy_remote() {
    local expected_revision

    require_command ssh
    expected_revision="$(get_source_revision)"
    preflight_release

    ssh "$SERVER_HOST" bash -s -- "$REMOTE_ROOT" "$DGC_ROOT" "$expected_revision" <<'REMOTE_SCRIPT'
set -euo pipefail

remote_root="$1"
dgc_root="$2"
expected_revision="$3"
compose_file="$remote_root/docker-compose.yml"
candidate_compose="$remote_root/docker-compose.yml.new"
candidate_nginx="$remote_root/weihub.cloud.conf.new"
candidate_revision="$remote_root/source-revision.new"
nginx_target="$dgc_root/nginx/conf.d/legacy-domain-redirect.conf"
timestamp="$(date +%Y%m%d%H%M%S)"
backup_root="$remote_root/backups/$timestamp"
rollback_image=""
rollback_keep=3
backup_keep=10

if [ ! -s "$remote_root/.env" ]; then
    echo "Missing required environment file: $remote_root/.env" >&2
    exit 1
fi

if [ ! -s "$candidate_compose" ] || [ ! -s "$candidate_nginx" ] || [ ! -s "$candidate_revision" ]; then
    echo "Run the upload step before deploy." >&2
    exit 1
fi

candidate_revision_value="$(tr -d '\r\n' < "$candidate_revision")"
if [[ ! "$candidate_revision_value" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid candidate source revision." >&2
    exit 1
fi
if [ "$candidate_revision_value" != "$expected_revision" ]; then
    echo "Staged candidate revision does not match the approved local revision." >&2
    exit 1
fi
source_revision="$candidate_revision_value"
export GIT_SHA="$source_revision"

install -d -m 0700 "$backup_root"
chmod 0600 "$remote_root/.env"
cp "$remote_root/.env" "$backup_root/app.env"
chmod 0600 "$backup_root/app.env"

if docker container inspect ai-resume-optimizer >"$backup_root/container-inspect.json" 2>/dev/null; then
    chmod 0600 "$backup_root/container-inspect.json"
fi
if [ -f /etc/systemd/system/ai-resume-optimizer.service ]; then
    cp /etc/systemd/system/ai-resume-optimizer.service "$backup_root/ai-resume-optimizer.service"
fi
cp "$nginx_target" "$backup_root/weihub.cloud.conf"
cp "$candidate_compose" "$backup_root/docker-compose.yml"
cp "$candidate_revision" "$backup_root/source-revision"
if [ -s "$compose_file" ]; then
    cp "$compose_file" "$backup_root/previous-docker-compose.yml"
fi

install -m 0644 "$candidate_compose" "$compose_file"
install -m 0644 "$candidate_nginx" "$nginx_target"

cd "$remote_root"
docker compose --env-file "$remote_root/.env" -f "$compose_file" config -q
if docker image inspect ai-resume-optimizer:latest >/dev/null 2>&1; then
    rollback_image="ai-resume-optimizer:rollback-$timestamp"
    docker tag ai-resume-optimizer:latest "$rollback_image"
fi
docker compose --env-file "$remote_root/.env" -f "$compose_file" build

rollback() {
    cp "$backup_root/weihub.cloud.conf" "$nginx_target"
    if [ -n "$rollback_image" ]; then
        docker tag "$rollback_image" ai-resume-optimizer:latest
        if [ -s "$backup_root/previous-docker-compose.yml" ]; then
            cp "$backup_root/previous-docker-compose.yml" "$compose_file"
        fi
        docker compose --env-file "$remote_root/.env" -f "$compose_file" up -d --force-recreate >/dev/null 2>&1 || true
    else
        docker compose --env-file "$remote_root/.env" -f "$compose_file" down >/dev/null 2>&1 || true
    fi
    docker exec dgc-nginx nginx -t
    docker exec dgc-nginx nginx -s reload
}

prune_deployment_history() {
    local index
    local rollback_tags=()
    local backup_paths=()

    mapfile -t rollback_tags < <(
        docker images --format '{{.Repository}}:{{.Tag}}' \
            | grep '^ai-resume-optimizer:rollback-' \
            | sort -r
    )
    for ((index = rollback_keep; index < ${#rollback_tags[@]}; index++)); do
        docker image rm "${rollback_tags[$index]}" >/dev/null 2>&1 || true
    done

    mapfile -t backup_paths < <(
        find "$remote_root/backups" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
            | sort -nr \
            | cut -d' ' -f2-
    )
    for ((index = backup_keep; index < ${#backup_paths[@]}; index++)); do
        find "${backup_paths[$index]}" -depth -delete
    done
}

if ! docker compose --env-file "$remote_root/.env" -f "$compose_file" up -d --force-recreate; then
    rollback
    exit 1
fi

healthy=false
for _ in $(seq 1 40); do
    state="$(docker inspect weihub-app --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
    if [ "$state" = healthy ]; then
        healthy=true
        break
    fi
    if [ "$state" = exited ] || [ "$state" = dead ]; then
        break
    fi
    sleep 3
done

if [ "$healthy" != true ]; then
    echo "Candidate container did not become healthy; raw application logs are suppressed by the privacy gate." >&2
    rollback
    exit 1
fi

if [ -n "$(docker port weihub-app)" ]; then
    echo "weihub-app unexpectedly publishes a host port" >&2
    rollback
    exit 1
fi

running_revision="$(docker inspect weihub-app --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [ "$running_revision" != "$source_revision" ]; then
    echo "Running image revision does not match the approved source revision." >&2
    rollback
    exit 1
fi

compose_owner="$(docker inspect weihub-app --format '{{ index .Config.Labels "com.docker.compose.project" }}')"
if [ "$compose_owner" != weihub ]; then
    echo "Candidate container is not owned by the expected Compose project." >&2
    rollback
    exit 1
fi

if ! docker exec dgc-nginx nginx -t; then
    rollback
    exit 1
fi
docker exec dgc-nginx nginx -s reload

verify_local_tls() {
    local host="$1"
    local url="$2"
    for _ in $(seq 1 10); do
        if curl --noproxy '*' --resolve "$host:443:127.0.0.1" --fail --silent --show-error --max-time 10 "$url" >/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

verify_local_permanent_redirect() {
    local host="$1"
    local url="$2"
    local status
    status="$(curl --noproxy '*' --resolve "$host:443:127.0.0.1" --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" || true)"
    [ "$status" = 301 ] || [ "$status" = 308 ]
}

verify_local_status() {
    local host="$1"
    local url="$2"
    local expected="$3"
    local status
    status="$(curl --noproxy '*' --resolve "$host:443:127.0.0.1" --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" || true)"
    [ "$status" = "$expected" ]
}

if ! verify_local_tls weihub.cloud https://weihub.cloud/ \
    || ! verify_local_tls weihub.cloud https://weihub.cloud/resume/ \
    || ! verify_local_tls weihub.cloud https://weihub.cloud/love/ \
    || ! verify_local_permanent_redirect weihub.cloud https://weihub.cloud/resume-optimizer/ \
    || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/orders 404 \
    || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/orders/pending 404 \
    || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/payments/xddpay/notify 404 \
    || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/payment/callback 404 \
    || ! verify_local_tls dramagenai.cloud https://dramagenai.cloud/; then
    rollback
    exit 1
fi

privacy_matches="$(docker logs weihub-app 2>&1 | grep -Eci 'resumeText|jdText|RESUME-PRIVATE|JOB-DESCRIPTION-PRIVATE' || true)"
if [ "$privacy_matches" -ne 0 ]; then
    echo "privacy log scan failed; matching log content is suppressed." >&2
    rollback
    exit 1
fi
echo "privacy_log_scan=passed"

if systemctl is-enabled --quiet ai-resume-optimizer.service 2>/dev/null; then
    systemctl disable ai-resume-optimizer.service
fi
if systemctl is-active --quiet ai-resume-optimizer.service 2>/dev/null; then
    systemctl stop ai-resume-optimizer.service
fi
if [ -f /etc/systemd/system/ai-resume-optimizer.service ]; then
    unlink /etc/systemd/system/ai-resume-optimizer.service
    systemctl daemon-reload
    systemctl reset-failed ai-resume-optimizer.service 2>/dev/null || true
fi
if docker container inspect ai-resume-optimizer >/dev/null 2>&1; then
    docker stop ai-resume-optimizer >/dev/null
    docker rm ai-resume-optimizer >/dev/null
fi
prune_deployment_history
install -m 0644 "$candidate_revision" "$remote_root/source-revision"

echo "Deployment completed. Revision: $source_revision. Backup: $backup_root"
REMOTE_SCRIPT
}

show_status() {
    ssh "$SERVER_HOST" "cd '$REMOTE_ROOT' && docker compose --env-file '$REMOTE_ROOT/.env' -f docker-compose.yml ps && docker exec dgc-nginx nginx -t"
}

show_logs() {
    ssh -t "$SERVER_HOST" "cd '$REMOTE_ROOT' && docker compose --env-file '$REMOTE_ROOT/.env' -f docker-compose.yml logs --tail 200 -f web"
}

case "${1:-}" in
    build)
        build_local
        ;;
    sql-preflight)
        run_isolated_sql
        ;;
    preflight)
        preflight_release
        ;;
    upload)
        upload_sources
        ;;
    deploy)
        deploy_remote
        ;;
    full)
        upload_sources
        deploy_remote
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        usage
        exit 1
        ;;
esac
