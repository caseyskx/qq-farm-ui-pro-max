# GitHub Container Registry (GHCR) 部署说明

> 历史说明（2026-03-07）：本文保留旧版本发布参考，当前有效工作流以 `docs/guides/REPO_ROOT_WORKFLOW_GUIDE.md` 为准；日志挂载请使用 `./logs:/app/logs`。

## 📦 镜像地址

QQ 农场助手 Docker 镜像已同步推送到 GitHub Container Registry：

```
ghcr.io/smdk000/qq-farm-ui-pro-max:latest
ghcr.io/smdk000/qq-farm-ui-pro-max:4.5.17
```

## 🔐 认证方式

### 1. 创建 Personal Access Token

1. 访问 GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 选择 scopes: `read:packages`, `write:packages`
4. 生成并保存 Token

### 2. 登录 GHCR

```bash
# 使用 Personal Access Token 登录
echo $GH_PAT | docker login ghcr.io -u smdk000 --password-stdin
```

## 🚀 部署方法

### Docker Compose 部署

```yaml
version: '3.8'

services:
  qq-farm-bot-ui:
    image: ghcr.io/smdk000/qq-farm-ui-pro-max:latest
    container_name: qq-farm-bot-ui
    restart: unless-stopped
    ports:
      - "3080:3000"
    environment:
      - ADMIN_PASSWORD=your_secure_password
      - TZ=Asia/Shanghai
    volumes:
      - ./data:/app/core/data
      - ./logs:/app/logs
      - ./backup:/app/core/backup
```

### 手动部署

```bash
docker run -d \
  --name qq-farm-bot-ui \
  --restart unless-stopped \
  -p 3080:3000 \
  -v ./data:/app/core/data \
  -v ./logs:/app/logs \
  -v ./backup:/app/core/backup \
  -e ADMIN_PASSWORD=your_password \
  -e TZ=Asia/Shanghai \
  ghcr.io/smdk000/qq-farm-ui-pro-max:latest
```

## 📊 多平台支持

- ✅ linux/amd64 (x86_64)
- ✅ linux/arm64 (ARM64)

## 🔄 从 Docker Hub 迁移

如果您之前使用 Docker Hub 镜像，可以轻松迁移到 GHCR：

```bash
# 停止旧容器
docker stop qq-farm-bot-ui
docker rm qq-farm-bot-ui

# 拉取 GHCR 镜像
docker pull ghcr.io/smdk000/qq-farm-ui-pro-max:latest

# 使用相同配置启动（数据卷保持不变）
docker run -d \
  --name qq-farm-bot-ui \
  --restart unless-stopped \
  -p 3080:3000 \
  -v ./data:/app/core/data \
  -e ADMIN_PASSWORD=your_password \
  ghcr.io/smdk000/qq-farm-ui-pro-max:latest
```

## 📋 版本标签

| 标签 | 说明 |
|------|------|
| `latest` | 最新稳定版本 |
| `4.5.17` | 特定版本 |
| `main` | 主分支最新构建 |

## 🔗 相关链接

- **GitHub Packages**: https://github.com/users/smdk000/packages/container/package/qq-farm-ui-pro-max
- **GitHub 仓库**: https://github.com/smdk000/qq-farm-ui-pro-max
- **Docker Hub**: https://hub.docker.com/r/smdk000/qq-farm-bot-ui

## ⚠️ 注意事项

1. **数据保护**: 数据卷挂载配置不变，数据不会丢失
2. **镜像同步**: Docker Hub 和 GHCR 会保持同步更新
3. **访问速度**: 国内用户访问 GHCR 可能较慢，建议使用 Docker Hub

---

**维护者**: smdk000  
**最后更新**: 2026-03-01
