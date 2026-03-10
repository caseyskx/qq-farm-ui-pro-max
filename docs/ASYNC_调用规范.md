# Async 调用规范

> 适用于 `core/` 中调用 `data-provider` 及异步服务的代码审查与开发规范。  
> 更新日期：2026-03-03

---

## 一、Provider 异步方法调用

### 1.1 必须使用 `await` 的 async 方法

调用 `data-provider.js` 中以下 async 方法时，**必须**使用 `await`：

| 方法 | 说明 |
|------|------|
| `getStatus` | 获取运行状态 |
| `getLogs` | 获取全局日志 |
| `getLands` | 获取土地信息 |
| `getFriends` | 获取好友列表 |
| `getFriendLands` | 获取好友土地 |
| `doFriendOp` | 好友操作（偷菜等） |
| `getBag` / `getSeeds` / `getDailyGifts` | 背包、种子、每日礼包 |
| `startAccount` / `stopAccount` / `restartAccount` | 账号启停 |
| `doFarmOp` | 农场操作 |
| `saveSettings` / `setAutomation` | 设置保存 |
| `getSchedulerStatus` / `getAccounts` | 调度与账号列表 |
| `resolveAccountId` | 账号 ID 解析 |
| `setRuntimeAccountName` | 运行时账号昵称更新 |

### 1.2 同步方法（无需 await）

以下方法为同步实现，直接调用即可：

| 方法 | 说明 |
|------|------|
| `getAccountLogs(limit)` | 内存切片，同步返回 |
| `addAccountLog(...)` | 写入内存日志 |
| `broadcastConfig(accountId)` | 同步广播配置 |
| `isAccountRunning(id)` | 同步状态查询 |

---

## 二、事件回调中的 async 调用

在**非 async 回调**（如 `setInterval`、`EventEmitter.on`、`socket.on`）中调用 async 函数时：

- ❌ **不要**仅用 `try/catch`：`try/catch` 无法捕获 Promise 拒绝
- ✅ **必须**使用 `.catch()` 处理拒绝，避免未捕获异常

### 正确示例

```javascript
// 定时器 / 事件回调
setInterval(() => {
    updateFriendsCache(accountId, data).catch((err) => {
        console.error('[worker-manager] 好友缓存同步失败:', err);
    });
}, 60000);

// 或 fire-and-forget
provider.broadcastConfig(id);  // 同步方法，无需处理
```

### 错误示例

```javascript
// ❌ try/catch 无法捕获 Promise 拒绝
setInterval(() => {
    try {
        updateFriendsCache(accountId, data);  // 返回 Promise，拒绝不会被 catch
    } catch (e) {
        console.error(e);  // 永远不会执行
    }
}, 60000);
```

---

## 三、代码审查清单

新增或修改涉及 `provider` 或异步服务的代码时，请自查：

- [ ] 所有 `provider.xxx()` 调用：若为 async 方法，是否已加 `await`？
- [ ] 在事件回调、定时器中调用 async 时，是否已加 `.catch()`？
- [ ] 是否误将同步方法（如 `getAccountLogs`）写成 `await`？（无害但多余）

---

## 四、相关文件

| 文件 | 说明 |
|------|------|
| `core/src/runtime/data-provider.js` | Provider 定义，async/sync 方法清单 |
| `core/src/controllers/admin.js` | 主要 API 控制器，provider 调用集中处 |
| `core/src/runtime/worker-manager.js` | `sync_friends_cache` 中 `updateFriendsCache` 使用 `.catch()` |
| `core/src/services/database.js` | `getCachedFriends`、`updateFriendsCache` |

---

**最后更新**: 2026-03-03
