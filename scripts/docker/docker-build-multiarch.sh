#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
VERSION_INPUT="${VERSION_INPUT:-}"
BUILD_WEB=1
PUSH_DOCKER_HUB=1
PUSH_GHCR=1
VERIFY_MANIFEST=1
BUILDER_NAME="${BUILDER_NAME:-qq-farm-builder}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
DOCKERHUB_IMAGE="${DOCKERHUB_IMAGE:-smdk000/qq-farm-bot-ui}"
GHCR_IMAGE="${GHCR_IMAGE:-ghcr.io/smdk000/qq-farm-ui-pro-max}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        print_error "缺少命令: $1"
        exit 1
    fi
}

parse_args() {
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --version)
                VERSION_INPUT="${2:-}"
                shift 2
                ;;
            --skip-web-build)
                BUILD_WEB=0
                shift
                ;;
            --docker-hub-only)
                PUSH_DOCKER_HUB=1
                PUSH_GHCR=0
                shift
                ;;
            --ghcr-only)
                PUSH_DOCKER_HUB=0
                PUSH_GHCR=1
                shift
                ;;
            --no-push-docker-hub)
                PUSH_DOCKER_HUB=0
                shift
                ;;
            --no-push-ghcr)
                PUSH_GHCR=0
                shift
                ;;
            --no-verify)
                VERIFY_MANIFEST=0
                shift
                ;;
            --builder-name)
                BUILDER_NAME="${2:-}"
                shift 2
                ;;
            *)
                if [ -z "${VERSION_INPUT}" ]; then
                    VERSION_INPUT="$1"
                    shift
                else
                    print_error "未知参数: $1"
                    exit 1
                fi
                ;;
        esac
    done
}

resolve_version() {
    local raw_version="${VERSION_INPUT:-}"

    if [ -z "${raw_version}" ]; then
        require_cmd node
        raw_version="$(node -p "require('${PROJECT_ROOT}/core/package.json').version")"
    fi

    VERSION="${raw_version#v}"
}

check_environment() {
    require_cmd docker

    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon 不可访问。"
        exit 1
    fi

    if ! docker buildx version >/dev/null 2>&1; then
        print_error "Docker Buildx 不可用。"
        exit 1
    fi

    if [ ! -f "${PROJECT_ROOT}/core/Dockerfile" ]; then
        print_error "缺少 Dockerfile: ${PROJECT_ROOT}/core/Dockerfile"
        exit 1
    fi

    if [ ! -f "${PROJECT_ROOT}/package.json" ]; then
        print_error "缺少 package.json: ${PROJECT_ROOT}/package.json"
        exit 1
    fi

    if [ "${PUSH_DOCKER_HUB}" != "1" ] && [ "${PUSH_GHCR}" != "1" ]; then
        print_error "至少需要启用一个推送目标。"
        exit 1
    fi
}

setup_builder() {
    if docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
        docker buildx use "${BUILDER_NAME}" >/dev/null
    else
        docker buildx create --use --name "${BUILDER_NAME}" --driver docker-container >/dev/null
    fi

    docker buildx inspect --bootstrap "${BUILDER_NAME}" >/dev/null
}

build_web_if_needed() {
    if [ "${BUILD_WEB}" != "1" ]; then
        print_warning "跳过前端构建，复用现有 web/dist。"
        return 0
    fi

    require_cmd pnpm
    print_info "构建前端产物..."
    (
        cd "${PROJECT_ROOT}"
        pnpm build:web
    )
}

build_and_push() {
    local tags=()
    local cmd=()

    if [ "${PUSH_DOCKER_HUB}" = "1" ]; then
        tags+=("${DOCKERHUB_IMAGE}:${VERSION}" "${DOCKERHUB_IMAGE}:latest")
    fi
    if [ "${PUSH_GHCR}" = "1" ]; then
        tags+=("${GHCR_IMAGE}:${VERSION}" "${GHCR_IMAGE}:latest")
    fi

    cmd=(
        docker buildx build
        --builder "${BUILDER_NAME}"
        --platform "${PLATFORMS}"
        --file "${PROJECT_ROOT}/core/Dockerfile"
        --provenance=false
        --push
    )

    for tag in "${tags[@]}"; do
        cmd+=(-t "${tag}")
    done

    cmd+=("${PROJECT_ROOT}")

    print_info "开始推送多架构镜像: ${VERSION}"
    "${cmd[@]}"
}

verify_images() {
    if [ "${VERIFY_MANIFEST}" != "1" ]; then
        return 0
    fi

    if [ "${PUSH_DOCKER_HUB}" = "1" ]; then
        print_info "校验 Docker Hub manifest..."
        docker buildx imagetools inspect "${DOCKERHUB_IMAGE}:${VERSION}" >/dev/null
    fi

    if [ "${PUSH_GHCR}" = "1" ]; then
        print_info "校验 GHCR manifest..."
        docker buildx imagetools inspect "${GHCR_IMAGE}:${VERSION}" >/dev/null
    fi
}

show_summary() {
    echo ""
    print_success "Docker 多架构镜像构建完成。"
    echo "版本: ${VERSION}"
    echo "平台: ${PLATFORMS}"
    if [ "${PUSH_DOCKER_HUB}" = "1" ]; then
        echo "  - ${DOCKERHUB_IMAGE}:${VERSION}"
        echo "  - ${DOCKERHUB_IMAGE}:latest"
    fi
    if [ "${PUSH_GHCR}" = "1" ]; then
        echo "  - ${GHCR_IMAGE}:${VERSION}"
        echo "  - ${GHCR_IMAGE}:latest"
    fi
}

main() {
    parse_args "$@"
    resolve_version
    check_environment
    setup_builder
    build_web_if_needed
    build_and_push
    verify_images
    show_summary
}

main "$@"
