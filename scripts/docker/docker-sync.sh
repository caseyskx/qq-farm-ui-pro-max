#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_SCRIPT="${SCRIPT_DIR}/docker-build-multiarch.sh"

if [ ! -f "${BUILD_SCRIPT}" ]; then
    echo "[ERROR] 未找到 docker-build-multiarch.sh，无法继续。" >&2
    exit 1
fi

if [ "$#" -ge 2 ] && [[ "$1" == *.* || "$1" == */* ]]; then
    case "$1" in
        ghcr.io|ghcr.io/*)
            shift
            exec bash "${BUILD_SCRIPT}" --ghcr-only "$@"
            ;;
        docker.io|docker.io/*|smdk000|smdk000/*)
            shift
            exec bash "${BUILD_SCRIPT}" --docker-hub-only "$@"
            ;;
    esac
fi

exec bash "${BUILD_SCRIPT}" "$@"
