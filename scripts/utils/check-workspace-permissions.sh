#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${WORKSPACE_PERMISSION_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OWNERSHIP_AUDIT_SCRIPT="${WORKSPACE_OWNERSHIP_AUDIT_SCRIPT:-$ROOT_DIR/scripts/utils/audit-frontend-ownership.sh}"
WORLD_WRITABLE_LIMIT="${WORKSPACE_PERMISSION_LIMIT:-40}"
STATUS=0

report_world_writable() {
  local label="$1"
  shift

  local -a matches=()
  while IFS= read -r path; do
    matches+=("$path")
  done < <("$@")

  if [ "${#matches[@]}" -eq 0 ]; then
    echo "[permission-audit] ${label}: clean"
    return 0
  fi

  STATUS=1
  echo "[permission-audit] ${label}: found ${#matches[@]} world-writable path(s)"

  local shown=0
  for path in "${matches[@]}"; do
    if [ "$shown" -ge "$WORLD_WRITABLE_LIMIT" ]; then
      break
    fi
    echo "  - ${path#$ROOT_DIR/}"
    shown=$((shown + 1))
  done

  if [ "${#matches[@]}" -gt "$WORLD_WRITABLE_LIMIT" ]; then
    echo "[permission-audit] ${label}: truncated ${#matches[@]} total matches; adjust WORKSPACE_PERMISSION_LIMIT if needed"
  fi
}

echo "[permission-audit] current user: $(id -un)"
echo "[permission-audit] workspace: $ROOT_DIR"

if [ ! -f "$OWNERSHIP_AUDIT_SCRIPT" ]; then
  echo "[permission-audit] ownership audit script not found: ${OWNERSHIP_AUDIT_SCRIPT#$ROOT_DIR/}"
  STATUS=1
elif ! bash "$OWNERSHIP_AUDIT_SCRIPT"; then
  STATUS=1
fi

report_world_writable \
  "web (excluding node_modules)" \
  find "$ROOT_DIR/web" \
  \( -path "$ROOT_DIR/web/node_modules" -o -path "$ROOT_DIR/web/node_modules/*" \) -prune \
  -o -perm -0002 -print

report_world_writable \
  "scripts (excluding symlinks)" \
  find "$ROOT_DIR/scripts" -perm -0002 ! -type l -print

report_world_writable \
  "package manifests" \
  find "$ROOT_DIR" -maxdepth 2 \( -path "$ROOT_DIR/package.json" -o -path "$ROOT_DIR/web/package.json" \) -perm -0002 -print

if [ "$STATUS" -eq 0 ]; then
  echo "[permission-audit] workspace permission and ownership checks passed"
fi

exit "$STATUS"
