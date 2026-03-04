# GitHub 同步说明

> 此文件夹为 GitHub 同步专用，包含脱敏后的项目代码

## 📦 文件夹内容

- ✅ `core/src/` - 后端源代码（已脱敏）
- ✅ `web/src/` - 前端源代码（已脱敏）
- ✅ `docs/` - 项目文档
- ✅ `pic/` - 图片资源
- ✅ `*.md` - 项目说明文档
- ✅ `docker-compose.yml` - Docker 配置
- ✅ `.env.*.example` - 配置模板

## 🚫 不包含的内容

- ❌ `.env` 文件（包含真实 API 密钥）
- ❌ `data/*.json`（包含用户数据）
- ❌ `data/*.db`（SQLite 数据库）
- ❌ `logs/`（运行日志）
- ❌ `node_modules/`（依赖包）

## 🔄 同步步骤

1. 在项目根目录执行：
   ```bash
   ./prepare-github-sync.sh
   ```

2. 进入同步文件夹：
   ```bash
   cd github-sync
   ```

3. 初始化 Git 仓库并提交：
   ```bash
   git init
   git add .
   git commit -m "Initial commit: GitHub sync version"
   git remote add origin https://github.com/your-username/your-repo.git
   git push -u origin main
   ```

## ⚠️ 重要提示

- 切勿将 `.env` 文件提交到 GitHub
- 使用 `.env.example` 作为配置模板
- 敏感信息请使用环境变量管理

## 📝 最近更新

### v4.1.0 (2026-03-04) - 账号分级模式与体验重构

- 🛡️ 账号多模式安全架构：上线【主号模式】【小号模式】【风险规避模式】
- 🧰 好友名单与过滤模块内嵌「全选、反选、清空」极速控制区
- 🔍 任务队列全景看板：统合系统发车队列引擎
- ⚙️ 全局防封时间微调枢纽：中控室调参，随改随存
- 💎 好友清单流式网格：流式磁贴 Grid 提升操作视野
- 🚑 侧边栏黑屏卡死根治：修复 Vue3 Router 切换渲染死锁

### v4.0.0 (2026-03-03) - 三阶段巡查与安全升级

- 🚀 三阶段好友巡查策略：扫描→偷菜→帮助
- 🛡️ 偷菜好友黑/白名单双模式
- ⚡ 令牌桶 + 优先级队列限流器
- 🔑 PBKDF2 密码安全升级：10000次迭代+随机盐
- ⏱️ 时间轮调度器：O(1) 性能
- 📢 前端更新通知弹窗

### v3.9.0 (2026-03-02) - 登录页品牌重塑

- 品牌升级「御农·QQ 农场智能助手」
- 星树流体屏与渐变霓虹特效、弹簧阻尼动效

### v3.8.x (2026-03-02) - 核心架构升级

- v3.8.5: 反探测防封优化，操作模拟降速
- v3.8.4: 第三方 API 密钥控制台化
- v3.8.0: MySQL+Redis 终局架构，铲除 SQLite

### v3.7.0 (2026-03-02) - 蹲守偷菜架构

- 偷菜设置新增「蹲守偷菜」模块，自动倒推好友土地成熟时间

### v3.6.0 (2026-03-01) - 端云同步

- 端云同步时间戳仲裁，多设备切换配置不覆盖

### v3.5.2 (2026-03-01) - 扫码重构

- 微信小程序扫码互通、深色主题 NProgress 动态变色

### v3.4.0 (2026-03-01) - 主题与体验卡

- 5 大主题色系 + 偷菜设置独立看板
- Diff 高亮确认弹窗 + 体验卡一键发放

### v3.3.3 - 回归修复：深色模式兼容性与性能模式覆盖遗漏

- ✅ 修复 `HelpCenter.vue` 独立重定义 `backdrop-filter`，不受性能模式管控
- ✅ 修复 `Friends.vue` Scoped CSS 中 `.dark` 选择器无法匹配 `<html>` 祖先
- ✅ 修复 `NotificationModal.vue` 底部动作条样式被意外修改

### v3.3.2 - Chrome 闪烁修复与性能模式全面增强

- ✅ 移除 `glass-panel` 的 `will-change`，改用 `contain: layout style paint`
- ✅ 降低 `mesh-orb` 光球模糊值 `blur(80px)` → `blur(60px)`
- ✅ 追加全局 `animation-duration: 0s !important` + `transition-duration: 0s !important`

### v3.3.1 - 好友列表按钮统一与公告弹窗品牌增强

- ✅ 引入 `op-btn` 基础类 + 6 种颜色变体
- ✅ 修复「除草」按钮与其他按钮形状不一致的问题
- ✅ 在「更新公告」弹窗底部注入作者防伪水印

### v3.3.0 - 自动控制功能提示与推荐建议系统

- ✅ `BaseSwitch.vue` 新增 `hint`/`recommend` prop + CSS Tooltip 气泡
- ✅ `Settings.vue` 全部 18 个开关添加功能解释 + 推荐建议标签

### v3.2.9 - 令牌桶进阶优化：紧急通道 & 冗余 Sleep 清理

- ✅ 新增 `sendMsgAsyncUrgent` 紧急通道，防偷不再被好友巡查长队列阻塞
- ✅ 移除 `farm.js` 中 2 处 + `friend.js` 中 5 处冗余 sleep（共 7 处）

### v3.2.8 - 性能优化：SQLite 防争用 & WebSocket 3QPS 令牌桶限流

- ✅ 追加 `busy_timeout = 5000`：并发写入遇锁时自旋最多 5 秒
- ✅ 追加 `wal_autocheckpoint = 1000`：每累积 1000 页自动合并 WAL
- ✅ 在 `sendMsgAsync` 前注入 Token Bucket 异步排队网关
- ✅ 所有业务请求强制以 **3 QPS（每帧 ≥ 334ms）** 匀速发出

