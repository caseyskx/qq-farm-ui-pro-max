#!/usr/bin/env bash
set -euo pipefail

APPID="${1:-1112386029}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/core/data/diagnostics"
mkdir -p "$OUT_DIR"
STAMP="$(date '+%Y%m%d-%H%M%S')"
OUT_FILE="$OUT_DIR/qq-friend-signals-${APPID}-${STAMP}.log"

section() {
  printf '\n===== %s =====\n' "$1" >>"$OUT_FILE"
}

append_cmd() {
  local label="$1"
  shift
  section "$label"
  if "$@" >>"$OUT_FILE" 2>&1; then
    :
  else
    printf '[warn] command failed: %s\n' "$*" >>"$OUT_FILE"
  fi
}

printf 'appid=%s\ncreated_at=%s\n' "$APPID" "$(date '+%Y-%m-%d %H:%M:%S %z')" >"$OUT_FILE"

if ! command -v adb >/dev/null 2>&1; then
  printf '[fatal] adb not found in PATH\n' >>"$OUT_FILE"
  printf '%s\n' "$OUT_FILE"
  exit 1
fi

adb root >/dev/null 2>&1 || true

append_cmd "ADB DEVICES" adb devices -l
append_cmd "QQ VERSION" adb shell dumpsys package com.tencent.mobileqq
append_cmd "TOP ACTIVITY" adb shell dumpsys activity activities

section "QQ VERSION FILTERED"
adb shell dumpsys package com.tencent.mobileqq 2>/dev/null | grep -E 'versionName|versionCode' >>"$OUT_FILE" || true

section "TOP ACTIVITY FILTERED"
adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' >>"$OUT_FILE" || true

PREF_PATHS="$(adb shell "find /data/data/com.tencent.mobileqq/shared_prefs -maxdepth 1 -type f -name '*${APPID}*.xml' 2>/dev/null" | tr -d '\r')"
if [ -n "$PREF_PATHS" ]; then
  while IFS= read -r pref; do
    [ -n "$pref" ] || continue
    section "PREF FILE ${pref}"
    adb shell "cat '$pref'" 2>/dev/null | grep -E 'authority_synchronized|scope\\.userInfoAndShareFriendship|scope|authority' >>"$OUT_FILE" || true
  done <<<"$PREF_PATHS"
else
  section "PREF FILES"
  printf 'no shared_prefs matched appid=%s\n' "$APPID" >>"$OUT_FILE"
fi

PROJECT_FILES="$(adb shell "find /data/data/com.tencent.mobileqq/files/minigame -name 'project.config.json' 2>/dev/null" | tr -d '\r')"
MATCHED_PROJECT=''
if [ -n "$PROJECT_FILES" ]; then
  while IFS= read -r project; do
    [ -n "$project" ] || continue
    if adb shell "cat '$project'" 2>/dev/null | grep -q "\"appid\": \"${APPID}\""; then
      MATCHED_PROJECT="$project"
      break
    fi
  done <<<"$PROJECT_FILES"
fi

if [ -n "$MATCHED_PROJECT" ]; then
  section "MINIGAME PROJECT CONFIG ${MATCHED_PROJECT}"
  adb shell "cat '$MATCHED_PROJECT'" 2>/dev/null >>"$OUT_FILE" || true
  MATCHED_DIR="$(dirname "$MATCHED_PROJECT")"
  section "MINIGAME GAME.JSON ${MATCHED_DIR}/game.json"
  adb shell "cat '${MATCHED_DIR}/game.json'" 2>/dev/null >>"$OUT_FILE" || true
else
  section "MINIGAME PROJECT CONFIG"
  printf 'no project.config.json matched appid=%s\n' "$APPID" >>"$OUT_FILE"
fi

section "LOGCAT FILTERED"
adb logcat -d 2>/dev/null | grep -E "queryAppRunTimeLoader|get_auth_status|set_auth_status|GetAllFrdReq|GetAllFrdRsp|profile_status_codec|${APPID}" >>"$OUT_FILE" || true

if [ -f "$ROOT_DIR/.env" ] && [ -d "$ROOT_DIR/core/node_modules/ioredis" ]; then
  section "REDIS FRIENDS CACHE"
  (
    set -a
    # shellcheck disable=SC1090
    source "$ROOT_DIR/.env" >/dev/null 2>&1 || true
    set +a
    cd "$ROOT_DIR"
    node - <<'NODE'
const Redis = require('./core/node_modules/ioredis');
const cfg = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
};
const r = new Redis(cfg);
(async () => {
  const keys = await r.keys('account:*:friends_cache');
  keys.sort();
  for (const key of keys) {
    let arr = [];
    try {
      arr = JSON.parse((await r.get(key)) || '[]');
    } catch {}
    const preview = arr.slice(0, 3).map(item => ({
      gid: item && item.gid,
      name: item && item.name,
      uin: item && item.uin,
    }));
    console.log(JSON.stringify({ key, count: arr.length, preview }));
  }
  await r.quit();
})().catch(async (err) => {
  console.error(err && err.stack || String(err));
  try { await r.quit(); } catch {}
  process.exitCode = 1;
});
NODE
  ) >>"$OUT_FILE" 2>&1 || true
fi

printf '%s\n' "$OUT_FILE"
