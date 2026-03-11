# 前端状态持久化清单（2026-03-10）

## 1. 说明

这份清单聚焦“用户可感知、且容易被误解成应该持久化”的前端状态。

- 不包含普通 `loading`、弹窗开关、临时输入草稿这类纯瞬时 UI 状态。
- 重点区分 4 类状态：
  - `浏览器本地持久化`：保存在 `localStorage` / `useStorage`，不进数据库。
  - `服务端同步偏好`：真实权威数据在后端 / MySQL；有些带本地缓存兜底，有些直接从服务端恢复。
  - `当前页面会话态`：刷新页面就丢，不写浏览器也不写数据库。
  - `纯运行时内存态`：组件 / 页面运行时使用，刷新或重启立即丢失。

## 2. 浏览器本地持久化（不进数据库）

### 2.1 登录与身份上下文

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `admin_token` | `web/src/utils/auth.ts` | 前端登录态标识，保存当前登录用户名；真实认证仍依赖 Cookie / refresh token | 需要重新登录 |
| `current_user` | `web/src/views/Login.vue`、`web/src/router/index.ts`、`web/src/components/Sidebar.vue` | 前端展示当前用户信息的本地缓存 | 需要重新拉取或重新登录 |
| `remember_username` / `saved_username` | `web/src/views/Login.vue` | 登录页“记住用户名” | 用户名不再自动回填 |

说明：

- `current_user` 不是数据库里的用户档案主存，只是前端显示缓存。
- 真正的登录有效性仍以服务端签发的 Cookie / token 为准。

### 2.2 说明：公告、通知、版本已读已迁入服务端偏好

- `app_seen_version`
- `announcement_dismissed_id`
- `last_read_notification_date`

说明：

- 这三项原本只存在浏览器本地，现已迁入 `user_preferences`。
- 浏览器本地键仍保留，用于首屏兜底、弱网可用和旧数据迁移。
- 当前权威来源已切换到服务端，详见下方 `3.7 公告、通知、版本已读`。

### 2.3 页面显示偏好

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |

### 2.4 背包页本机迁移源

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `qq-farm.mall.purchase-history.v1` | `web/src/components/BagPanel.vue` | 商城 / 商店购买记忆的旧本机缓存，现主要用于首屏兜底和迁移 | 服务端已恢复时不再以本机缓存为准 |
| `qq-farm.bag.activity-history.v1` | `web/src/components/BagPanel.vue` | 最近 30 条购买 / 使用 / 出售动态的旧本机缓存，现主要用于首屏兜底和迁移 | 服务端已恢复时不再以本机缓存为准 |
| `qq-farm.bag.use-history.v1` | `web/src/components/BagPanel.vue` | 旧版使用记录键，仅作迁移源 | 仅旧版本升级时用到 |

说明：

- 这三项都按 `current_account_id` 进行浏览器内部分桶。
- 其中前两项现已迁入账号级服务端缓存，本地键保留为迁移源和弱网兜底。
- 它们不是后端审计表，也不是 MySQL 统计。

## 3. 服务端同步偏好（权威数据不在浏览器）

这些状态的权威来源都已经在后端，因此不能再简单归类为“没持久化”。

- 一部分仍保留浏览器缓存，用于首屏秒开、弱网兜底和旧数据迁移。
- 另一部分不再写浏览器，页面刷新时会直接从服务端恢复。

### 3.1 UI 外观与主题缓存

位置：`web/src/stores/app.ts`

涉及键：

- `ui_theme`
- `app_color_theme`
- `app_performance_mode`
- `login_background`
- `background_scope`
- `login_background_overlay_opacity`
- `login_background_blur`
- `workspace_visual_preset`
- `app_background_overlay_opacity`
- `app_background_blur`
- `theme_background_linked`
- `site_title`
- `support_qq_group`
- `copyright_text`
- `app_ui_sync_time`

当前行为：

- 浏览器会先保留一份本地缓存，便于首屏和离线回显。
- 登录后会通过 `/api/ui-config` 与后端同步。
- 普通用户个人外观偏好已迁入 `ui_settings`。
- 管理员全局品牌 / 背景配置已进入全局配置存储。

结论：

- 这些状态“有浏览器缓存”，但不是“只存在浏览器”。
- 当前权威来源已经是后端配置，而不是本地缓存本身。

### 3.2 当前账号选择

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `current_account_id` | `web/src/utils/auth.ts`、`core/src/services/user-preferences.js` | 当前正在操作的账号 ID，上下文会随它切换 | 登录后会从服务端恢复；断网时仍会先用本机缓存兜底 |

说明：

- 浏览器本地仍保留 `current_account_id`，用于首屏和弱网兜底。
- 当前权威来源已升级为后端 `user_preferences.current_account_id`。
- 这项偏好不再放进 `ui_settings`，避免“只想保存账号选择，却把全局 UI 默认值固化成个人覆盖”。

### 3.3 背包页购买记忆与交易动态

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `account_bag_preferences.purchase_memory` | `core/src/services/account-bag-preferences.js`、`web/src/components/BagPanel.vue` | 商城 / 商店购买记忆，用于“常买推荐” | 登录后会从服务端恢复；本机缓存只作首屏和弱网兜底 |
| `account_bag_preferences.activity_history` | `core/src/services/account-bag-preferences.js`、`web/src/components/BagPanel.vue` | 最近 30 条购买 / 使用 / 出售动态 | 登录后会从服务端恢复；本机缓存只作首屏和弱网兜底 |

说明：

- 这两项现在是账号级服务端缓存，会跟随账号走。
- 若服务端尚无记录但浏览器本地有旧缓存，前端会自动把旧数据迁回服务端。
- 它们仍属于“操作辅助记忆”，不是正式审计日志。

### 3.4 Dashboard / Analytics / 经营汇报历史视图偏好

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `user_preferences.dashboard_view_state` | `core/src/services/user-preferences.js`、`web/src/views/Dashboard.vue` | 运行日志筛选条件 | 登录后会从服务端恢复；本机缓存只作首屏兜底和旧数据迁移 |
| `user_preferences.analytics_view_state` | `core/src/services/user-preferences.js`、`web/src/views/Analytics.vue` | 图鉴排序方式、策略推荐面板折叠状态 | 登录后会从服务端恢复；本机缓存只作首屏兜底和旧数据迁移 |
| `user_preferences.report_history_view_state` | `core/src/services/user-preferences.js`、`web/src/views/Settings.vue` | 经营汇报历史筛选 / 排序 / 页数 / 关键字 | 登录后会从服务端恢复；本机缓存只作首屏兜底和旧数据迁移 |

说明：

- `Dashboard` 当前已持久化的字段包括：`module`、`event`、`keyword`、`isWarn`。
- `Analytics` 当前已持久化的字段包括：`sortKey`、`strategyPanelCollapsed`。
- `经营汇报历史` 当前已持久化的字段包括：`mode`、`status`、`keyword`、`sortOrder`、`pageSize`。
- 浏览器本地旧键 `dashboard_log_filter`、`analytics_sort_key`、`analytics_strategy_collapsed`、`qq-farm-bot:report-history-view:v1` 仍保留为首屏兜底和旧数据迁移源，但权威来源已切换到 `user_preferences`。

### 3.5 卡密页与系统日志页视图偏好

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `user_preferences.cards_view_state` | `core/src/services/user-preferences.js`、`web/src/views/Cards.vue` | 卡密页筛选条件、页码、每页数量 | 登录后会从服务端恢复，不依赖浏览器缓存 |
| `user_preferences.system_logs_view_state` | `core/src/services/user-preferences.js`、`web/src/views/SystemLogs.vue` | 系统日志页筛选条件、页码、每页数量 | 登录后会从服务端恢复，不依赖浏览器缓存 |

说明：

- `Cards` 当前已持久化的字段包括：`keyword`、`type`、`status`、`source`、`batchNo`、`createdBy`、`page`、`pageSize`。
- `SystemLogs` 当前已持久化的字段包括：`level`、`accountId`、`keyword`、`page`、`pageSize`。
- 这两项走 `GET/POST /api/view-preferences`，按当前登录用户保存，不跟账号 ID 绑定。

### 3.6 账号页视图偏好

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `user_preferences.accounts_view_state` | `core/src/services/user-preferences.js`、`web/src/views/Accounts.vue` | 账号页视图模式、表格排序、列显隐 | 登录后会从服务端恢复；本机缓存只作兜底和旧数据迁移 |
| `user_preferences.accounts_action_history` | `core/src/services/user-preferences.js`、`web/src/views/Accounts.vue` | 最近批量操作摘要 | 登录后会从服务端恢复；本机缓存只作兜底和旧数据迁移 |

说明：

- `Accounts` 当前已持久化的字段包括：`viewMode`、`tableSortKey`、`tableSortDirection`、`tableColumnVisibility`。
- `Accounts` 最近操作摘要当前已持久化的字段包括：`id`、`actionLabel`、`status`、`timestamp`、`totalCount`、`successCount`、`failedCount`、`skippedCount`、`affectedNames`、`failedNames`、`targetLabel`。
- 页面仍保留 `accounts_view_mode`、`accounts_table_sort`、`accounts_table_columns`、`accounts_action_history` 作为首屏兜底和旧数据迁移源，但权威来源已切换到 `user_preferences`。
- 最近操作摘要会跟随当前登录用户同步，但仍然不是正式审计日志，也不会替代后端操作日志。

### 3.7 公告、通知、版本已读

| 状态 / Key | 位置 | 真实用途 | 换设备 / 清缓存后的表现 |
| --- | --- | --- | --- |
| `user_preferences.app_seen_version` | `core/src/services/user-preferences.js`、`web/src/App.vue` | 当前版本更新公告是否已看过 | 登录后会从服务端恢复；本地缓存只作兜底和旧数据迁移 |
| `user_preferences.announcement_dismissed_id` | `core/src/services/user-preferences.js`、`web/src/components/AnnouncementDialog.vue` | 最新系统公告是否已关闭 | 登录后会从服务端恢复；本地缓存只作兜底和旧数据迁移 |
| `user_preferences.notification_last_read_date` | `core/src/services/user-preferences.js`、`web/src/components/NotificationPanel.vue`、`web/src/components/Sidebar.vue` | 通知面板最新一条已读时间 | 登录后会从服务端恢复；本地缓存只作兜底和旧数据迁移 |

说明：

- 这三项现在都走 `GET/POST /api/view-preferences`。
- 前端会优先读取服务端值；当服务端缺记录而浏览器本地有旧值时，会自动回写服务端。
- `NotificationPanel`、`AnnouncementDialog`、更新公告大弹窗里的提示文案也已经同步改成“服务端同步 + 本地兜底”。

## 4. 当前页面会话态（刷新页面即丢）

### 4.1 卡密页

位置：`web/src/views/Cards.vue`

当前会话态：

- `selectedCards`
- 生成 / 编辑 / 明细弹窗的当前操作上下文

说明：

- 卡密数据本身来自服务端。
- 筛选条件、页码和每页数量现已写入 `user_preferences.cards_view_state`。
- 当前仍不会持久化的是批量勾选状态和弹窗中的临时操作上下文。

### 4.2 系统日志页

位置：`web/src/views/SystemLogs.vue`

当前会话态：

- 当前详情弹窗上下文

说明：

- 日志数据本身来自后端 MySQL 审计表。
- 页面筛选和翻页状态现已写入 `user_preferences.system_logs_view_state`。
- 当前仍不会持久化的是详情弹窗上下文这类临时查看状态。

## 5. 纯前端运行时内存态（刷新即丢）

这类状态通常不是“应该持久化却没持久化”，而是故意只用于前端交互。

典型位置：

- `web/src/components/Sidebar.vue`
  - `showAccountDropdown`
  - `showAccountModal`
  - `showNotificationModal`
  - `hasUnread`
  - `justClosedModal`
  - `qrLoginInProgress`
- `web/src/views/Login.vue`
  - `showDisclaimer`
  - `pendingAuthData`
  - `trialCooldown`
  - `trialSuccess`
- `web/src/views/Analytics.vue`
  - `strategyLevel`
  - `strategyLevelMode`
  - `liveAccountLevel`
- `web/src/views/Dashboard.vue`
  - `autoScroll`
  - `showAllTasks`

结论：

- 这类状态属于页面交互或短时运行时辅助信息。
- 默认不建议迁入数据库，除非业务明确要求“跨设备也要保留同样的页面操作上下文”。

## 6. 与前端排查相关的后端非持久化状态

虽然这份文档聚焦前端，但下面几项也经常被用户误认为“设置没存住”：

| 状态 | 位置 | 性质 |
| --- | --- | --- |
| `trialRateLimitMap` | `core/src/controllers/admin.js` | 公开体验卡接口的 1 小时短期限流，纯内存 |
| 登录失败锁定计数 | `core/src/services/security.js` | 风控内存态，重启清空 |
| WebSocket 在线连接状态 | `core/src/stores/status` / 服务端实时连接层 | 运行时状态，不属于配置持久化 |

## 7. 当前结论

### 7.1 已经完成服务端持久化的高价值配置

- 账号级设置：自动化、时间区间、经营汇报、出售策略、风险模式等
- 全局设置：体验卡、第三方 API、全局 UI、时间参数、集群策略等
- 普通用户 UI 偏好：已进入 `ui_settings`
- 用户级视图偏好：`current_account_id`、账号页视图偏好、账号页最近操作摘要、卡密页视图偏好、系统日志页视图偏好
- 账号级辅助记忆：背包页购买记忆、交易动态
- 用户级视图偏好：Dashboard、Analytics、经营汇报历史、卡密页、系统日志页、账号页
- 用户级轻量状态：更新公告版本已读、公告关闭状态、通知已读时间

### 7.2 仍然保留在浏览器本地，且短期内更适合继续本地化的状态

- 记住用户名
- `current_user` 的前端展示缓存
- 头像失效 URL 的 `sessionStorage` 缓存

### 7.3 如果未来要继续迁移，优先级建议

当前剩余高价值、且容易被误判成“应该跨端同步”的状态已经基本收完。

更适合继续留在本地：

1. 记住用户名
2. `current_user` 展示缓存
3. 头像失效 URL 的 `sessionStorage` 缓存
