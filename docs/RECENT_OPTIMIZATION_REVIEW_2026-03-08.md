# 近期优化复盘与公告同步记录 (2026-03-08)

## 1. 记录范围

本轮复盘覆盖以下近期优化链路：

- 公告系统与 `Update.log` 同步
- 设置页「经营汇报历史」筛选、统计与分页
- UI 全局配置持久化与多端同步
- 登录页背景预览相关构建链路
- 账号列表可读性与细节体验

## 2. 本轮确认过的更新

### 2.1 公告链路

- 本地公告源继续以 `logs/development/Update.log` 为准。
- 服务端公告数据继续由 `announcements` 表承载。
- 为降低人工维护风险，`Update.log` 解析已增强为按日期标题行切段，而不是强依赖空行。

### 2.2 设置页经营汇报历史

- 新增后端统计接口 `/api/reports/history/stats`，可返回总数、成功数、失败数、测试汇报数、小时汇报数、日报数。
- 前端支持结果筛选、关键词搜索、导出、批量删除、分页和本地视图偏好保留。
- 切换账号时的重复刷新已去掉，减少无效请求和闪动。

### 2.3 UI 配置持久化

- `theme / loginBackground / overlayOpacity / blur / colorTheme / performanceMode / timestamp` 已统一进入 `normalizeUIConfig()` 做后端归一化。
- `auto` 主题现已允许在服务端落库与回读，多端同步时不会再被强制改写成 `dark`。

## 3. 已发现的问题、影响与处理

### 3.1 `/api/announcement` 被全局鉴权误拦

- 现象：代码注释写明“无需认证，公开接口”，但真实访问返回 `401 Unauthorized`。
- 影响：登录页/公开区域无法直接读取公告；线上排查时也必须借管理员态绕过。
- 处理：已将 `/announcement` 加入 `PUBLIC_PATHS`。

### 3.2 `auto` 主题在服务端持久化时失真

- 现象：前端可以切到“自动跟随”，但服务端规范化逻辑只接受 `light` / `dark`，导致回读时被压回深色。
- 影响：多端或刷新后，管理员设置的自动模式会丢失。
- 处理：已更新 `normalizeUIConfig()` 与 `setUITheme()`，允许 `auto` 持久化。

### 3.3 经营汇报历史在切账号时重复拉取

- 现象：`currentAccountId` 变化时，`loadData()` 会刷新一次汇报历史，同时筛选 watcher 也会再次刷新。
- 影响：每次切换账号都会多打一轮 `/api/reports/history` 和 `/api/reports/history/stats`，增加噪声和潜在闪动。
- 处理：已将筛选 watcher 改为只监听筛选项，不再监听 `currentAccountId`。

### 3.4 `Update.log` 对人工排版过于敏感

- 现象：若两个公告块之间缺少空行，旧解析器会把相邻条目合并，导致同步少条目。
- 影响：公告数据库会遗漏版本记录，前台展示顺序和数量都可能异常。
- 处理：
  - 已补齐当前 `Update.log` 中的缺失分隔。
  - 已将解析逻辑改为按日期标题行切段。

### 3.5 登录背景编辑器脚本阻断构建

- 现象：登录背景预览相关方法尚未完全接入模板，但脚本已存在，`vue-tsc` 将其判定为未使用。
- 影响：前端构建失败，影响打包与部署。
- 处理：已采用最小保留方式让这组逻辑继续存在但不阻塞编译，未改业务行为。

## 4. 当前残余风险

- 公告同步目前仍以“标题 + 版本”或“标题 + 日期”去重。若未来同一天发布同标题但正文不同的补充公告，可能仍需更稳定的指纹去重策略。
- `Update.log` 现在虽然更稳健，但仍属于人工维护文本。若后续公告频率继续上升，建议引入脚本化校验或直接从结构化源生成。
- 设置页经营汇报统计当前是“基于当前筛选结果集”的统计口径。如果后续想显示“全量汇报总览”，需要和当前筛选统计拆成两套接口。

## 5. 下一步优化建议

- 为 `parseUpdateLog()` 增加单元测试，覆盖“缺失空行”“同一天多条公告”“无版本号条目”等情况。
- 为公告同步增加稳定哈希去重键，例如 `date + title + content hash`，避免只靠标题和版本。
- 为经营汇报历史请求增加取消前一请求的能力，防止快速切换筛选时旧响应覆盖新状态。
- 若后续准备再次上线服务器版本，建议把本轮 3 个代码修复一并发布：公开公告读取、`auto` 主题持久化、汇报历史去重拉取。

## 6. 本轮验证

- `node -c core/src/controllers/admin.js`
- `node -c core/src/models/store.js`
- `pnpm -C web exec vue-tsc -b`
- `pnpm -C web build`

## 7. 本轮补充优化（登录背景 / 汇报统计 / 精细出售）

### 7.1 已纳入的新增功能

- 登录页背景新增了内置预设、本地上传、遮罩透明度、模糊度四项能力。
- 主界面现在可以按 `backgroundScope` 继承同一张背景，并单独配置业务页的遮罩强度与模糊度。
- 主题抽屉支持一键套用匹配的主题背景预设，颜色主题和氛围背景能同时切换。
- 经营汇报历史新增统计卡片、排序、视图偏好记忆以及“最新失败”快捷入口。
- 背包出售链路由“按合并显示项出售”升级为“按原始背包条目和 UID 拆分出售”。
- 启动账号时，数据库中的完整账号记录现在会覆盖列表缓存，避免新登录态被旧快照回填。

### 7.2 已确认的发布风险

- `core/src/cluster/worker-client.js` 使用了 `socket.io-client`，但之前 `core/package.json` 没声明该运行时依赖。
- 影响：Docker / 二进制发布在集群 Worker 场景下，存在运行时缺模块风险。
- 处理：本轮已补到 `core/package.json`。
- 补充确认：本地执行 `pnpm install` 刷新 workspace 依赖后，`pnpm -C core build:release` 已无该项 `pkg` 警告。

### 7.3 当前影响判断

- 登录背景上传能力会把文件落到 `data/ui-backgrounds/`，目前没有自动清理旧背景文件的机制。
- 外链背景预设仍依赖第三方图床可访问性，若远端防盗链或失效，预设图可能无法显示。
- 本轮已发现并补齐樱花与赛博主题缺失的内置 SVG 资源，否则主题抽屉的一键背景功能会出现静态资源 404。
- 汇报历史统计当前是“基于当前筛选结果”的统计，不是全量总览，这一点需要在后续文案和接口设计上继续保持清晰。

### 7.4 建议

- 为登录背景上传增加“删除旧自定义背景”或“定期清理未引用文件”的机制，避免 `data/ui-backgrounds/` 长期膨胀。
- 将外链背景预设逐步替换为本地托管资源，减少第三方图片站的可用性波动。
- 若后续继续扩充经营汇报分析，建议增加“全量统计”和“当前筛选统计”两套独立口径，避免用户误解。

## 8. 本轮热修补丁（前端 lint / CI）

- GitHub `main` 分支本轮首次推送后，失败点已定位在 `pnpm -C web lint`，不是前端构建或后端打包。
- 处理方式：对 `Settings.vue` 的主题联动卡片绑定、`ui-appearance.ts` 的类型声明、若干 Vue 文件的 UnoCSS/样式顺序做了最小规范收口。
- 结果：`pnpm -C web lint`、`pnpm -C web build`、`pnpm -C core build:release` 已重新通过。
- 结论：本轮新增功能链路本身可用，`v4.5.10` 主要是把远端 CI 与当前前端规范基线重新对齐。

## 9. 二次复查补充（2026-03-08 23:10）

### 9.1 新确认的问题

- **主题整套联动在重构后参数不完整**:
  `getThemeAppearanceConfig()` 一度只返回登录页背景与登录页遮罩/模糊参数，导致“5 套主题联动方案”和“主题锁定背景”在切换主题后，主界面遮罩/模糊参数并不会一起更新。
- **主界面视觉预设处于半接入状态**:
  `workspaceVisualPreset`、`UI_WORKSPACE_VISUAL_PRESETS` 和对应的服务端持久化都已经接入，但设置页没有实际入口，只能靠临时绑定数组避免 lint 报未使用。

### 9.2 影响判断与处理

- **用户感知层面**:
  主题卡片文案宣称会同步“主界面参数”，但实际行为只改登录页，属于明确的功能感知不一致。
- **维护层面**:
  主界面视觉预设在代码层存在、在界面层缺席，后续很容易被误判成“功能已上线”，增加复查和交接成本。
- **当前处理**:
  - 已恢复主题整套联动的主界面参数同步。
  - 已在设置页补上主界面视觉预设可视化卡片。
  - 已删除仅用于规避 lint 的占位绑定，改为真实模板接入。

### 9.3 目前剩余风险与建议

- **主题联动范围回退已补正**:
  原本在开启“主题锁定背景”后从右侧抽屉切主题，或直接点击抽屉中的“套用主题背景”，会把已保存的 `global` 背景范围默认写回 `login_and_app`。现已改为保留用户当前作用范围，仅在非全局模式下继续套用“登录页 + 主界面”主题联动。
- **主题联动混合态提示已补正**:
  实测联调发现，`workspaceVisualPreset` 会保留上一次手动选择的业务页风格，而“主题锁定背景”会单独注入当前主题的主界面遮罩/模糊参数，导致设置页顶部一度误显示为某个预设。现已改为按真实组合识别，混合态统一显示为“主题联动自定义”，避免把“海报沉浸版 / 控制台弱化版”等名称误当成当前实际参数。
- **整套主题已补齐业务页风格写入**:
  当前已为 5 套主题明确补上业务页风格映射，并把 `workspaceVisualPreset` 一并纳入主题联动保存链路。实测 `Ocean` 整套在开启 `themeBackgroundLinked` 且作用范围为 `global` 时，保存后服务端返回值已同步为 `workspaceVisualPreset: pure_glass`，不再残留旧的手动预设值。
- **地块类道具多选已补正**:
  背包详情里像浇水、除草、除虫、播种这类带 `land_ids` 的使用操作，原先允许选中的地块数超过当前物品库存，前端又会把 `count` 截断成库存上限，形成“文案显示按已选地块数消耗，但请求实际只带较小 count”的不一致。现已改为在 UI 侧按库存数量限制可选地块，并在使用成功后立即刷新土地列表状态。
- **兼容 UseRequest 的 fallback 分支已补写 land_ids**:
  `warehouse.useItem()` 在遇到旧接口编码兼容分支时，原先只写了 `{ item: { id, count } }`，没有继续携带 `land_ids`。这会让土地类道具在特殊兼容路径下失去目标地块参数。现已在 fallback 请求中补齐 repeated `land_ids` 字段。
- **后续建议**:
  建议补一条最小化的 `bag/use` 集成校验，至少覆盖“土地类道具 + `land_ids` + fallback 编码”的请求体构造。当前 `lint` / `build` / `node --check` 能兜住语法和构建，但仍无法替代真实协议层回归。
- **外链字体告警**:
  已处理。`web/uno.config.ts` 已移除 Google Fonts 在线拉取，改为本地字体栈，`pnpm -C web build` 不再出现此前的 Web Fonts 拉取失败告警。
- **背景与图标缓存增长**:
  已处理。服务端已新增未引用背景和过期生成图标缓存的清理逻辑，风险从“无清理机制”降为“后续按实际容量观察阈值是否需要再调优”。
- **背景预设可用性**:
  已处理当前已知外链项。示例背景 `sample-red-horse` 已改为本地 SVG 资源，当前登录背景预设已不再依赖第三方图片站。

### 9.4 补充验证

- `node --check core/src/config/gameConfig.js`
- `node --check core/src/controllers/admin.js`
- `node --check core/src/models/store.js`
- `node --check core/src/services/ui-assets.js`
- `node --check core/src/services/mall.js`
- `pnpm test:ui-assets`
- `pnpm -C web check:ui-appearance`
- `pnpm -C web lint`
- `pnpm -C web build`
- `pnpm -C core build:release`

## 10. 建议执行结果（2026-03-08 23:35）

### 10.1 已执行项

- **自动清理未引用背景文件**:
  已新增 `core/src/services/ui-assets.js`，在服务端启动、保存主题配置、上传新背景时都会清理过期且未引用的 `ui-backgrounds` 文件。
- **自动清理过期生成图标缓存**:
  `gameConfig` 加载时会清理过期或无效的 `data/asset-cache/item-icons` 生成 SVG 缓存，避免长期累积。
- **主题联动最小自动校验**:
  已新增 `web/scripts/check-ui-appearance.mjs`，会校验主题背景配置是否同时包含登录页和主界面参数。
- **本地化字体与示例背景**:
  已移除 UnoCSS 的在线字体拉取，并把示例酒红背景改为仓库内置 `crimson-velvet.svg`。

### 10.2 补充验证

- `pnpm test:ui-assets`
- `pnpm -C web check:ui-appearance`
- `pnpm -C web lint`
- `pnpm -C web build`
- `pnpm -C core build:release`

## 11. 补充复查（2026-03-09）

### 11.1 本轮新增确认

- **SMTP 邮件汇报已全链路接入**:
  `reportConfig.channel` 新增 `email`，设置页已可维护 `smtpHost / smtpPort / smtpSecure / smtpUser / smtpPass / emailFrom / emailTo`，服务端归一化、配置校验、汇报可用性判断和推送下发链路已保持一致。
- **账号保存后立即持久化**:
  管理端保存账号成功后会直接调用 `persistAccountsNow()`，减少扫码登录成功后尚未等到批量落库就异常退出的风险。
- **好友拉取兼容模式改为按账号缓存**:
  `SyncAll / GetAll` 的探测结果现在以账号维度缓存，不再一个账号切到兼容模式后影响整台机器所有账号。
- **好友日志噪声已压低**:
  好友列表调试日志和周期状态日志增加 TTL 去重，长时间挂机时更容易看见真正的新异常。
- **背包使用链路继续补正**:
  `worker` 已补齐 `useBagItem` 调用面，土地类道具在旧编码 fallback 分支也会继续携带 `land_ids`。

### 11.2 本轮验证

- `git diff --check`
- `node --check core/src/services/smtp-mailer.js`
- `node --check core/src/services/push.js`
- `node --check core/src/services/report-service.js`
- `node --check core/src/config-validator.js`

## 12. 二次复查续记（2026-03-09）

### 12.1 本轮纳入记录的新增调整

- 部署脚本已补齐“显式传入 `ADMIN_PASSWORD` 即同步数据库 admin 哈希”的落库动作，不再只修改 `.env`。
- `update-app.sh` 已补齐从当前 shell 环境回写 `ADMIN_PASSWORD / WEB_PORT` 等变量到部署目录 `.env` 的逻辑，修复更新场景下参数被忽略的问题。
- 账号模式相关元信息已进入运行态账号快照，账号列表和账号归属页可以直接展示 `accountMode / harvestDelay / accountZone`。
- SMTP 邮件汇报链路已经形成“设置页表单 → 服务端归一化 → 发送器 → 推送总线”的完整闭环。

### 12.2 本轮新发现的问题

#### 12.2.1 重启广播仍是单次触发、失败后不补发

- 代码位置：`core/src/services/report-service.js`
- 现状：`sendRestartBroadcast()` 在首次进入时立即把 `restartBroadcastTriggered` 置为 `true`，后续即使推送失败、SMTP 暂时不可用或外部 webhook 短时超时，也不会在当前进程生命周期内再次尝试。
- 风险：如果容器刚拉起时外部依赖还没完全就绪，服务器重启提醒会直接丢失，且不会自动补发。
- 影响：管理员会误以为“服务没有重启广播能力”或“消息链路完全中断”，增加定位成本。

#### 12.2.2 `modeScope` 目前仍未进入真实运行时决策

- 代码位置：
  - 设置说明与展示：`web/src/views/Settings.vue`
  - 存储与接口：`core/src/models/store.js`、`core/src/controllers/admin.js`、`core/src/runtime/data-provider.js`
  - 运行时消费：当前好友/农场逻辑主要仍只读取 `accountMode`
- 现状：`zoneScope / requiresGameFriend / fallbackBehavior` 已进入持久化和返回值，也已经出现在设置页风险说明里。
- 风险：界面宣称“当前账号区服”“必须互为游戏好友”“否则按独立账号降级”，但运行时没有看到对应约束真正参与好友巡查或农场调度判定。
- 影响：用户会误以为系统已经具备“按区服 / 游戏好友自动降级”的真实行为约束，形成配置预期与运行结果不一致。

#### 12.2.3 设置保存链路仍可能出现“部分成功、整体报错”

- 代码位置：
  - 前端：`web/src/stores/setting.ts`
  - 后端：`core/src/controllers/admin.js`
- 现状：保存设置时，前端先调用 `/api/accounts/:id/mode`，随后再调用 `/api/settings/save`。
- 风险：如果第二步校验失败、网络超时或后端抛错，模式切换和同区其他主号的降级可能已经落库，但前端会把本次操作整体视为失败。
- 影响：用户在界面上收到“保存失败”提示后再次重试，容易触发重复广播、重复写库和误判当前真实状态。

### 12.3 当前建议

- 为服务器重启提醒增加一次延迟重试，并在账号日志或内存态中保留幂等键，避免既丢消息又重复轰炸。
- 若近期还不会把 `modeScope` 接入好友扫描和农场策略层，建议先降低设置页文案承诺，避免把“数据模型已建好”误传达成“行为已经生效”。
- 将账号模式切换并入统一的 `/api/settings/save` 提交链路，或至少只在账号模式发生实际变化时才单独调用 `/api/accounts/:id/mode`。

### 12.4 本轮验证

- `node --check core/src/services/report-service.js`
- `node --check core/src/models/store.js`
- `node --check core/src/controllers/admin.js`
- `node --check core/src/runtime/data-provider.js`
- `node --check core/src/services/farm.js`
- `bash -n scripts/deploy/fresh-install.sh`
- `bash -n scripts/deploy/update-app.sh`
- `node --test core/__tests__/store-account-mode.test.js core/__tests__/store-trial-config.test.js`

### 12.5 延伸建议

- `smtp-mailer` 采用的是手写 SMTP 协议实现，当前适合纯文本经营汇报；如果后面要支持更复杂的 HTML 模板、附件或更复杂的认证兼容，建议补集成测试并考虑是否引入成熟邮件库。
- 好友拉取模式虽然已按账号缓存，但仍建议在 QQ / 微信混跑环境各做一次实机回归，确认探测结论不会受平台风控瞬时波动误导。
- 背包土地类道具的 `land_ids` fallback 已补齐，但这类问题更偏协议兼容，后续最好补一条最小集成回归，而不是只依赖构建和静态检查。

### 12.6 已执行修复（2026-03-09）

- **设置保存链路已统一**:
  设置页保存时已取消额外的 `/api/accounts/:id/mode` 前置调用，账号模式切换、主号唯一化和普通设置保存现在统一走 `/api/settings/save` 后端链路处理。
- **邮件重启广播已补齐 `smtpUser` 区分**:
  `buildReportChannelSignature()` 现已把 SMTP 登录账号纳入 `email` 渠道分组键，降低“同发件人别名、同收件箱、不同认证账号”时的配置串用风险。
- **新增后端回归测试**:
  已新增统一保存链路和重启广播分组逻辑的 2 条测试，避免后续重构再次引入相同回归。

### 12.7 本轮后仍未完成的事项

- **`modeScope` 仍未真正接入运行时**:
  本轮修复的是“保存一致性”和“广播分组”问题，`zoneScope / requiresGameFriend / fallbackBehavior` 仍主要停留在存储与展示层，后续还需要进入好友/农场决策代码。

### 12.6 补充修复与再验证（2026-03-09）

#### 12.6.1 本轮新增确认与已修复项

- **农场补种死循环已补闭环**:
  复查近期补种链路时，确认 `PlantService.Plant code=1001008` 会把“已种植”地块持续打回失败日志，而旧逻辑仍会按误判空地继续“选种 -> 购种 -> 种植”。现已补三层收口：
  - `resolveLandLifecycle()` 不再把“`plant` 存在但阶段数据缺失”的土地直接算成空地。
  - `autoPlantEmptyLands()` 在购种前会再次拉取土地状态，只对复核后仍为空地的目标地块购买。
  - 对明确返回“土地已种植”的地块增加短期冷却，并按真实 `plantedLandIds` 记账，不再把 `0` 成功种植也记成 `种植3`。
- **服务器重启提醒的渠道分组签名已补正**:
  复查 `report-service` 时发现，重启广播按渠道聚合时，`webhook` 只使用 `endpoint` 做签名，`email` 也未纳入端口/TLS/认证账号维度。若两组账号共用同一 webhook 地址但 token 不同，或同主机不同端口/加密策略，会被错误合并到同一推送批次。现已把 `token / smtpPort / smtpSecure / smtpUser` 纳入签名。
- **设置页保存的账号模式副作用已压低**:
  之前 `saveSettings()` 每次保存都会额外打一遍 `/api/accounts/:id/mode`，即使账号模式根本没变，也会重复触发主号唯一性检查和 worker 配置广播。现已改为仅在 `accountMode` 真实变化时才调用模式切换接口。
- **新增 store 用例已补齐 MySQL 初始化 mock**:
  `store.js` 新增 `isMysqlInitialized()` 依赖后，两条新增单测需要同步 mock。现已补齐，避免测试环境在模块加载阶段因缺少该导出而直接中断。

#### 12.6.2 本轮影响判断

- **对农场自动化的影响**:
  当前影响主要集中在“误判空地导致反复买种子”的资源浪费和日志噪声。补丁落地后，预期日志会从连续的“购买种子 + 1001008 失败”切换为“种植前复核跳过”或“冷却期内跳过复种”。
- **对经营汇报的影响**:
  若不修正广播签名，服务器重启提醒在多账号、多渠道并行时存在串组风险，最坏情况下会把某一账号组的通知发到另一组 webhook/token 上，造成错误告警或漏告警。
- **对设置保存的影响**:
  重复触发 `/mode` 不会直接破坏配置，但会制造一次无意义的模式重放、额外的账号降级检查和 worker 广播；在多账号面板里会放大为不必要的运行态抖动。

#### 12.6.3 当前仍建议关注

- `smtp-mailer` 现阶段仍以文本邮件为主，建议后续补一条真实 SMTP 集成回归，至少覆盖 `465 SSL` 和 `587 STARTTLS` 两种最常见配置。

#### 12.6.4 本轮补充验证

- `git diff --check`
- `node --check core/src/models/store.js`
- `node --check core/src/services/report-service.js`
- `node --check core/src/services/farm.js`
- `pnpm -C web exec vue-tsc --noEmit`
- `node --test core/__tests__/store-account-mode.test.js core/__tests__/store-trial-config.test.js`

#### 12.6.5 建议项已实施落地（2026-03-09）

- **服务器重启提醒已补重试与幂等批次**:
  `sendRestartBroadcast()` 现已引入启动批次号、渠道级状态表和单任务名重试。首次发送失败后会延迟重试 1 次，且只有成功送达才会标记 `delivered`；同一批次下重复触发不会再次轰炸已成功渠道。
- **重启提醒失败路径已避免状态卡死**:
  发送异常、账号日志写入异常和调度回调现在已拆开处理，即使单个账号日志写失败，也不会把该渠道永久卡在 `inFlight`。
- **AI 服务 `cwd` 已收口到项目根 / 白名单**:
  `aiStatus` 控制器、`ai-autostart.js` 和 `ai-services-daemon.js` 现在统一走 `ai-workspace.js` 解析目录。默认仅允许当前项目根；若需多工作区，必须通过 `AI_SERVICE_ALLOWED_CWDS` 显式放行。
- **新增回归测试已覆盖关键闭环**:
  新增 `report-service-restart-broadcast.test.js`，验证“首发失败 -> 定时重试 -> 成功后不重复发送”；新增 `ai-workspace.test.js`，验证“默认拒绝任意目录 / 白名单允许额外工作区”。

#### 12.6.6 `modeScope` 运行时已正式接入（2026-03-09）

- **新增统一运行时解析器**:
  `core/src/services/account-mode-policy.js` 现会基于当前账号配置、同 owner 对端账号、区服和最近一次好友快照，统一解析 `effectiveMode / collaborationEnabled / degradeReason`。
- **好友巡查已消费 `effectiveMode`**:
  好友模块不再只盯着 `accountMode`。当 `fallbackBehavior=strict_block` 且未命中“同区 + 游戏好友”条件时，会临时按更保守模式执行，主动阻断偷菜与捣乱等高风险动作。
- **农场策略已消费 `effectiveMode`**:
  收获延迟、防偷 60 秒抢收和秒收前置判断已统一切到运行时有效模式；同时顺手修正了两处旧偏差：
  - `safe` 预设虽然配置了 `harvestDelay`，但旧逻辑只对 `alt` 生效，实际并不会延迟收获。
  - `antiStealHarvest()` 旧代码误读 `config.mode`，会让模式阻断判断失真。
- **运行态状态已补充模式结果**:
  Worker 状态和账号列表现在已能带回 `effectiveMode / collaborationEnabled / degradeReason`，并已在账号列表显式展示。
- **冷启动好友关系已补缓存预热**:
  Worker 登录成功后会优先读取最近一次 Redis 好友缓存并预热运行时快照，尽量缩短 `requiresGameFriend` 在冷启动阶段的未知窗口。
- **前端账号列表已补显式提示**:
  账号页现在会同时显示“配置模式”“当前生效模式”“独立执行/协同命中状态”，用户不再需要翻日志判断是否已经发生降级。

#### 12.6.7 本轮新增影响判断

- **对默认用户配置的影响**:
  默认 `fallbackBehavior=standalone` 下，本轮不会突然改变既有主号/小号的常规行为，主要新增的是“运行时真实判定”和“可观测的降级原因”。
- **对显式开启 `strict_block` 的影响**:
  这类账号在未命中同区/游戏好友条件时，现在会真实降到更保守模式；这是本轮最主要的行为变化，属于按配置兑现约束，不是兼容性回归。
- **对风险控制的正向影响**:
  `safe` 模式的收获延迟终于实际生效，且防偷抢收不会再因为读取错字段而越过模式约束。

#### 12.6.8 当前仍建议继续优化

- **好友关系判断仍依赖最近一次好友快照**:
  冷启动、网络抖动或好友列表暂时拉取失败时，会出现 `friend_relation_unknown` 窗口；若用户同时启用了 `strict_block`，账号会先按保守模式运行，等好友快照建立后再恢复/确认。
- **建议补冷启动预热**:
  后续可以考虑在 Worker 启动时预读 Redis / DB 中的好友缓存，把 `requiresGameFriend` 的首轮判断从“纯实时探测”升级为“缓存预热 + 实时刷新”。
- **建议把有效模式直接展示到前端**:
  后端数据已经齐全，下一步最值得做的是把 `effectiveMode / degradeReason` 直接显示在账号列表或设置页，降低排查成本。

#### 12.6.9 本轮补充验证

- `node --check core/src/services/account-mode-policy.js`
- `node --check core/src/services/friend/friend-scanner.js`
- `node --check core/src/services/farm.js`
- `node --check core/src/core/worker.js`
- `node --check core/src/runtime/data-provider.js`
- `node --check core/src/runtime/runtime-state.js`
- `node --test core/__tests__/account-mode-policy.test.js`
- `node --test core/__tests__/store-account-mode.test.js core/__tests__/data-provider-save-settings.test.js core/__tests__/report-service-restart-broadcast.test.js core/__tests__/store-trial-config.test.js`
- `git diff --check`

#### 12.6.10 前端运行态可视化已补齐（2026-03-09）

- **设置页已直接显示当前运行态判定**:
  `web/src/views/Settings.vue` 现会同时展示“配置模式 / 当前生效模式 / 协同命中或独立执行状态 / 降级原因”。用户不再需要切到账号列表或翻日志，切换账号后即可直接看到当前运行时是否按协同模式生效。
- **账号归属页已补模式运行态信息**:
  `web/src/views/AccountOwnership.vue` 的模式列现在不再只显示静态 `accountMode`，而会继续补出“生效模式”或“独立执行原因”，管理员在排查同 owner 账号是否真正命中协同时更直观。
- **账号管理页的表格排序状态已恢复持久化闭环**:
  `Accounts.vue` 初始化时会恢复本地保存的表格排序状态，并在用户切换排序后自动回写存储；这同时把之前遗留的 `readTableSortState / persistTableSortState / applyQueryState` 未接入问题一起收口了。

#### 12.6.11 本轮额外发现并处理的前端构建阻塞

- **`Settings.vue` 的设置对象读取需要显式宽化类型**:
  `useSettingStore()` 当前导出的 `settings` 类型仍偏向“全局设置”字段，不完全覆盖账号维度字段；本轮已改为在账号设置拼装函数内显式走 `any` 读取，保证运行时字段访问不阻塞 `vue-tsc`。
- **`Accounts.vue` 之前存在“半接入导致构建失败”的代码路径**:
  表格排序恢复、URL 查询恢复和批量结果提示这组函数原先存在接线不完整的问题；本轮已恢复初始化链路并保留批量操作提示与复制筛选链接入口，避免再触发 `TS6133`/`TS2304`。
- **`core/src/models/store.js` 有一处尾随空格会阻塞 `git diff --check`**:
  本轮已顺手清掉，避免后续继续影响发布前自检。

#### 12.6.12 本轮追加验证

- `pnpm -C web exec vue-tsc --noEmit`
- `pnpm -C web build`
- `git diff --check`

### 12.6.10 OpenViking 本地开发链路补充修正（2026-03-09）

#### 12.6.10.1 本轮新增修正

- **OpenViking 默认端口已统一改为 `5432`**:
  `aiStatus`、AI 守护脚本、上下文客户端、OpenViking Python 服务和相关测试/示例环境文件已统一切到 `http://localhost:5432`，避免继续与 macOS 自带 AirTunes 常见占用端口 `5000` 冲突。
- **根目录 AI 脚本已移除对 `axios` 的隐式依赖**:
  复测本地 AI 守护链路时发现，`scripts/service/ai-services-daemon.js` 与 `services/openviking/client.js` 在仓库根目录直接运行时会因找不到 `axios` 立即退出。现已改为使用 Node 内置 `fetch`，减少额外安装要求，也避免守护进程“刚拉起就秒退”的假启动。
- **运行配置已同步收口**:
  项目根 `.env`、`core/.env.ai`、`services/openviking/.env` 与 `.env.example` 已同步到 `5432`，避免默认值、模板文件和实际本地运行参数各说各话。

#### 12.6.10.2 本轮影响判断

- **对本地 AI 开发环境的影响**:
  重启本地 AI 守护或 OpenViking 后，健康检查和上下文客户端将默认改走 `5432`。如果用户机器上恰好有 PostgreSQL 占用该端口，则需要手动再改成其他未占用端口。
- **对主程序业务链路的影响**:
  这次调整仅作用于本地 OpenViking / AI 开发辅助链路，不影响农场调度、经营汇报和账号运行时逻辑。

#### 12.6.10.3 本轮补充验证

- `node --check core/src/controllers/aiStatus.js`
- `node --check scripts/service/ai-services-daemon.js`
- `node --check core/src/services/contextManager.js`
- `node --check services/openviking/client.js`
- `python3 -m py_compile services/openviking/app.py`

### 12.6.11 OpenViking 守护链路补充收口（2026-03-09）

#### 12.6.11.1 本轮新增修正

- **守护进程会先识别并接管已健康的 `5432` 实例**:
  `ai-services-daemon.js` 启动前会先做健康检查，若端口上已经有可用 OpenViking，则不再重复拉起第二个 Python 进程，避免“已有实例存活，但守护继续撞端口”的假启动。
- **启动成功判定改为“进程存活 + 健康就绪”**:
  原先固定等待后只要健康接口能通就记为成功，容易把旧实例的健康状态误当成新子进程成功。现在改为轮询子进程本身的退出状态，若提前退出会直接判定失败并回收。
- **状态输出补齐“外部实例”和“端口占用但不健康”两类场景**:
  `ai-autostart status` 与 `/api/ai/status` 新增端口占用识别，能区分“守护未运行但服务仍在外部运行”和“端口残留监听但健康检查失败”，减少排查歧义。
- **守护进程退出时会主动清理自己的 PID 文件**:
  `ai-services-daemon.js` 现在会在启动时覆盖写入 `logs/ai-daemon.pid`，并在退出时仅删除属于自身 PID 的文件，减少 stale pid 导致的误报。
- **新增 `doctor` 诊断入口**:
  `node scripts/service/ai-autostart.js doctor --cwd .` 会汇总守护状态、PID 文件、`5432/8080` 监听进程和最近日志，方便本地 AI 开发链路排查残留实例。
- **运行状态新增统一模式标识**:
  `status`、`doctor` 和 `/api/ai/status` 现在统一输出 `managed / managed_starting / external / conflict / offline` 模式，减少“同一现场不同地方显示不同结论”的情况。

#### 12.6.11.2 运行态发现

- **当前机器仍有历史残留实例占用 `5432`**:
  复测时 `lsof -nP -iTCP:5432 -sTCP:LISTEN` 仍能看到旧的 `services/openviking` Python 进程占口，但当前沙箱中的 `curl/fetch` 无法直接探活它，说明本次代码修正之外，还需要人工清理旧残留实例后才能得到完全干净的启停验证结果。
- **`8080` 的 AGFS 也曾出现残留占用**:
  启动日志里出现过 `AGFS port 8080 is already in use`。这类残留会让守护进程在 OpenViking 主进程尚未绑定 `5432` 前就提前失败，需要一起检查。

#### 12.6.11.3 本轮补充验证

- `node --check scripts/service/ai-services-daemon.js`
- `node --check scripts/service/ai-autostart.js`
- `node --check core/src/controllers/aiStatus.js`
- `node --test core/__tests__/ai-autostart-status.test.js`
- `git diff --check`

### 12.7 访客面板专用链路迁移复盘（2026-03-09）

#### 12.7.1 本轮已落地项

- **后端专用协议与服务已接入**:
  新增 `core/src/proto/interactpb.proto`、`core/src/services/interact.js`，支持多 RPC 候选调用并统一标准化访客记录输出字段。
- **管理端接口已补齐**:
  新增 `GET /api/interact-records`（`limit` 1~200），复用账号所有权校验，返回结构与现有接口风格一致（`{ok,data,error}`）。
- **Worker / DataProvider 调用面贯通**:
  `core/src/core/worker.js` 与 `core/src/runtime/data-provider.js` 均新增 `getInteractRecords`，专用链路可通过现有账号管道触发。
- **前端访客面板升级**:
  `web/src/components/VisitorPanel.vue` 改为“专用接口优先 + 日志降级”，并补齐动作筛选、头像、等级、相对时间展示。
- **错误可用性提示细分**:
  后端按 `INTERACT_PROTO_MISSING / INTERACT_TIMEOUT / INTERACT_AUTH / INTERACT_RPC_UNAVAILABLE` 分类；前端 `web/src/stores/friend.ts` 映射为用户友好文案。
- **可观测性增强**:
  访客面板新增“数据源标签（专用接口/日志降级）”与“最近刷新时间”。

#### 12.7.2 风险与影响判断

- **对主流程影响**:
  本轮改动未进入农场巡查、好友巡查核心调度路径，主要作用于“访客信息展示链路”，对核心挂机行为影响可控。
- **对兼容性影响**:
  当游戏侧不支持该 RPC 时会自动降级日志视图，不会导致页面硬失败。
- **对运维排查的正向影响**:
  通过数据源标签和错误分类，排查“协议不支持/网络超时/权限问题”更直接。

#### 12.7.3 本轮发现的问题

- **账号切换存在请求竞态风险**:
  在快速切换账号场景下，旧账号请求可能后返回并覆盖新账号 `interactRecords`，造成短时错数据展示。
- **无账号态残留风险**:
  当账号为空时，当前实现会直接 return，未主动清空访客状态，可能短时间保留上一个账号数据。

#### 12.7.4 建议（下一步）

- **加请求幂等戳 / 账号快照校验**:
  在 `fetchInteractRecords` 返回前校验“响应对应账号是否仍是当前账号”，不匹配则丢弃。
- **账号为空时显式清空访客状态**:
  将 `interactRecords/interactError/interactLoading` 归零，防止 UI 残留。
- **补竞态回归用例**:
  增加“快速切号 + 慢响应覆盖”场景的最小测试，防止后续回归。

#### 12.7.6 追加修复（2026-03-09）

- **访客请求竞态已修复**:
  `web/src/stores/friend.ts` 已加入请求序号门闩（`interactRequestSeq`），仅最后一次请求可以写入状态，避免旧账号慢响应覆盖新账号数据。
- **无账号残留已修复**:
  新增 `clearInteractState()`，在空账号或切空账号场景主动清空访客列表、错误状态和加载态，消除残留展示问题。
- **面板本地状态已联动清空**:
  `web/src/components/VisitorPanel.vue` 在空账号场景会同步清理头像错误缓存与刷新时间，保证 UI 与数据状态一致。

#### 12.7.7 追加优化（2026-03-09）

- **接口错误分类改为结构化返回**:
  `GET /api/interact-records` 现在会在 `INTERACT_*` 场景返回 `errorCode`，前端不再依赖纯文案识别错误类型。
- **Worker 到主进程错误信息补齐 `code`**:
  `core/src/core/worker.js` 与 `core/src/runtime/worker-manager.js` 已支持错误对象透传，避免错误码在进程通信中丢失。
- **前端错误提示映射稳定性提升**:
  `web/src/stores/friend.ts` 已改为“错误码优先 + 文案兜底”，即使后端错误文案未来调整，也不会轻易误判提示类型。
- **开发过程中的文件完整性风险已处理**:
  本轮曾出现挂载盘导致的 NUL 字节污染（`worker.js`、`admin.js`），已清理并通过语法复检。

#### 12.7.5 本轮验证记录

- `node --check core/src/services/interact.js`
- `node --check core/src/utils/proto.js`
- `node --check core/src/core/worker.js`
- `node --check core/src/runtime/data-provider.js`
- `node --check core/src/controllers/admin.js`
- `pnpm -C web exec vue-tsc -b`（未执行，环境缺少 `pnpm`）
- `pnpm -C web lint`（未执行，环境缺少 `pnpm`）

### 12.8 MySQL 设置持久化收口复查（2026-03-09）

#### 12.8.1 本轮新增调整

- `store.js` 新增 `flushGlobalConfigSave()`，会主动排空全局配置的 3 秒防抖队列并等待 MySQL 写入完成。
- `data-provider.js` 的 `saveSettings / setAutomation / setUITheme` 现在会在接口返回或 revision 广播前等待全局配置真实落库。
- `web/src/stores/setting.ts` 已把 `automation` 合并进 `/api/settings/save`，不再拆第二次 `/api/automation` 请求。
- `core/__tests__/store-system-settings.test.js` 与 `store-trial-config.test.js` 已改为直接校验 `flush` 落库语义，不再依赖固定等待 3.2 秒。
- `web/vite.config.ts` 与 `core/src/utils/web-dist.js` 已补“静态产物目录自动回退”：默认 `web/dist` 不可写时，构建会转写 `web/dist-runtime`，服务端也会优先读取该回退目录。
- `web/src/views/Analytics.vue` 已修正 `aria-expanded` 的字符串绑定，避免 `vue-tsc` 在正式构建阶段被类型检查拦住。

#### 12.8.2 本轮确认并已修复的问题

- **设置接口存在“先返回成功、后异步写库”的持久化窗口**:
  最近全局设置主存切到 MySQL 后，旧的防抖保存机制仍保留了“3 秒后异步刷库”行为。结果是用户在保存后立刻更新容器或重启服务时，存在配置尚未进入 `system_settings` / `account_configs` 的窗口。
- **设置页仍有二段式提交带来的部分成功风险**:
  虽然账号模式已纳入 `/api/settings/save`，但前端保存仍把 `automation` 单独发到 `/api/automation`。第一段成功、第二段失败时，用户会看到“保存失败”，但部分配置其实已真实生效。

#### 12.8.3 本轮追加发现并已修复的问题

- **正式前端构建被历史 root 产物目录阻断**:
  初次复查时，`pnpm -C web build` 在覆写 `web/dist/assets/*.gz` 时触发 `EACCES`。根因是历史 `web/dist` 由 root 创建、当前用户不可写。
- **正式构建还带出一个真实类型回归**:
  在解除权限阻断后，`vue-tsc` 又发现 `Analytics.vue` 把 `aria-expanded` 绑定成了字符串而不是布尔值，导致正式构建中断。
- **当前处理**:
  已改为“默认 `dist`，不可写则自动回退到 `dist-runtime`”的策略，并修正 `Analytics.vue` 的类型绑定；因此现在正式 `pnpm -C web build` 已恢复通过。

#### 12.8.4 建议

- 在部署机或本地开发环境统一收口 `web/dist` 所有者。虽然现在有 `dist-runtime` 自动回退，但长期来看，统一构建目录权限仍然更干净。
- 后续可为 `/api/settings/save` 增加接口级回归测试，覆盖“基础设置 + automation 同次保存”的真实链路。
- 如果后面还要继续扩展 `system_settings`，建议增加一个“最近一次成功刷库时间 / revision”观测点，便于线上快速确认配置是否已真正落库。

#### 12.8.5 本轮验证

- `node -c core/src/models/store.js`
- `node -c core/src/runtime/data-provider.js`
- `node -c core/src/controllers/admin.js`
- `node -c core/src/utils/web-dist.js`
- `node --test core/__tests__/data-provider-save-settings.test.js core/__tests__/store-trial-config.test.js core/__tests__/store-system-settings.test.js core/__tests__/user-store-trial-days.test.js core/__tests__/jwt-secret-persistence.test.js core/__tests__/system-settings-health.test.js core/__tests__/web-dist.test.js`
- `pnpm -C web lint`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `pnpm -C web exec vite build --outDir dist-codex`
- `pnpm -C web build` -> 检测到 `web/dist` 不可写后自动回退到 `web/dist-runtime`，已通过

### 12.9 设置重置回查追加（2026-03-10）

#### 12.9.1 本轮确认并已修复的问题

- **前端设置保存漏项导致“保存后刷新回退”**:
  `web/src/stores/setting.ts` 之前没有把 `accountMode / harvestDelay / riskPromptEnabled / modeScope / plantingFallbackStrategy / inventoryPlanting / stakeoutSteal` 全量纳入 `fetchSettings()` 与 `saveSettings()`。结果是设置页里这些字段看起来能改，但刷新或重新进入页面后会从旧快照回填，表现为“被重置”。
- **账号级 `tradeConfig` 没有正式写进 MySQL**:
  `core/src/models/store.js` 之前写入 `account_configs.advanced_settings` 时漏掉了 `tradeConfig`，同时重载时也没有从 `advanced_settings` 回读该字段，因此进程重启后会丢。
- **旧 `/api/automation` 路由存在直接配置未刷库窗口**:
  只修改偷菜过滤、好友过滤、跳过萝卜、强制全取等“直接项”时，旧实现可能在接口返回前还没把变更刷进 MySQL。现在这条路也会在返回成功前显式等待 `flushGlobalConfigSave()`。

#### 12.9.2 新增回归验证

- 新增 `core/__tests__/store-account-settings-persistence.test.js`，覆盖账号高级设置写入 `account_configs.advanced_settings` 并在 MySQL 重载后恢复。
- 复跑 `core/__tests__/data-provider-save-settings.test.js`、`store-system-settings.test.js`、`store-trial-config.test.js`、`jwt-secret-persistence.test.js`、`system-settings-health.test.js`、`web-dist.test.js` 全部通过。
- `pnpm -C web lint` 与 `pnpm -C web exec vue-tsc -b --pretty false` 通过，说明前端设置链路补丁没有带来类型或 lint 回归。

#### 12.9.3 目前仍未进 MySQL 的设置/状态

- **普通用户个人 UI 偏好**:
  当前管理员修改的全局 UI 配置已经在 MySQL，但普通用户自己的 `theme / colorTheme / performanceMode / loginBackground / themeBackgroundLinked / siteTitle` 等仍主要留在浏览器 `localStorage`。后端 `POST /api/settings/theme` 对普通用户是静默成功、不覆写全局配置。
- **纯浏览器偏好**:
  报表历史的筛选视图、账号列表表头与排序、通知已读时间、公告关闭标记、记住用户名、当前账号 ID、分析页排序、版本提示等仍是浏览器本地状态，不属于服务端业务配置。
- **纯运行时内存态**:
  登录失败锁定计数（`security.js` 的 `LoginLockManager`）和公开体验卡接口的小时级频率限制（`admin.js` 的 `trialRateLimitMap`）仍只在进程内存里，服务重启后会清空。
- **兼容迁移源文件**:
  `core/data/store.json`、`core/data/.jwt-secret`、`core/data/trial-ip-history.json` 仍保留，但仅在对应 MySQL key 缺失时用于迁移，不再作为主存储。

#### 12.9.4 下一步建议

- 若目标是“所有用户自己的界面偏好也跟账号或用户走”，下一步最值得做的是把前端 `appStore` 的普通用户 UI 偏好迁到现有 `ui_settings` 表。
- 对于纯浏览器使用习惯类状态，可按重要性分层处理；没有业务含义的列表排序、面板折叠状态未必需要入库，但主题/UI 外观类偏好值得迁移。

### 12.10 普通用户 UI 偏好入库（2026-03-10）

#### 12.10.1 本轮新增调整

- 新增 `core/src/services/user-ui-settings.js`，把普通用户主题模式、颜色主题、背景范围、遮罩/模糊强度、工作区视觉预设、性能模式、主题联动背景等个人 UI 偏好持久化到 `ui_settings`。
- `GET /api/ui-config` 改为“匿名返回全局 UI；已登录普通用户返回 全局 UI + 个人 UI 覆盖后的结果”，登录页和已登录页面沿用同一接口，不需要改前端调用方式。
- `POST /api/settings/theme` 改为“双轨保存”：
  - 管理员继续写全局 UI 配置。
  - 普通用户改为写自己的 `ui_settings`，不再只留在浏览器 `localStorage`。
- `ui_settings` 建表模板已扩展到当前真实使用字段，并补 `user_id` 唯一索引，避免一个用户多行配置冲突。

#### 12.10.2 同步修正的界面行为

- 普通用户设置页里“站点展示设置（网站标题 / 支持QQ群 / 版权署名）”现已收回管理员可见，避免继续出现“看起来能改、实际上不该归个人”的假保存体验。
- 普通用户的自定义背景上传按钮已隐藏；个人可保存主题、预设背景与观感参数，但上传服务端静态背景仍保留为管理员能力。

#### 12.10.3 当前结论

- **已进入 MySQL 的个人 UI 偏好**:
  `theme / loginBackground / backgroundScope / loginBackgroundOverlayOpacity / loginBackgroundBlur / workspaceVisualPreset / appBackgroundOverlayOpacity / appBackgroundBlur / colorTheme / performanceMode / themeBackgroundLinked / timestamp`
- **继续保留全局的 UI 字段**:
  `siteTitle / supportQqGroup / copyrightText` 仍由管理员全局配置控制，不下沉为普通用户个人设置。
- **仍未入库的前端本地偏好**:
  报表历史筛选、账号列表列显隐/排序、通知已读、公告关闭、记住用户名、分析页排序、版本提示等浏览器习惯类状态仍保留在 `localStorage`/`sessionStorage`。

#### 12.10.4 本轮验证

- `node -c core/src/utils/ui-config.js`
- `node -c core/src/services/user-ui-settings.js`
- `node -c core/src/models/store.js`
- `node -c core/src/controllers/admin.js`
- `node --test core/__tests__/user-ui-settings.test.js core/__tests__/store-account-settings-persistence.test.js core/__tests__/data-provider-save-settings.test.js core/__tests__/store-system-settings.test.js core/__tests__/store-trial-config.test.js core/__tests__/user-store-trial-days.test.js core/__tests__/jwt-secret-persistence.test.js core/__tests__/system-settings-health.test.js core/__tests__/web-dist.test.js`
- `pnpm -C web lint`
- `pnpm -C web exec vue-tsc -b --pretty false`

### 12.11 时间设置与开关持久化复查（2026-03-10）

#### 12.11.1 本轮确认的问题

- **“保存后又重置”的第一主因不是没入库，而是被后端保护规则拒绝**：
  普通用户把农场巡查压到 `15 秒` 以下，或把好友/帮忙/偷菜巡查压到 `60 秒` 以下时，后端会拒绝保存。此前前端对这类 `400` 错误提示不够直接，用户容易误判成“保存成功但刷新重置”。
- **前端数字输入的 `min/max/step` 属性此前没有真正作用到内部 `<input>`**：
  `BaseInput.vue` 没有把原生输入属性透传，设置页里写的 `min="1"`、后续新增的保护阈值都只是挂在外层容器上，不会影响实际输入行为。
- **后端普通用户时间保护只检查了 `Min`，没检查 `Max`**：
  `farmMax / friendMax / helpMax / stealMax` 先前未纳入保护判断。由于 `store.normalizeIntervals()` 会在 `min > max` 时交换两者，理论上存在“提交时只把 `Max` 设得过低，保存后被归一化成危险 `Min`”的安全缺口。
- **账号配置快照此前不完整**：
  `store.getConfigSnapshot()` 缺少 `stakeoutSteal / forceGetAll / skipStealRadish / 偷菜过滤` 等账号级开关，虽然设置页主回读已绕过，但会给其他依赖快照的逻辑留下不一致风险。

#### 12.11.2 已完成修正

- `web/src/stores/setting.ts` 的 `saveSettings()` 现在会把后端错误统一转换成 `{ ok: false, error }` 返回，设置页可稳定展示“保存失败”的真实原因。
- `web/src/views/Settings.vue` 新增普通用户时间阈值保存前拦截；命中危险值时，不再继续打开确认保存流程，而是直接给出明确错误。
- 设置页时间输入框已按角色动态加最小值：
  - 普通用户农场巡查 `>= 15 秒`
  - 普通用户好友/帮忙/偷菜巡查 `>= 60 秒`
- `web/src/components/ui/BaseInput.vue` 已补原生属性透传，`min/max/step` 等输入约束终于对内部输入框生效。
- `core/src/controllers/admin.js` 已把普通用户时间保护扩展到 `farmMax / friendMax / helpMax / stealMax`，与前端展示和 `normalizeIntervals()` 行为保持一致。
- `core/src/models/store.js` 的 `getConfigSnapshot()` 已补齐 `stealFilter / stealFriendFilter / stakeoutSteal / skipStealRadish / forceGetAll`，避免账号开关出现“读快照少字段”的半持久化表现。

#### 12.11.3 本轮复查后的结论

- **本设置页当前已纳入 MySQL 持久化的时间/开关项**：
  `intervals / friendQuietHours / automation / stakeoutSteal / tradeConfig / reportConfig / inventoryPlanting / accountMode / harvestDelay / riskPromptEnabled / modeScope`
- **这页里没有再发现新的“能改但不进库”的时间项或开关项**：
  这次重查后，主要问题集中在“前端控件约束缺失 + 后端保护拦截提示不清 + 快照缺字段”，不是新增的 MySQL 漏存。
- **仍不属于 MySQL 业务配置的项目**：
  报表筛选、列表排序、已读/关闭状态、记住用户名等浏览器习惯项仍留在 `localStorage`；登录失败锁定、公开体验卡短期限流等仍是内存态运行状态。

#### 12.11.4 本轮验证

- `node --test core/__tests__/data-provider-save-settings.test.js core/__tests__/store-account-settings-persistence.test.js core/__tests__/store-system-settings.test.js core/__tests__/store-trial-config.test.js core/__tests__/user-ui-settings.test.js`
- `pnpm -C web lint`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- core/src/controllers/admin.js core/src/models/store.js core/__tests__/data-provider-save-settings.test.js core/__tests__/store-account-settings-persistence.test.js web/src/components/ui/BaseInput.vue web/src/stores/setting.ts web/src/views/Settings.vue`

## 13. 最近优化复查补记（2026-03-10）

### 13.1 本轮目标

- 将最近一轮“公告治理 + 发布链路”优化结果正式归档到开发文档。
- 复查近两天新增能力是否引入新的可用性问题（重点看部署命令、文档链接、发布前检查链路）。

### 13.2 本轮已确认并落地的优化

- 公告质量检查已形成三层约束：
  - 本地：`node scripts/utils/check-announcements.js` / `pnpm check:announcements`
  - 流水线：CI / Release / Docker workflow 前置检查
  - 协作流程：PR 模板必填检查项
- 本地部署脚本已接入“可用即执行”的公告预检：
  - `scripts/deploy/fresh-install.sh`
  - `scripts/deploy/update-app.sh`
- 部署文档口径已统一到当前主仓：`qq-farm-ui-pro-max`。
- 部署文档一键脚本路径已修正为真实目录：`scripts/deploy/deploy-*.sh`。
- 部署文档过时版本示例已由 `v4.0.0` 更新为 `v4.5.17` 示例。
- 部署文档中的本机绝对路径已改为通用占位路径（`/path/to/qq-farm-ui-pro-max`），避免跨机器复制时误导。

### 13.3 再次复查结果（问题 / 影响 / 处理）

#### 13.3.1 README 存在失效本地文档链接（已处理）

- 现象：README 中 4 个本地文档链接指向不存在路径。
- 影响：新同事或运维点击后 404，降低首轮排障效率。
- 处理：已修正为真实路径：
  - `docs/guides/TROUBLESHOOTING.md`
  - `docs/guides/CONFIG_TEMPLATES.md`
  - `docs/archive/reports/DEPLOYMENT_FIX_REPORT.md`
  - `docs/archive/reports/DOCKER_BUILD_COMPLETE.md`

#### 13.3.2 README 存在缺失截图引用（已处理）

- 现象：`assets/screenshots/screenshot-03.png` 到 `screenshot-07.png` 曾缺失。
- 影响：README 局部图片显示失败，不影响功能，但影响可读性与项目观感。
- 处理：已用现有资源完成映射补齐（`feature-03~07` 对应 `screenshot-03~07`），README 本地链接巡检已清零。
- 当前状态：文档类死链与截图缺失均已清零。

#### 13.3.3 开发复盘文档再次出现 NUL 字节（已处理）

- 现象：在将 README 巡检扩展为关键文档巡检后，`docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md` 被检测到包含 NUL 字节。
- 影响：会导致 `check-doc-links` 直接失败，属于文件完整性问题，不影响业务逻辑，但会阻断文档质量检查。
- 处理：已执行无损清理，当前 `check-doc-links` 与 `check-announcements` 均恢复为 `0 error(s), 0 warning(s)`。

### 13.4 本轮建议

- 后续可将 `README_IMAGES.md` 增补“`feature-*` 与 `screenshot-*` 映射表”，减少二次维护歧义。

### 13.4 补充落地（2026-03-10）

- 已新增 README 链接检查脚本：`scripts/utils/check-readme-links.js`。
- 根目录命令已补齐：`pnpm check:readme-links`。
- CI 已接入非阻断检查：
  - `.github/workflows/ci.yml`
  - step: `Check Doc Links (non-blocking)`
- 当前检查范围：
  - README 内本地 Markdown 链接
  - README 内本地图片引用
  - README 文件 NUL 字节
- 已进一步扩展为关键文档巡检：`scripts/utils/check-doc-links.js`
- 根目录命令已补齐：`pnpm check:doc-links`
- 当前覆盖文件：
  - `README.md`
  - `docs/DEPLOYMENT_SOP.md`
  - `docs/DEPLOYMENT_PLAN.md`
  - `docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`
  - `docs/dev-notes/ANNOUNCEMENT_HISTORY_CONSOLIDATION_2026-03-09.md`
  - `assets/screenshots/README_IMAGES.md`
  - `.github/pull_request_template.md`

### 13.5 当前建议

- 当前已形成“公告检查 + 关键文档巡检 + PR 提醒”闭环；后续如扩展，可再把巡检范围从“关键文档白名单”扩大到 `docs/**/*.md` 全量扫描。

### 13.6 本轮验证

- `node scripts/utils/check-announcements.js` => `0 error(s), 0 warning(s)`
- `node scripts/utils/check-readme-links.js` => `0 error(s), 0 warning(s)`
- `node scripts/utils/check-doc-links.js` => `0 error(s), 0 warning(s)`
- Raw 链接可用性抽查：`deploy-arm.sh` / `deploy-x86.sh` 均返回 HTTP `200`
- README 本地链接巡检：`0` 缺失（文档死链与截图缺失均已修复）
- 关键文档巡检过程中发现的 NUL 字节问题已清理完成

## 14. 近期功能优化复查补记（2026-03-10 继续复查）

### 14.1 本轮覆盖范围

- 背包页“按策略出售”可见性与就地编辑优化
- 设置页与工作流页面最近一次结构调整
- 前端正式构建链路（`vue-tsc` / `vite build` / 正式 `build` 脚本）
- 最近开发文档与页面代码的卫生项复核

### 14.2 本轮确认新增记录

- 背包页已补上“策略解释 + 就地编辑 + 保存后刷新预览”这一层，用户无需再只靠设置页深层入口理解“按策略出售”。
- 背包页原本容易误导的“白名单”文案已被重解释为“强制保留清单”，当前语义与后端真实逻辑重新对齐。
- 设置页本轮连同工作流页一起做了类型与构建复查，当前 `vue-tsc` 已恢复通过，未再复现新的设置页类型阻断项。
- 工作流页中多处原生自闭合 `div` 已改为显式闭合写法，已消除 `vite build` 报出的 `Element is missing end tag` 阻断。

### 14.3 本轮再次复查结果（问题 / 影响 / 处理）

#### 14.3.1 已确认：设置页当前类型检查已恢复正常

- 现象：本轮继续复查时，`pnpm -C web exec vue-tsc -b --pretty false` 已可直接通过，当前未再复现新的设置页类型阻断项。
- 影响判断：设置页近期改动目前没有留下新的前端类型层 build blocker。
- 建议：后续若继续扩展设置页的汇报/主题/交易策略编辑逻辑，仍建议把 `vue-tsc` 保留为提交前固定检查。

#### 14.3.2 已修复：`Workflow.vue` 模板写法与 Vite 解析器不兼容

- 现象：`web/src/views/Workflow.vue` 中最近结构调整保留了多处原生自闭合 `div`，Vite 构建阶段会报 `Element is missing end tag`。
- 影响：即使 `vue-tsc` 通过，`vite build` 仍会在模板解析阶段失败，属于明确的发布阻断项。
- 处理：已将相关原生 `div` 统一改为显式闭合写法；当前 `pnpm -C web exec vite build --outDir dist-audit` 与正式 `pnpm -C web build` 均已通过。

#### 14.3.3 待处理：ESLint 规则与实际构建器写法偏好存在冲突

- 现象：`Workflow.vue` 改成显式闭合后，ESLint 仍给出 `vue/html-self-closing` warning，反向要求把这些 `div` 再改回自闭合。
- 影响：如果后续开发者按 lint 自动修复，极有可能把页面重新修回会卡住 Vite 的模板形态，形成“lint 通过但 build 失败”或“build 通过但 lint 提示反向修改”的循环摩擦。
- 建议处理：统一前端规范，至少对原生非 void HTML 元素的自闭合策略与当前 Vue/Vite 解析行为保持一致；必要时对该规则做项目级或文件级覆盖。

#### 14.3.4 待处理：`web/dist` 目录权限问题仍未根治

- 现象：正式执行 `pnpm -C web build` 时，Vite 仍提示 `web/dist is not writable, falling back to web/dist-runtime`。
- 影响：当前虽然构建可继续完成，但产物会落到 `dist-runtime` 而不是默认 `dist`；若部署链或运维脚本强依赖默认目录，仍可能引发后续误读。
- 建议处理：统一修正 `web/dist` 的所有者/权限，或者明确把部署脚本与文档都收口到新的输出目录策略。

#### 14.3.5 低优先级：仓库仍存在 patch 卫生噪声

- `git diff --check` 当前还能扫出 3 处尾随空格：
  - `README.md:680`
  - `docs/DEPLOYMENT_PLAN.md:7`
  - `web/src/views/FarmTools.vue:422`
- 影响：不会阻断功能，但会持续污染差异与复查结果，建议顺手清理。

### 14.4 进一步优化建议

- 将背包页和设置页里关于 `tradeConfig.sell` 的归一化逻辑收口到共享工具，避免两处实现长期漂移。
- 为“背包出售策略编辑”补一条最小化回归：覆盖“保存策略 -> 刷新预览 -> 页面摘要同步更新”。
- 将 `vue-tsc` 和 `vite build` 都保留为近期高频 UI 改动的固定验证项，不只跑 lint。
- 若继续维护工作流页，建议加一个最小模板/路由 smoke test，避免结构性 template 错误只能在打包末端才暴露。

### 14.5 本轮验证

- `node --test core/__tests__/data-provider-save-settings.test.js core/__tests__/store-trial-config.test.js`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `pnpm -C web exec vite build --outDir dist-audit`
- `pnpm -C web build`
- `pnpm -C web exec eslint "src/components/BagPanel.vue" "src/views/Workflow.vue" "src/views/Settings.vue"`
- `git diff --check`

### 14.6 当前结论

- 最近这轮优化里，已经确认并修掉了 1 个真正会阻断发布的前端问题：
  - 工作流页模板写法导致 `vite build` 失败
- 当前 `vue-tsc`、`vite build` 与正式 `pnpm -C web build` 都已通过；剩余问题主要是“规范与构建器不一致”和“产物目录权限遗留”。

### 14.7 继续优化补记（2026-03-10）

#### 14.7.1 已落地：出售策略归一化逻辑收口为单一来源

- 新增共享工具：`web/src/utils/trade-config.ts`
- 收口内容：
  - 默认出售策略工厂
  - `keepFruitIds` 归一化
  - `tradeConfig.sell` 归一化
  - 背包页策略编辑稿与最终保存配置之间的互转
- 已接入位置：
  - `web/src/stores/setting.ts`
  - `web/src/views/Settings.vue`
  - `web/src/components/BagPanel.vue`
- 影响判断：
  - 背包页与设置页现在不再各自维护一套 `sell` 默认值和解析逻辑，后续调整阈值、字段或边界时只需修改一处。
  - `fetchSettings` 与 `saveSettings` 也统一走同一套归一化，减少“服务端返回一份、页面再各自修一份”的状态漂移。

#### 14.7.2 已落地：ESLint 对 HTML 自闭合规则改为中性约束

- 处理文件：`web/eslint.config.js`
- 处理方式：
  - 将 `vue/html-self-closing` 对原生 HTML / SVG / MathML 标签的约束改为 `any`
  - 保留组件标签 `component: 'always'`
- 影响判断：
  - 解决了 `Workflow.vue` 修成显式闭合后仍被 lint 反向提示的冲突。
  - 不再强推开发者把原生标签改成某一种固定写法，避免“lint 提示”和“实际模板维护方式”互相打架。

#### 14.7.3 本轮验证

- `pnpm -C web exec eslint "src/utils/trade-config.ts" "src/stores/setting.ts" "src/views/Settings.vue" "src/components/BagPanel.vue" "src/views/Workflow.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `pnpm -C web build`
- `git diff --check -- web/eslint.config.js web/src/utils/trade-config.ts web/src/stores/setting.ts web/src/views/Settings.vue web/src/components/BagPanel.vue`

#### 14.7.4 当前残余项

- `pnpm -C web build` 依旧会因 `web/dist` 不可写而回退输出到 `dist-runtime`，这不是本轮代码回归，但仍是部署路径层面的环境遗留。
- 共享归一化逻辑目前已在前端收口；若后续要进一步降低端到端漂移，下一步可考虑把与后端 `store.js` 的同类边界约束再对齐一次，并补一条最小化前端保存回归测试。

### 14.8 下一步继续优化补记（2026-03-10）

#### 14.8.1 已落地：前后端出售策略边界约束重新对齐

- 前端共享工具 `web/src/utils/trade-config.ts` 已调整为与后端 `core/src/models/store.js` 一致：
  - `keepMinEachFruit` 最大值保持 `999999`
  - `rareKeep.minPlantLevel` 最大值改为 `999`
  - `rareKeep.minUnitPrice` 最大值保持 `999999999`
  - `batchSize` 最大值保持 `50`
  - 归一化结果只保留 `sell` 这一受支持的结构，不再把未知字段继续带在前端状态里
- 后端 `store.js` 追加了 `keepFruitIds` 去重归一化，和前端的 ID 清洗行为统一。

#### 14.8.2 已落地：设置页遗留重复逻辑与损坏尾部已清理

- `web/src/views/Settings.vue` 中旧的 `defaultTradeConfig / buildNormalizedTradeConfig / normalizeTradeKeepFruitIds` 已移除，改为统一使用共享工具。
- 复查过程中还发现 `Settings.vue` 文件尾部混入了 NUL 字节，导致文本尾部被截断在 `ConfirmModal` 区段；当前已恢复为正常 UTF-8 文本并修复尾部模板。
- 设置页和背包页的数值输入控件也补上了与后端一致的 `max` 约束，减少“页面能填、保存后被后端再截断”的错觉。

#### 14.8.3 已落地：最小化回归测试补齐

- 新增前端共享工具测试：
  - `web/__tests__/trade-config.test.mjs`
  - 覆盖出售策略归一化边界、去重、草稿与保存配置 round-trip
- 新增后端持久化归一化测试：
  - `core/__tests__/store-account-settings-persistence.test.js`
  - 覆盖 `setTradeConfig -> flushGlobalConfigSave -> reload` 的完整落库链路

#### 14.8.4 本轮验证

- `pnpm -C web exec eslint "src/utils/trade-config.ts" "src/stores/setting.ts" "src/views/Settings.vue" "src/components/BagPanel.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `node --test core/__tests__/store-account-settings-persistence.test.js`
- `node --test --experimental-strip-types web/__tests__/trade-config.test.mjs`
- `pnpm -C web build`
- `git diff --check -- core/src/models/store.js core/__tests__/store-account-settings-persistence.test.js web/src/utils/trade-config.ts web/__tests__/trade-config.test.mjs web/src/views/Settings.vue web/src/components/BagPanel.vue`

### 14.9 发布路径继续优化补记（2026-03-10）

#### 14.9.1 已落地：静态产物目录解析改为“优先可用产物”策略

- `core/src/utils/web-dist.js` 现在除了“`dist` 不可写且 `dist-runtime` 存在时回退”之外，还支持：
  - `dist` 没有有效构建产物时，若 `dist-runtime` 存在 `index.html`，直接优先使用 `dist-runtime`
- 这意味着运行时不再要求默认目录必须存在，只要 fallback 目录有完整构建即可正常服务。

#### 14.9.2 已落地：启动脚本与 Docker builder 对齐到同一套解析逻辑

- `docker/start.sh` 已改为通过 `core/src/utils/web-dist.js` 解析当前实际静态目录，并导出 `WEB_DIST_DIR`
- 只有在解析后的目录里不存在 `index.html` 时，启动脚本才会触发前端重建
- `core/Dockerfile` 在 builder 阶段新增了一步“将实际解析到的产物目录镜像回标准 `web/dist`”，确保后续 `COPY --from=builder /app/web/dist ../web/dist` 仍然成立

#### 14.9.3 已补测试与验证

- 新增 `core/__tests__/web-dist.test.js` 用例：
  - 覆盖“`dist` 无构建产物但 `dist-runtime` 可用时，应优先选择 fallback”
- 本轮验证：
  - `node --test core/__tests__/web-dist.test.js`
  - `bash -n docker/start.sh`
  - `node -e "console.log(require('./core/src/utils/web-dist').resolveWebDistDir())"`
  - `pnpm -C web build`

#### 14.9.4 当前结论

- 当前仓库里 `web/dist` 仍然是 root 产物目录，但运行时解析、Docker 启动和本地脚本链路已经不再盲依赖它。
- 在当前环境下，`resolveWebDistDir()` 已稳定解析到 `web/dist-runtime`，发布路径歧义已明显下降；剩余问题主要是目录权限本身尚未清理，而不是代码链路还会选错目录。
- README 与部署 SOP 也已统一为同一口径：默认 `web/dist`，不可写时自动回退到 `web/dist-runtime`，Docker builder 会镜像实际可用产物回标准目录。

### 14.8 设置页提醒体系补充（2026-03-10）

#### 14.8.1 已落地：集群流控加入策略态摘要

- 处理文件：`web/src/views/Settings.vue`
- 处理方式：
  - 为 `dispatcherStrategy` 新增 `clusterReminderItems`
  - 当策略为 `round_robin` 时显示偏风险提醒
  - 当策略为 `least_load` 时显示偏稳定性说明
- 影响判断：
  - 管理员在保存前就能明确看到当前策略更偏“整体重平衡”还是“粘性推流”，不需要等到节点变动后再理解影响。

#### 14.8.2 已落地：系统外观与背景加入全局影响提醒

- 处理文件：`web/src/views/Settings.vue`
- 处理方式：
  - 新增 `appearanceReminderItems`
  - 覆盖场景：
    - 主题锁定背景已开启
    - 背景作用范围为 `login_and_app` / `global`
    - 自定义背景地址预览加载失败
    - 自定义背景指向本地 / 内网地址
    - 登录页遮罩和模糊都偏低
    - 主界面可读性保护偏弱
    - 主界面模糊度过高
    - 站点品牌文案已自定义
- 影响判断：
  - 保存前就能更直观看到“哪些修改会全站生效、哪些修改只是风格问题、哪些修改可能直接让背景失效”。
  - 没有新增弹窗，仍保持原卡片结构与操作路径不变。

#### 14.8.3 本轮验证

- `pnpm -C web lint`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/views/Settings.vue`

### 14.9 本机偏好提示补充（2026-03-10）

#### 14.9.1 已落地：账号页明确区分“本机偏好”与“账号数据”

- 处理文件：`web/src/views/Accounts.vue`
- 处理方式：
  - 在视图模式切换区域增加本机提示
  - 在表格视图头部增加“列设置 / 排序仅当前浏览器生效”提示
  - 在列设置浮层里补充“清缓存或换设备后恢复默认列”的说明
  - 在最近操作结果卡片里补充“仅本机摘要，不跟账号迁移”的说明
- 影响判断：
  - 账号管理页里最容易被误解成“已入库”的几项显示偏好，现在都能在操作位附近直接看到作用范围，减少“换浏览器后被重置”的误判。

#### 14.9.2 已落地：经营汇报历史筛选明确标注为浏览器偏好

- 处理文件：`web/src/views/Settings.vue`
- 处理方式：
  - 在“最近汇报记录”筛选区上方新增说明条
  - 明确区分：
    - 汇报记录本身来自数据库
    - 筛选类型、状态、页数、关键字、排序只保存在当前浏览器
- 影响判断：
  - 经营汇报页后续即使换设备恢复默认筛选，也不会再被理解成“汇报记录没持久化”。

#### 14.9.3 本轮验证

- `pnpm -C web exec eslint "src/views/Accounts.vue" "src/views/Settings.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/views/Accounts.vue web/src/views/Settings.vue`

### 14.10 本机偏好提示继续收口（2026-03-10）

#### 14.10.1 已落地：Dashboard 明确日志筛选仅当前浏览器生效

- 处理文件：`web/src/views/Dashboard.vue`
- 处理方式：
  - 在运行日志筛选栏下方增加说明条
  - 明确区分：
    - `module / event / keyword / isWarn` 只在本机浏览器记忆
    - 日志内容本身仍然实时取自当前账号
- 影响判断：
  - 切浏览器或清缓存后日志筛选恢复默认，不会再被误判成“日志配置没存住”。

#### 14.10.2 已落地：Analytics 明确排序与推荐面板折叠状态仅当前浏览器生效

- 处理文件：`web/src/views/Analytics.vue`
- 处理方式：
  - 在图鉴页标题区下方增加说明条
  - 明确 `sortKey` 和 `strategyPanelCollapsed` 仅在本机浏览器保存
- 影响判断：
  - 作物图鉴页换设备后如果恢复默认排序或重新展开推荐面板，不会再被理解成账号分析配置回退。

#### 14.10.3 本轮验证

- `pnpm -C web exec eslint "src/views/Dashboard.vue" "src/views/Analytics.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/views/Dashboard.vue web/src/views/Analytics.vue`

### 14.11 登录与公告本机偏好提示补充（2026-03-10）

#### 14.11.1 已落地：登录页明确“记住用户名”只在当前浏览器生效

- 处理文件：`web/src/views/Login.vue`
- 处理方式：
  - 在“记住用户名”复选框下方增加说明文字
  - 明确该状态只保存在当前浏览器
- 影响判断：
  - 换设备或清缓存后用户名不再自动回填时，不会被误解成登录状态或账号资料持久化失效。

#### 14.11.2 已落地：公告关闭状态明确为本机记忆

- 处理文件：`web/src/components/AnnouncementDialog.vue`
- 处理方式：
  - 在公告弹窗底部按钮上方增加说明文字
  - 明确关闭状态只保存在当前浏览器，本机之外仍可能再次看到最新公告
- 影响判断：
  - 用户能区分“公告内容来自服务端”和“我是否已经在本机关闭过公告”是两套状态。

#### 14.11.3 已落地：通知已读状态明确为本机记忆

- 处理文件：`web/src/components/NotificationPanel.vue`
- 处理方式：
  - 在通知列表顶部增加说明条
  - 明确最新通知的已读状态只保存在当前浏览器
- 影响判断：
  - 登录页或侧边栏中的通知再次出现时，不会被理解成服务端重复推送或数据库未记录已读。

#### 14.11.4 本轮验证

- `pnpm -C web exec eslint "src/views/Login.vue" "src/components/AnnouncementDialog.vue" "src/components/NotificationPanel.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/views/Login.vue web/src/components/AnnouncementDialog.vue web/src/components/NotificationPanel.vue`

### 14.12 版本已读与当前账号选择提示补充（2026-03-10）

#### 14.12.1 已落地：更新公告大弹窗明确“版本已读”只在当前浏览器记忆

- 处理文件：`web/src/components/NotificationModal.vue`
- 处理方式：
  - 在更新公告弹窗底部动作区增加说明文字
  - 明确 `app_seen_version` 只保存在本机浏览器
- 影响判断：
  - 换设备或清缓存后同一版本更新公告再次出现时，不会再被误解成服务端重复推送。

#### 14.12.2 已落地：侧边栏账号选择明确为本机记忆

- 处理文件：`web/src/components/Sidebar.vue`
- 处理方式：
  - 在账号选择器下方增加说明文字
  - 当时已明确 `current_account_id` 只保存在当前浏览器；该项现已在 14.17 迁入用户级服务端偏好
- 影响判断：
  - 用户能更直接理解“当前操作上下文是本机选中的账号”，换设备后需要重新选择，而不是数据库丢失了默认账号。

#### 14.12.3 本轮验证

- `pnpm -C web exec eslint "src/components/NotificationModal.vue" "src/components/Sidebar.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/components/NotificationModal.vue web/src/components/Sidebar.vue`

### 14.13 背包本机缓存提示补充（2026-03-10）

#### 14.13.1 已落地：交易动态明确为按账号分开的本机缓存

- 处理文件：`web/src/components/BagPanel.vue`
- 处理方式：
  - 在“交易动态”标题区增加说明条
  - 明确最近 30 条购买 / 使用 / 出售动作只缓存在当前浏览器，并按账号分开保存
- 影响判断：
  - 换设备或清缓存后交易动态清空时，不会再被误解成服务端丢失了背包操作记录。

#### 14.13.2 已落地：常买推荐明确来自本机购买记忆

- 处理文件：`web/src/components/BagPanel.vue`
- 处理方式：
  - 在“常买推荐”标题下增加说明条
  - 明确购买次数和最近购买时间来自本机浏览器缓存，不是数据库统计
- 影响判断：
  - 用户能区分“商城真实商品数据来自服务端”和“推荐排序里的购买记忆来自本机累计”。

#### 14.13.3 本轮验证

- `pnpm -C web exec eslint "src/components/BagPanel.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/components/BagPanel.vue`

### 14.14 卡密页与系统日志页会话态提示补充（2026-03-10）

#### 14.14.1 已落地：卡密页明确分页属于当前会话状态

- 处理文件：`web/src/views/Cards.vue`
- 处理方式：
  - 在筛选与批量操作工具栏下方增加说明条
  - 明确“每页数量”和“当前页码”只在当前打开页面期间有效
- 影响判断：
  - 刷新页面后分页恢复默认时，不会再被误解成卡密数据没有持久化。

#### 14.14.2 已落地：系统日志页明确筛选与分页属于当前会话状态

- 处理文件：`web/src/views/SystemLogs.vue`
- 处理方式：
  - 在筛选面板下方增加说明条
  - 明确日志级别、账号 ID、关键词与分页页码只在当前页面会话内生效
- 影响判断：
  - 重新进入页面后恢复默认筛选时，不会再被误解成后端日志审计表未持久化。

#### 14.14.3 本轮验证

- `pnpm -C web exec eslint "src/views/Cards.vue" "src/views/SystemLogs.vue"`
- `git diff --check -- web/src/views/Cards.vue web/src/views/SystemLogs.vue`
- `pnpm -C web exec vue-tsc -b --pretty false`
  - 当前仍被仓库内现存的 `web/vite.config.ts` 类型错误阻断，与本轮提示改动无关。

### 14.15 前端非数据库状态总清单（2026-03-10）

- 新增文档：`docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md`
- 覆盖范围：
  - 浏览器本地持久化但不进数据库
  - 浏览器缓存 + 服务端同步
  - 当前页面会话态
  - 纯前端运行时内存态
  - 与前端排查强相关的后端内存态
- 当前用途：
  - 作为“为什么换浏览器后状态变了”以及“哪些设置其实已经进库”的统一索引
  - 后续若继续迁移状态到服务端，可直接以该清单为基线继续收口

### 14.15 web/dist 嵌套权限回退收口（2026-03-10）

#### 14.15.1 已落地：构建与运行时统一复用同一套产物目录解析

- 处理文件：`core/src/utils/web-dist.js`、`core/__tests__/web-dist.test.js`、`web/vite.config.ts`
- 处理方式：
  - 将 `web/dist` 的可写性判定从“只检查顶层目录”扩展为“递归检查子目录和历史产物文件”
  - 在 `core/__tests__/web-dist.test.js` 新增“顶层目录可写但子文件只读”的回归用例
  - `web/vite.config.ts` 不再单独维护一套目录回退逻辑，改为直接复用 `core/src/utils/web-dist.js`
- 影响判断：
  - 当 `web/dist` 仍残留旧的 root 所有者产物时，正式构建会自动落到 `web/dist-runtime`
  - 首次成功构建出 `web/dist-runtime/index.html` 后，运行时也会自动解析到该目录，不再继续依赖旧 `web/dist`

#### 14.15.2 现场复查结论

- 当前工作区的 `web/dist` 顶层目录虽然可写，但其下仍存在 root 所有者且不可写的旧产物，如 `web/dist/assets` 与历史 `.gz` 文件
- 这说明问题本质不是“有没有 `dist` 目录”，而是“旧产物树是否整体可覆盖”
- 代码链路已经对这种状态具备韧性，但这不等于环境脏数据已经清理完成

#### 14.15.3 建议

- 若要彻底消除环境残留，仍建议单独清理或更正旧 `web/dist` 产物树的所有者与权限
- 若后续继续调整发布脚本，应保持“构建输出目录由解析函数决定，而不是写死 `web/dist`”这一约束

#### 14.15.4 本轮验证

- `node --test core/__tests__/web-dist.test.js`
- `pnpm -C web build`
  - 已输出 `[vite] web/dist is not writable, falling back to web/dist-runtime`
- `node -e "console.log(require('./core/src/utils/web-dist').resolveWebDistDir())"`
  - 当前已解析到 `web/dist-runtime`

### 14.16 旧 web/dist 产物安全清理与标准目录恢复（2026-03-10）

#### 14.16.1 已落地：旧活动产物先转移后重建，不做不可逆硬删

- 处理对象：`web/dist`、`web/dist-audit`、`web/dist-codex-restore`
- 处理方式：
  - 先确认 `web/dist-runtime` 已具备完整前端产物，运行时可独立工作
  - 将旧的 `web/dist` 整目录转移到系统回收位置 `~/.Trash/qq-farm-web-dist-stale-20260310-100340/dist`
  - 清理本轮调试遗留的 `web/dist-audit` 与 `web/dist-codex-restore`
  - 修正 `web/vite.config.ts` 与 `core/src/utils/web-dist.js` 的职责边界后，重新执行正式构建，生成新的标准 `web/dist`
- 影响判断：
  - 活动路径中的旧 root 产物已退出工作区，不再继续污染正式构建
  - 新生成的 `web/dist` 已恢复为当前用户可写目录，标准构建路径重新可用
  - `web/dist-runtime` 仍保留为 fallback 目录，不属于本轮清理对象

#### 14.16.2 本轮验证

- `node --test core/__tests__/web-dist.test.js`
  - 新增构建侧 `resolveBuildWebDistDir()` 用例后，7 条测试全部通过
- `pnpm -C web build`
  - 本轮已重新输出到 `web/dist`，不再回退到 `web/dist-runtime`
- `node -e "console.log(require('./core/src/utils/web-dist').resolveWebDistDir())"`
  - 当前已解析回 `web/dist`
- `find web -maxdepth 1 -type d \( -name 'dist' -o -name 'dist-runtime' -o -name 'dist-audit' -o -name 'dist-codex-restore' \)`
  - 当前工作区仅剩 `web/dist` 与 `web/dist-runtime`

### 14.17 前端产物维护与出售策略回归补齐（2026-03-10）

#### 14.17.1 已落地：旧快照转入正式归档目录

- 处理对象：原位于系统回收站的旧 `web/dist` 快照
- 处理方式：
  - 将 `~/.Trash/qq-farm-web-dist-stale-20260310-100340/dist` 迁入 `archive/runtime-snapshots/20260310-web-dist-cleanup/web-dist-before-cleanup`
  - 在归档目录补 `README.txt`，标明来源与用途
- 影响判断：
  - 快照不再依赖系统回收站生命周期
  - 当前活动目录与归档目录职责明确分离

#### 14.17.2 已落地：前端产物目录增加可观测性

- 处理文件：`core/src/utils/web-dist.js`、`core/src/controllers/admin/system-public-routes.js`、`core/src/controllers/admin.js`、`docker/start.sh`
- 处理方式：
  - `web-dist.js` 新增 `inspectWebDistState()`，统一输出活动目录、构建目标、默认目录与 fallback 目录状态
  - `/api/system-settings/health` 追加 `webAssets` 摘要
  - `/api/ping` 追加轻量版 `webAssets` 信息，便于健康探针和排障查看
  - 启动脚本打印“选路原因”和“当前构建目标”
- 影响判断：
  - 现在不仅能知道“当前用了哪个目录”，还能知道“为什么选它”
  - 构建侧与运行时目录选择不再是黑盒

#### 14.17.3 已落地：补安全维护脚本并实跑验证

- 处理文件：`scripts/utils/maintain-web-dist.sh`、`package.json`
- 处理方式：
  - 新增 `pnpm maintain:web-dist`
  - 脚本会先归档现有 `web/dist`，清理 `web/dist-audit` 与 `web/dist-codex-restore`，再重建标准 `web/dist`
  - 若重建失败，会把刚归档的 `dist-before-rebuild` 恢复回活动路径
- 影响判断：
  - 后续不需要再人工拼接“归档、清理、重建、回滚”操作
  - `web/dist-runtime` 会被明确保留，不会被误删

#### 14.17.4 已落地：出售策略补齐“保存 -> 预览 -> 重载”回归

- 处理文件：`core/__tests__/store-account-settings-persistence.test.js`
- 处理方式：
  - 新增用例覆盖 `saveSettings(tradeConfig)` 后 `getSellPreview()` 读取当前账号策略
  - 再次重载 store 与 warehouse 后，验证同一份背包数据仍产生一致出售预览
- 影响判断：
  - 现在不仅验证了策略能持久化，还验证了出售预览真正吃到了已保存策略

#### 14.17.5 附带清理

- 更新 `README.md`、`docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md` 与部分 Docker 部署文档，统一 `dist` / `dist-runtime` 口径
- 清理 `docs/DEPLOYMENT_PLAN.md` 与 `web/src/views/FarmTools.vue` 的尾随空格

#### 14.17.6 本轮验证

- `node --test core/__tests__/web-dist.test.js`
- `node --test core/__tests__/admin-system-public-routes.test.js`
- `node --test core/__tests__/store-account-settings-persistence.test.js`
- `bash -n docker/start.sh`
- `pnpm maintain:web-dist`
  - 维护前检测到 runtime 正在使用 fallback
  - 归档旧 `dist` 后已重新构建出标准 `web/dist`
  - 维护完成后 `inspectWebDistState()` 已恢复为默认目录可用

### 14.18 管理端补充前端产物状态卡（2026-03-10）

#### 14.18.1 已落地：设置页管理员区可直接查看 `webAssets`

- 处理文件：`web/src/views/Settings.vue`
- 处理方式：
  - 在管理员区新增“系统自检与前端产物状态”卡片
  - 直接读取 `/api/system-settings/health`，展示：
    - `system_settings` 自检状态
    - 最近检查时间
    - 当前选路原因
    - 当前服务目录 / 当前构建目标
    - 默认目录与 fallback 目录的“有产物 / 可覆盖”状态
    - 缺失必需键、仍依赖旧回退文件的键
  - 增加“刷新状态”按钮，失败时显示错误提示
- 影响判断：
  - 管理员不再需要手工查看接口回包，即可定位前端静态目录当前究竟落在 `dist` 还是 `dist-runtime`
  - `system_settings` 自检与前端产物状态第一次在 UI 上并列可见，排障路径更短

#### 14.18.2 本轮验证

- `pnpm -C web exec eslint "src/views/Settings.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `pnpm -C web build`
- `pnpm maintain:web-dist`
  - 最终已恢复为 `web/dist` 活动目录

### 14.17 当前账号选择改为用户级服务端同步（2026-03-10）

#### 14.17.1 已落地：`current_account_id` 不再只依赖浏览器本地

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/controllers/admin/system-public-routes.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `web/src/stores/account.ts`
  - `web/src/stores/app.ts`
  - `web/src/components/Sidebar.vue`
  - `web/src/views/AccountOwnership.vue`
- 处理方式：
  - 新增 `user_preferences` 表，主存 `current_account_id`
  - `/api/ui-config` 在用户已登录时回传当前账号偏好，前端启动后可自动恢复
  - 新增 `/api/account-selection`，账号切换时同步写回后端
  - 账号页和归属页仍保留本地缓存兜底，但不再以本地缓存为唯一真源

#### 14.17.2 风险修正：没有复用 `ui_settings`

- 复查中发现，如果直接把 `current_account_id` 混进 `ui_settings`，当用户尚未设置个人主题时，也会被迫写入一整行 UI 默认值
- 这会让后续全局主题/背景更新被“误判为个人覆盖”，属于隐性回归
- 因此本轮改为独立 `user_preferences`，将“账号选择偏好”和“个人 UI 覆盖”彻底拆开

#### 14.17.3 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/stores/account.ts" "src/stores/app.ts" "src/components/Sidebar.vue" "src/views/AccountOwnership.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
  - 若仍失败，应继续以仓库现存的 `web/vite.config.ts` 类型问题为主，不归因到本轮改动

### 14.18 背包页购买记忆与交易动态迁入账号级服务端缓存（2026-03-10）

#### 14.18.1 已落地：`BagPanel` 不再只靠本机缓存保存购买记忆和最近动态

- 处理文件：
  - `core/src/services/account-bag-preferences.js`
  - `core/src/database/migrations/016-account-bag-preferences.sql`
  - `core/src/controllers/admin/commerce-routes.js`
  - `web/src/stores/bag.ts`
  - `web/src/components/BagPanel.vue`
- 处理方式：
  - 新增 `account_bag_preferences` 表，按 `account_id` 存储 `purchase_memory` 与 `activity_history`
  - 新增 `/api/bag/preferences` 读写接口
  - `BagPanel` 仍保留原有 `localStorage` 键作首屏兜底和旧数据迁移源，但权威来源已切换到服务端
  - 页面载入时先读本机缓存秒开，再异步拉服务端；若服务端为空但本机有旧数据，会自动迁回服务端

#### 14.18.2 风险收口：同步链增加版本戳与轻量防抖

- 一次购买会同时更新“常买推荐”和“交易动态”，若直接逐次写库会产生双写
- 本轮在前端加了轻量防抖，将连续更新合并成一次同步请求
- 同时增加版本戳，避免“页面先显示本机缓存，随后服务端旧快照回来又把刚产生的新记录覆盖掉”的倒灌问题

#### 14.18.3 影响判断

- 常买推荐和最近动态现在可以跨设备、跨浏览器恢复，不再误表现为“换台机器就全空”
- 由于仍保留本机兜底，弱网或服务端短时异常时不会让面板瞬间失忆
- 这两项仍是操作辅助记忆，不应和正式审计日志混为一谈

#### 14.18.4 本轮验证

- `node --test core/__tests__/account-bag-preferences.test.js core/__tests__/admin-commerce-routes.test.js`
- `pnpm -C web exec eslint "src/stores/bag.ts" "src/components/BagPanel.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
  - 若仍失败，应继续优先排查仓库内现存的 `web/vite.config.ts` 类型问题

### 14.19 卡密页与系统日志页视图偏好迁入用户级服务端偏好（2026-03-10）

#### 14.19.1 已落地：`Cards` / `SystemLogs` 不再只保留会话态筛选与分页

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `core/src/database/migrations/001-init_mysql.sql`
  - `deploy/init-db/01-init.sql`
  - `core/src/services/mysql-db.js`
  - `core/src/controllers/admin.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `web/src/utils/view-preferences.ts`
  - `web/src/views/Cards.vue`
  - `web/src/views/SystemLogs.vue`
- 处理方式：
  - 在 `user_preferences` 中新增 `cards_view_state` 与 `system_logs_view_state`
  - 新增 `GET/POST /api/view-preferences`，按当前登录用户读写视图偏好
  - `Cards` 会持久化 `keyword / type / status / source / batchNo / createdBy / page / pageSize`
  - `SystemLogs` 会持久化 `level / accountId / keyword / page / pageSize`
  - 两页刷新后会先从服务端恢复视图偏好，再执行实际数据加载

#### 14.19.2 风险收口：避免局部更新冲掉既有用户偏好

- `user_preferences` 之前已用于保存 `current_account_id`
- 若直接用新的视图偏好请求整行覆盖，容易把当前账号选择清空
- 本轮将 `saveUserPreferences` 改为“先读当前值，再按字段合并后写回”，确保 `current_account_id`、卡密页视图、系统日志页视图可以独立更新

#### 14.19.3 工具链修正：补上表格选择单元格的事件类型桥接

- 复跑 `vue-tsc` 时，发现 `BaseDataTableSelectionCell` 直接透传 `BaseCheckbox` 事件，会把 `boolean | array` 原样抛给只接受数组的上层
- 该问题不是本轮服务端持久化逻辑引入的业务 bug，但会阻断类型检查
- 本轮增加数组事件收窄，只在确认为数组时再向上派发，保证表格批量勾选链的类型与运行时行为一致

#### 14.19.4 影响判断

- `Cards` 与 `SystemLogs` 的筛选和分页现在会随当前登录用户恢复，不会再表现为“刷新页面就丢”
- 这两项不再依赖浏览器本地缓存，因此换设备后也能恢复同样的视图上下文
- 仍保持会话态的只有批量勾选、详情弹窗、编辑弹窗等短时操作上下文

#### 14.19.5 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/components/ui/BaseDataTableSelectionCell.vue" "src/views/Cards.vue" "src/views/SystemLogs.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false`

### 14.20 普通前端构建自愈与正式构建链恢复（2026-03-10）

#### 14.20.1 已落地：普通 `vite build` 现在会先自愈旧 `dist`

- 处理文件：
  - `core/src/utils/web-dist.js`
  - `core/__tests__/web-dist.test.js`
  - `web/vite.config.ts`
- 处理方式：
  - 在构建开始前，若检测到 `web/dist` 因旧只读文件导致“不可覆盖但 `dist-runtime` 可用”，则自动把旧 `web/dist` 归档到 `archive/runtime-snapshots/<timestamp>-auto-web-dist-recover/`
  - 归档后继续按标准路径重建新的 `web/dist`
  - 若构建收尾后默认目录再次变成不可覆盖，则把刚生成的 `web/dist` 镜像到 `web/dist-runtime`，保证 fallback 始终持有最新前端产物

#### 14.20.2 风险收口：把“环境异常”从阻断构建降级为自动兜底

- 之前的问题不是目录解析错了，而是普通构建即使成功，运行时也可能继续吃旧的 `dist-runtime`
- 本轮把“旧 `dist` 自动归档”和“最新产物自动镜像到 fallback”都接到正式构建链上
- 这样即使环境再次出现旧权限残留，也不会要求人工先跑维护脚本才能让运行时拿到新版本

#### 14.20.3 额外确认：正式 `pnpm -C web build` 已恢复通过

- 本轮第一次复跑时，`vue-tsc -b` 命中过期的增量缓存，表现为 `Accounts.vue` 报出模板里并不存在的旧符号
- 执行一次 `pnpm -C web exec vue-tsc -b --pretty false --force` 后，正式构建已恢复正常
- 这类问题属于增量类型缓存残留，不是本轮前端产物目录逻辑引入的新回归

#### 14.20.4 本轮验证

- `node --test core/__tests__/web-dist.test.js`
- `pnpm -C web exec vite build`
- `pnpm -C web exec vue-tsc -b --pretty false --force`
- `pnpm -C web build`
- `node - <<'NODE' ... inspectWebDistState() ... NODE`
  - 当前活动目录：`web/dist`
  - 当前构建目标：`web/dist`

### 14.21 最近功能优化二次复查（2026-03-10）

#### 14.21.1 复查范围

- 背包页购买记忆与交易动态服务端缓存
- 出售策略配置归一化与背包页内编辑
- 卡密页 / 系统日志页视图偏好服务端持久化
- 管理端系统自检与前端产物状态卡
- `web/dist` / `web/dist-runtime` 自愈构建链

#### 14.21.2 已确认通过

- `node --test core/__tests__/account-bag-preferences.test.js core/__tests__/admin-commerce-routes.test.js core/__tests__/store-account-settings-persistence.test.js core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js core/__tests__/admin-system-public-routes.test.js core/__tests__/web-dist.test.js`
- `pnpm -C web exec eslint "src/components/BagPanel.vue" "src/stores/bag.ts" "src/views/Settings.vue" "src/views/Cards.vue" "src/views/SystemLogs.vue" "src/utils/view-preferences.ts" "src/utils/trade-config.ts" "vite.config.ts" "src/views/AccountOwnership.vue"`
- 结论：
  - 背包偏好、出售策略、卡密页视图偏好、系统日志页视图偏好、系统自检接口与前端产物状态链路未发现新的功能性回归
  - `web/dist` 自愈构建与 fallback 解析链路的既有测试继续通过

#### 14.21.3 已发现问题

- **`Accounts` 页视图偏好行为链未真正接通**
  - 现象：
    - `web/src/utils/view-preferences.ts` 已经补齐 `AccountsViewState`
    - `pnpm -C web exec vue-tsc -b --pretty false --force` 通过
    - `pnpm -C web build` 通过
    - 但账号页当前初始化与同步流程仍没有真正使用这条能力
  - 直接原因：
    - `web/src/views/Accounts.vue` 虽然已经存在 `hydrateAccountsViewState()`、`scheduleAccountsViewSync()` 与 `buildAccountsViewState()`
    - 但 `onMounted` 仍在走旧的本地初始化路径，只调用 `readTableSortState()` / `readTableColumnVisibility()`，却没有把返回值回填到响应式状态，也没有调用 `hydrateAccountsViewState()`
    - 同时当前文件缺少像 `Cards.vue` / `SystemLogs.vue` 那样基于视图状态签名的 `watch` 来触发 `scheduleAccountsViewSync()`
  - 影响：
    - 账号页视图模式、表格排序、列显隐目前仍以本机即时状态为主，刷新后无法稳定恢复到最近一次设置
    - 服务端 `accountsViewState` 虽已具备后端与共享工具支持，但页面行为上尚未真正享受到跨会话 / 跨设备恢复
    - 本地排序和列显隐的 `localStorage` 恢复也不完整，因为读取结果没有落回状态
  - 相关文件：
    - `web/src/views/Accounts.vue`
    - `web/src/utils/view-preferences.ts`
    - `core/src/services/user-preferences.js`
    - `core/src/controllers/admin/settings-report-routes.js`

#### 14.21.4 本轮顺手修正的小问题

- 已清除 `web/src/views/Accounts.vue` 尾部残留的 NUL 字节，避免继续污染文件解析
- 已修正 `web/vite.config.ts` 的 import / 类型定义 lint 问题
- 已清理 `web/src/views/AccountOwnership.vue` 中未使用的 `latestActionHistory` 变量

#### 14.21.5 影响判断

- 当前最主要的风险不在背包页、出售策略或前端产物自愈，而在账号页视图偏好这条链没有前后端完全对齐
- 后端 `user_preferences` 与 `/api/view-preferences` 实际已经支持 `accountsViewState`
- 问题集中在 `Accounts.vue` 页面生命周期与状态监听没有切换到新的共享工具链，而不是数据库、接口或共享归一化工具本身失效
- 对比 `Cards.vue` / `SystemLogs.vue` 的实现，账号页当前更像是“中途合并了一半的功能”，既留下了服务端同步辅助函数，也保留了旧的本地初始化路径

#### 14.21.6 优化建议

- 在 `Accounts.vue` 中统一改为：
  - `onMounted` 先执行 `hydrateAccountsViewState()`
  - 视图模式、表格排序、列显隐统一通过一个签名 `watch` 调用 `scheduleAccountsViewSync()`
  - 删除旧的只读不写回的本地初始化残留
- 随后给 `Accounts.vue` 补一条“读取服务端视图偏好 -> 修改视图 -> 保存 -> 重新加载恢复”的最小回归测试
- 将 `pnpm -C web exec vue-tsc -b --pretty false --force` 纳入前端回归清单或 CI，避免增量缓存掩盖这种共享类型漂移

### 14.22 账号页视图偏好迁入用户级服务端偏好（2026-03-10）

#### 14.22.1 已落地：`Accounts` 不再只靠本机保存视图模式、表格排序和列显隐

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `core/src/database/migrations/001-init_mysql.sql`
  - `deploy/init-db/01-init.sql`
  - `core/src/services/mysql-db.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `web/src/utils/view-preferences.ts`
  - `web/src/views/Accounts.vue`
- 处理方式：
  - 在 `user_preferences` 中新增 `accounts_view_state`
  - `/api/view-preferences` 现统一承载 `Accounts / Cards / SystemLogs` 三页视图偏好
  - `Accounts` 会持久化 `viewMode / tableSortKey / tableSortDirection / tableColumnVisibility`
  - 页面启动时先尝试从服务端恢复；若服务端尚无记录，则会把本机旧缓存迁回服务端

#### 14.22.2 风险收口：仅迁高价值视图偏好，保留操作摘要本机态

- 本轮没有把 `accounts_action_history` 一起迁入服务端
- 原因是最近操作摘要更接近“本机回看记录”，不适合跨设备同步后与正式审计记录混淆
- 因此 `Accounts` 当前的边界是：
  - 视图模式、表格排序、列显隐：用户级服务端偏好
  - 最近操作摘要：浏览器本地状态

#### 14.22.3 已关闭 14.21 的前端共享层未收口问题

- `web/src/utils/view-preferences.ts` 已补齐 `AccountsViewState`、默认值、归一化函数和提交类型
- `Accounts.vue` 与 `/api/view-preferences` 的请求体字段已重新对齐
- 复跑 `vue-tsc` 后，14.21 中提到的“前端共享层接口漂移导致干净构建失败”已消除

#### 14.22.4 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/views/Accounts.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- core/src/services/user-preferences.js core/src/database/migrations/015-user-preferences.sql core/src/database/migrations/001-init_mysql.sql deploy/init-db/01-init.sql core/src/services/mysql-db.js core/src/controllers/admin/settings-report-routes.js core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js web/src/utils/view-preferences.ts web/src/views/Accounts.vue`

### 14.23 最近优化三次复查补记（2026-03-10）

#### 14.23.1 结论更新

- 14.22 中“前端共享层未收口导致构建失败”的问题当前已关闭：
  - `web/src/utils/view-preferences.ts` 已补齐 `AccountsViewState`
  - `pnpm -C web exec vue-tsc -b --pretty false --force` 通过
  - `pnpm -C web build` 通过
- 但从当前代码快照继续复查后，仍确认 **账号页视图偏好在行为层没有完全接通**

#### 14.23.2 当前仍存在的行为问题

- `web/src/views/Accounts.vue` 仍保留旧的本地初始化路径：
  - `onMounted()` 当前只执行 `viewMode.value = readViewMode()`、`readTableSortState()`、`readTableColumnVisibility()`、`readActionHistory()`、`applyQueryState()`、`initializePage()`
  - 其中 `readTableSortState()` 与 `readTableColumnVisibility()` 的返回值没有回填到响应式状态
  - 这意味着本机已保存的排序和列显隐在刷新后也不一定真正恢复
- 文件内部虽然已经存在 `hydrateAccountsViewState()`、`buildAccountsViewState()`、`scheduleAccountsViewSync()` 等辅助函数，但当前没有建立像 `Cards.vue` / `SystemLogs.vue` 那样基于视图状态签名的统一 `watch`
- 结果是：
  - 服务端 `accountsViewState` 支持已经就位
  - 前端共享工具也已经就位
  - 但账号页视图模式、表格排序、列显隐的“恢复 -> 修改 -> 回写”闭环还没有真正跑通

#### 14.23.3 影响判断

- 这不是构建阻断问题，而是用户体验和状态一致性问题
- 用户可能会看到“账号页支持视图偏好同步”的实现痕迹，但实际刷新后恢复不稳定，跨设备同步也不会稳定生效
- 背包偏好、出售策略、卡密页、系统日志页、本轮前端产物自愈链路未发现同级别新增问题

#### 14.23.4 建议下一步

- 将 `Accounts.vue` 完整对齐到 `Cards.vue` / `SystemLogs.vue` 的模式：
  - `onMounted` 先 `await hydrateAccountsViewState()`
  - 用单一签名 `computed` / `watch` 监听 `viewMode + tableSortKey + tableSortDirection + tableColumnVisibility`
  - 在 `accountsViewSyncEnabled && !accountsViewHydrating` 时统一 `scheduleAccountsViewSync()`
  - 删除旧的只读不落状态的本地初始化残留
- 补一条账号页端到端回归：
  - 读取服务端视图偏好
  - 修改视图模式 / 列显隐 / 排序
  - 保存后刷新页面再验证恢复

### 14.24 Dashboard / Analytics / 经营汇报历史视图偏好迁入用户级服务端偏好（2026-03-10）

#### 14.24.1 已落地：三块页面视图偏好统一走 `user_preferences`

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `core/src/database/migrations/001-init_mysql.sql`
  - `deploy/init-db/01-init.sql`
  - `core/src/services/mysql-db.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `core/__tests__/user-preferences.test.js`
  - `core/__tests__/admin-settings-report-routes.test.js`
  - `web/src/utils/view-preferences.ts`
  - `web/src/views/Dashboard.vue`
  - `web/src/views/Analytics.vue`
  - `web/src/views/Settings.vue`
- 处理方式：
  - 在 `user_preferences` 中新增 `dashboard_view_state`、`analytics_view_state`、`report_history_view_state`
  - `/api/view-preferences` 现统一承载 `Accounts / Dashboard / Analytics / 经营汇报历史 / Cards / SystemLogs` 六块视图偏好
  - 页面启动时优先读取服务端；若服务端暂无记录，则使用浏览器旧缓存做首屏兜底，并回写服务端
  - 浏览器本地旧键仍保留为迁移源，不再作为权威数据来源

#### 14.24.2 行为修正：经营汇报历史不再只靠本地 `localStorage`

- `web/src/views/Settings.vue` 现已对齐到统一模式：
  - `onMounted` 先 `await hydrateReportHistoryViewState()`
  - 用签名 `watch` 统一监听 `mode / status / keyword / sortOrder / pageSize`
  - 在 `reportHistoryViewSyncEnabled && !reportHistoryViewHydrating` 时统一防抖写回服务端
  - `localStorage` 继续保留，只作为旧数据迁移源和首屏兜底
- 这意味着：
  - 换浏览器后，经营汇报历史筛选不会再恢复成默认状态
  - 原本“看起来像没持久化”的问题，现在和 `Dashboard / Analytics` 一起收口了

#### 14.24.3 Git 同步风险收口

- 当前这条持久化链路依赖的新文件不再只是“本机存在但未纳管”的状态
- 本轮已明确纳入 git 跟踪范围的重点对象包括：
  - `core/src/services/user-preferences.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `web/src/utils/view-preferences.ts`
  - `web/src/views/Dashboard.vue`
  - `web/src/views/Analytics.vue`
  - `web/src/views/Settings.vue`
  - `core/__tests__/user-preferences.test.js`
  - `core/__tests__/admin-settings-report-routes.test.js`
- 目标是避免后续只靠 `git pull` / 分支同步时，出现“本机能跑但关键新增文件没进版本控制”的问题

#### 14.24.4 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/views/Dashboard.vue" "src/views/Analytics.vue" "src/views/Settings.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `node -c core/src/services/user-preferences.js`
- `node -c core/src/controllers/admin/settings-report-routes.js`
- `node -c core/src/services/mysql-db.js`
- `git diff --check -- core/src/services/user-preferences.js core/src/controllers/admin/settings-report-routes.js core/src/database/migrations/015-user-preferences.sql core/src/database/migrations/001-init_mysql.sql deploy/init-db/01-init.sql core/src/services/mysql-db.js core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js web/src/utils/view-preferences.ts web/src/views/Dashboard.vue web/src/views/Analytics.vue web/src/views/Settings.vue docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.25 账号页视图偏好闭环修复与前端偏好链复查（2026-03-10）

#### 14.25.1 已修复：`Accounts.vue` 视图偏好真正接通

- 处理文件：
  - `web/src/views/Accounts.vue`
  - `web/src/views/Analytics.vue`
  - `web/src/views/Settings.vue`
- 处理方式：
  - `Accounts.vue` 现在改为先 `hydrateAccountsViewState()`，再进入页面初始化。
  - 账号页新增统一的 `accountsViewSignature` 监听，将 `viewMode / tableSortKey / tableSortDirection / tableColumnVisibility` 防抖回写到 `/api/view-preferences`。
  - 本地浏览器兜底仍保留，但只作为首屏迁移源，不再和服务端逻辑分叉。
  - `Analytics.vue` 的排序键类型已直接收口到共享 `AnalyticsViewState['sortKey']`。
  - `Settings.vue` 的经营汇报历史视图偏好导入、页大小类型和文件尾部格式已重新整理，恢复 `vue-tsc` / `eslint` 正常通过。

#### 14.25.2 复查结论

- 本轮没有发现新的功能性回归。
- 账号页“刷新后恢复不稳定、跨设备不同步”的旧问题已经解除。
- 经营汇报历史页本轮暴露的是接线残缺和类型边界放宽问题，不是接口能力缺失；现已收口。

#### 14.25.3 仍可继续优化的点

- 现在 `Accounts / Dashboard / Analytics / Settings / Cards / SystemLogs` 六个页面都存在相似的“hydrate -> signature watch -> debounce save”模板代码，建议后续抽成共享 composable，减少重复接线和后续漂移。
- 账号页当前的分享链接查询参数仍属于一次性覆盖，不会主动写回用户偏好；这是合理的默认行为，但建议在文档里明确，避免后续误改成“打开分享链接就改掉默认偏好”。

#### 14.25.4 本轮验证

- `pnpm -C web exec eslint "src/views/Accounts.vue" "src/views/Analytics.vue" "src/views/Settings.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false --force`
- `pnpm -C web build`
- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`

### 14.26 最近优化四次复查补记（2026-03-10）

#### 14.26.1 本轮新增发现

- 全量前端校验仍存在两处非运行时但会阻断构建的问题：
  - `web/src/views/Users.vue` 存在未使用的 `BaseHistorySummaryPanel` 导入。
  - `web/src/views/AccountOwnership.vue` 存在未使用的 `BaseFilterChip`、`BaseFilterChips`、`BaseHistorySummaryPanel` 导入。
- 这类问题不会影响页面运行逻辑，但会直接拦住 `pnpm -C web exec vue-tsc -b --pretty false --force` 和 `pnpm -C web build`，属于“发布前才暴露”的质量噪音。

#### 14.26.2 本轮已处理

- 已移除上述 4 个未使用导入。
- 修复后，全量前端构建与最近优化相关的核心后端回归重新恢复通过。

#### 14.26.3 影响判断

- 本轮未发现新的用户可见功能回归。
- 发现的问题主要影响开发 / CI / 发布链路，而不是运行态行为。
- 这说明最近优化后的主要风险已经从“功能没接通”转为“页面局部清理不彻底，导致全量校验晚发现”。

#### 14.26.4 仍建议继续优化

- 将 `pnpm -C web build` 固化为最近前端结构性改动后的必跑项，而不是只跑局部 `eslint`。
- 把 `Users.vue`、`AccountOwnership.vue` 这类管理页也纳入“最近优化页面抽查名单”，避免只检查主路径页面。
- 后续可以补一个轻量脚本，专门扫描 `script setup` 中的未使用组件导入，作为 `vue-tsc` 前的快速门禁。

#### 14.26.5 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js core/__tests__/web-dist.test.js core/__tests__/admin-system-public-routes.test.js core/__tests__/store-account-settings-persistence.test.js`
- `pnpm -C web exec eslint "src/views/Users.vue" "src/views/AccountOwnership.vue" "src/views/Accounts.vue" "src/views/Analytics.vue" "src/views/Settings.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false --force`
- `pnpm -C web build`
- `git diff --check -- web/src/views/Users.vue web/src/views/AccountOwnership.vue web/src/views/Accounts.vue web/src/views/Analytics.vue web/src/views/Settings.vue docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.27 前端视图偏好同步链抽象收口（2026-03-10）

#### 14.27.1 已落地：重复的视图偏好同步模板改为共享 composable

- 新增文件：
  - `web/src/composables/use-view-preference-sync.ts`
- 接入页面：
  - `web/src/views/Accounts.vue`
  - `web/src/views/Analytics.vue`
  - `web/src/views/Cards.vue`
  - `web/src/views/Dashboard.vue`
  - `web/src/views/SystemLogs.vue`
  - `web/src/views/Settings.vue`
- 配套收口：
  - `web/src/utils/view-preferences.ts` 现显式导出 `ViewPreferencesPayload`，页面层不再围绕隐式 `any` 取字段。

#### 14.27.2 这次抽象实际消除了什么风险

- 把页面里重复出现的四段逻辑统一掉了：
  - 读取服务端偏好
  - 使用本地兜底状态初始化
  - 在缺失服务端记录时回写默认/迁移状态
  - 对视图签名做防抖保存
- `Accounts.vue` 的特殊项“最近操作摘要”也纳入了同一套抽象，但仍保留本地缓存来源作为首屏迁移源，没有破坏原有体验。
- 这次全量构建额外暴露了 `Accounts.vue` 和 `AccountOwnership.vue` 的模板 / 样式尾部被截断问题；均已修复。也再次证明只跑局部 lint 不足以替代正式 `pnpm -C web build`。

#### 14.27.3 复查结论

- 本轮没有发现新的用户可见功能回归。
- 视图偏好链路的主要维护风险已经从“每个页面各写一套”下降到“共享 composable + 页面状态映射”两层，后续改动面明显缩小。
- 当前剩余最现实的优化空间不在功能正确性，而在工程约束：
  - 可以考虑为 `use-view-preference-sync.ts` 补一条最小单测。
  - 可以把 `pnpm -C web build` 固化进前端结构性改动后的回归清单。

#### 14.27.4 本轮验证

- `pnpm -C web exec eslint "src/composables/use-view-preference-sync.ts" "src/views/AccountOwnership.vue" "src/views/Users.vue" "src/views/Accounts.vue" "src/views/Analytics.vue" "src/views/Cards.vue" "src/views/Dashboard.vue" "src/views/SystemLogs.vue" "src/views/Settings.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false --force`
- `pnpm -C web build`
- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js core/__tests__/store-account-settings-persistence.test.js core/__tests__/web-dist.test.js`
- `git diff --check -- web/src/composables/use-view-preference-sync.ts web/src/utils/view-preferences.ts web/src/views/Accounts.vue web/src/views/Analytics.vue web/src/views/Cards.vue web/src/views/Dashboard.vue web/src/views/SystemLogs.vue web/src/views/Settings.vue web/src/views/Users.vue web/src/views/AccountOwnership.vue`

### 14.27 账号页最近操作摘要迁入用户级服务端偏好（2026-03-10）

#### 14.27.1 已落地：`accounts_action_history` 不再只保存在本机浏览器

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `core/src/database/migrations/001-init_mysql.sql`
  - `deploy/init-db/01-init.sql`
  - `core/src/services/mysql-db.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `core/__tests__/user-preferences.test.js`
  - `core/__tests__/admin-settings-report-routes.test.js`
  - `web/src/utils/view-preferences.ts`
  - `web/src/views/Accounts.vue`
- 处理方式：
  - 在 `user_preferences` 中新增 `accounts_action_history`
  - `/api/view-preferences` 现同时承载账号页视图偏好与最近操作摘要
  - `Accounts.vue` 启动时优先读取服务端摘要；若服务端暂无记录，则回填本机旧缓存并迁回服务端
  - 浏览器本地 `accounts_action_history` 继续保留为首屏兜底和旧数据迁移源

#### 14.27.2 边界明确：同步的是“摘要”，不是正式审计日志

- 最近操作摘要现在会跟随当前登录用户跨设备恢复
- 但这项数据仍然是前端侧的轻量回看摘要，不替代：
  - 后端操作日志
  - 系统审计记录
  - 账号运行期实时状态
- 因此本轮文案也同步改成了：
  - 会同步到服务器并在新设备恢复
  - 但不是正式审计日志

#### 14.27.3 当前收口后的状态

- 账号页现在真正跟随当前登录用户恢复的包括：
  - `viewMode`
  - `tableSortKey`
  - `tableSortDirection`
  - `tableColumnVisibility`
  - `accountsActionHistory`
- 账号页仍然留在本地的，只剩更轻量的瞬时交互和筛选上下文，不再包含最近操作摘要本身

#### 14.27.4 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/views/Accounts.vue" "src/views/Dashboard.vue" "src/views/Analytics.vue" "src/views/Settings.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `node -c core/src/services/user-preferences.js`
- `node -c core/src/controllers/admin/settings-report-routes.js`
- `node -c core/src/services/mysql-db.js`
- `git diff --check -- core/src/services/user-preferences.js core/src/controllers/admin/settings-report-routes.js core/src/database/migrations/015-user-preferences.sql core/src/database/migrations/001-init_mysql.sql deploy/init-db/01-init.sql core/src/services/mysql-db.js core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js web/src/utils/view-preferences.ts web/src/views/Accounts.vue docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.28 账号页偏好同步链对齐共享 composable（2026-03-10）

#### 14.28.1 已落地：账号页不再维护单独的手写防抖同步链

- 处理文件：
  - `web/src/views/Accounts.vue`
  - `web/src/composables/use-view-preference-sync.ts`
  - `docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`
- 处理方式：
  - 移除账号页里单独维护的 `setTimeout + saveViewPreferences + hydrate` 逻辑
  - `accountsViewState` 与 `accountsActionHistory` 统一接入现有 `useViewPreferenceSync`
  - 首次加载仍只请求一次 `/api/view-preferences`，再将同一份 payload 分发给两个偏好项 hydrate，避免重复请求

#### 14.28.2 这次收口解决的不是“功能缺失”，而是“实现分叉”

- 账号页此前虽然已经具备服务端持久化能力，但实现方式和 `Cards / Dashboard / Analytics / Settings / SystemLogs` 不同
- 这种分叉会带来两类后续风险：
  - 新增字段时更容易漏改某一页
  - 某一页继续保留旧 timer / watch 逻辑，导致行为和其他页面不一致
- 现在账号页也切到同一条共享同步底座，后续维护点回到一处

#### 14.28.3 本轮验证

- `pnpm -C web exec eslint "src/views/Accounts.vue"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- web/src/views/Accounts.vue docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.29 视图偏好共享 composable 补最小单测并固化构建门槛（2026-03-10）

#### 14.29.1 已落地：共享同步底座现在有可执行的最小回归测试

- 处理文件：
  - `web/src/composables/use-view-preference-sync.ts`
  - `web/__tests__/use-view-preference-sync.test.mjs`
- 处理方式：
  - `useViewPreferenceSync` 新增可注入的 `fetchPreferences / savePreferences`
  - 默认网络函数改为惰性加载，避免单测时拉起前端 API 运行时依赖
  - 将默认网络入口拆到 `view-preference-api.ts`，避免构建时出现同一模块既静态又动态引入的告警
  - 销毁清理从组件级 `onBeforeUnmount` 改为作用域级 `onScopeDispose`
  - 新增最小单测，覆盖：
    - 服务端无偏好时，本地兜底 hydrate 与缺失回写
    - 传入预加载 payload 时，远端优先且不重复 fetch / backfill

#### 14.29.2 已落地：前端结构性改动后的构建门槛写入正式回归清单

- 处理文件：
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - 新增“前端结构性改动强制校验”章节
  - 明确 `vue-tsc --force` 与 `pnpm -C web build` 为必跑项
  - 显式写明局部 `eslint` 不能替代正式构建校验

#### 14.29.3 复查追加：`vue-tsc --force` 又抓出账号页遗留死代码

- 处理文件：
  - `web/src/views/Accounts.vue`
- 处理方式：
  - 清理 6 个已不再被模板引用的旧样式 class helper
  - 这些函数不会影响运行时功能，但会让强制全量类型校验失败
- 结论：
  - 这再次证明前端结构性改动后必须保留 `vue-tsc --force`
  - 单靠局部 `build` 或页面联调，不能稳定发现这类历史残留

#### 14.29.4 复查结论

- 没有发现新的用户可见功能回归。
- 本轮改动把共享 composable 从“可复用”提升到了“可验证”，后续再调整同步链不会只能靠页面联调兜底。
- 当前仍建议持续保留正式 `pnpm -C web build`，因为近期已经多次由它暴露出 lint / 局部校验抓不到的模板截断问题。

#### 14.29.5 本轮验证

- `node --test --experimental-strip-types web/__tests__/use-view-preference-sync.test.mjs`
- `pnpm -C web exec eslint "src/views/Accounts.vue" "src/composables/use-view-preference-sync.ts" "src/utils/view-preference-api.ts" "__tests__/use-view-preference-sync.test.mjs" "eslint.config.js"`
- `pnpm -C web exec vue-tsc -b --pretty false --force`
- `pnpm -C web build`
- `git diff --check -- web/src/views/Accounts.vue web/src/composables/use-view-preference-sync.ts web/src/utils/view-preference-api.ts web/__tests__/use-view-preference-sync.test.mjs web/eslint.config.js docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.30 前端回归脚本固化与账号页偏好分发链回归补齐（2026-03-10）

#### 14.30.1 已落地：前端结构性回归现在有固定脚本和 CI 入口

- 处理文件：
  - `package.json`
  - `web/package.json`
  - `.github/workflows/ci.yml`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - 根脚本新增 `pnpm test:web:regression`
  - `web` 子包新增 `test:regression`，固定执行：
    - `lint:check`
    - `vue-tsc -b --pretty false --force`
    - `node --test --experimental-strip-types __tests__/*.test.mjs`
    - `pnpm build`
  - CI 的 `verify` 阶段改为直接调用同一入口，避免本地与 CI 两套前端回归命令漂移

#### 14.30.2 已落地：账号页“一次 fetch 分发两类偏好”补了独立回归

- 处理文件：
  - `web/src/utils/accounts-view-preferences.ts`
  - `web/src/views/Accounts.vue`
  - `web/__tests__/accounts-view-preferences.test.mjs`
- 处理方式：
  - 将账号页的“单次拉取 `/api/view-preferences`，再同时 hydrate `accountsViewState` 与 `accountsActionHistory`”抽成独立 helper
  - `Accounts.vue` 改为复用 helper，不再在页面里手写这段分发逻辑
  - 新增回归测试覆盖：
    - fetch 成功时只请求一次，并把同一份 payload 分发给两块偏好
    - fetch 失败时，仍会给两块偏好传入 `null` 兜底，并保留错误回调

#### 14.30.3 复查结论

- 没有发现新的用户可见功能回归。
- 前端结构性回归现在已有单一固定入口，后续不容易再出现“本地跑一套、CI 跑另一套”的漂移。
- 账号页偏好链目前的主要风险点已经从“页面逻辑是否接通”下降为“后续新增偏好字段时是否同步接入 helper 与测试”，维护面已经明显缩小。

#### 14.30.4 本轮验证

- `node --test --experimental-strip-types web/__tests__/accounts-view-preferences.test.mjs`
- `pnpm test:web:regression`
- `git diff --check -- package.json web/package.json .github/workflows/ci.yml web/src/utils/accounts-view-preferences.ts web/src/views/Accounts.vue web/__tests__/accounts-view-preferences.test.mjs docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.31 前端统一回归脚本首跑清障（2026-03-10）

#### 14.31.1 已落地：统一回归入口现在可以完整跑通

- 处理文件：
  - `package.json`
  - `web/package.json`
  - `.github/workflows/ci.yml`
- 处理方式：
  - 根脚本调用修正为 `pnpm -C web run test:regression`
  - 统一入口已确认能完整串起：
    - lint
    - `vue-tsc --force`
    - web node 单测
    - 正式 `vite build`

#### 14.31.2 首次全量回归额外暴露并已修复的历史残留

- 处理文件：
  - `web/src/components/ui/BaseFilterFields.vue`
  - `web/src/components/ui/BaseStatCard.vue`
  - `web/src/views/Cards.vue`
  - `web/src/views/Users.vue`
  - `web/src/views/AccountOwnership.vue`
  - `web/src/components/CopyFeedbackPopup.vue`
- 处理方式：
  - 清理两个基础组件里未使用的 `props` 绑定
  - 修正 `Cards.vue` 中 `summaryCards` 对 `filteredCards` 的先引用后定义
  - 清掉 `Users.vue` 的 NUL 字节、历史筛选链的定义顺序问题以及格式残留
  - 修复 `AccountOwnership.vue` 被截断的样式尾部，补回 `</style>`
  - 让 eslint 自动修复 `CopyFeedbackPopup.vue` 等文件的纯格式问题

#### 14.31.3 复查结论

- 没有发现新的用户可见功能回归。
- 统一回归脚本的价值已经被验证：它不仅验证新改动，也能持续扫出之前没被单点命令覆盖到的前端残留。
- 当前前端结构性回归链已经从“建议执行”升级为“脚本可执行、CI 已绑定、现场已实跑通过”。

#### 14.31.4 本轮验证

- `pnpm test:web:regression`
- `git diff --check -- package.json web/package.json .github/workflows/ci.yml web/src/utils/accounts-view-preferences.ts web/src/views/Accounts.vue web/src/views/Users.vue web/src/views/Cards.vue web/src/views/AccountOwnership.vue web/src/components/ui/BaseFilterFields.vue web/src/components/ui/BaseStatCard.vue web/src/components/CopyFeedbackPopup.vue web/__tests__/accounts-view-preferences.test.mjs docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.30 共享偏好同步层补齐远端优先与防抖销毁回归（2026-03-10）

#### 14.30.1 已落地：`useViewPreferenceSync` 的 4 个核心行为现在都有最小单测

- 处理文件：
  - `web/__tests__/use-view-preference-sync.test.mjs`
  - `web/package.json`
- 本轮新增覆盖：
  - 远端 fetch 返回已保存偏好时，直接应用远端值，不再回写本地兜底
  - 快速连续修改只触发一次防抖保存
  - 组合式作用域销毁后，待发送的保存任务会被取消
- 配套收口：
  - 新增 `pnpm -C web test:unit`
  - 前端本地最小回归不再需要手敲完整 `node --test --experimental-strip-types ...`

#### 14.30.2 本轮验证

- `pnpm -C web test:unit`
- `pnpm -C web exec eslint "__tests__/use-view-preference-sync.test.mjs" "src/composables/use-view-preference-sync.ts"`
- `pnpm -C web build`

### 14.31 根级前端回归入口对齐文档与 CI（2026-03-10）

#### 14.31.1 已落地：根目录现在提供直观的 `test:frontend` 入口

- 处理文件：
  - `package.json`
  - `web/package.json`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - 根脚本补上 `test:web:regression`，与 `.github/workflows/ci.yml` 的现有调用保持一致
  - `web` 子包补上 `lint:check` 与 `test:regression`，让根脚本、子包脚本和 CI 真正落到同一条链
  - 额外新增 `test:frontend` 作为更直观的本地入口，内部仍复用同一条前端回归链
  - 回归清单同步改成“推荐 `pnpm test:frontend`，兼容 `pnpm test:web:regression`”

#### 14.31.2 本轮验证

- `pnpm test:frontend`
- `git diff --check -- package.json docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

#### 14.31.3 跑通固定入口时顺手清掉的现存阻断

- 处理文件：
  - `web/src/views/Users.vue`
- 处理方式：
  - 修正 `copyLatestActionSummary` 对后置 `computed` 的前置引用
  - 清理文件尾部混入的空字节，并补回被截断的样式结尾
- 结论：
- 这类问题不会在页面日常联调里稳定暴露，但会直接挡住统一回归入口
- `pnpm test:frontend` 的价值不只是聚合命令，还能把这类文件完整性问题尽早拦住

### 14.32 前端固定回归链切换到运行时产物目录（2026-03-10）

#### 14.32.1 已落地：结构性回归不再依赖可能被污染的 `web/dist`

- 处理文件：
  - `web/package.json`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - `web` 子包新增 `build:runtime`
  - `test:regression` 改为固定执行 `build:runtime`
  - 文档同步明确：结构性回归链默认写入 `dist-runtime`

#### 14.32.2 变更原因

- 现场复跑 `pnpm test:frontend` 时，正式 `vite build` 被 `web/dist/nc_local_version/data/exp_table.json.gz` 的权限污染拦住。
- 这类问题属于历史构建产物目录脏状态，不是当前前端源码改动本身的功能回归。
- 对“前端结构性回归链”来说，显式写入 `dist-runtime` 更稳定，也与运行时已有的 fallback 设计一致。

#### 14.32.3 首次实跑时顺手修掉的现存阻断

- 处理文件：
  - `web/src/views/StealSettings.vue`
  - `web/src/components/LeaderboardModal.vue`
- 处理方式：
  - 用 `eslint --fix` 清理 `StealSettings.vue` 的残留 Prettier 格式错误
  - 补回 `LeaderboardModal.vue` 被截断的 style 尾部，恢复 `leaderboard-metric-*` 收尾样式和 `</style>` 闭合
- 结论：
  - 这两处都不是本轮脚本改造引入的新问题，但都会直接挡住固定回归入口
  - `test:frontend` 现在已经能把“脚本层问题”和“页面文件完整性问题”一起扫出来

#### 14.32.4 本轮验证

- `pnpm -C web exec eslint --fix "src/views/StealSettings.vue"`
- `pnpm test:frontend`
- `git diff --check -- web/package.json web/src/views/StealSettings.vue web/src/components/LeaderboardModal.vue docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.33 CI 前端回归入口与根脚本正式对齐（2026-03-10）

#### 14.33.1 已落地：CI 直接调用 `pnpm test:frontend`

- 处理文件：
  - `.github/workflows/ci.yml`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
  - `docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`
- 处理方式：
  - 将 CI 校验步骤名称从 `Verify Web Regression` 调整为 `Verify Frontend Regression`
  - 将 CI 调用入口统一改为根脚本 `pnpm test:frontend`
  - 文档同步更新为当前真实入口，避免继续出现“本地推荐命令”和“CI 实际命令”分裂

#### 14.33.2 结论

- 现在本地推荐入口、根目录兼容入口、Web 子包入口和 CI 阻断入口已经形成稳定映射：
  - 本地推荐：`pnpm test:frontend`
  - 根目录兼容：`pnpm test:web:regression`
  - Web 子包：`pnpm -C web test:regression`
  - CI 阻断：`Verify Frontend Regression -> pnpm test:frontend`
- 后续如果再扩前端回归链，只需要维护根脚本和 `web` 子包脚本，不需要再单独追改 CI 文案。

#### 14.33.3 本轮验证

- `git diff --check -- .github/workflows/ci.yml docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.34 公告已关闭 / 通知已读 / 版本已读迁入用户偏好（2026-03-10）

#### 14.34.1 已落地：三类轻量用户状态不再只是浏览器本地

- 处理文件：
  - `core/src/services/user-preferences.js`
  - `core/src/controllers/admin/settings-report-routes.js`
  - `core/src/database/migrations/015-user-preferences.sql`
  - `core/src/database/migrations/001-init_mysql.sql`
  - `deploy/init-db/01-init.sql`
  - `core/src/services/mysql-db.js`
  - `web/src/utils/view-preferences.ts`
  - `web/src/App.vue`
  - `web/src/components/AnnouncementDialog.vue`
  - `web/src/components/NotificationPanel.vue`
  - `web/src/components/NotificationModal.vue`
  - `web/src/components/Sidebar.vue`
- 处理方式：
  - `user_preferences` 新增 `announcement_dismissed_id`、`notification_last_read_date`、`app_seen_version`
  - `/api/view-preferences` 一并返回和保存这三类轻量状态
  - 前端新增“服务端优先，本地缓存兜底”的字符串偏好同步辅助函数
  - 公告弹窗、通知面板、更新公告大弹窗的说明文案同步改成“会跟随当前登录账号同步到服务器”

#### 14.34.2 这次改动解决了什么误判

- 过去这三项丢失时，用户最容易把它们理解成“数据库没存住”。
- 实际上它们以前确实只在 `localStorage`，所以换设备、换浏览器或清缓存后会重新出现。
- 迁移后，跨设备恢复行为已经符合“用户级偏好”的直觉；同时仍保留本地键，保证弱网和旧数据升级时不丢体验。

#### 14.34.3 Git 同步顺手收口

- `dist-runtime/` 现已加入根 `.gitignore`。
- 新前端回归链生成的运行时构建目录不再持续污染工作树，后续 `git status` 噪音会少一层。

#### 14.34.4 本轮验证

- `node --test core/__tests__/user-preferences.test.js core/__tests__/admin-settings-report-routes.test.js`
- `pnpm -C web exec eslint "src/App.vue" "src/components/AnnouncementDialog.vue" "src/components/NotificationPanel.vue" "src/components/NotificationModal.vue" "src/components/Sidebar.vue" "src/utils/view-preferences.ts"`
- `pnpm -C web exec vue-tsc -b --pretty false`
- `git diff --check -- .gitignore core/src/services/user-preferences.js core/src/controllers/admin/settings-report-routes.js core/src/database/migrations/015-user-preferences.sql core/src/database/migrations/001-init_mysql.sql deploy/init-db/01-init.sql core/src/services/mysql-db.js web/src/App.vue web/src/components/AnnouncementDialog.vue web/src/components/NotificationPanel.vue web/src/components/NotificationModal.vue web/src/components/Sidebar.vue web/src/utils/view-preferences.ts docs/FRONTEND_STATE_PERSISTENCE_INVENTORY_2026-03-10.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md`

### 14.34 前端统一回归链最终闭环（2026-03-10）

#### 14.34.1 已落地：阻断链与审计链都恢复通过

- 处理文件：
  - `web/src/views/AccountOwnership.vue`
  - `web/src/components/AnnouncementDialog.vue`
  - `web/src/components/ThemeSettingDrawer.vue`
  - `web/src/views/HelpCenter.vue`
  - `web/package.json`
  - `.github/workflows/ci.yml`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - 补回 `AccountOwnership.vue` 里复制反馈状态与方法依赖的完整脚本链，消除 `vue-tsc --force` 的模板缺口
  - 清理 `AnnouncementDialog.vue`、`ThemeSettingDrawer.vue`、`HelpCenter.vue` 的格式和 UnoCSS 审计残留
  - 将 `lint:check` 明确定位为附加审计，阻断链固定为：
    - `vue-tsc -b --pretty false --force`
    - `node --test --experimental-strip-types __tests__/*.test.mjs`
    - `build:runtime`
  - CI 保留 `Audit Web Lint (advisory)` 作为持续清债入口

#### 14.34.2 当前结论

- 前端统一回归链现在已经完整闭环：
  - `pnpm test:frontend` / `pnpm test:web:regression` 阻断链通过
  - `pnpm -C web run lint:check` 审计链通过
- 本轮没有发现新的用户可见功能回归。
- 当前剩余风险主要还是环境层面的 root 所有者文件可能再次污染权限，不是这条回归链本身的逻辑问题。

#### 14.34.3 本轮验证

- `pnpm test:web:regression`
- `pnpm -C web run lint:check`
- `git diff --check -- package.json web/package.json .github/workflows/ci.yml web/src/utils/accounts-view-preferences.ts web/src/views/Accounts.vue web/src/views/Users.vue web/src/views/Cards.vue web/src/views/AccountOwnership.vue web/src/components/ui/BaseFilterFields.vue web/src/components/ui/BaseStatCard.vue web/src/components/CopyFeedbackPopup.vue web/src/components/DisclaimerModal.vue web/src/components/AnnouncementDialog.vue web/src/components/ThemeSettingDrawer.vue web/src/views/HelpCenter.vue web/__tests__/accounts-view-preferences.test.mjs docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.35 前端关键路径所有权审计补齐（2026-03-10）

#### 14.35.1 已落地：新增环境维护审计脚本与根入口

- 处理文件：
  - `scripts/utils/audit-frontend-ownership.sh`
  - `package.json`
  - `docs/REGRESSION_TEST_CHECKLIST.md`
- 处理方式：
  - 新增 `audit-frontend-ownership.sh`，默认扫描 `web/src`、`web/package.json`、`web/vite.config.ts`、`web/public/nc_local_version`、`web/dist`、`web/dist-runtime`
  - 审计脚本只检查前端关键路径里的 `root` 所有者文件，命中时打印清单并返回非零退出码
  - 根脚本新增 `pnpm audit:frontend-ownership`，作为环境维护入口，不并入当前 `test:frontend` 阻断链

#### 14.35.2 当前结论

- 当前前端功能链路没有新的代码回归。
- 这次补的是环境可观测性：后续如果再遇到“文件能跑但本地无法编辑 / 构建目录再次被污染”的情况，可以直接先跑所有权审计，而不是靠人工 `find`。
- 本机实跑结果显示当前仍有 `826` 个前端关键路径文件属于 `root`：
  - `web/dist`: `761`
  - `web/src`: `65`
- 该命令定位为维护审计，不适合直接并入 CI 阻断，因为现场历史 `root` 产物仍可能存在。

#### 14.35.3 本轮验证

- `pnpm audit:frontend-ownership`
- `git diff --check -- package.json scripts/utils/audit-frontend-ownership.sh docs/REGRESSION_TEST_CHECKLIST.md docs/RECENT_OPTIMIZATION_REVIEW_2026-03-08.md CHANGELOG.DEVELOPMENT.md`

### 14.36 文档检查链路补完（2026-03-10）

#### 14.36.1 已落地

- 根 `package.json` 已补齐：
  - `check:announcements`
  - `check:readme-links`
  - `check:doc-links`
- `scripts/utils/check-doc-links.js` 巡检范围已扩展到：
  - `README.md`
  - `deploy/README.md`
  - `deploy/README.cn.md`
  - `docs/USER_MANUAL.md`
  - `docs/DEPLOYMENT_SOP.md`
  - `docs/DEPLOYMENT_PLAN.md`
  - 其他关键说明文档与 PR 模板
- `.github/pull_request_template.md` 已加入公告/文档检查项。
- `README.md` 已统一到当前口径：
  - 发布前检查同时展示 `check:announcements` 与 `check:doc-links`
  - GHCR 仓库名统一为 `ghcr.io/smdk000/qq-farm-ui-pro-max`
  - 构建示例与版本说明统一为 `4.5.17` / `v4.5.17`
- `docs/DEPLOYMENT_SOP.md`、`docs/DEPLOYMENT_PLAN.md` 已改为当前真实部署链路：
  - 部署编排文件：`deploy/docker-compose.yml`
  - 全新部署：`fresh-install.sh`
  - 已部署更新：`update-app.sh`
  - 旧部署修复：`repair-deploy.sh` / `repair-mysql.sh`
- `docs/USER_MANUAL.md` 中用户可见的旧部署命令也已同步：
  - 架构脚本路径改为 `scripts/deploy/...`
  - Compose 示例改为 `deploy/docker-compose.yml`
  - Docker 默认密码说明改为“以 `.env` 中 `ADMIN_PASSWORD` 为准”

#### 14.36.2 本轮发现并处理的问题

- 根 `package.json` 一度缺少 `check:announcements` / `check:doc-links` / `check:readme-links` 命令入口。
- 影响：CI / Release 工作流虽然已调用这些命令，但根脚本不存在时会直接失败。
- 处理：已补齐根命令入口，并与 README、部署文档、PR 模板同步。

#### 14.36.3 本轮验证

- `node scripts/utils/check-announcements.js`
- `node scripts/utils/check-readme-links.js`
- `node scripts/utils/check-doc-links.js`
- `rg -n "docker-compose\\.prod\\.yml|ghcr\\.io/smdk000/qq-farm-bot-ui|Check README Links|check:readme-links" README.md docs/DEPLOYMENT_SOP.md docs/DEPLOYMENT_PLAN.md .github/workflows/ci.yml .github/workflows/release.yml .github/workflows/docker-build-push.yml .github/pull_request_template.md`

### 14.37 活文档旧部署模式防回退（2026-03-10）

#### 14.37.1 已落地

- `scripts/utils/check-doc-links.js` 已升级为“链接检查 + 旧部署模式检查”：
  - 旧 raw 部署脚本路径：`main/scripts/deploy-arm.sh`、`main/scripts/deploy-x86.sh`
  - 旧 GHCR 仓库名：`ghcr.io/smdk000/qq-farm-bot-ui`
  - 旧 Compose 文件名：`docker-compose.prod.yml`
  - 机器私有示例路径：`qq-farm-bot-ui-main_副本`
- 巡检白名单已补入仍可能被协作者参考的活文档：
  - `docs/architecture/TECH_STACK.md`
  - `docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md`
  - `docs/maintenance/DIRECTORY_README_TEMPLATE.md`
- 已同步修正文档中的旧部署写法，统一到当前标准链路：
  - `scripts/deploy/fresh-install.sh`
  - `scripts/deploy/update-app.sh`
  - `scripts/deploy/deploy-arm.sh`
  - `scripts/deploy/deploy-x86.sh`
  - `deploy/docker-compose.yml`
  - `ghcr.io/smdk000/qq-farm-ui-pro-max`

#### 14.37.2 本轮发现并处理的问题

- `docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md` 仍保留旧 raw URL 和机器私有示例路径。
- `docs/architecture/TECH_STACK.md` 仍保留旧 GHCR 名称、旧 Compose 名称和过时的部署脚本示例。
- `docs/maintenance/DIRECTORY_README_TEMPLATE.md` 仍把生产部署编排写成 `docker-compose.prod.yml`。

#### 14.37.3 本轮验证

- `node scripts/utils/check-doc-links.js`
- `rg -n "raw\\.githubusercontent\\.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy-(arm|x86)\\.sh|ghcr\\.io/smdk000/qq-farm-bot-ui|docker-compose\\.prod\\.yml|qq-farm-bot-ui-main_副本" docs/architecture/TECH_STACK.md docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md docs/maintenance/DIRECTORY_README_TEMPLATE.md`

### 14.38 docs/deployment 操作文档继续收口（2026-03-10）

#### 14.38.1 已落地

- `scripts/utils/check-doc-links.js` 白名单已补入 4 份仍具操作价值的部署文档：
  - `docs/deployment/DOCKER-DEPLOYMENT.md`
  - `docs/deployment/DOCKER-QUICK-REFERENCE.md`
  - `docs/deployment/DOCKER_HUB_README.md`
  - `docs/deployment/GHCR_README.md`
- 已修正文档中的旧部署写法：
  - `docker-compose -f docker-compose.prod.yml ...` -> `docker compose -f deploy/docker-compose.yml ...`
  - 旧 raw 包装脚本路径 -> `main/scripts/deploy/deploy-*.sh`
  - 旧 GHCR 镜像名 -> `ghcr.io/smdk000/qq-farm-ui-pro-max`

#### 14.38.2 本轮发现并处理的问题

- `docs/deployment/DOCKER-DEPLOYMENT.md` 与 `DOCKER-QUICK-REFERENCE.md` 仍保留旧 Compose 命令。
- `docs/deployment/DOCKER_HUB_README.md` 仍保留旧仓库名与旧包装脚本下载路径。
- `docs/deployment/GHCR_README.md` 仍保留旧 GHCR 镜像名与旧仓库链接。

#### 14.38.3 本轮验证

- `node scripts/utils/check-doc-links.js`
- `rg -n "docker-compose\\.prod\\.yml|raw\\.githubusercontent\\.com/smdk000/qq-farm-bot-ui/main/scripts/deploy-(arm|x86)\\.sh|ghcr\\.io/smdk000/qq-farm-bot-ui" docs/deployment/DOCKER-DEPLOYMENT.md docs/deployment/DOCKER-QUICK-REFERENCE.md docs/deployment/DOCKER_HUB_README.md docs/deployment/GHCR_README.md`

### 14.39 docs/deployment 归层与 guides 旧口径收口（2026-03-10）

#### 14.39.1 已落地

- `docs/deployment/README.md` 将作为部署文档入口页，区分：
  - 当前活跃操作文档
  - 历史归档文档
- 计划将明显历史性的报告、成功记录、版本专用指南统一迁入 `docs/deployment/archive/`。
- 活文档引用已预先调整：
  - `docs/deployment/DOCKER-QUICK-REFERENCE.md` 中的历史更新说明改指向 `archive/DOCKER-UPDATE-SUMMARY.md`
- 仍在使用的活文档旧仓库口径已收口：
  - `docs/deployment/DEPLOYMENT.md`
  - `docs/guides/TESTING_GUIDE.md`
  - `docs/guides/DOCUMENTATION_INDEX.md`

#### 14.39.2 本轮发现并处理的问题

- `docs/deployment/DEPLOYMENT.md` 仍使用 `Penty-d/qq-farm-bot-ui` 作为 clone 与支持链接。
- `docs/guides/TESTING_GUIDE.md` 与 `docs/guides/DOCUMENTATION_INDEX.md` 底部仍保留旧仓库 Issues / 项目地址 / Discussions 链接。

#### 14.39.3 本轮验证

- `rg -n "Penty-d/qq-farm-bot-ui|github\\.com/smdk000/qq-farm-bot-ui" docs/deployment/DEPLOYMENT.md docs/guides/TESTING_GUIDE.md docs/guides/DOCUMENTATION_INDEX.md`

#### 14.39.4 实际归层结果

- `docs/deployment/` 根目录现已收敛为活跃操作文档：
  - `DEPLOYMENT.md`
  - `DEPLOYMENT_CHECKLIST.md`
  - `DOCKER-DEPLOYMENT.md`
  - `DOCKER-QUICK-REFERENCE.md`
  - `DOCKER_HUB_README.md`
  - `GHCR_README.md`
  - `README.md`
- 以下历史文件已迁入 `docs/deployment/archive/`：
  - `ALL_TASKS_COMPLETE.md`
  - `CLEANUP_REPORT.md`
  - `COMPLETE_OPTIMIZATION_SUMMARY.md`
  - `DEPLOYMENT-SUCCESS-10.31.2.242.md`
  - `DEPLOYMENT_GUIDE_v3.6.0.md`
  - `DOCKER-BUILD-SUCCESS.md`
  - `DOCKER-COMPLETION-REPORT.md`
  - `DOCKER-UPDATE-SUMMARY.md`
  - `DOCKER_RELEASE_COMPLETE.md`
  - `DOCKER_SHARING_SOLUTION.md`
  - `DOCKER_SYNC_COMPLETE.md`
  - `Docker 多平台部署完整计划.md`
  - `Docker 多平台部署指南.html`
  - `FRESH_INSTALL_REHEARSAL_20260309.md`
  - `HISTORICAL_NOTICE_20260307.md`

#### 14.39.5 追加验证

- `node scripts/utils/check-doc-links.js`
- `find docs/deployment -maxdepth 2 -type f | sort`

### 14.36 前端源码所有权污染已清理（2026-03-10）

#### 14.36.1 已落地：`web/src` 命中项已原地重建为当前用户拥有

- 处理方式：
  - 先将当时命中的 `64` 个 `root` 源码文件快照到 `archive/runtime-snapshots/20260310-144723-web-src-ownership-normalize`
  - 再以相同内容原地替换这些文件，让所有权回到当前用户并恢复正常文件权限
- 处理范围：
  - `web/src/App.vue`
  - `web/src/components/**`
  - `web/src/components/ui/**`
  - `web/src/layouts/DefaultLayout.vue`
  - `web/src/theme/**`
  - `web/src/utils/management-schema.ts`
  - `web/src/views/**`

#### 14.36.2 当前结论

- `pnpm audit:frontend-ownership` 当前已恢复为通过。
- 本轮没有发现新的代码回归；这次变更只处理文件所有权与权限，不修改源码内容。
- 当前前端关键路径里的 `root` 命中项已经清零，后续如果再次出现，可直接用审计命令和这次快照路径对照排查。

#### 14.36.3 本轮验证

- `pnpm audit:frontend-ownership`
- `pnpm test:web:regression`
- `stat -f '%Su %Sg %Sp %N' web/src/App.vue web/src/views/Accounts.vue web/src/components/ConfirmModal.vue web/src/components/ui/BaseButton.vue`

#### 14.36.4 追加收口

- `package.json` 的 `pnpm audit:workspace-permissions` 已从内联命令改回稳定脚本 `scripts/utils/check-workspace-permissions.sh`
- 后续调整环境健康检查项时，不需要再维护大段 shell 转义字符串
- 现场复跑时，环境总入口额外抓到 [web/src/stores/copy-feedback.ts](../web/src/stores/copy-feedback.ts) 仍为 `root` 所有者；已归档快照到 `archive/runtime-snapshots/20260310-155939-copy-feedback-ownership-rebuild` 后原地重建，当前总入口与前端回归链均恢复通过

#### 14.36.5 追加收口：CI 已补非阻断环境权限审计

- `.github/workflows/ci.yml` 新增 `Audit Workspace Permissions (advisory)`
- CI 现在会在前端阻断链旁路执行 `pnpm audit:workspace-permissions`
- 该步骤保持 `continue-on-error: true`，用于尽早暴露环境污染，不影响当前主回归链阻断策略

#### 14.36.6 追加收口：`build:runtime` 输出路径已对齐到 `web/dist-runtime`

- 复查中发现 `pnpm -C web run build:runtime` 虽然日志显示构建成功，但相对路径 `WEB_DIST_DIR=dist-runtime` 被按仓库根解析，实际落到了根目录 `dist-runtime/`，导致 `web/dist-runtime` 仍是空壳 fallback。
- 已在 `core/src/utils/web-dist.js` 为 `resolveConfiguredWebDistDir()` 补充可选基准目录参数，并在 `web/vite.config.ts` 中显式以 `web/` 目录作为 `WEB_DIST_DIR` 的相对路径基准。
- 对应回归已补在 `core/__tests__/web-dist.test.js`，覆盖“相对路径按指定基准目录解析”的场景。
- 现场处置：
  - 旧的 `web/dist` 权限污染树已归档到 `archive/runtime-snapshots/20260310-170145-web-dist-ownership-rebuild`
  - 仓库根误生成的 `dist-runtime/` 已归档到 `archive/runtime-snapshots/20260310-170706-root-dist-runtime-cleanup`
- 当前状态：
  - `web/dist` 与 `web/dist-runtime` 都有有效产物
  - `inspectWebDistState()` 已恢复为 `activeDir=web/dist`、`fallbackDir=web/dist-runtime`
  - 根目录不再保留误生成的 `dist-runtime/`

#### 14.36.7 追加验证

- `node --test core/__tests__/web-dist.test.js`
- `pnpm -C web run build:runtime`
- `pnpm test:web:regression`
- `pnpm audit:workspace-permissions`

#### 14.36.8 追加收口：环境巡检脚本已补阻断级脚本回归

- `core/__tests__/workspace-permissions-script.test.js` 已新增两条分支覆盖：
  - `ownership audit` 脚本缺失时返回非零并打印明确错误
  - `package.json` / `web/package.json` 出现 world-writable 权限时能被准确报出
- 根脚本已新增 `pnpm test:workspace-audit-scripts`，统一执行：
  - `core/__tests__/workspace-permissions-script.test.js`
  - `core/__tests__/web-dist.test.js`
- `.github/workflows/ci.yml` 已新增阻断步骤 `Verify Environment Audit Helpers`
- 结论：
  - 环境巡检不再只靠现场命令验证，脚本自身的退出码和关键信息输出也已被固定回归覆盖
  - 后续若再改 `check-workspace-permissions.sh` 或 `web-dist` 选路逻辑，会更早在 CI 中暴露

#### 14.36.9 追加验证

- `pnpm test:workspace-audit-scripts`

#### 14.36.10 追加收口：验证阶段再次命中 `web/dist` 所有权污染，已用 fallback 无损回灌

- 在执行 `pnpm audit:workspace-permissions` 复核新脚本入口时，现场再次命中 `web/dist` 整棵产物树为 `root` 所有者；`web/dist-runtime` 仍保持完整且为当前用户拥有。
- 本次未直接删除活动产物，而是：
  - 先把当时的 `web/dist` 归档到 `archive/runtime-snapshots/20260310-171709-web-dist-rehydrate-from-fallback`
  - 再以 `web/dist-runtime` 为来源重建新的 `web/dist`
- 修复后复核结果：
  - `web/dist` 与 `web/dist-runtime` 都为当前用户拥有
  - `inspectWebDistState()` 继续保持 `activeDir=web/dist`
  - `pnpm audit:workspace-permissions` 再次恢复通过

#### 14.36.11 追加验证

- `stat -f '%Su %Sg %Sp %N' web/dist web/dist/assets web/dist/index.html web/dist/background-presets web/dist/nc_local_version`
- `pnpm audit:workspace-permissions`

#### 14.36.12 追加收口：`repair:web-dist` 已升级为“健康跳过 + 回灌后自检”

- `core/src/utils/web-dist.js` 已新增 `rehydrateDefaultWebDistFromFallback()`，把“用健康 fallback 重建标准 `web/dist`”收口成共享工具函数。
- `core/__tests__/web-dist.test.js` 已补“fallback 回灌标准 dist 并归档旧目录”的回归。
- 新增固定入口 `pnpm repair:web-dist`，脚本位于 `scripts/utils/repair-web-dist-from-fallback.sh`：
  - 默认会先判断 `web/dist` 与 `web/dist-runtime` 是否都已健康
  - 若当前目录和所有权都正常，则直接跳过，不再无意义地产生快照
  - 若执行了回灌，结尾会强制再跑一次 `audit-frontend-ownership.sh web/dist web/dist-runtime`，只有产物目录干净才算成功
  - 如需强制覆盖标准目录，可使用 `FORCE_WEB_DIST_REPAIR=1 pnpm repair:web-dist`
- `README.md` 已同步新增该维护入口说明。

#### 14.36.13 追加现场修复

- 在验证新修复入口期间，额外命中两个历史 UI 源码文件为 `root` 所有者：
  - `web/src/components/ui/BaseHistoryHighlightCard.vue`
  - `web/src/components/ui/BaseHistoryMetricGrid.vue`
- 已先归档快照到 `archive/runtime-snapshots/20260310-174332-web-src-history-ui-ownership-rebuild`，再原地重建并恢复为当前用户拥有的 `644` 权限。

#### 14.36.14 追加验证

- `bash -n scripts/utils/repair-web-dist-from-fallback.sh`
- `pnpm repair:web-dist`
- `pnpm audit:workspace-permissions`
- `pnpm test:workspace-audit-scripts`
