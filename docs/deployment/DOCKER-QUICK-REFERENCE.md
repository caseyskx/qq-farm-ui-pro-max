# Docker 快速参考卡片

> 历史说明（2026-03-07）：本文为旧版速查卡，当前有效工作流以 `docs/guides/REPO_ROOT_WORKFLOW_GUIDE.md` 为准。

> 📦 QQ 农场助手 Docker 部署 - 一分钟快速上手

---

## 🚀 快速启动（3 步）

```bash
# 1. 拉取镜像
docker pull qq-farm-bot-ui:3.3.0

# 2. 启动容器
docker run -d --name qq-farm-bot \
  -p 3080:3000 \
  -v ./data:/app/core/data \
  -e ADMIN_PASSWORD=your_password \
  qq-farm-bot-ui:3.3.0

# 3. 访问界面
# http://localhost:3080
```

---

## 🔨 构建镜像

```bash
# 方法 1：使用脚本（推荐）
./scripts/docker-build-push.sh 3.3.0

# 方法 2：手动构建
docker build -t qq-farm-bot-ui:3.3.0 -f core/Dockerfile .

# 方法 3：多平台构建
docker buildx build --platform linux/amd64,linux/arm64 \
  -t qq-farm-bot-ui:3.3.0 -f core/Dockerfile . --push
```

---

## 📤 推送镜像

```bash
# 登录 Docker Hub
docker login

# 推送特定版本
docker push qq-farm-bot-ui:3.3.0

# 推送 latest
docker push qq-farm-bot-ui:latest

# 使用脚本
./scripts/docker-build-push.sh 3.3.0
```

---

## 🔄 同步镜像

```bash
# 同步到 Docker Hub
./scripts/docker-sync.sh docker.io 3.3.0

# 同步到阿里云
./scripts/docker-sync.sh registry.cn-hangzhou.aliyuncs.com 3.3.0

# 同步到私有仓库
./scripts/docker-sync.sh harbor.your-company.com 3.3.0
```

---

## 🏭 Docker Compose

```bash
# 启动
docker compose -f deploy/docker-compose.yml up -d

# 查看状态
docker compose -f deploy/docker-compose.yml ps

# 查看日志
docker compose -f deploy/docker-compose.yml logs -f

# 停止
docker compose -f deploy/docker-compose.yml down

# 更新
docker compose -f deploy/docker-compose.yml pull
docker compose -f deploy/docker-compose.yml up -d
```

---

## 📊 常用命令

### 容器管理

```bash
# 启动容器
docker start qq-farm-bot

# 停止容器
docker stop qq-farm-bot

# 重启容器
docker restart qq-farm-bot

# 删除容器
docker rm qq-farm-bot

# 查看日志
docker logs -f qq-farm-bot

# 进入容器
docker exec -it qq-farm-bot /bin/sh
```

### 镜像管理

```bash
# 查看镜像
docker images | grep qq-farm

# 删除镜像
docker rmi qq-farm-bot-ui:3.3.0

# 清理悬空镜像
docker image prune -f

# 保存镜像
docker save -o qq-farm-bot-ui.tar qq-farm-bot-ui:3.3.0

# 加载镜像
docker load -i qq-farm-bot-ui.tar
```

### 监控命令

```bash
# 资源使用
docker stats qq-farm-bot

# 容器信息
docker inspect qq-farm-bot

# 健康状态
docker inspect --format='{{.State.Health.Status}}' qq-farm-bot

# 查看进程
docker top qq-farm-bot
```

---

## 🔧 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ADMIN_PASSWORD` | - | 管理员密码（必填） |
| `TZ` | `Asia/Shanghai` | 时区 |
| `NODE_ENV` | `production` | 运行环境 |
| `LOG_LEVEL` | `info` | 日志级别 |

---

## 📁 数据卷挂载

| 容器路径 | 宿主机路径 | 说明 |
|----------|------------|------|
| `/app/core/data` | `./data` | 核心数据（必须） |
| `/app/logs` | `./logs` | 日志文件（可选） |
| `/app/core/backup` | `./backup` | 备份目录（可选） |

---

## 🌐 端口映射

| 容器端口 | 宿主机端口 | 说明 |
|----------|------------|------|
| `3000` | `3080` | Web 界面 |
| `3000` | 自定义 | 可修改为其他端口 |

**修改端口示例：**
```bash
-p 3081:3000  # 使用 3081 端口
-p 8080:3000  # 使用 8080 端口
```

---

## 🔍 故障排查

### 查看日志

```bash
# 实时日志
docker logs -f qq-farm-bot

# 最近 100 行
docker logs --tail 100 qq-farm-bot

# 带时间戳
docker logs -f --timestamps qq-farm-bot
```

### 进入调试

```bash
# 进入容器
docker exec -it qq-farm-bot /bin/sh

# 查看进程
docker exec qq-farm-bot ps aux

# 测试网络
docker exec qq-farm-bot wget -qO- http://localhost:3000/api/ping
```

### 重启容器

```bash
# 正常重启
docker restart qq-farm-bot

# 强制重启
docker restart -t 0 qq-farm-bot
```

---

## 🔒 安全建议

```bash
# 1. 修改默认密码
-e ADMIN_PASSWORD=your_secure_password

# 2. 限制端口访问
-p 127.0.0.1:3080:3000

# 3. 使用只读挂载
-v ./data:/app/core/data:ro

# 4. 限制资源
--memory="1g" --cpus="2.0"
```

---

## 📋 检查清单

部署前确认：

```bash
# Docker 已安装
docker --version

# Docker 已登录
docker login

# 端口未被占用
lsof -i :3080

# 数据目录已创建
mkdir -p ./data

# 脚本已授权
chmod +x scripts/*.sh
```

---

## 🆘 获取帮助

```bash
# 查看 Docker 帮助
docker --help

# 查看运行帮助
docker run --help

# 查看 Compose 帮助
docker compose --help
```

**文档资源：**
- [RELEASE-NOTES.md](../archive/RELEASE-NOTES.md) - 版本说明
- [DOCKER-DEPLOYMENT.md](DOCKER-DEPLOYMENT.md) - 完整指南
- [DOCKER-UPDATE-SUMMARY.md](archive/DOCKER-UPDATE-SUMMARY.md) - 历史更新说明

**技术支持：**
- GitHub: https://github.com/smdk000/qq-farm-ui-pro-max/issues
- QQ 群：227916149

---

## 📈 性能指标

| 指标 | 数值 |
|------|------|
| 镜像大小 | ~200-250MB |
| 启动时间 | 5-8 秒 |
| 空闲内存 | 200-300MB |
| 运行内存 | 400-600MB |
| CPU 占用 | < 5% |

---

## 🎯 版本信息

**当前版本：** v3.3.0  
**镜像标签：**
- `qq-farm-bot-ui:3.3.0`
- `qq-farm-bot-ui:latest`

**支持架构：**
- ✅ linux/amd64
- ✅ linux/arm64

---

**快速参考卡片 v1.0** | 2026-03-01 | smdk000
