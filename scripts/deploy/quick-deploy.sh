#!/usr/bin/env bash

set -Eeuo pipefail

REPO_SLUG="${REPO_SLUG:-smdk000/qq-farm-ui-pro-max}"
REPO_REF="${REPO_REF:-main}"
RAW_BASE_URL="${RAW_BASE_URL:-https://raw.githubusercontent.com/${REPO_SLUG}/${REPO_REF}}"
BOOTSTRAP_DIR_INPUT="${BOOTSTRAP_DIR:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

prepare_bootstrap_dir() {
    if [ -n "${BOOTSTRAP_DIR_INPUT}" ]; then
        mkdir -p "${BOOTSTRAP_DIR_INPUT}"
        printf '%s\n' "${BOOTSTRAP_DIR_INPUT}"
        return 0
    fi

    mktemp -d "${TMPDIR:-/tmp}/qq-farm-quick-deploy.XXXXXX"
}

download_bootstrap_script() {
    local name="$1"
    local target_dir="$2"
    curl -fsSL "${RAW_BASE_URL}/scripts/deploy/${name}" -o "${target_dir}/${name}"
    chmod +x "${target_dir}/${name}" || true
}

bootstrap_and_exec() {
    local target_dir=""
    target_dir="$(prepare_bootstrap_dir)"

    command -v curl >/dev/null 2>&1 || {
        echo "[ERROR] 未找到 install-or-update.sh 且系统缺少 curl，无法执行远程一键部署。" >&2
        exit 1
    }

    download_bootstrap_script "install-or-update.sh" "${target_dir}"
    download_bootstrap_script "fresh-install.sh" "${target_dir}"
    download_bootstrap_script "update-app.sh" "${target_dir}"
    download_bootstrap_script "repair-mysql.sh" "${target_dir}"
    download_bootstrap_script "repair-deploy.sh" "${target_dir}"
    download_bootstrap_script "manual-config-wizard.sh" "${target_dir}"
    download_bootstrap_script "stack-layout.sh" "${target_dir}"
    download_bootstrap_script "verify-stack.sh" "${target_dir}"
    download_bootstrap_script "update-agent.sh" "${target_dir}"
    download_bootstrap_script "install-update-agent-service.sh" "${target_dir}"

    exec bash "${target_dir}/install-or-update.sh" "$@"
}

if [ -f "${SCRIPT_DIR}/install-or-update.sh" ] && [ -f "${SCRIPT_DIR}/stack-layout.sh" ]; then
    exec bash "${SCRIPT_DIR}/install-or-update.sh" "$@"
fi

bootstrap_and_exec "$@"
