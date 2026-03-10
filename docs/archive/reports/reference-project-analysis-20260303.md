# QQ 农场机器人三方程序功能对比分析报告

> 分析日期: 2026-03-03
> 
> - **我的程序** (`qq-farm-bot-ui-main`)
> - **参考项目A** (`qq-farm-bot-ui-main 3`)
> - **参考项目B** (`qq-farm-bot-main`)

---

## 一、 总体架构对比

| 维度 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| 后端服务模块数 | 28 个 | 25 个 | 20 个 |
| 控制器数 | 4 个 (`admin`, `aiStatus`, `cards`, `users`) | 1 个 (`admin`) | 1 个 (`admin`) |
| 前端页面数 | 12 个 | 7 个 | 9 个 |
| 前端 Store 数 | 8 个 | 8 个 | 11 个 |
| 数据库 | MySQL + Redis | JSON 文件 | JSON 文件 |
| 外部服务 | ipad860, openviking | 无 | 无 |
| Docker 部署 | ✅ 完整 | ✅ 基础 | 无 |
| 多用户/卡密 | ✅ (拆分模块化) | ❌ | ✅ (内嵌在admin.js) |
| `admin.js` 代码量 | 1681 行 / 74KB | 862 行 / 33KB | 1603 行 / 62KB |

---

## 二、 功能模块详细对比

### 2.1 我的程序独有的模块 ✅

| 模块 | 文件 | 功能描述 |
|---|---|---|
| **MySQL 数据库层** | `mysql-db.js` | 支持 MySQL 持久化存储，连接池管理 |
| **Redis 缓存层** | `redis-cache.js` | 高性能缓存，降低数据库压力 |
| **写入缓冲** | `write-buffer.js` | 批量合并写入，减少 IO 抖动 |
| **熔断器** | `circuit-breaker.js` | 服务降级与容错保护 |
| **数据库抽象** | `database.js` | 统一数据库接口抽象层 |
| **上下文管理器** | `contextManager.js` | 多账号运行时上下文隔离 |
| **AI 助手** | `qwenAIAssistant.js` | 通义千问 AI 辅助决策 |
| **防偷抢收** | `farm.js` 中 `antiStealHarvest()` | 60 秒紧急施肥 + 瞬间收获 |
| **紧急通道 API** | `getAllLandsUrgent`, `fertilizeUrgent`, `harvestUrgent` | 高优先级请求通道，Promise 合并缓存 |
| **蹲守系统** | `friend.js` 中 `activeStakeouts` | 监控好友作物成熟时间，定时偷取 |
| **偷菜过滤器** | `shouldStealPlant()`, `shouldStealFriend()` | 按植物 ID / 好友 GID 精准过滤 |
| **定时任务 Jobs** | `jobs/dailyStatsJob.js`, `logCleanupJob.js` | 每日统计汇总 + 日志自动清理 |
| **AI 状态控制器** | `controllers/aiStatus.js` | AI 助手状态管理 API |
| **卡密管理控制器** | `controllers/cards.js` | 独立卡密 CRUD 模块 |
| **用户管理控制器** | `controllers/users.js` | 独立用户管理模块 |
| **输入校验** | `utils/validators.js` | 用户名、密码、卡密格式校验 |
| **Repository 层** | `repositories/` | 数据访问层规范化 |

> **前端独有页面**: `StealSettings.vue` (偷菜策略设置), `HelpCenter.vue` (帮助中心), `Workflow.vue` (工作流可视化)

---

### 2.2 参考项目A 独有的模块 (值得借鉴) ⭐

| 模块 | 文件 | 功能描述 | 借鉴价值 |
|---|---|---|---|
| **配置校验框架** | `config-validator.js` (355行) | Schema 驱动的配置热更新校验，类型/范围/枚举/自定义规则链 | ⭐⭐⭐⭐ |
| **令牌桶限流器** | `rate-limiter.js` (350行) | `TokenBucket` + `PriorityQueue` + `RequestQueue` + `BatchOperationOptimizer` | ⭐⭐⭐⭐⭐ |
| **时间轮调度器** | `scheduler-optimized.js` (388行) | `TimerNode` → `TimeWheel` → `OptimizedScheduler`，100ms tick 粒度 | ⭐⭐⭐ |
| **安全模块** | `security.js` (300行) | PBKDF2 密码哈希、登录锁定、密码强度检查、速率限制中间件 | ⭐⭐⭐⭐ |
| **公共工具库** | `common.js` (498行) | 日期管理、奖励汇总、错误判断、Cooldown 管理器、重试/超时/限流工具 | ⭐⭐⭐ |

---

### 2.3 参考项目B 独有的功能 (值得借鉴) ⭐

| 功能 | 位置 | 描述 | 借鉴价值 |
|---|---|---|---|
| **三阶段好友巡查** | `friend.js` `checkFriends()` | 扫描分类→批量偷菜→批量帮助，偷完自动出售 | ⭐⭐⭐⭐⭐ |
| **偷菜/帮助分离** | `visitFriendForSteal()`, `visitFriendForHelp()` | 独立的偷菜和帮助函数，跳过不需要的操作 | ⭐⭐⭐⭐ |
| **好友智能排序** | `checkFriends()` 内 | 偷菜多的优先、帮助需求多的优先 | ⭐⭐⭐⭐ |
| **偷菜好友黑/白名单** | `stealFriendFilter` | 支持黑名单/白名单双模式切换 | ⭐⭐⭐⭐⭐ |
| **植物黑名单** | `plantBlacklist`, `plant-blacklist.ts` Store | 不偷特定植物，前端有独立 Store 管理 | ⭐⭐⭐⭐ |
| **被封禁自动加黑** | `visitFriend()` try/catch | 检测 1002003 错误码 → 自动加入好友黑名单 | ⭐⭐⭐⭐⭐ |
| **偷菜过滤日志** | `visitFriendForSteal()` | 记录被黑名单过滤的数量和原因 | ⭐⭐⭐ |
| **多用户+卡密系统** | `user-store.js` (422行) | `registerUser`, `renewUser`, `createCardsBatch`, 有效期管理 | ⭐⭐⭐ |
| **微信登录配置** | `user-store.js` | `saveWxLoginConfig`, `getWxLoginConfig` 每用户独立配置 | ⭐⭐⭐ |
| **用户清理定时** | `admin.js` `cleanupExpiredUsers()` | 每 5 分钟检查过期用户 | ⭐⭐⭐ |
| **用户管理页面** | `UserManagement.vue` | 独立用户管理界面 | ⭐⭐ |
| **卡密管理页面** | `CardManagement.vue` | 独立卡密管理界面 | ⭐⭐ |
| **偷菜数据分析** | `Analytics.vue` (15KB vs 11KB) | 更详细的偷菜数据统计和展示 | ⭐⭐⭐ |
| **微信登录 Store** | `wx-login.ts` (10.9KB) | 独立的微信登录状态管理 | ⭐⭐⭐ |
| **更新日志系统** | `App.vue` (2.2KB vs 740B) | 前端内嵌 Update 通知弹窗 | ⭐⭐⭐ |


---

## 三、 核心业务逻辑差异分析

### 3.1 好友巡查策略 (最大差异点)

````carousel
**我的程序**: 单一 `visitFriend()` 函数，遍历好友列表逐个执行全部操作（帮助+偷菜+捣乱），存在"为了帮一个好友浇水而进入农场，发现没有可偷的就直接离开"的浪费。

```
好友1 → 帮助+偷菜+捣乱
好友2 → 帮助+偷菜+捣乱
好友3 → 帮助+偷菜+捣乱
...
```
<!-- slide -->
**参考项目B 的三阶段策略**: 先扫描全部好友分类，然后按优先级分批执行。

```
第一阶段：扫描所有好友 → 分成 stealFriends[] 和 helpFriends[]
第二阶段：批量偷菜（按可偷数量排序，偷完自动出售）
第三阶段：批量帮助（按需求量排序，达经验上限自动停止）
```

**优势**: 偷菜优先、减少无效进出、经验上限精确控制
````

### 3.2 偷菜过滤机制

| 过滤维度 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| 植物黑名单 | ✅ `shouldStealPlant()` | ❌ | ✅ `plantBlacklist` |
| 好友黑名单 | ✅ `shouldStealFriend()` | ❌ | ✅ `stealFriendFilter` |
| 黑/白名单双模式 | ❌ 仅黑名单 | ❌ | ✅ 支持 blacklist/whitelist 切换 |
| 被封禁自动加黑 | ❌ | ❌ | ✅ 检测 1002003 错误 |
| 过滤日志记录 | ❌ | ❌ | ✅ 记录过滤数量和原因 |
| 前端独立 Store | ❌ 合并在 setting | ❌ | ✅ `plant-blacklist.ts` |

### 3.3 请求控制与安全

| 维度 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| 请求队列 | 无专用模块 | ✅ `RequestQueue` + 优先级 | 无 |
| 令牌桶限流 | 无 | ✅ `TokenBucket` | 无 |
| 批量优化器 | 无 | ✅ `BatchOperationOptimizer` | 无 |
| 配置校验 | 无 Schema 校验 | ✅ `ConfigValidator` | 无 |
| 密码安全 | SHA256 | ✅ PBKDF2 + 盐 + 兼容旧格式 | SHA256 |
| 登录锁定 | 无 | ✅ 5次失败锁定5分钟 | 无 |
| 密码强度检查 | 无 | ✅ 长度+复杂度 | 无 |

### 3.4 农场操作

| 维度 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| 基础操作 | ✅ 收获/浇水/除草/除虫/施肥/种植 | ✅ 相同 | ✅ 相同 |
| 有机肥循环 | ✅ 500 轮上限 | ✅ 无上限 | ✅ 无上限 |
| 防偷抢收 | ✅ `antiStealHarvest()` | ❌ | ❌ |
| 紧急通道 | ✅ Urgent API 系列 | ❌ | ❌ |
| Promise 合并缓存 | ✅ 500ms TTL | ❌ | ❌ |
| 指数退避 | ✅ `consecutiveErrors` | ❌ | ❌ |
| `runFarmOperation` 参数 | `(opType)` 无 options | `(opType, options={})` 支持配置 | `(opType)` 无 options |

---

## 四、 前端页面差异

| 页面 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| Dashboard | ✅ 28KB | ✅ 27KB | ✅ 25KB |
| Settings | ✅ **55KB** (最丰富) | ✅ 26KB | ✅ 25KB |
| Friends | ✅ 13KB | ✅ 12KB | ✅ 14KB |
| Accounts | ✅ 7KB | ✅ 8KB | ✅ 8KB |
| Analytics | ✅ 11KB | ✅ 11KB | ✅ **16KB** (最详细) |
| Login | ✅ **18KB** (微信扫码) | ✅ 2KB (基础) | ✅ 4KB (中等) |
| StealSettings | ✅ 25KB | ❌ | ❌ |
| Workflow | ✅ 45KB | ❌ | ❌ |
| HelpCenter | ✅ 20KB | ❌ | ❌ |
| Cards | ✅ 19KB | ❌ | ❌ |
| Users | ✅ 16KB | ❌ | ❌ |
| Personal | ✅ 2KB | ✅ 2KB | ✅ 2KB |
| 卡密管理 | *(合并在 Cards)* | ❌ | ✅ 19KB |
| 用户管理 | *(合并在 Users)* | ❌ | ✅ 10KB |

---

## 五、 重点建议：值得借鉴的功能

> [!IMPORTANT]
> 以下是参考项目中**值得借鉴**的功能点，建议优先考虑引入。

### 🥇 最高优先级

1. **三阶段好友巡查策略** (来自参考项目B)
   - 扫描分类 → 批量偷菜(优先) → 批量帮助
   - 偷完所有好友后统一出售
   - 智能排序：可偷多的优先访问

2. **偷菜好友黑/白名单双模式** (来自参考项目B)
   - 当前只有黑名单，增加白名单模式（只偷名单中的好友）
   - 前端 UI 可切换黑名单/白名单

3. **被封禁自动加黑** (来自参考项目B)
   - 进入好友农场时检测 `1002003` 错误
   - 自动将被封禁好友加入黑名单，避免反复尝试

### 🥈 高优先级

4. **令牌桶 + 优先级队列限流** (来自参考项目A)
   - `TokenBucket` 控制并发上限
   - `PriorityQueue` 让紧急请求插队
   - `BatchOperationOptimizer` 合并同类操作

5. **配置 Schema 校验** (来自参考项目A)
   - 热更新配置时自动校验类型、范围、必填
   - 防止非法配置导致运行时崩溃

6. **PBKDF2 密码安全** (来自参考项目A)
   - 当前 SHA256 不够安全
   - PBKDF2 + 盐 + 10000 次迭代
   - 兼容旧格式的平滑迁移

### 🥉 中优先级

7. **偷菜过滤详细日志** (来自参考项目B) — 记录被过滤的数量和原因
8. **时间轮调度器** (来自参考项目A) — 大量定时任务场景性能更优
9. **公共工具抽象** (来自参考项目A) — `createDailyCooldown`, `withRetry`, `withTimeout` 等
10. **前端更新通知弹窗** (来自参考项目B) — `App.vue` 中解析 `Update.log` 展示版本变更

---

## 六、 我的程序的核心优势（无需借鉴）

> [!TIP]
> 以下功能是我的程序**相对领先**于两个参考项目的地方，应继续保持和完善。

| 优势领域 | 具体能力 |
|---|---|
| 数据库层 | MySQL + Redis，远超 JSON 文件存储 |
| 容错能力 | 熔断器 + 写入缓冲 + 指数退避 |
| 防偷机制 | 紧急通道 + 防偷抢收 + Promise 合并缓存 |
| 蹲守系统 | 好友作物成熟时间追踪和定时偷取 |
| AI 助手 | 通义千问辅助决策 |
| 前端功能 | Settings 55KB (最丰富), Workflow 45KB, HelpCenter 20KB |
| 登录方式 | 微信扫码登录 18KB (最完善) |
| 部署方案 | Docker + ipad860 + openviking 多服务 |
| 模块化 | 控制器拆分为 4 个独立文件 |
| 代码质量 | 含 `__tests__/` 测试目录, `scripts/` 工具脚本 |

---

## 七、 总结

| 对比维度 | 我的程序 | 参考项目A | 参考项目B |
|---|---|---|---|
| **整体完成度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **基础设施质量** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **好友偷菜策略** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **请求控制** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **安全性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **前端丰富度** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **部署便利性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

**结论**: 我的程序在基础设施和部署层面领先，但在**好友巡查策略**（参考项目B的三阶段分离模型）和**请求安全控制**（参考项目A的令牌桶+配置校验+PBKDF2）方面可以显著提升。
