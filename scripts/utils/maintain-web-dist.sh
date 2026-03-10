#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DIST_DIR="${REPO_ROOT}/web/dist"
RUNTIME_DIST_DIR="${REPO_ROOT}/web/dist-runtime"
ARCHIVE_ROOT="${REPO_ROOT}/archive/runtime-snapshots"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SNAPSHOT_DIR="${ARCHIVE_ROOT}/${TIMESTAMP}-web-dist-maintenance"
SNAPSHOT_DIST_DIR="${SNAPSHOT_DIR}/dist-before-rebuild"

print_web_dist_state() {
  node - <<'NODE'
const { inspectWebDistState } = require('./core/src/utils/web-dist');
const state = inspectWebDistState();
console.log(`活动目录: ${state.activeDirRelative} (${state.selectionReasonLabel})`);
console.log(`构建目标: ${state.buildTargetDirRelative}`);
console.log(`默认目录: ${state.defaultDirRelative} | 有产物=${state.defaultHasAssets} | 可写=${state.defaultWritable}`);
console.log(`回退目录: ${state.fallbackDirRelative} | 有产物=${state.fallbackHasAssets} | 可写=${state.fallbackWritable}`);
NODE
}

dist_has_entries() {
  local target="$1"
  [ -d "$target" ] && find "$target" -mindepth 1 -print -quit 2>/dev/null | grep -q .
}

archive_existing_dist() {
  if ! dist_has_entries "$DIST_DIR"; then
    return 0
  fi

  mkdir -p "$SNAPSHOT_DIR"
  mv "$DIST_DIR" "$SNAPSHOT_DIST_DIR"
  cat > "${SNAPSHOT_DIR}/README.txt" <<EOF
web/dist maintenance snapshot
- created_at: $(date '+%Y-%m-%d %H:%M:%S %z')
- source: ${DIST_DIR}
- reason: rebuild standard dist after cleaning stale or debug outputs
- restore_hint: move dist-before-rebuild back to web/dist if a later build must be rolled back manually
EOF
  echo "已归档旧 dist: ${SNAPSHOT_DIST_DIR}"
}

restore_archived_dist_on_failure() {
  if [ -d "$SNAPSHOT_DIST_DIR" ] && [ ! -d "$DIST_DIR" ]; then
    mv "$SNAPSHOT_DIST_DIR" "$DIST_DIR"
    echo "已恢复旧 dist: ${DIST_DIR}"
  fi
}

cleanup_debug_outputs() {
  local debug_dir=""
  for debug_dir in "${REPO_ROOT}/web/dist-audit" "${REPO_ROOT}/web/dist-codex-restore"; do
    if [ -d "$debug_dir" ]; then
      rm -rf "$debug_dir"
      echo "已清理调试产物: ${debug_dir}"
    fi
  done
}

main() {
  cd "$REPO_ROOT"

  echo "== web/dist 维护开始 =="
  print_web_dist_state

  if [ -d "$RUNTIME_DIST_DIR" ]; then
    echo "已保留 fallback 目录: ${RUNTIME_DIST_DIR}"
  fi

  archive_existing_dist
  cleanup_debug_outputs

  if ! pnpm -C web build; then
    echo "构建失败，准备回滚旧 dist"
    restore_archived_dist_on_failure
    exit 1
  fi

  echo "== web/dist 维护完成 =="
  print_web_dist_state
  if [ -d "$SNAPSHOT_DIR" ]; then
    echo "归档快照: ${SNAPSHOT_DIR}"
  fi
}

main "$@"
