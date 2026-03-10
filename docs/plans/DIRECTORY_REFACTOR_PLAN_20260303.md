# 项目目录结构重构计划

> 历史说明（2026-03-07）：本文形成于 `github-sync` 仍在主流程中的阶段，现仅作归档参考。当前有效工作流请参见 `docs/guides/REPO_ROOT_WORKFLOW_GUIDE.md`。

> **版本**：v1.0  
> **日期**：2026-03-03  
> **状态**：计划阶段（待执行）

---

## 一、当前状况描述

### 1.1 根目录松散文件清单

| 文件 | 类型 | 问题 | 建议归属 |
|------|------|------|----------|
| `Update.log` | 日志 | ~~根目录散落~~ | 已迁移至 `logs/development/` |
| `README_DRAFT.md` | 文档 | 草稿在根目录 | `docs/drafts/` |
| `CHANGELOG.DEVELOPMENT.md` | 文档 | 可保留根目录 | 保留（或合并到 CHANGELOG） |
| `DIRECTORY_MAINTENANCE_SOP.md` | 文档 | 维护 SOP | `docs/maintenance/` |
| `pnpm-lock.yaml` | 配置 | 合法 | 保留 |
| `package.json` | 配置 | 合法 | 保留 |
| `LICENSE` | 法律 | 合法 | 保留 |
| `README.md` | 文档 | 合法 | 保留 |
| `CHANGELOG.md` | 文档 | 合法 | 保留 |

### 1.2 目录结构问题汇总

| 问题类型 | 具体表现 | 影响 |
|----------|----------|------|
| **中文目录名** | `log开发日志/` | URL 编码、跨平台兼容性 |
| **命名不一致** | `docs/stakeout_steal` vs `docs/dev-notes` | 查找困难、规范混乱 |
| **松散文档** | `docs/参考项目功能对比分析报告_20260303.md` 在 docs 根 | 应归入 `docs/archive/reports/` |
| **构建产物在源码** | `web/build.log`、`web/stats.html` | 应加入 .gitignore |
| **部署包在仓库** | `deploy-to-server/*.tar.gz` | 仓库膨胀，应排除 |
| **deploy-to-server 混合** | 脚本 + 文档 + 压缩包混放 | 应拆分到 scripts/deploy 与 docs/deployment |
| **log 分散** | ~~`Update.log` 根目录 + `log开发日志/`~~ | 已统一到 `logs/development/` |

### 1.3 现有目录概览

```
qq-farm-bot-ui-main_副本/
├── .cursor/          # Cursor IDE 配置（含大量 skills）
├── .llm-chat-history/# LLM 对话历史
├── .specstory/       # SpecStory 历史
├── .agent/           # Agent 配置
├── .github/          # GitHub 配置
├── assets/           # 静态资源
├── core/             # 后端核心（Node.js）
├── data/             # 运行时数据
├── deploy-to-server/ # 部署脚本+文档+压缩包（混合）
├── docker/           # Docker 配置
├── docs/             # 文档（结构较复杂）
├── github-sync/      # GitHub 同步目标（独立 .git）
├── logs/             # 日志（含 development/ 开发日志、运行日志）
├── scripts/          # 脚本（deploy/docker/github/service/utils）
├── services/         # 外部服务（ipad860, openviking）
└── web/              # 前端（Vue/Vite）
```

---

## 二、重构目标与分类方案

### 2.1 目标原则

1. **条理清晰**：按职能划分，每个目录职责单一
2. **易于查找**：统一命名规范（kebab-case）
3. **方便维护**：SOP 可重复执行
4. **github-sync 可控**：仅同步公开内容，敏感内容排除

### 2.2 目标目录树结构

```
qq-farm-bot-ui-main_副本/
├── .cursor/                    # [保留] Cursor 配置
├── .github/                    # [保留] CI/CD
├── .gitignore
├── .dockerignore
├── .env                        # [保留] 本地配置，不提交
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── LICENSE
├── README.md
├── CHANGELOG.md
├── CHANGELOG.DEVELOPMENT.md    # [可选] 开发版变更
│
├── core/                       # 后端核心
│   ├── src/
│   ├── __tests__/
│   ├── data/
│   ├── config/
│   ├── package.json
│   └── Dockerfile
│
├── web/                        # 前端
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── services/                   # 外部服务
│   ├── ipad860/                # [不同步 GitHub]
│   └── openviking/
│
├── scripts/                    # 脚本（按用途分子目录）
│   ├── deploy/
│   ├── docker/
│   ├── github/
│   ├── service/
│   └── utils/
│
├── docs/                       # 文档（统一 kebab-case）
│   ├── README.md
│   ├── guides/                 # 用户指南
│   ├── api/                    # API 文档
│   ├── architecture/           # 架构文档
│   ├── deployment/             # 部署文档
│   ├── plans/                  # 计划文档（按日期 YYYY-MM-DD）
│   ├── archive/                # 归档
│   │   ├── reports/           # 报告类
│   │   └── legacy/            # 历史遗留
│   ├── dev-notes/              # 开发笔记
│   ├── maintenance/            # 维护 SOP、规范
│   ├── drafts/                 # 草稿（README_DRAFT 等）
│   └── pic/                    # 文档配图
│
├── logs/                       # 所有日志统一
│   ├── ai-autostart.log
│   └── development/            # 开发日志（原 log开发日志）
│       ├── Update.log
│       ├── Log_2026-02.md
│       └── Log_2026-03.md
│
├── assets/                     # 静态资源
│   └── screenshots/
│
├── docker/                     # Docker 相关
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── start.sh
│   └── start-with-ai.sh
│
├── deploy-to-server/           # [重构为] 部署产物目录
│   ├── README.md               # 部署说明（从 docs 链接）
│   └── .gitignore              # 忽略 *.tar.gz
│
├── data/                       # 运行时数据（不提交）
├── github-sync/                 # GitHub 同步目标
└── node_modules/               # 依赖
```

### 2.3 分类逻辑说明

| 目录 | 设立逻辑 | 包含内容 |
|------|----------|----------|
| `core/` | 后端业务逻辑 | Node.js 服务、数据模型、API |
| `web/` | 前端界面 | Vue 组件、静态资源 |
| `services/` | 外部/独立服务 | ipad860、openviking 等子项目 |
| `scripts/` | 可执行脚本 | 按用途：deploy、docker、github、service、utils |
| `docs/` | 项目文档 | 按类型：guides、api、plans、archive、dev-notes |
| `logs/` | 所有日志 | 运行日志 + 开发日志（统一 kebab-case 子目录） |
| `assets/` | 静态资源 | 截图、图标等 |
| `docker/` | 容器化 | Compose、启动脚本 |
| `deploy-to-server/` | 部署相关 | 部署脚本、说明，排除 .tar.gz |
| `github-sync/` | 公开同步 | 由脚本生成，不手动维护 |

---

## 三、github-sync 方案设计

### 3.1 推荐方案：**自动化同步脚本（当前已实现）**

- **实现方式**：`scripts/github/prepare-github-sync.sh` 已存在
- **原理**：从主项目复制指定文件到 `github-sync/`，排除敏感内容
- **优点**：可控、可审计、无软链接跨平台问题
- **不推荐**：物理移动（会破坏主项目结构）、软链接（Windows 兼容性差）

### 3.2 同步范围（需在 prepare-github-sync.sh 中维护）

**包含：**
- `core/src/`、`core/config/`、`core/proto/`、`core/gameConfig/`
- `web/src/`、`web/index.html`
- `docs/guides/`、`docs/api/`、`docs/architecture/`（公开部分）
- `pic/`（脱敏后图片）
- `package.json`、`pnpm-*.yaml`
- `docker-compose*.yml`、`start.sh`、`start.bat`
- `.env.*.example` 配置模板
- `README.md`、`CHANGELOG*.md`、`LICENSE`

**排除：**
- `services/ipad860/`（私有服务）
- `docs/plans/`、`docs/dev-notes/`、`docs/archive/`（内部计划）
- `data/*.json`、`data/*.db`
- `.env`、`logs/`
- `*.tar.gz`、`node_modules/`
- `deploy-to-server/*.tar.gz`

### 3.3 同步流程（已在 DIRECTORY_MAINTENANCE_SOP 中）

1. `bash scripts/github/prepare-github-sync.sh`
2. `bash scripts/github/check-sensitive-info.sh`
3. `cd github-sync && git add -A && git status`
4. 人工检查后 `git commit`、`git push`

---

## 四、命名规范

### 4.1 统一采用 kebab-case

| 类型 | 格式 | 示例 |
|------|------|------|
| 目录 | kebab-case | `dev-notes/`、`stakeout-steal/` |
| 文档 | UPPER_SNAKE 或 kebab-case | `DEPLOYMENT.md`、`api-guide.md` |
| 脚本 | kebab-case | `prepare-github-sync.sh` |
| 图片 | kebab-case + 序号 | `theme-01.png` |
| Plan | `Plan_YYYYMMDD_名称` | `Plan_20260303_xxx.html` |

### 4.2 需重命名的目录/文件

| 当前 | 目标 |
|------|------|
| `log开发日志/` | `logs/development/` |
| `docs/stakeout_steal/` | `docs/stakeout-steal/` |
| `docs/database_optimization/` | `docs/database-optimization/` |
| `docs/steal_settings_ui/` | `docs/steal-settings-ui/` |
| `docs/admin_ui_optimization/` | `docs/admin-ui-optimization/` |
| `docs/auto_features/` | `docs/auto-features/` |
| `docs/double_check/` | `docs/double-check/` |
| `docs/v2.0.2_merge/` | `docs/archive/v2.0.2-merge/` |
| `docs/参考项目功能对比分析报告_20260303.md` | `docs/archive/reports/reference-project-analysis-20260303.md` |

---

## 五、影响分析与处理

### 5.1 代码引用

- **import 路径**：本次重构主要移动 `docs/`、`logs/`、根目录散落文件，**不移动 core/src、web/src**，因此代码 import 基本无影响
- **文档内链接**：需批量检查 `docs/` 内相互引用、README 中的图片路径
- **脚本路径**：`prepare-github-sync.sh` 中的源路径需随目录调整更新

### 5.2 需修改的配置

| 文件 | 修改内容 |
|------|----------|
| `.gitignore` | 添加 `web/build.log`、`web/stats.html`、`deploy-to-server/*.tar.gz` |
| `scripts/github/prepare-github-sync.sh` | 更新 docs 源路径（若 docs 子目录重命名） |
| `package.json` | 若有脚本引用 `log开发日志`，改为 `logs/development` |
| `DIRECTORY_MAINTENANCE_SOP.md` | 更新为 `docs/maintenance/DIRECTORY_MAINTENANCE_SOP.md` 后，内部路径描述更新 |

### 5.3 Git 历史保留

**必须使用 `git mv`：**

```bash
git mv log开发日志 logs/development
git mv docs/stakeout_steal docs/stakeout-steal
git mv docs/参考项目功能对比分析报告_20260303.md docs/archive/reports/reference-project-analysis-20260303.md
# ... 依此类推
```

### 5.4 引用修复清单

执行移动后，需全局搜索并替换：

- `log开发日志` → `logs/development`
- `stakeout_steal` → `stakeout-steal`
- `database_optimization` → `database-optimization`
- `steal_settings_ui` → `steal-settings-ui`
- `admin_ui_optimization` → `admin-ui-optimization`
- `auto_features` → `auto-features`
- `double_check` → `double-check`

---

## 六、操作步骤（条例化）

### 阶段一：准备

1. 创建分支：`git checkout -b refactor/directory-cleanup-20260303`
2. 备份：`git stash`（若有未提交更改）
3. 扫描引用：`grep -rn "log开发日志\|stakeout_steal\|database_optimization" . --include="*.md" --include="*.json" --include="*.sh" --include="*.js" --include="*.ts" --include="*.vue" | grep -v node_modules | grep -v .git`

### 阶段二：根目录整理

4. `git mv Update.log logs/`（或 `logs/development/`）
5. `git mv README_DRAFT.md docs/drafts/`
6. `git mv DIRECTORY_MAINTENANCE_SOP.md docs/maintenance/`
7. 在 `.gitignore` 添加：`web/build.log`、`web/stats.html`、`deploy-to-server/*.tar.gz`

### 阶段三：log开发日志 迁移

8. `mkdir -p logs/development`
9. `git mv log开发日志/* logs/development/`
10. `rmdir log开发日志`（若为空）
11. 更新所有引用 `log开发日志` 的路径为 `logs/development`

### 阶段四：docs 重命名与归位

12. `git mv docs/stakeout_steal docs/stakeout-steal`
13. `git mv docs/database_optimization docs/database-optimization`
14. `git mv docs/steal_settings_ui docs/steal-settings-ui`
15. `git mv docs/admin_ui_optimization docs/admin-ui-optimization`
16. `git mv docs/auto_features docs/auto-features`
17. `git mv docs/double_check docs/double-check`
18. `git mv docs/v2.0.2_merge docs/archive/v2.0.2-merge`
19. `git mv docs/参考项目功能对比分析报告_20260303.md docs/archive/reports/reference-project-analysis-20260303.md`

### 阶段五：deploy-to-server 整理

20. 将 `deploy-to-server/*.tar.gz` 加入 `.gitignore`，若已提交则 `git rm --cached`
21. 将 `deploy-to-server/*.md` 评估：保留为部署说明，或移至 `docs/deployment/`
22. 部署脚本可保留在 `deploy-to-server/` 或迁至 `scripts/deploy/`（二选一，建议保留便于一键部署）

### 阶段六：引用修复与验证

23. 执行全局搜索替换（见 5.4）
24. 更新 `scripts/github/prepare-github-sync.sh` 中 docs 相关路径
25. 运行 `pnpm install -r`、`pnpm build:web` 验证构建
26. 运行 `bash scripts/github/prepare-github-sync.sh` 验证同步
27. 运行 `bash scripts/github/check-sensitive-info.sh` 验证无敏感信息

### 阶段七：提交与合并

28. `git add -A && git status`
29. `git commit -m "refactor: 目录结构重构 - 统一命名与分类"`
30. `git checkout main && git merge refactor/directory-cleanup-20260303`

---

## 七、README 模板（目录结构说明）

已生成模板文件：`docs/maintenance/DIRECTORY_README_TEMPLATE.md`

该模板包含：
- 根目录各文件/目录用途与是否提交
- `core/`、`web/`、`services/` 说明
- `scripts/` 子目录用途表
- `docs/` 子目录用途表
- `logs/`、`data/`、`deploy-to-server/`、`github-sync/` 说明
- 禁止事项清单

**使用方式**：重构完成后，可将该模板内容合并到根目录 `README.md` 的「目录结构」章节，或单独维护为 `docs/DIRECTORY_STRUCTURE.md`。

---

## 八、自动化维护脚本建议

### 8.1 同步到 github-sync 的脚本（已存在）

- `scripts/github/prepare-github-sync.sh`：主同步逻辑
- `scripts/github/check-sensitive-info.sh`：敏感信息检查

### 8.2 建议新增：日常整理脚本

**`scripts/utils/quick-cleanup.sh`**（建议实现）：

```bash
#!/bin/bash
# 快速将根目录松散文件按 SOP 决策树归位
# 用法：./scripts/utils/quick-cleanup.sh
```

功能建议：
- 扫描根目录 `*.md`、`*.log`、`*.html`（排除 README、CHANGELOG、LICENSE）
- 按扩展名/命名模式提示目标目录
- 使用 `git mv` 执行移动
- 输出变更清单供人工确认

### 8.3 建议新增：目录结构校验脚本

**`scripts/utils/validate-directory-structure.sh`**：

- 检查根目录是否只有白名单文件
- 检查 `docs/` 是否无中文命名
- 检查 `scripts/` 是否无松散脚本
- 检查是否存在应忽略的大文件（>10MB）

---

## 九、风险与回滚

| 风险 | 缓解措施 |
|------|----------|
| 文档链接失效 | 移动前导出引用清单，移动后批量替换 |
| 构建失败 | 每阶段执行后运行 build 验证 |
| Git 历史丢失 | 严格使用 `git mv`，禁止 `mv` |
| 同步脚本路径错误 | 同步前在测试分支验证 prepare-github-sync.sh |

**回滚**：`git checkout main && git branch -D refactor/directory-cleanup-20260303`

---

## 十、附录：当前 docs 子目录清单

```
docs/
├── admin_ui_optimization/   → admin-ui-optimization
├── api/
├── architecture/
├── archive/
├── auto_features/          → auto-features
├── database_optimization/  → database-optimization
├── deployment/
├── dev-notes/
├── double_check/           → double-check
├── guides/
├── pic/
├── plans/
├── stakeout_steal/         → stakeout-steal
├── steal_settings_ui/      → steal-settings-ui
├── templates/
├── v2.0.2_merge/           → archive/v2.0.2-merge
└── 参考项目功能对比分析报告_20260303.md → archive/reports/
```
