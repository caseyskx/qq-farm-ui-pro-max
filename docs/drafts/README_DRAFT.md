# QQ 农场智能助手 - 多账号挂机 + Web 面板

> 草稿说明（2026-03-07）：本文为历史草稿，内部图片与路径引用不再代表当前仓库结构。当前有效工作流与目录口径请参见 `docs/guides/REPO_ROOT_WORKFLOW_GUIDE.md`。

基于 Node.js 的 QQ 农场自动化工具，支持多账号管理、Web 控制面板、实时日志与数据分析。

![版本](https://img.shields.io/badge/版本-v3.8.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-20+-green)
![MySQL](https://img.shields.io/badge/MySQL-8.0-orange)
![Redis](https://img.shields.io/badge/Redis-6.0-red)
![License](https://img.shields.io/badge/License-ISC-yellow)

> **登录说明**：Docker 部署默认 `admin` / `qq007qq008`；二进制版默认 `admin` / `admin`。建议部署后立即修改密码。

---

## 功能特性

### 多账号管理
- 账号新增、编辑、删除、启动、停止
- 扫码登录（支持 QQ 与微信）与手动输入 Code
- 账号被踢下线自动删除、连续离线超时自动删除
- 账号离线推送通知（Bark、自定义 Webhook 等）

### 自动化能力
- **农场管理**：收获、种植、浇水、除草、除虫、铲除、土地升级
- **仓库管理**：收获后自动出售果实
- **好友互动**：自动偷菜 / 帮忙 / 捣乱
- **任务系统**：自动检查并领取任务奖励
- **智能防护**：好友黑名单、静默时段、60 秒防偷抢收保护、两季作物智能识别

### Web 面板
- 概览 / 农场 / 背包 / 好友 / 分析 / 账号 / 设置 / 帮助中心
- 实时日志，支持按账号、模块、事件、级别、关键词、时间范围筛选
- 深色 / 浅色主题切换，响应式设计

![Dashboard](github-sync/pic/截图1.png)

**分析页** - 支持按经验效率、净利润效率、等级要求等维度排序作物：

![分析页面](github-sync/pic/截图2.png)

**帮助中心** - 新手入门、设置说明、高级教程、故障排查：

![帮助中心](github-sync/pic/help-center.svg)

### 多用户模式
- 用户注册/登录、卡密管理（天卡/周卡/月卡/永久卡）
- 用户权限控制（管理员/普通用户）、账号续费
- 详见下方「多用户模式」章节

---

## 快速开始

### 方式一：Docker 一键部署（推荐）

**x86_64（Intel/AMD 云服务器）：**
```bash
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy-x86.sh && chmod +x deploy-x86.sh && ./deploy-x86.sh
```

**ARM64（甲骨文 ARM、树莓派、Apple Silicon）：**
```bash
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy-arm.sh && chmod +x deploy-arm.sh && ./deploy-arm.sh
```

- 空数据库会自动建库建表，约 2 分钟内完成，日志出现 `✅ MySQL 核心表结构自动初始化完成` 即成功
- 访问：`http://localhost:3080`（默认 `admin` / `qq007qq008`）

### 方式二：本地 Docker 编排

```bash
./docker/start.sh          # Linux/macOS
docker\start.bat           # Windows
```

### 方式三：源码运行

```bash
# 1. 安装 Node.js 20+、启用 pnpm
corepack enable

# 2. 安装依赖并构建
pnpm install
pnpm build:web

# 3. 启动
pnpm dev:core
```

访问：`http://localhost:3000`

![设置页面](github-sync/pic/settings.svg)

### 方式四：二进制版（无需 Node.js）

从 [GitHub Releases](https://github.com/smdk000/qq-farm-ui-pro-max/releases) 下载对应平台可执行文件，直接运行。访问 `http://localhost:3000`，默认 `admin` / `admin`。

| 平台 | 文件名 |
|------|--------|
| Windows x64 | `qq-farm-bot-win-x64.exe` |
| Linux x64 | `qq-farm-bot-linux-x64` |
| macOS Intel | `qq-farm-bot-macos-x64` |
| macOS Apple Silicon | `qq-farm-bot-macos-arm64` |

---

## 环境要求

| 部署方式 | 要求 |
|---------|------|
| 源码运行 | Node.js 20+、pnpm 10+；可选 MySQL 8.0+、Redis 6.0+ |
| 二进制版 | 无需 Node.js |
| Docker | Docker Engine 20+、Docker Compose v2+；支持 linux/amd64、linux/arm64 |

---

## 技术栈

**后端**：Node.js 20+、Express、Socket.io、MySQL 8.0、Redis、SQLite（离线模式）、Protobuf.js  
**前端**：Vue 3、Vite 7、TypeScript、Pinia、UnoCSS  
**部署**：Docker、pnpm workspace、GitHub Actions

[<img src="https://skillicons.dev/icons?i=nodejs,vue,vite,ts,mysql,redis,docker" height="36" />](https://nodejs.org/)

---

## Docker 部署详解

### Docker Compose（生产环境）

```bash
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/docker-compose.prod.yml
curl -o .env https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/.env.example
# 编辑 .env 修改 ADMIN_PASSWORD 等
docker-compose -f docker-compose.prod.yml up -d
```

### 单容器运行

```bash
docker run -d \
  --name qq-farm-bot-ui \
  --restart unless-stopped \
  -p 3080:3000 \
  -v ./data:/app/core/data \
  -v ./logs:/app/logs \
  -v ./backup:/app/core/backup \
  -e ADMIN_PASSWORD=qq007qq008 \
  -e TZ=Asia/Shanghai \
  smdk000/qq-farm-bot-ui:latest
```

### 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码 | `qq007qq008` |
| `TZ` | 时区 | `Asia/Shanghai` |
| `LOG_LEVEL` | 日志级别 | `info` |

| 数据卷 | 说明 |
|--------|------|
| `./data` | 核心数据库（账号、用户数据） |
| `./logs` | 日志文件 |
| `./backup` | 备份目录 |

---

## 数据保护与备份

- ❌ 不要删除 `./data` 目录
- ❌ 不要手动修改数据库文件
- ✅ 升级前务必备份：`tar -czf farm-bot-backup-$(date +%Y%m%d).tar.gz ./data`
- ✅ 恢复：`tar -xzf farm-bot-backup-20260301.tar.gz -C ./data`

---

## 多用户模式

### 管理员
1. 登录后进入「卡密」页面，生成天卡/周卡/月卡/永久卡
2. 进入「用户」页面，查看/编辑用户、修改到期时间、启用/封禁

### 普通用户
1. 登录页切换到「注册」，输入用户名、密码、卡密完成注册
2. 登录后在 Dashboard 点击「续费」，输入新卡密续费

![用户管理](github-sync/pic/users.svg)
![卡密管理](github-sync/pic/cards.svg)

---

## 偷菜过滤配置

1. 进入「设置」→ 选择账号 →「偷菜过滤设置」
2. 启用过滤，选择**黑名单**（不偷选中蔬菜）或**白名单**（只偷选中蔬菜）
3. 勾选蔬菜/好友，保存

![偷菜设置](github-sync/pic/steal-settings.svg)

---

## 界面预览

### 登录
![登录1](github-sync/pic/登录1.png)
![登录2](github-sync/pic/登录2.png)
![登录3](github-sync/pic/登录3.png)

### 主题
![主题1](github-sync/pic/主题1.png)
![主题2](github-sync/pic/主题2.png)
![主题3](github-sync/pic/主题3.png)
![主题4](github-sync/pic/主题4.png)
![主题5](github-sync/pic/主题5.png)
![主题6](github-sync/pic/主题6.png)
![主题7](github-sync/pic/主题7.png)
![主题8](github-sync/pic/主题8.png)
![主题9](github-sync/pic/主题9.png)
![主题10](github-sync/pic/主题10.png)

### 核心功能
![功能1](github-sync/pic/功能1.png)
![功能2](github-sync/pic/功能2.png)
![功能3](github-sync/pic/功能3.png)
![功能4](github-sync/pic/功能4.png)
![功能5](github-sync/pic/功能5.png)
![功能6](github-sync/pic/功能6.png)
![功能7](github-sync/pic/功能7.png)
![功能8](github-sync/pic/功能8.png)
![功能9](github-sync/pic/功能9.png)
![功能10](github-sync/pic/功能10.png)
![功能11](github-sync/pic/功能11.png)
![功能12](github-sync/pic/功能12.png)
![功能13](github-sync/pic/功能13.png)
![功能14](github-sync/pic/功能14.png)
![功能15](github-sync/pic/功能15.png)
![功能16](github-sync/pic/功能16.png)
![功能17](github-sync/pic/功能17.png)

---

## 项目结构

```
qq-farm-bot-ui/
├── core/          # 后端（Node.js 机器人引擎）
├── web/           # 前端（Vue 3 + Vite）
├── assets/        # 截图资源
├── docs/          # 详细文档
├── docker/        # Docker 配置
└── package.json
```

---

## 常见问题与故障排查

### 使用类
- **如何添加账号？** 进入「账号」页面 → 添加账号，支持扫码或手动输入 QID/密码
- **如何配置偷菜过滤？** 见上方「偷菜过滤配置」章节
- **如何查看日志？** Dashboard 实时日志，支持按账号、模块、级别筛选

### 部署类
- **镜像拉取失败**：确认使用 `smdk000/qq-farm-bot-ui:latest`，执行 `docker login`
- **端口被占用**：检查 `lsof -i :3080`，或修改 `PORT` 环境变量
- **权限错误**：使用 `sudo` 或将用户加入 `docker` 组

### 数据库备份
- MySQL 部署：备份 `./data` 目录
- SQLite 单机：备份 `core/data/farm-bot.db`

---

## 开发指南

```bash
pnpm install
pnpm dev:core    # 后端
pnpm dev:web     # 前端（热重载）
pnpm build:web
pnpm package:release   # 打包二进制
```

---

## 文档与链接

- **GitHub**：https://github.com/smdk000/qq-farm-ui-pro-max
- **Releases**：https://github.com/smdk000/qq-farm-ui-pro-max/releases
- **Docker Hub**：https://hub.docker.com/r/smdk000/qq-farm-bot-ui
- **开发发布 SOP**：[docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md](docs/maintenance/SOP_DEVELOPMENT_RELEASE_DEPLOY.md)（AI 编辑器可参考）
- **故障排查**：[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- **配置模板**：[docs/CONFIG_TEMPLATES.md](docs/CONFIG_TEMPLATES.md)
- **更新日志**：[CHANGELOG.DEVELOPMENT.md](CHANGELOG.DEVELOPMENT.md)

---

## 最近更新（v3.7.0）

- ✅ **精准蹲守机制**：自定义防风控延迟（0-60s），自动分析好友农田成熟时刻
- ✅ **多线程挂载**：`friendScheduler` 定时器，到点秒取互不阻塞

完整历史见 [CHANGELOG.DEVELOPMENT.md](CHANGELOG.DEVELOPMENT.md)

---

## 特别感谢

- [linguo2625469/qq-farm-bot](https://github.com/linguo2625469/qq-farm-bot) - 核心功能
- [QianChenJun/qq-farm-bot](https://github.com/QianChenJun/qq-farm-bot) - 部分功能
- [lkeme/QRLib](https://github.com/lkeme/QRLib) - 扫码登录
- [imaegoo/pushoo](https://github.com/imaegoo/pushoo) - 推送通知
- [Penty-d/qq-farm-bot-ui](https://github.com/Penty-d/qq-farm-bot-ui) - 主体框架

---

## 免责声明

本项目仅供学习与研究用途。使用本工具可能违反游戏服务条款，由此产生的一切后果由使用者自行承担。

---

## 许可证

ISC License

---

**维护者**：smdk000 | **版本**：v3.8.0 | **QQ 群**：227916149

- [提交问题](https://github.com/smdk000/qq-farm-ui-pro-max/issues)
- [讨论区](https://github.com/smdk000/qq-farm-ui-pro-max/discussions)
