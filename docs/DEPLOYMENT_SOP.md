# QQ 农场助手 - 部署 SOP（标准操作流程）

> 本文档定义当前发布链路中与部署相关的标准动作：公告/文档预检、镜像构建、部署包同步、README 维护与 Git 推送。

---

## 一、前置条件

- Docker 20.10+（含 Buildx）与 Docker Compose v2
- GitHub 推送权限、Docker Hub 登录权限
- Node.js / pnpm（仅本地预检、构建或发版时需要；服务器运行发布包可不安装）
- 已确认当前主仓：`git remote -v` 对应 `smdk000/qq-farm-ui-pro-max`
- 本次发版涉及公告或文档时，已同步更新：
  - `logs/development/Update.log`
  - `CHANGELOG.md`
  - `CHANGELOG.DEVELOPMENT.md`
  - `README.md`
  - `deploy/README.md`
  - `deploy/README.cn.md`

推荐先执行：

```bash
pnpm check:announcements
pnpm check:doc-links
```

若本机无 `pnpm`，可使用：

```bash
node scripts/utils/check-announcements.js
node scripts/utils/check-doc-links.js
```

---

## 二、Docker 镜像构建与推送

### 2.1 构建脚本

- 本地多架构构建脚本：`scripts/docker/docker-build-multiarch.sh`
- GitHub Actions 工作流：
  - `.github/workflows/ci.yml`
  - `.github/workflows/release.yml`
  - `.github/workflows/docker-build-push.yml`

### 2.2 本地构建示例

```bash
cd /path/to/qq-farm-ui-pro-max
./scripts/docker/docker-build-multiarch.sh --version 4.5.20
```

说明：

- 脚本默认同步 Docker Hub 与 GHCR：`smdk000/qq-farm-bot-ui`、`ghcr.io/smdk000/qq-farm-ui-pro-max`
- Git tag 示例可写作 `v4.5.20`；镜像 tag 示例统一使用 `4.5.20`
- 如只推送单一仓库，可附加 `--docker-hub-only` 或 `--ghcr-only`

### 2.3 镜像口径

- Docker Hub：`smdk000/qq-farm-bot-ui:latest` / `smdk000/qq-farm-bot-ui:4.5.20`
- GHCR：`ghcr.io/smdk000/qq-farm-ui-pro-max:latest` / `ghcr.io/smdk000/qq-farm-ui-pro-max:4.5.20`

### 2.4 本地 Release 产物

```bash
cd /path/to/qq-farm-ui-pro-max
./scripts/release/build-release-assets.sh --version v4.5.20
```

默认输出目录：`release-assets/`

---

## 三、部署包与文档同步

### 3.1 当前标准部署资料

- 部署编排：`deploy/docker-compose.yml`
- 环境变量模板：`deploy/.env.example`
- 初始化 SQL：`deploy/init-db/01-init.sql`
- 标准部署说明：`deploy/README.md`
- 国内网络部署说明：`deploy/README.cn.md`

### 3.2 当前标准部署脚本

| 脚本 | 路径 | 用途 |
|------|------|------|
| fresh-install.sh | `scripts/deploy/` | 全新服务器完整部署 |
| update-app.sh | `scripts/deploy/` | 已部署服务器只更新主程序 |
| repair-deploy.sh | `scripts/deploy/` | 修复旧部署目录结构 |
| repair-mysql.sh | `scripts/deploy/` | 修复旧数据库结构 / 数据 |
| quick-deploy.sh | `scripts/deploy/` | 快速部署辅助脚本 |
| deploy-arm.sh | `scripts/deploy/` | ARM 架构包装器，内部转发到 `fresh-install.sh` |
| deploy-x86.sh | `scripts/deploy/` | x86 架构包装器，内部转发到 `fresh-install.sh` |

### 3.3 README 需要保持一致的内容

- 根 README 部署章节必须与 `deploy/README.md` / `deploy/README.cn.md` 口径一致
- 全新部署入口应优先展示：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/install-or-update.sh) --action install
```

- 已部署环境更新入口应优先展示：

```bash
/opt/qq-farm-current/install-or-update.sh --action update --preserve-current
```

- 如果文档保留架构包装器示例，URL 必须使用真实路径：

```bash
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-arm.sh
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-x86.sh
```

---

## 四、Git 主仓推送

### 4.1 提交前检查

```bash
bash scripts/github/check-sensitive-info.sh .
git status
```

### 4.2 提交示例

```bash
git add -A
git status
git commit -m "chore: 更新 v4.5.20 部署文档与发布链路"
git push origin <branch>
```

---

## 五、执行顺序

1. 补齐 `Update.log` / `CHANGELOG` / 部署文档（如本次发布涉及这些内容）
2. 执行 `pnpm check:announcements`
3. 执行 `pnpm check:doc-links`
4. 构建并推送镜像
5. 复查 `README.md`、`deploy/README.md`、`deploy/README.cn.md`
6. 确认部署包文件与脚本齐全
7. 执行敏感信息检查
8. 提交并推送到主仓

---

## 六、检查清单

- [ ] `check:announcements` 已通过
- [ ] `check:doc-links` 已通过
- [ ] `Update.log` / `CHANGELOG` 与当前发版内容一致
- [ ] `README.md` / `deploy/README.md` / `deploy/README.cn.md` 口径一致
- [ ] 部署包使用 `deploy/docker-compose.yml`、`deploy/.env.example`、`deploy/init-db/01-init.sql`
- [ ] 一键脚本 URL 指向 `qq-farm-ui-pro-max/main/scripts/deploy/...`
- [ ] Docker Hub 与 GHCR 镜像名未写混
- [ ] 镜像构建成功（amd64 + arm64）
- [ ] 已完成敏感信息检查与 Git 推送

---

*最后更新：2026-03-10*
