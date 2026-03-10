#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "$REPO_ROOT"

echo "== web/dist fallback 回灌开始 =="

if [ "${FORCE_WEB_DIST_REPAIR:-0}" != "1" ]; then
  if node - <<'NODE'
const { inspectWebDistState } = require('./core/src/utils/web-dist');
const state = inspectWebDistState();
const alreadyHealthy = state.activeDirRelative === 'web/dist'
  && state.defaultHasAssets
  && state.defaultWritable;
process.exit(alreadyHealthy ? 0 : 1);
NODE
  then
    if bash "${REPO_ROOT}/scripts/utils/audit-frontend-ownership.sh" web/dist web/dist-runtime >/dev/null 2>&1; then
      echo "web/dist 与 web/dist-runtime 当前都健康，跳过 fallback 回灌。设置 FORCE_WEB_DIST_REPAIR=1 可强制执行。"
      exit 0
    fi
  fi
fi

node - <<'NODE'
const { inspectWebDistState, rehydrateDefaultWebDistFromFallback } = require('./core/src/utils/web-dist');

function printState(prefix, state) {
  console.log(`${prefix}活动目录: ${state.activeDirRelative} (${state.selectionReasonLabel})`);
  console.log(`${prefix}默认目录: ${state.defaultDirRelative} | 有产物=${state.defaultHasAssets} | 可写=${state.defaultWritable}`);
  console.log(`${prefix}回退目录: ${state.fallbackDirRelative} | 有产物=${state.fallbackHasAssets} | 可写=${state.fallbackWritable}`);
}

const before = inspectWebDistState();
printState('', before);

const result = rehydrateDefaultWebDistFromFallback();
if (!result.rehydrated) {
  console.error(`fallback 回灌失败: ${result.reason}`);
  if (result.error) {
    console.error(result.error instanceof Error ? result.error.message : String(result.error));
  }
  process.exit(1);
}

console.log(`已从 ${result.sourceDirRelative} 重建 ${result.targetDirRelative}`);
if (result.archiveDirRelative) {
  console.log(`归档快照: ${result.archiveDirRelative}`);
}

const after = inspectWebDistState();
printState('完成后', after);
NODE

if ! bash "${REPO_ROOT}/scripts/utils/audit-frontend-ownership.sh" web/dist web/dist-runtime; then
  echo "fallback 回灌后仍检测到前端产物所有权污染，请先处理外部写入进程后重试"
  exit 1
fi

echo "== web/dist fallback 回灌完成 =="
