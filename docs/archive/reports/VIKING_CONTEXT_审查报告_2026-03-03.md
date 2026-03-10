# Viking-Context 功能优化审查报告

> 审查范围：近期功能优化、已发现问题的修复验证、潜在影响与优化建议  
> 审查时间：2026-03-03

---

## 一、近期功能优化概览

| 模块 | 改动内容 | 状态 |
|------|----------|------|
| `rate-limiter.js` | `executeUrgent` 真正跳过排队，直接消耗令牌执行 | ✅ 已优化 |
| `security.js` | 定时器可清理（`startLoginLockCleanup` / `stopLoginLockCleanup`） | ✅ 已优化 |
| `common.js` | `withTimeout` 文档说明（超时不取消原任务） | ✅ 已优化 |
| `friend.js` | 三阶段巡查、封禁自动加黑、过滤统计 | ✅ 已实现 |
| `config-validator.js` | Schema 校验、`friend_three_phase` / `auto_blacklist_banned` | ✅ 已实现 |
| `admin.js` | 设置保存接入 `validateSettings` | ✅ 已接入 |
| `store.js` | 密码变更使用 `saveGlobalConfigImmediate` 立即持久化 | ✅ 已修复 |
| `setting.ts` | 各保存操作移除 `loading` 修改，避免整页闪烁 | ✅ 已修复 |

---

## 二、已修复问题

### 1. 管理密码修改时的屏幕闪烁 ✅

**原因**：`changeAdminPassword()` 曾设置 `loading.value = true`，而 Settings 页面用 `v-if="loading"` 控制整页，导致整页被替换为「加载中...」。

**修复**：在 `changeAdminPassword` 中移除对 `loading` 的修改，仅保留接口调用；按钮加载态由 Settings 的 `passwordSaving` 控制。

---

### 2. 管理密码保存无效（延迟持久化）✅

**原因**：`saveGlobalConfig()` 有约 2 秒防抖，密码变更延迟写入。

**修复**：在 `setAdminPasswordHash()` 中改为调用 `saveGlobalConfigImmediate()`，使密码变更立即持久化。

---

### 3. Settings 页面同类闪烁问题 ✅

**原因**：`saveSettings`、`saveOfflineConfig`、`saveThirdPartyApiConfig` 同样会设置 `loading.value = true`，导致整页切换为「加载中...」。

**修复**：在上述三个保存函数中移除对 `loading` 的修改，与 `changeAdminPassword` 的修复方式一致；各按钮已有 `saving`、`offlineSaving`、`thirdPartyApiSaving` 控制加载态。

---

### 4. stealFriendFilter Schema 缺失 ✅

**修复**：已在 `config-validator.js` 中补充 `STEAL_FRIEND_FILTER_SCHEMA`，并在 `SETTINGS_SCHEMA` 中增加 `stealFriendFilter` 字段。

---

### 5. 偷菜设置好友列表不显示（getCachedFriends 未 await）✅

**原因**：`admin.js` 中 `/api/friends/cache` 调用 `getCachedFriends(id)` 为 async 但未 `await`，返回 Promise 而非数组，前端收到非数组导致列表为空。

**修复**：改为 `data = await getCachedFriends(id)`；并增加缓存为空时回退到 `provider.getFriends(id)` 实时拉取。

---

### 6. 状态接口返回错误数据（getStatus 未 await）✅

**原因**：`admin.js` 中 `/api/status` 调用 `provider.getStatus(id)` 为 async 但未 `await`，`data` 为 Promise 而非状态对象，`data.status` 为 undefined。

**修复**：改为 `const data = await provider.getStatus(id)`。

---

### 7. 日志接口可能报错（getLogs 未 await）✅

**原因**：`admin.js` 中日志 API 调用 `provider.getLogs(targetId, options)` 为 async 但未 `await`，`list` 为 Promise，后续 `list.filter()` 会抛出 TypeError。

**修复**：改为 `let list = await provider.getLogs(targetId, options)`。

---

### 8. 好友缓存更新错误未捕获（updateFriendsCache 未处理 Promise）✅

**原因**：`worker-manager.js` 中 `sync_friends_cache` 事件调用 `updateFriendsCache(accountId, msg.data)` 为 async，未 await 且 try/catch 无法捕获 Promise 拒绝，失败时产生未处理拒绝。

**修复**：改为 `updateFriendsCache(accountId, msg.data).catch((err) => { log(...); })`，在同步回调中正确捕获异步错误。

---

## 三、已确认无问题的设计

| 项目 | 说明 |
|------|------|
| **strictValidation** | `/api/settings/save` 支持 `strictValidation === true` 时校验失败直接拒绝保存；前端未传该参数，默认仍为宽松模式，行为符合预期。 |
| **PBKDF2 密码** | admin 修改密码流程使用 `security.hashPassword` / `verifyPassword`，迁移逻辑正常；密码已通过 `saveGlobalConfigImmediate` 立即持久化。 |
| **stealFriendFilter 保存路径** | 实际经 `/api/automation` 保存，不经过 `/api/settings/save`，与前端 payload 拆分一致。 |

---

## 四、已知但暂未接入的模块

| 模块 | 说明 | 建议 |
|------|------|------|
| `rate-limiter.js` | 未被任何模块引用，限流由 `network.js` 内置令牌桶承担 | 已标注为预留模块；若接入可为 `executeUrgent` 增加可选 `timeoutMs` |
| `scheduler-optimized.js` | 时间轮调度器，所有模块仍使用 `scheduler.js` | 可注明「可选实现，需手动切换」 |
| `common.js` 工具库 | `withRetry`、`withTimeout` 等未被引用 | 在需要时优先从 `common.js` 引入 |

---

## 五、潜在风险与建议

### 1. stopLoginLockCleanup 与热重载

**说明**：热重载会重新加载模块，新实例会再次调用 `startLoginLockCleanup()`，旧实例的 `setInterval` 无法被新实例清除。

**建议**：在测试或热重载前显式调用 `stopLoginLockCleanup()`；若使用单例模式，可将 `_cleanupIntervalHandle` 放在全局对象上。

---

### 2. 配置校验失败仍会保存

**说明**：`/api/settings/save` 在 `validation.valid === false` 时仅打日志，仍使用 `validation.coerced` 保存。

**建议**：当前行为适合「尽量修正并保存」的策略，可保持现状并在文档中说明；若需严格拦截，可传 `strictValidation: true`。

---

## 六、优化建议汇总

1. **Settings 闪烁**：已全部修复，无需进一步操作。
2. **密码持久化**：已修复，无需进一步操作。
3. **Schema 校验**：`stealFriendFilter` 已补充，其他字段已覆盖。
4. **预留模块**：建议在 `rate-limiter.js`、`scheduler-optimized.js` 顶部增加简要说明，避免误用。
5. **common.js**：在需要重试、超时、限流或格式化时，优先从 `common.js` 引入。

---

## 七、相关文件索引

| 文件 | 说明 |
|------|------|
| `web/src/stores/setting.ts` | 各保存函数已移除 `loading` 修改 |
| `web/src/views/Settings.vue` | 使用 `v-if="loading"` 控制整页；各按钮有 `saving`、`offlineSaving`、`thirdPartyApiSaving`、`passwordSaving` |
| `core/src/models/store.js` | `setAdminPasswordHash` 已改为 `saveGlobalConfigImmediate()` |
| `core/src/controllers/admin.js` | `POST /api/admin/change-password`；`/api/settings/save` 支持 `strictValidation`；`/api/status`、`/api/logs`、`/api/friends/cache` 已补全 await |
| `core/src/services/config-validator.js` | 已包含 `STEAL_FRIEND_FILTER_SCHEMA`，`SETTINGS_SCHEMA` 中已定义 `stealFriendFilter` |
| `core/src/runtime/worker-manager.js` | `sync_friends_cache` 中 `updateFriendsCache` 已用 `.catch()` 处理异步错误 |
| `core/src/runtime/data-provider.js` | `getStatus`、`getLogs` 为 async，调用处需 await |

---

## 八、技术要点（Async 调用规范）

- `provider.getStatus`、`provider.getLogs`、`getCachedFriends` 等为 async，调用时必须 `await`，否则返回 Promise 导致后续逻辑错误。
- 在事件回调等非 async 环境中调用 async 函数时，应使用 `.catch()` 处理拒绝，而不是仅用 `try/catch` 包裹同步调用（`try/catch` 无法捕获 Promise 拒绝）。

---

*报告生成于 viking-context 审查流程*
