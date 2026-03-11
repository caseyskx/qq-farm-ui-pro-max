# QQ 农场助手 - 部署执行计划

> 基于 [DEPLOYMENT_SOP.md](./DEPLOYMENT_SOP.md) 整理的可执行步骤清单。

**当前版本**：v4.5.17（Git tag 示例）
**镜像版本示例**：4.5.17
**执行日期**：2026-03-10

---

## 阶段一：公告与文档预检

### 1.1 同步本次发版记录

- 检查 `logs/development/Update.log`
- 检查 `CHANGELOG.md`
- 检查 `CHANGELOG.DEVELOPMENT.md`
- 检查 `README.md`
- 检查 `deploy/README.md`
- 检查 `deploy/README.cn.md`

### 1.2 执行公告检查

```bash
pnpm check:announcements
```

无 `pnpm` 时：

```bash
node scripts/utils/check-announcements.js
```

### 1.3 执行文档链接检查

```bash
pnpm check:doc-links
```

无 `pnpm` 时：

```bash
node scripts/utils/check-doc-links.js
```

通过标准：

- `0 error(s), 0 warning(s)`

---

## 阶段二：Docker 镜像构建与推送

### 2.1 本地构建

```bash
cd /path/to/qq-farm-ui-pro-max
./scripts/docker/docker-build-multiarch.sh 4.5.17
```

### 2.2 镜像口径复核

- Docker Hub：`smdk000/qq-farm-bot-ui:latest`、`smdk000/qq-farm-bot-ui:4.5.17`
- GHCR：`ghcr.io/smdk000/qq-farm-ui-pro-max:latest`、`ghcr.io/smdk000/qq-farm-ui-pro-max:4.5.17`

---

## 阶段三：部署包与说明文档同步

### 3.1 确认部署包文件

- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `deploy/init-db/01-init.sql`

### 3.2 确认部署脚本

- `scripts/deploy/fresh-install.sh`
- `scripts/deploy/update-app.sh`
- `scripts/deploy/repair-deploy.sh`
- `scripts/deploy/repair-mysql.sh`
- `scripts/deploy/quick-deploy.sh`
- `scripts/deploy/deploy-arm.sh`
- `scripts/deploy/deploy-x86.sh`

### 3.3 核对 README 部署入口

全新服务器：

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/fresh-install.sh)
```

已部署服务器更新：

```bash
/opt/qq-farm-bot-current/update-app.sh
```

如保留架构包装器示例：

```bash
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-arm.sh
curl -O https://raw.githubusercontent.com/smdk000/qq-farm-ui-pro-max/main/scripts/deploy/deploy-x86.sh
```

---

## 阶段四：Git 主仓提交

### 4.1 提交前检查

```bash
bash scripts/github/check-sensitive-info.sh .
git status
```

### 4.2 增量提交

```bash
git add -A
git status
git commit -m "chore: v4.5.17 部署文档与发布链路收口"
git push origin <branch>
```

---

## 阶段五：检查清单

- [ ] `check:announcements` 已通过
- [ ] `check:doc-links` 已通过
- [ ] `README.md`、`deploy/README.md`、`deploy/README.cn.md` 已同步
- [ ] `docs/DEPLOYMENT_SOP.md`、`docs/DEPLOYMENT_PLAN.md` 已同步
- [ ] 部署包文件路径为 `deploy/docker-compose.yml` / `deploy/.env.example` / `deploy/init-db/01-init.sql`
- [ ] 一键部署入口为 `fresh-install.sh`
- [ ] 已部署更新入口为 `update-app.sh`
- [ ] Docker Hub / GHCR 镜像名无混用
- [ ] 敏感信息检查已通过
- [ ] 代码已推送到 GitHub

---

## 附录：关键路径

| 项目 | 路径 |
|------|------|
| 工作目录 | `/path/to/qq-farm-ui-pro-max` |
| Update.log | `logs/development/Update.log` |
| 根 README | `README.md` |
| 标准部署说明 | `deploy/README.md` |
| 国内部署说明 | `deploy/README.cn.md` |
| 生产 Compose | `deploy/docker-compose.yml` |
| 构建脚本 | `scripts/docker/docker-build-multiarch.sh` |
| 部署脚本 | `scripts/deploy/` |
| 部署 SOP | `docs/DEPLOYMENT_SOP.md` |

---

*最后更新：2026-03-10*
