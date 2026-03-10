#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ "$#" -gt 0 ]; then
  SEARCH_PATHS=("$@")
else
  SEARCH_PATHS=(
    "web/src"
    "web/package.json"
    "web/vite.config.ts"
    "web/public/nc_local_version"
    "web/node_modules/.tmp"
    "web/dist"
    "web/dist-runtime"
  )
fi

declare -a ABSOLUTE_PATHS=()
for target in "${SEARCH_PATHS[@]}"; do
  if [ -e "$ROOT_DIR/$target" ]; then
    ABSOLUTE_PATHS+=("$ROOT_DIR/$target")
  fi
done

if [ "${#ABSOLUTE_PATHS[@]}" -eq 0 ]; then
  echo "[ownership-audit] no existing targets to scan"
  exit 0
fi

OUTPUT_LIMIT="${OWNERSHIP_AUDIT_LIMIT:-80}"
declare -a ROOT_OWNED_FILES=()
while IFS= read -r file; do
  ROOT_OWNED_FILES+=("$file")
done < <(find "${ABSOLUTE_PATHS[@]}" -user root -type f 2>/dev/null | sort)

echo "[ownership-audit] current user: $(id -un)"
echo "[ownership-audit] scanned targets:"
for target in "${ABSOLUTE_PATHS[@]}"; do
  echo "  - ${target#$ROOT_DIR/}"
done

if [ "${#ROOT_OWNED_FILES[@]}" -eq 0 ]; then
  echo "[ownership-audit] no root-owned files found in frontend-critical paths"
  exit 0
fi

echo "[ownership-audit] found ${#ROOT_OWNED_FILES[@]} root-owned file(s) in frontend-critical paths:"
for target in "${SEARCH_PATHS[@]}"; do
  if [ ! -e "$ROOT_DIR/$target" ]; then
    continue
  fi

  count=0
  for file in "${ROOT_OWNED_FILES[@]}"; do
    case "${file#$ROOT_DIR/}" in
      "$target"/*|"$target")
        count=$((count + 1))
        ;;
    esac
  done

  if [ "$count" -gt 0 ]; then
    echo "  - $target: $count"
  fi
done

echo "[ownership-audit] showing up to ${OUTPUT_LIMIT} matching file(s):"
shown=0
for file in "${ROOT_OWNED_FILES[@]}"; do
  if [ "$shown" -ge "$OUTPUT_LIMIT" ]; then
    break
  fi
  echo "  - ${file#$ROOT_DIR/}"
  shown=$((shown + 1))
done

if [ "${#ROOT_OWNED_FILES[@]}" -gt "$OUTPUT_LIMIT" ]; then
  echo "[ownership-audit] ... truncated ${#ROOT_OWNED_FILES[@]} total matches; rerun with a narrower path or set OWNERSHIP_AUDIT_LIMIT"
fi

exit 1
