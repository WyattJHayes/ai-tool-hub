#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SERVER_HOST="${SERVER_HOST:-root@101.43.35.235}"
REMOTE_ROOT="${REMOTE_ROOT:-/opt/ai-tool-hub}"
DGC_ROOT="${DGC_ROOT:-/opt/dramagenai/dramagenai-cloud}"
COMPOSE_SOURCE="$SCRIPT_DIR/docker-compose.prod.yml"
NGINX_SOURCE="$SCRIPT_DIR/nginx.conf"
ENV_VALIDATOR="$SCRIPT_DIR/validate-env.py"
RELEASE_LIB="$SCRIPT_DIR/release-lib.sh"

# Shared release helpers are uploaded with each candidate and exercised by the
# repository's deployment behavior tests.
source "$RELEASE_LIB"

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
    local aggregate_output
    local aggregate_status

    require_command ssh
    ssh "$SERVER_HOST" bash -s -- "$REMOTE_ROOT" <<'REMOTE_PREFLIGHT'
set -euo pipefail

remote_root="$1"
env_file="$remote_root/.env"

if [ ! -s "$env_file" ]; then
    echo "production_env=missing" >&2
    exit 1
fi
if [ "$(stat -c '%a' "$remote_root/.env")" != 600 ]; then
    echo "production_env_mode=invalid" >&2
    exit 1
fi

if ! docker container inspect weihub-app >/dev/null 2>&1; then
    echo "current_container=missing" >&2
    exit 1
fi
REMOTE_PREFLIGHT

    # Stream the parser itself so production secrets never leave the host and a
    # stale remote validator cannot silently weaken this release's contract.
    ssh "$SERVER_HOST" python3 - "$REMOTE_ROOT/.env" < "$ENV_VALIDATOR"
    echo "payment_boundary=disabled"

    set +e
    aggregate_output="$(ssh "$SERVER_HOST" bash -s 2>/dev/null <<'REMOTE_AGGREGATE'
set -uo pipefail
docker exec -i weihub-app node - <<'NODE'
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
NODE
REMOTE_AGGREGATE
)"
    aggregate_status=$?
    set -e
    classify_aggregate_probe "$aggregate_status" "$aggregate_output"
    echo "preflight_source_revision=$source_revision"
}

preflight_release() {
    local source_revision
    source_revision="$(get_source_revision)"
    verify_payment_boundary
    require_release_authority "$source_revision"
    preflight_remote "$source_revision"
}

upload_sources() {
    local archive
    local candidate_root
    local source_checksum
    local source_revision
    local temp_root

    preflight_release
    require_command git
    require_command ssh
    require_command scp
    source_revision="$(get_source_revision)"
    candidate_root="$REMOTE_ROOT/candidates/$source_revision"
    temp_root="$(mktemp -d)"
    trap 'rm -rf "$temp_root"' RETURN
    archive="$temp_root/source.tar"

    create_source_archive "$PROJECT_ROOT" "$source_revision" "$archive"
    source_checksum="$(release_sha256 "$archive")"

    ssh "$SERVER_HOST" install -d -m 0755 "$candidate_root"
    scp "$archive" "$SERVER_HOST:$candidate_root/source.tar.upload"
    scp "$COMPOSE_SOURCE" "$SERVER_HOST:$candidate_root/docker-compose.yml.upload"
    scp "$NGINX_SOURCE" "$SERVER_HOST:$candidate_root/weihub.cloud.conf.upload"
    scp "$RELEASE_LIB" "$SERVER_HOST:$candidate_root/release-lib.sh.upload"
    ssh "$SERVER_HOST" bash -s -- "$candidate_root" <<'REMOTE_UPLOAD'
set -euo pipefail
candidate_root="$1"
install -m 0644 "$candidate_root/source.tar.upload" "$candidate_root/source.tar"
install -m 0644 "$candidate_root/docker-compose.yml.upload" "$candidate_root/docker-compose.yml"
install -m 0644 "$candidate_root/weihub.cloud.conf.upload" "$candidate_root/weihub.cloud.conf"
install -m 0644 "$candidate_root/release-lib.sh.upload" "$candidate_root/release-lib.sh"
rm -f "$candidate_root/source.tar.upload" \
    "$candidate_root/docker-compose.yml.upload" \
    "$candidate_root/weihub.cloud.conf.upload" \
    "$candidate_root/release-lib.sh.upload"
REMOTE_UPLOAD
    printf 'candidate_source_revision=%s\ncandidate_source_sha256=%s\n' \
        "$source_revision" "$source_checksum"
}

deploy_remote() {
    local archive
    local expected_checksum
    local expected_compose_checksum
    local expected_nginx_checksum
    local expected_release_lib_checksum
    local expected_revision
    local temp_root

    require_command git
    require_command ssh
    expected_revision="$(get_source_revision)"
    preflight_release
    temp_root="$(mktemp -d)"
    trap 'rm -rf "$temp_root"' RETURN
    archive="$temp_root/source.tar"
    create_source_archive "$PROJECT_ROOT" "$expected_revision" "$archive"
    expected_checksum="$(release_sha256 "$archive")"
    expected_compose_checksum="$(release_sha256 "$COMPOSE_SOURCE")"
    expected_nginx_checksum="$(release_sha256 "$NGINX_SOURCE")"
    expected_release_lib_checksum="$(release_sha256 "$RELEASE_LIB")"

    ssh "$SERVER_HOST" bash -s -- \
        "$REMOTE_ROOT" "$DGC_ROOT" "$expected_revision" "$expected_checksum" \
        "$expected_compose_checksum" "$expected_nginx_checksum" \
        "$expected_release_lib_checksum" <<'REMOTE_SCRIPT'
set -euo pipefail

remote_root="$1"
dgc_root="$2"
expected_revision="$3"
expected_checksum="$4"
expected_compose_checksum="$5"
expected_nginx_checksum="$6"
expected_release_lib_checksum="$7"
compose_file="$remote_root/docker-compose.yml"
candidate_root="$remote_root/candidates/$expected_revision"
candidate_archive="$candidate_root/source.tar"
candidate_compose="$candidate_root/docker-compose.yml"
candidate_nginx="$candidate_root/weihub.cloud.conf"
candidate_release_lib="$candidate_root/release-lib.sh"
nginx_target="$dgc_root/nginx/conf.d/legacy-domain-redirect.conf"
timestamp="$(date +%Y%m%d%H%M%S)"
backup_root="$remote_root/backups/$timestamp"
candidate_source="$candidate_root/source-$timestamp-$$"
candidate_image="ai-resume-optimizer:candidate-$expected_revision"
rollback_image=""
rollback_keep=3
backup_keep=10

if [[ ! "$expected_revision" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid approved source revision." >&2
    exit 1
fi

if [ ! -s "$remote_root/.env" ]; then
    echo "Missing required environment file: $remote_root/.env" >&2
    exit 1
fi

if [ ! -s "$candidate_archive" ] || [ ! -s "$candidate_compose" ] \
    || [ ! -s "$candidate_nginx" ] || [ ! -s "$candidate_release_lib" ]; then
    echo "Run the upload step before deploy." >&2
    exit 1
fi

verify_candidate_checksum() {
    local artifact="$1"
    local expected="$2"
    local label="$3"
    local actual

    if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]]; then
        printf 'candidate_%s_checksum=invalid\n' "$label" >&2
        return 1
    fi
    actual="$(sha256sum "$artifact" | awk '{print $1}')" || {
        printf 'candidate_%s_checksum=unreadable\n' "$label" >&2
        return 1
    }
    if [ "$actual" != "$expected" ]; then
        printf 'candidate_%s_checksum=mismatch\n' "$label" >&2
        return 1
    fi
    printf 'candidate_%s_checksum=verified\n' "$label"
}

verify_candidate_checksum "$candidate_release_lib" "$expected_release_lib_checksum" release_lib
verify_candidate_checksum "$candidate_compose" "$expected_compose_checksum" compose
verify_candidate_checksum "$candidate_nginx" "$expected_nginx_checksum" nginx
source "$candidate_release_lib"
verify_source_archive "$candidate_archive" "$expected_checksum"

install -d -m 0755 "$candidate_source"
tar -xf "$candidate_archive" -C "$candidate_source" --strip-components=1
source_revision="$expected_revision"

if validate_and_build_candidate_preserving_active \
    "$candidate_compose" "$remote_root/.env" "$candidate_source" \
    "$candidate_image" "$source_revision" \
    "$compose_file" "$nginx_target"; then
    :
else
    status=$?
    rm -rf "$candidate_source"
    exit "$status"
fi

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
cp "$candidate_compose" "$backup_root/docker-compose.yml"
printf '%s\n' "$source_revision" > "$backup_root/source-revision"

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
    local expected_url="$3"
    local final
    local status
    status="$(curl --noproxy '*' --resolve "$host:443:127.0.0.1" --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" || true)"
    final="$(curl --noproxy '*' --resolve "$host:443:127.0.0.1" \
        --location --max-redirs 5 --silent --output /dev/null \
        --write-out '%{http_code} %{url_effective}' --max-time 10 "$url" || true)"
    { [ "$status" = 301 ] || [ "$status" = 308 ]; } \
        && [ "$final" = "200 $expected_url" ]
}

verify_local_status() {
    local host="$1"
    local url="$2"
    local expected="$3"
    local status
    status="$(curl --noproxy '*' --resolve "$host:443:127.0.0.1" --silent --output /dev/null --write-out '%{http_code}' --max-time 10 "$url" || true)"
    [ "$status" = "$expected" ]
}

verify_candidate_release() {
    local compose_owner
    local healthy=false
    local running_revision
    local state

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
        return 1
    fi
    if [ -n "$(docker port weihub-app)" ]; then
        echo "weihub-app unexpectedly publishes a host port" >&2
        return 1
    fi

    running_revision="$(docker inspect weihub-app --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')" || return $?
    if [ "$running_revision" != "$source_revision" ]; then
        echo "Running image revision does not match the approved source revision." >&2
        return 1
    fi
    compose_owner="$(docker inspect weihub-app --format '{{ index .Config.Labels "com.docker.compose.project" }}')" || return $?
    if [ "$compose_owner" != weihub ]; then
        echo "Candidate container is not owned by the expected Compose project." >&2
        return 1
    fi

    docker exec dgc-nginx nginx -t || return $?
    docker exec dgc-nginx nginx -s reload || return $?
    if ! verify_local_tls weihub.cloud https://weihub.cloud/ \
        || ! verify_local_tls weihub.cloud https://weihub.cloud/resume/ \
        || ! verify_local_tls weihub.cloud https://weihub.cloud/love/ \
        || ! verify_local_permanent_redirect weihub.cloud \
            https://weihub.cloud/resume-optimizer/ https://weihub.cloud/resume \
        || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/orders 404 \
        || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/orders/pending 404 \
        || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/payments/xddpay/notify 404 \
        || ! verify_local_status weihub.cloud https://weihub.cloud/api/resume/payment/callback 404 \
        || ! verify_local_tls dramagenai.cloud https://dramagenai.cloud/; then
        return 1
    fi
    scan_privacy_logs weihub-app
}

rollback_image="ai-resume-optimizer:rollback-$timestamp"
if run_candidate_activation \
    "$candidate_source" "$remote_root/source" \
    "$candidate_compose" "$compose_file" \
    "$candidate_nginx" "$nginx_target" \
    "$backup_root" "$remote_root/.env" "$candidate_image" \
    "$rollback_image" "$source_revision" verify_candidate_release; then
    :
else
    status=$?
    exit "$status"
fi

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
printf '%s\n' "$source_revision" | install -m 0644 /dev/stdin "$remote_root/source-revision"
docker image rm "$candidate_image" >/dev/null 2>&1 || true

echo "Deployment completed. Revision: $source_revision. Backup: $backup_root"
REMOTE_SCRIPT
}

show_status() {
    ssh "$SERVER_HOST" "cd '$REMOTE_ROOT' && env -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u AI_TOOL_HUB_ENV_FILE -u AI_TOOL_HUB_IMAGE -u AI_TOOL_HUB_SOURCE_DIR -u AI_TOOL_HUB_BUILD_CONTEXT -u DGC_NETWORK_NAME -u GIT_SHA -u COMPOSE_PROJECT_NAME AI_TOOL_HUB_ENV_FILE='$REMOTE_ROOT/.env' AI_TOOL_HUB_IMAGE=ai-resume-optimizer:latest AI_TOOL_HUB_SOURCE_DIR='$REMOTE_ROOT/source' AI_TOOL_HUB_BUILD_CONTEXT='$REMOTE_ROOT/source' DGC_NETWORK_NAME=dramagenai-cloud_dgc-net GIT_SHA=status COMPOSE_PROJECT_NAME=weihub docker compose --project-name weihub --env-file '$REMOTE_ROOT/.env' -f docker-compose.yml ps && docker exec dgc-nginx nginx -t"
}

show_logs() {
    ssh -t "$SERVER_HOST" "cd '$REMOTE_ROOT' && env -u COMPOSE_FILE -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES -u AI_TOOL_HUB_ENV_FILE -u AI_TOOL_HUB_IMAGE -u AI_TOOL_HUB_SOURCE_DIR -u AI_TOOL_HUB_BUILD_CONTEXT -u DGC_NETWORK_NAME -u GIT_SHA -u COMPOSE_PROJECT_NAME AI_TOOL_HUB_ENV_FILE='$REMOTE_ROOT/.env' AI_TOOL_HUB_IMAGE=ai-resume-optimizer:latest AI_TOOL_HUB_SOURCE_DIR='$REMOTE_ROOT/source' AI_TOOL_HUB_BUILD_CONTEXT='$REMOTE_ROOT/source' DGC_NETWORK_NAME=dramagenai-cloud_dgc-net GIT_SHA=logs COMPOSE_PROJECT_NAME=weihub docker compose --project-name weihub --env-file '$REMOTE_ROOT/.env' -f docker-compose.yml logs --tail 200 -f web"
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
