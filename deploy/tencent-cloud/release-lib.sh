#!/usr/bin/env bash

readonly RESTORATION_FAILED_STATUS=75

release_sha256() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

verify_source_archive() {
    local archive="$1"
    local expected="$2"
    local actual

    if [[ ! "$expected" =~ ^[0-9a-f]{64}$ ]] || [ ! -s "$archive" ]; then
        echo "source_archive=invalid" >&2
        return 1
    fi
    actual="$(release_sha256 "$archive")" || {
        echo "source_archive=unreadable" >&2
        return 1
    }
    if [ "$actual" != "$expected" ]; then
        echo "source_archive=checksum_mismatch" >&2
        return 1
    fi
    echo "source_archive=verified"
}

run_release_compose() {
    local env_file="$1"
    local compose_file="$2"
    local image="$3"
    local source_dir="$4"
    local revision="$5"
    shift 5

    env -u AI_TOOL_HUB_ENV_FILE \
        -u AI_TOOL_HUB_IMAGE \
        -u AI_TOOL_HUB_SOURCE_DIR \
        -u AI_TOOL_HUB_BUILD_CONTEXT \
        -u DGC_NETWORK_NAME \
        -u GIT_SHA \
        -u COMPOSE_PROJECT_NAME \
        -u COMPOSE_FILE \
        -u COMPOSE_PROFILES \
        -u COMPOSE_ENV_FILES \
        AI_TOOL_HUB_ENV_FILE="$env_file" \
        AI_TOOL_HUB_IMAGE="$image" \
        AI_TOOL_HUB_SOURCE_DIR="$source_dir" \
        AI_TOOL_HUB_BUILD_CONTEXT="$source_dir" \
        DGC_NETWORK_NAME=dramagenai-cloud_dgc-net \
        GIT_SHA="$revision" \
        COMPOSE_PROJECT_NAME=weihub \
        docker compose --project-name weihub --env-file "$env_file" -f "$compose_file" "$@"
}

validate_and_build_candidate() {
    local compose_file="$1"
    local env_file="$2"
    local source_dir="$3"
    local image="$4"
    local revision="$5"
    local status

    run_release_compose "$env_file" "$compose_file" "$image" "$source_dir" "$revision" config -q
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "candidate_config=failed" >&2
        return "$status"
    fi

    run_release_compose "$env_file" "$compose_file" "$image" "$source_dir" "$revision" build
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "candidate_build=failed" >&2
        return "$status"
    fi
    echo "candidate_build=passed"
}

release_file_state() {
    local checksum

    if [ -f "$1" ]; then
        checksum="$(release_sha256 "$1")" || return $?
        printf 'file:%s\n' "$checksum"
    else
        echo absent
    fi
}

validate_and_build_candidate_preserving_active() {
    local compose_file="$1"
    local env_file="$2"
    local source_dir="$3"
    local image="$4"
    local revision="$5"
    local active_compose="$6"
    local active_nginx="$7"
    local compose_before
    local nginx_before
    local status

    compose_before="$(release_file_state "$active_compose")" || return $?
    nginx_before="$(release_file_state "$active_nginx")" || return $?

    validate_and_build_candidate "$compose_file" "$env_file" "$source_dir" "$image" "$revision"
    status=$?

    if [ "$(release_file_state "$active_compose")" != "$compose_before" ] \
        || [ "$(release_file_state "$active_nginx")" != "$nginx_before" ]; then
        echo "candidate_active_files=changed" >&2
        return 1
    fi
    return "$status"
}

prepare_rollback_image() {
    local container="$1"
    local rollback_tag="$2"
    local image_id
    local status

    if image_id="$(docker container inspect --format '{{.Image}}' "$container" 2>/dev/null)"; then
        :
    else
        status=$?
        echo "rollback_image=unavailable" >&2
        return "$status"
    fi
    if [[ ! "$image_id" =~ ^sha256:[0-9a-f]{64}$ ]]; then
        echo "rollback_image=unavailable" >&2
        return 1
    fi
    if docker image inspect "$image_id" >/dev/null 2>&1; then
        :
    else
        status=$?
        echo "rollback_image=unavailable" >&2
        return "$status"
    fi
    if docker tag "$image_id" "$rollback_tag"; then
        :
    else
        status=$?
        echo "rollback_image=unavailable" >&2
        return "$status"
    fi
    echo "rollback_image=prepared"
}

require_restorable_active_release() {
    local active_source="$1"
    local active_compose="$2"
    local active_nginx="$3"

    if [ ! -s "$active_compose" ]; then
        echo "rollback_state=active_compose_missing" >&2
        return 1
    fi
    if [ ! -d "$active_source" ]; then
        echo "rollback_state=active_source_missing" >&2
        return 1
    fi
    if [ ! -s "$active_nginx" ]; then
        echo "rollback_state=active_nginx_missing" >&2
        return 1
    fi
}

restore_active_release() {
    local active_source="$1"
    local active_compose="$2"
    local active_nginx="$3"
    local backup_root="$4"
    local env_file="$5"
    local rollback_image="$6"
    local revision="$7"
    local restoration_failed=0
    local step

    step=candidate_cleanup
    if ! docker rm -f weihub-app >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=source_cleanup
    if ! rm -rf "$active_source" >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=source
    if ! mv "$backup_root/previous-source" "$active_source" >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=compose_config
    if ! install -m 0644 "$backup_root/previous-docker-compose.yml" "$active_compose" >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=nginx_config
    if ! install -m 0644 "$backup_root/previous-nginx.conf" "$active_nginx" >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=image_tag
    if ! docker tag "$rollback_image" ai-resume-optimizer:latest >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=compose_recreate
    if ! run_release_compose "$env_file" "$active_compose" \
        ai-resume-optimizer:latest "$active_source" "$revision" \
        up -d --force-recreate >/dev/null 2>&1; then
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    step=nginx_test
    if docker exec dgc-nginx nginx -t >/dev/null 2>&1; then
        step=nginx_reload
        if ! docker exec dgc-nginx nginx -s reload >/dev/null 2>&1; then
            echo "restoration_step=$step status=failed" >&2
            restoration_failed=1
        fi
    else
        echo "restoration_step=$step status=failed" >&2
        restoration_failed=1
    fi

    if [ "$restoration_failed" -ne 0 ]; then
        return "$RESTORATION_FAILED_STATUS"
    fi
    echo "candidate_restoration=passed"
}

run_candidate_activation() {
    local candidate_source="$1"
    local active_source="$2"
    local candidate_compose="$3"
    local active_compose="$4"
    local candidate_nginx="$5"
    local active_nginx="$6"
    local backup_root="$7"
    local env_file="$8"
    local candidate_image="$9"
    local rollback_image="${10}"
    local revision="${11}"
    local verify_callback="${12}"
    local status
    local restoration_status

    handle_activation_signal() {
        local signal_status="$1"
        trap - INT TERM
        if [ -d "$backup_root/previous-source" ]; then
            if restore_active_release "$active_source" "$active_compose" "$active_nginx" \
                "$backup_root" "$env_file" "$rollback_image" "$revision"; then
                :
            else
                restoration_status=$?
                echo "candidate_restoration=failed original_status=$signal_status restoration_status=$restoration_status" >&2
                exit "$restoration_status"
            fi
        fi
        exit "$signal_status"
    }

    require_restorable_active_release "$active_source" "$active_compose" "$active_nginx" || return $?
    if install -d -m 0700 "$backup_root" \
        && cp "$active_compose" "$backup_root/previous-docker-compose.yml" \
        && cp "$active_nginx" "$backup_root/previous-nginx.conf"; then
        :
    else
        return $?
    fi
    prepare_rollback_image weihub-app "$rollback_image" || return $?
    trap 'handle_activation_signal 130' INT
    trap 'handle_activation_signal 143' TERM

    if mv "$active_source" "$backup_root/previous-source"; then
        :
    else
        status=$?
        trap - INT TERM
        return "$status"
    fi

    if mv "$candidate_source" "$active_source" \
        && install -m 0644 "$candidate_compose" "$active_compose" \
        && install -m 0644 "$candidate_nginx" "$active_nginx" \
        && docker tag "$candidate_image" ai-resume-optimizer:latest \
        && run_release_compose "$env_file" "$active_compose" \
            ai-resume-optimizer:latest "$active_source" "$revision" \
            up -d --force-recreate \
        && "$verify_callback"; then
        trap - INT TERM
        echo "candidate_activation=passed"
        return 0
    else
        status=$?
    fi

    trap - INT TERM
    if restore_active_release "$active_source" "$active_compose" "$active_nginx" \
        "$backup_root" "$env_file" "$rollback_image" "$revision"; then
        :
    else
        restoration_status=$?
        echo "candidate_restoration=failed original_status=$status restoration_status=$restoration_status" >&2
        return "$restoration_status"
    fi
    return "$status"
}

scan_privacy_logs() {
    local container="$1"
    local log_file
    local status

    log_file="$(mktemp)" || {
        echo "privacy_log_read=fail" >&2
        return 1
    }
    if docker logs "$container" >"$log_file" 2>&1; then
        :
    else
        status=$?
        rm -f "$log_file"
        echo "privacy_log_read=fail" >&2
        return "$status"
    fi

    if grep -Eiq 'resumeText|jdText|RESUME-PRIVATE|JOB-DESCRIPTION-PRIVATE' "$log_file"; then
        rm -f "$log_file"
        echo "privacy_log_scan=match" >&2
        return 1
    else
        status=$?
    fi
    rm -f "$log_file"
    if [ "$status" -ne 1 ]; then
        echo "privacy_log_scan=failed" >&2
        return "$status"
    fi
    echo "privacy_log_scan=passed"
}

classify_aggregate_probe() {
    local execution_status="$1"
    local raw_output="$2"
    local label
    local failed=false
    local transport
    local query
    local result
    local labels=(
        auth_users
        profiles
        resume_quota_accounts
        resume_usage_ledger
        resume_memberships
        resume_orders
        resume_payment_events
    )

    for label in "${labels[@]}"; do
        transport=fail
        query=fail
        result=""
        if [ "$execution_status" -eq 0 ] \
            && grep -Fqx "aggregate_transport_${label}=pass" <<<"$raw_output"; then
            transport=pass
            if grep -Fqx "aggregate_query_${label}=pass" <<<"$raw_output"; then
                query=pass
                result="$(grep -E "^aggregate_result_${label}=(zero|nonzero) count=[0-9]+$" <<<"$raw_output" | head -n 1)"
                if [ -z "$result" ]; then
                    query=fail
                fi
            fi
        fi
        printf 'aggregate_transport_%s=%s\n' "$label" "$transport"
        printf 'aggregate_query_%s=%s\n' "$label" "$query"
        if [ "$transport" = pass ] && [ "$query" = pass ]; then
            printf '%s\n' "$result"
        else
            failed=true
        fi
    done
    if [ "$failed" = true ]; then
        echo "zero_source_reconciliation=failed" >&2
        return 1
    fi
    echo "zero_source_reconciliation=passed"
}
