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
    printf 'Usage: %s {build|upload|deploy|full|status|logs}\n' "$0"
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

    git -C "$PROJECT_ROOT" rev-parse HEAD
}

upload_sources() {
    local source_revision

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
    require_command ssh

    ssh "$SERVER_HOST" bash -s -- "$REMOTE_ROOT" "$DGC_ROOT" <<'REMOTE_SCRIPT'
set -euo pipefail

remote_root="$1"
dgc_root="$2"
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

git_sha="$(tr -d '\r\n' < "$candidate_revision")"
if [[ ! "$git_sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Invalid source revision: $git_sha" >&2
    exit 1
fi
export GIT_SHA="$git_sha"

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
    docker logs --tail 100 weihub-app >&2 || true
    rollback
    exit 1
fi

if [ -n "$(docker port weihub-app)" ]; then
    echo "weihub-app unexpectedly publishes a host port" >&2
    rollback
    exit 1
fi

running_revision="$(docker inspect weihub-app --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [ "$running_revision" != "$git_sha" ]; then
    echo "Running image revision $running_revision does not match candidate $git_sha" >&2
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

if ! verify_local_tls weihub.cloud https://weihub.cloud/ \
    || ! verify_local_tls weihub.cloud https://weihub.cloud/love/ \
    || ! verify_local_tls dramagenai.cloud https://dramagenai.cloud/; then
    rollback
    exit 1
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
install -m 0644 "$candidate_revision" "$remote_root/source-revision"

echo "Deployment completed. Revision: $git_sha. Backup: $backup_root"
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
