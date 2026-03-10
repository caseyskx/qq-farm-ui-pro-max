# Git 同步范围清单（2026-03-10）

## 1. 目的

这份清单只回答一件事：

- 当前工作树里，哪些改动已经适合单独同步。
- 哪些改动还属于其他并行工作，不应该和这批持久化/回归收口混在一起。

## 2. 当前分层概览

- 已暂存：`31` 个文件
- 未暂存已修改：`944` 个文件
- 未跟踪：`178` 个文件

结论：

- 现在已经存在一批可以独立提交/同步的“收口包”。
- 其余大面积变动仍然很多，不能直接把整个工作树当成一个提交范围。

## 3. 当前可独立同步的范围

### 3.1 CI / 前端回归链收口

文件数：`7`

- `.github/workflows/ci.yml`
- `docs/REGRESSION_TEST_CHECKLIST.md`
- `web/package.json`
- `web/__tests__/use-view-preference-sync.test.mjs`
- `web/src/components/LeaderboardModal.vue`
- `web/src/views/StealSettings.vue`

这一组负责：

- 把 CI 入口统一到 `pnpm test:frontend`
- 固化前端回归链
- 补齐共享视图偏好同步的最小单测
- 清掉会阻断回归链的页面残缺/格式问题

### 3.2 用户级偏好与轻量状态持久化

文件数：`21`

- `.gitignore`
- `core/src/services/user-preferences.js`
- `core/src/controllers/admin/settings-report-routes.js`
- `core/src/database/migrations/001-init_mysql.sql`
- `core/src/database/migrations/015-user-preferences.sql`
- `core/src/services/mysql-db.js`
- `deploy/init-db/01-init.sql`
- `core/__tests__/user-preferences.test.js`
- `core/__tests__/admin-settings-report-routes.test.js`
- `web/src/utils/view-preferences.ts`
- `web/src/App.vue`
- `web/src/components/AnnouncementDialog.vue`
- `web/src/components/NotificationPanel.vue`
- `web/src/components/NotificationModal.vue`
- `web/src/components/Sidebar.vue`

这一组负责：

- 把 `app_seen_version`
- `announcement_dismissed_id`
- `last_read_notification_date`

从纯浏览器本地状态迁入 `user_preferences`

同时顺手收口：

- `dist-runtime/` 构建产物忽略规则
- 服务端优先、本地缓存兜底的同步链

### 3.3 共享视图偏好抽象与页面接线

- `web/src/composables/use-view-preference-sync.ts`
- `web/src/components/ui/BaseCheckbox.vue`
- `web/src/components/ui/BaseDataTableSelectionCell.vue`
- `web/src/views/Accounts.vue`
- `web/src/views/Analytics.vue`
- `web/src/views/Dashboard.vue`
- `web/src/views/Settings.vue`

这一组负责：

- 把页面里重复的 `hydrate -> watch -> debounce save` 逻辑抽成共享 composable
- 统一账号页、分析页、仪表盘、设置页的视图偏好同步方式
- 修正表格选择和基础控件的类型/接线问题

### 3.4 文档与状态清单

文件数：`3`

- `docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md`
- `docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`
- `docs/dev-notes/GIT_SYNC_SCOPE_2026-03-10.md`

这一组负责：

- 记录哪些状态已经进数据库
- 说明哪些仍是浏览器缓存/迁移源
- 留下本轮验证结果和边界判断

## 4. 当前明确不应混入这批同步的范围

下面这些范围当前仍有大量并行改动，但不属于这批“持久化 + 回归链 + git 收口”：

- 大量截图、静态资源、图鉴和 `nc_local_version` 内容
- 大量部署脚本、README、发布文档
- 大量 `core/src/controllers/admin/*` 新拆分文件
- 大量管理页基础组件与 UI 重构文件
- 其他历史测试补充与运行时模块拆分

这些改动并不一定有问题，但当前没有被整理成同一个可独立同步的范围。

## 5. 当前推荐的同步方式

如果现在只想同步“已经收口完成”的这批内容，建议只基于当前已暂存范围操作，不要直接 `git add .`。

建议命令：

```bash
git diff --cached --name-only
git diff --cached --stat
```

如果后面要继续拆提交，建议按下面 3 段切：

1. `CI / 前端回归链`
2. `用户级偏好与轻量状态持久化`
3. `文档与状态清单`

### 5.1 推荐提交切分

#### Commit 1: CI / 前端回归链

建议提交信息：

```bash
git commit -m "test(web): stabilize frontend regression chain"
```

对应路径：

```text
.github/workflows/ci.yml
.gitignore
docs/REGRESSION_TEST_CHECKLIST.md
web/__tests__/use-view-preference-sync.test.mjs
web/package.json
web/src/components/LeaderboardModal.vue
web/src/views/StealSettings.vue
```

#### Commit 2: 用户级偏好与轻量状态持久化

建议提交信息：

```bash
git commit -m "feat(preferences): persist user view and read-state preferences"
```

对应路径：

```text
core/__tests__/admin-settings-report-routes.test.js
core/__tests__/user-preferences.test.js
core/src/controllers/admin/settings-report-routes.js
core/src/database/migrations/001-init_mysql.sql
core/src/database/migrations/015-user-preferences.sql
core/src/services/mysql-db.js
core/src/services/user-preferences.js
deploy/init-db/01-init.sql
web/src/App.vue
web/src/components/AnnouncementDialog.vue
web/src/components/NotificationModal.vue
web/src/components/NotificationPanel.vue
web/src/components/Sidebar.vue
web/src/components/ui/BaseCheckbox.vue
web/src/components/ui/BaseDataTableSelectionCell.vue
web/src/composables/use-view-preference-sync.ts
web/src/utils/view-preferences.ts
web/src/views/Accounts.vue
web/src/views/Analytics.vue
web/src/views/Dashboard.vue
web/src/views/Settings.vue
```

#### Commit 3: 文档与状态清单

建议提交信息：

```bash
git commit -m "docs: record persistence inventory and sync scope"
```

对应路径：

```text
docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md
docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md
docs/dev-notes/GIT_SYNC_SCOPE_2026-03-10.md
```

### 5.2 额外说明

- [CHANGELOG.DEVELOPMENT.md](/Users/smdk000/文稿/qq/qq-farm-bot-ui-main_副本/CHANGELOG.DEVELOPMENT.md) 已追加本轮记录，但它在本次整理前就处于未暂存修改状态。
- 为避免把你其他历史编辑一并误纳入当前提交，这个文件暂时没有加入本次“可独立同步范围”。

## 6. 当前结论

- 这批“可独立同步范围”已经具备单独提交条件。
- 最大的同步风险，已经不是这 30 个已暂存文件本身，而是剩余 `944 + 178` 项并行改动容易被误混进来。
- 当前这批同步范围现在是 `31` 个已暂存文件。
- 后续如果继续整理 git，优先级应该是继续把未暂存/未跟踪范围按主题切层，而不是再扩大本次提交面。

## 7. 阶段更新（2026-03-10 第二轮整理后）

### 7.1 当前状态

- 上一阶段的 `31` 个文件已经压缩并落成 `3` 个提交。
- 当前分支 `main` 相比 `origin/main` 超前 `3` 个提交。
- 当前没有 staged 内容。
- 当前没有 unmerged 冲突。
- 原本的大工作区改动已经恢复回工作区。

当前剩余范围：

- 未暂存已修改：`344` 个文件
- 未跟踪：`185` 个文件

安全保险仍然保留：

- 备份分支：`codex/rewrite-backup-20260310`
- stash：`codex-pre-pop-current-2026-03-10`
- stash：`codex-rewrite-residual-2026-03-10`
- stash：`codex-rewrite-unstaged-2026-03-10`
- stash：`codex-split-unstaged-2026-03-10`

### 7.2 下一层候选同步包

下面这些范围已经能看出清晰主题，但还没有继续拆成新提交：

#### A. 后端管理路由拆分与接线

文件量：约 `48` 个

核心范围：

- `core/src/controllers/admin.js`
- `core/src/controllers/users.js`
- `core/client.js`
- `core/src/controllers/admin/*`
- `core/__tests__/admin-*.test.js`

这一包的主题已经比较清楚：

- 把原本集中在 `admin.js` 的大路由继续拆成独立子模块
- 补 `auth / account / announcement / commerce / maintenance / socket / system-public` 等路由测试
- 调整应用壳、运行时接线和路由装配

这一包适合作为下一批优先整理对象，因为边界最清晰，也最像一组真正的结构性重构。

#### B. 持久化与运行时收口补包

文件量：约 `23` 个

核心范围：

- `core/src/models/store.js`
- `core/src/models/user-store.js`
- `core/src/runtime/data-provider.js`
- `core/src/services/database.js`
- `core/src/services/jwt-service.js`
- `core/src/services/system-settings.js`
- `core/src/services/user-ui-settings.js`
- `core/src/services/account-bag-preferences.js`
- `core/src/database/migrations/014-system-settings.sql`
- `core/src/database/migrations/016-account-bag-preferences.sql`
- 多个 `store / data-provider / jwt / user-ui / account-bag` 测试

这一包主要是：

- 把前面做过的持久化改造继续补完整
- 收尾 `system_settings / user_ui / bag_preferences / jwt / data-provider`
- 补运行时和持久化回归测试

这一包也比较适合独立成一组，但它会和前面的 `user-preferences` 提交形成“同类续作”，提交信息要显式区分。

#### C. Web 管理页与主题统一重构

文件量：约 `90` 个

核心范围：

- `web/src/views/*`
- `web/src/components/*`
- `web/src/components/ui/*`
- `web/src/stores/*`
- `web/src/utils/*`
- `web/src/theme/*`
- `web/__tests__/*`

这一包体量明显更大，里面至少又混着 3 类子主题：

- 账号/用户/卡密/日志等管理页布局重构
- 基础 UI 组件抽象
- 主题与全局视觉统一

这一包不建议直接整体同步，后续应该继续拆成更细的前端批次。

#### D. 文档、截图、仓库运维与发布材料

文件量：约 `156` 个

核心范围：

- `docs/**`
- `assets/screenshots/**`
- `.github/**`
- `scripts/utils/**`
- `README.md`
- `CHANGELOG*.md`
- `deploy/**`
- `docker-compose.yml`
- `docker/**`
- `package.json`

这一包包含：

- 大量说明文档和阶段记录
- 主题审计截图和界面素材
- 仓库维护脚本
- 工作流和发布材料

这一包只能最后再整理，不适合现在和代码重构一起提交。

### 7.3 当前建议顺序

如果继续拆下一批提交，建议顺序是：

1. `后端管理路由拆分与接线`
2. `持久化与运行时收口补包`
3. `Web 管理页与主题统一重构`
4. `文档、截图、仓库运维与发布材料`

原因很简单：

- A 包边界最清楚，结构性最强
- B 包和已提交的偏好持久化链最接近，容易串成连续历史
- C 包太大，必须继续二次拆分
- D 包最适合作为尾包
