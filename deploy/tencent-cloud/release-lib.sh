#!/usr/bin/env bash

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

validate_and_build_candidate() {
    local compose_file="$1"
    local env_file="$2"
    local source_dir="$3"
    local status

    AI_TOOL_HUB_SOURCE_DIR="$source_dir" \
        docker compose --env-file "$env_file" -f "$compose_file" config -q
    status=$?
    if [ "$status" -ne 0 ]; then
        echo "candidate_config=failed" >&2
        return "$status"
    fi

    AI_TOOL_HUB_SOURCE_DIR="$source_dir" \
        docker compose --env-file "$env_file" -f "$compose_file" build
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
    local active_compose="$4"
    local active_nginx="$5"
    local compose_before
    local nginx_before
    local status

    compose_before="$(release_file_state "$active_compose")" || return $?
    nginx_before="$(release_file_state "$active_nginx")" || return $?

    validate_and_build_candidate "$compose_file" "$env_file" "$source_dir"
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
