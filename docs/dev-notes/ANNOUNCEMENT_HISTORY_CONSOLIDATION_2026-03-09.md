# 更新公告历史归拢建议（2026-03-09）

## 阶段汇总（Executive Summary）

- 执行区间：`2026-03-09` 至 `2026-03-10`，累计完成 `12` 轮归拢与流程加固。
- 范围覆盖：`Update.log`、`CHANGELOG.md`、`CHANGELOG.DEVELOPMENT.md`、部署文档、CI/Release/Docker 流水线、本地部署脚本、PR 模板。
- 结果状态：
  - 公告结构统一为“日期标题 + `- [模块]` 条目”主风格。
  - 重复标题、异常 bullet、异构日期标题问题已清零。
  - 公告自检已形成三层约束：本地命令 + 流水线 + PR 模板。
- 当前基线（以最新自检为准）：
  - `node scripts/utils/check-announcements.js` => `0 error(s), 0 warning(s)`
- 残余风险：
  - 历史长文档仍存在“描述偏长”个别条目，但已转为可持续治理问题，不再是阻断风险。

## 审查范围

- `logs/development/Update.log`
- `CHANGELOG.DEVELOPMENT.md`
- `CHANGELOG.md`
- 公告管理/同步入口：`web/src/views/AnnouncementManager.vue`、`core/src/controllers/admin.js`

## 发现的问题

1. **同版本拆成多条，阅读成本高**
- `v4.3.0` 在同一天有“补充”和“主条”两段，信息分散。
- `v4.1.1` 有“系统健壮性升级”与“施肥冲突修复”两段，可合并。

2. **同标题重复出现，语义冗余**
- `2026-03-01 升级 前端：v2.1.0 后端：v2.1.0` 出现两次（一次摘要，一次详细）。

3. **标题风格不统一**
- 混用 `vX.Y.Z`、`[vX.Y.Z]`、`Phase`、`补充`。
- 有的标题带前后端版本，有的没有。

4. **描述偏长，业务信息密度不均**
- 大量条目在单行内包含多个从句和背景叙述，不利于快速扫描。
- `Update.log` 中 50 条 bullet 超过 70 字，建议压缩。

5. **公告结构不稳定**
- 同一文件内混用 `-`、`新增：`、`调整：`，对自动解析和后续同步去重不友好。

## 建议的归拢规范（建议后续统一执行）

### 标题规范
- 建议统一为：`YYYY-MM-DD 主题 前端：vX.Y.Z 后端：vA.B.C`
- 一版一标题；“补充”并入原版条目，不单开同版本标题。

### 内容规范
- 每条公告保留 3~6 个 bullet。
- bullet 模板：`[模块] 变更动作 + 结果`（不写背景故事）。
- 每条尽量控制在 40~65 字。
- 把验证/回归放到最后一条：`[验证] xxx 通过`。

### 去重规范
- 同日同版本只保留一条标题。
- 如果需要“摘要 + 详情”，用同一标题下的 `摘要` / `详情` 子段，不重复标题。

## 可立即执行的归拢点

1. 合并 `Update.log` 中 `v4.3.0` 两段（`Phase 1-4 补充` 并入 `日志系统重构与全栈架构优化`）。
2. 合并 `Update.log` 中 `v4.1.1` 两段（施肥冲突并入主条）。
3. 合并 `Update.log` 中 `v2.1.0` 双标题（保留详细条，摘要并入第一条 bullet）。
4. 将 `新增：/调整：` 统一改为 `- [模块]` 风格。

## 示例（精简改写）

### 原条目（示意）
- `2026-03-08 登录背景系统、汇报统计增强与精细出售修复 ...`（多条长句）

### 建议改写
- `[登录页] 新增背景范围、遮罩与模糊度配置，支持主题联动。`
- `[汇报] 历史记录新增统计卡片与失败快捷筛选。`
- `[背包] 出售改为按原始条目下发，减少预览与实际偏差。`
- `[验证] web build 与 core build:release 通过。`

## 本次额外处理

- 已清理 `CHANGELOG.md` 的 NUL 字节污染，避免后续检索与解析异常。

## 二轮归拢执行记录（2026-03-09）

### 已完成

1. `Update.log` 重点区段完成“去宣传化 + 语义收敛”
- 覆盖版本：`v4.5.0`、`v4.4.1`、`v4.4.0`、`v4.3.0`、`v4.2.0`、`v4.1.2`、`v4.1.1`。
- 处理方式：保留事实与版本号，不改业务结论；将冗长叙述改为“模块 + 变更 + 结果”的短句。

2. 历史格式不一致项清理
- 修复旧段落 `-xxx` 无空格写法，统一为 `- xxx`。
- 统一术语展示（如 `auto` 模式用反引号标识）。
- 清理遗留分隔符 `---`，避免被解析为异常列表项。

3. 结构重复持续收敛
- 维持“同标题零重复”状态。
- 维持“同版本补充并入主条”状态（`v4.3.0`、`v4.1.1`、`v2.1.0`）。

### 本轮复检结论

- 标题总数：`42`
- 精确重复标题：`0`
- `^-\\S` 异常 bullet：`0`
- 公告解析入口语法检查：`node --check core/src/controllers/admin.js` 通过

### 风险与建议

- 风险低：本轮仅改公告文案，不改接口/解析逻辑。
- 建议后续把 `CHANGELOG.DEVELOPMENT.md` 的“复查补记”继续做分层（主公告/复查记录拆分），避免单节过长影响检索效率。

## 三轮归拢执行记录（2026-03-09）

### 已完成

- 在 `CHANGELOG.DEVELOPMENT.md` 顶部新增“快速索引（精简版）”，将近期关键版本压缩为 6 条可扫描摘要。
- 新增统一公告模板：`docs/dev-notes/ANNOUNCEMENT_TEMPLATE.md`，包含标题规范、条目模板、禁止项与发布前自检清单。

### 影响判断

- 风险低：仅文档层优化，不涉及代码逻辑、接口与数据库结构。
- 收益：后续发布可先读索引再查详情，且新公告可按模板稳定落地，减少“同版本拆分、描述过长、格式不统一”回归。

## 四轮归拢执行记录（2026-03-09）

### 已完成

- 在 `CHANGELOG.md` 顶部新增“快速索引（精简版）”，与 `CHANGELOG.DEVELOPMENT.md` 保持同类入口。
- 索引覆盖近期关键版本（`v4.5.0` 至 `v4.1.0`），采用“版本 + 日期 + 一句话价值”格式。

### 影响判断

- 风险低：仅增加导航摘要，不修改历史正文。
- 收益：三份公告文档（`Update.log` / `CHANGELOG.DEVELOPMENT.md` / `CHANGELOG.md`）都具备“先看摘要再看细节”的统一阅读路径。

## 五轮归拢执行记录（2026-03-09）

### 已完成

- 对 `Update.log` 的历史段（`v2.0.1` 至 `v1.0.0`）完成模板化收敛：
  - 由“新增/调整/修复”散段改为统一 `- [模块]` 句式。
  - 保留原始事实、注意事项和 PR 归属信息，仅压缩描述长度并统一术语。
- `v2.0.0` 重构公告改为“架构/后端/功能/前端/说明”五类摘要，降低阅读跳转成本。
- `v1.2.x`、`v1.1.x`、`v1.0.x` 历史条目统一了标点、空格、术语和句式。

### 本轮复检结论

- 标题总数：`42`
- 精确重复标题：`0`
- 异常 bullet（`^-\\S`）：`0`

### 影响判断

- 风险低：仅公告文本归拢，不涉及业务代码和接口行为。
- 收益：`Update.log` 全段（新旧版本）可读性与可检索性显著一致，后续同步解析更稳定。

## 六轮归拢执行记录（2026-03-09）

### 已完成

- 将 `Update.log` 末尾英文异构段：
  - `## [2026-03-06] System Evolution Phase 2: Reliability & Decoupling`
  统一改写为标准日期标题 + `- [模块]` 条目格式。
- 保留原始技术事实（事务、Weighted TTL、PlatformFactory、系统日志持久化），仅做语言与结构统一。

### 本轮复检结论

- 标题总数：`43`（新增 1 条标准日期标题）
- 精确重复标题：`0`
- 异常 bullet（`^-\\S`）与 `## [YYYY-MM-DD]` 异构标题：`0`

### 影响判断

- 风险低：文案与结构归拢，不改变任何功能逻辑。
- 收益：`Update.log` 全文件统一为同一解析风格，减少后续公告同步与人工维护成本。

## 七轮归拢执行记录（2026-03-09）

### 已完成

- 新增公告自检脚本：`scripts/utils/check-announcements.js`（只读检查，不改文件）。
- 根目录 `package.json` 新增命令：`check:announcements`。
- 公告模板 `ANNOUNCEMENT_TEMPLATE.md` 已补充发布前自检步骤：执行 `pnpm check:announcements`。

### 检查项（当前脚本）

- `Update.log` 日期标题重复检查（精确标题去重）。
- bullet 格式检查（拦截 `-xxx` 无空格写法）。
- 异构日期标题检查（拦截 `## [YYYY-MM-DD]` 风格）。
- `Update.log` / `CHANGELOG.md` / `CHANGELOG.DEVELOPMENT.md` 的 NUL 字节检查。
- 超长 bullet 提示（`> 120` 字符，警告级）。

### 本轮执行结果

- 本机执行：`node scripts/utils/check-announcements.js`
- 结果：`0 error, 0 warning`
- 修正：已拆分 `Update.log` 1 条超长 bullet，并清理 `CHANGELOG.DEVELOPMENT.md` 中的 NUL 字节。
- 说明：当前环境缺少 `pnpm`，因此未直接执行 `pnpm check:announcements`；CI 或有 `pnpm` 的环境可直接使用该命令。

## 八轮归拢执行记录（2026-03-09）

### 已完成

- 已将公告自检接入 CI/发布流水线：
  - `.github/workflows/ci.yml`：`Install Dependencies` 后新增 `pnpm check:announcements`
  - `.github/workflows/release.yml`：`Install Dependencies` 后新增 `pnpm check:announcements`
  - `.github/workflows/docker-build-push.yml`：新增 `actions/setup-node@v4`，并执行 `node scripts/utils/check-announcements.js`

### 本轮复检结论

- `node --check scripts/utils/check-announcements.js` 通过
- `node scripts/utils/check-announcements.js` 通过（`0 error, 0 warning`）

### 影响判断

- 风险低：仅新增发布前只读校验步骤，不改变构建产物逻辑。
- 收益：公告质量检查从“人工约定”升级为“流水线硬约束”，可持续防止重复标题、格式回退和文件损坏问题再次出现。

## 九轮归拢执行记录（2026-03-09）

### 已完成

- 本地部署脚本接入公告预检（可用即执行，缺失依赖时自动跳过）：
  - `scripts/deploy/update-app.sh`
  - `scripts/deploy/fresh-install.sh`
- 预检逻辑：优先检测 `check-announcements.js` 与 `node`，可执行时阻断错误公告；部署包模式或无 Node 时仅提示并继续。

### 本轮复检结论

- `bash -n scripts/deploy/update-app.sh` 通过
- `bash -n scripts/deploy/fresh-install.sh` 通过
- `node scripts/utils/check-announcements.js` 通过（`0 error, 0 warning`）

### 影响判断

- 风险低：仅新增发布前文本校验，不影响业务部署流程主链路。
- 收益：本地更新与全新部署在进入 Docker/服务重启前即可提前拦截公告质量问题，避免问题版本进入发布环节。

## 十轮归拢执行记录（2026-03-10）

### 已完成

- README 部署章节新增“发布前公告自检”说明，并补充：
  - 全新部署脚本会在可用时执行公告预检
  - 更新脚本会在更新前尝试执行公告预检
- `docs/DEPLOYMENT_SOP.md` 已将公告自检纳入：
  - 前置条件
  - 执行顺序（步骤 3）
  - 检查清单
- 同步更新文档日期：
  - `README.md` 最后更新时间改为 `2026-03-10`
  - `docs/DEPLOYMENT_SOP.md` 最后更新时间改为 `2026-03-10`

### 影响判断

- 风险低：仅文档流程补充，不影响脚本执行逻辑。
- 收益：公告预检已从“代码实现”延展到“发布流程文档”，团队执行路径一致，交接成本更低。

## 十一轮归拢执行记录（2026-03-10）

### 已完成

- `docs/DEPLOYMENT_PLAN.md` 已同步加入公告自检步骤：
  - 新增阶段 `1.3 执行公告自检`
  - 支持 `pnpm check:announcements` 与 `node scripts/utils/check-announcements.js` 双路径
  - 明确通过标准：`0 error(s), 0 warning(s)`
- 阶段五检查清单新增“公告自检已通过”项。
- 文档日期更新为 `2026-03-10`。

### 影响判断

- 风险低：仅计划文档补充，不改代码逻辑。
- 收益：计划文档与 SOP / README 完全对齐，发布前检查口径一致。

## 十二轮归拢执行记录（2026-03-10）

### 已完成

- 新增 PR 模板：`.github/pull_request_template.md`。
- 模板中已加入“公告与发布检查（必填）”项：
  - 公告自检命令执行与结果确认
  - `Update.log` / `CHANGELOG.md` / `CHANGELOG.DEVELOPMENT.md` 同步检查
  - `README.md` / `DEPLOYMENT_SOP.md` / `DEPLOYMENT_PLAN.md` 同步检查

### 本轮复检结论

- `node scripts/utils/check-announcements.js` 通过（`0 error, 0 warning`）。

### 影响判断

- 风险低：仅新增协作模板，不影响运行逻辑。
- 收益：公告规范从“脚本与文档约定”进一步落地到 PR 提交流程，减少漏改与口径不一致。

## 十三轮归拢执行记录（2026-03-10）

### 已完成

- 在本文件顶部新增“阶段汇总（Executive Summary）”，压缩展示近两日归拢成果与当前基线状态。
- 保留原有 1~12 轮详细记录不变，仅新增一页决策摘要层，便于快速浏览与交接。

### 本轮复检结论

- `node scripts/utils/check-announcements.js` 通过（`0 error, 0 warning`）。

### 影响判断

- 风险低：仅文档展示层优化，不改任何流程与代码。
- 收益：管理者可先读摘要再下钻明细，减少阅读成本并提高执行一致性。

## 十四轮归拢执行记录（2026-03-10）

### 已完成

- 修复部署文档中的“实际可用性”问题：
  - `docs/DEPLOYMENT_SOP.md`、`docs/DEPLOYMENT_PLAN.md` 的一键脚本 URL 已改为真实仓库与真实路径：
    - `https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-arm.sh`
    - `https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-x86.sh`
  - SOP/Plan 中过时版本示例由 `v4.0.0` 更新为 `v4.5.17` 示例。
  - README 的 GitHub 仓库与 Issues 链接改为 `qq-farm-ui-pro-max`，与 `git remote -v` 一致。

### 本轮复检结论

- 新脚本链接实测可访问：HTTP `200`（arm/x86 两条）。
- `node scripts/utils/check-announcements.js` 通过（`0 error, 0 warning`）。

### 影响判断

- 风险低：仅文档修正，不涉及业务代码。
- 收益：显著降低按文档执行时的“命令可读但链接失效”风险，提升新同事/运维的首轮成功率。
