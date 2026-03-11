#!/usr/bin/env bash

normalize_stack_name() {
    local input="${1:-qq-farm}"
    local normalized=""

    normalized="$(printf '%s' "${input}" \
        | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
    printf '%s\n' "${normalized:-qq-farm}"
}

stack_dir_name() {
    normalize_stack_name "${1:-qq-farm}"
}

stack_current_link_path() {
    local base_dir="${1:-/opt}"
    local stack_name="${2:-qq-farm}"
    printf '%s/%s-current\n' "${base_dir%/}" "$(normalize_stack_name "${stack_name}")"
}

stack_container_name() {
    local stack_name="${1:-qq-farm}"
    local role="${2:-bot}"
    printf '%s-%s\n' "$(normalize_stack_name "${stack_name}")" "${role}"
}

stack_agent_service_name() {
    local stack_name="${1:-qq-farm}"
    printf '%s-update-agent\n' "$(normalize_stack_name "${stack_name}")"
}

