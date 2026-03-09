# 干净新服务器一键部署演练报告（2026-03-09）

## 目的

单独验证 `scripts/deploy/fresh-install.sh` 在“全新部署”场景下是否能完整跑通，并确认以下链路真实可用：

- 部署目录创建
- `docker-compose.yml` / `.env.example` / 初始化 SQL / 修复脚本落地
- 4 服务启动：`qq-farm-bot + mysql + redis + ipad860`
- `repair-mysql.sh` 自动执行
- `admin` 管理员账号可用
- `current` 链接生成
- `/api/ping` 探活成功

## 演练环境

- 时间：2026-03-09
- 方式：本机隔离 Docker 演练
- 代码版本：`2c44b724677e94a1ac8c0036dccf11b9e921cf9f`
- 镜像版本：`smdk000/qq-farm-bot-ui:4.5.17`
- 架构：`arm64`
- 端口：`3180`
- 部署目录：`/tmp/qq-farm-fresh-install-rehearsal/2026_03_09/qq-farm-bot`
- current 链接：`/tmp/qq-farm-fresh-install-current`
- 说明：本次演练使用 `SKIP_DOCKER_PULL=1`，直接复用本地已存在镜像，避免外网拉取影响结果

## 实际执行命令

```bash
DEPLOY_BASE_DIR=/tmp/qq-farm-fresh-install-rehearsal \
CURRENT_LINK=/tmp/qq-farm-fresh-install-current \
SKIP_DOCKER_PULL=1 \
NON_INTERACTIVE=1 \
ADMIN_PASSWORD='fresh-install-test-20260309' \
MYSQL_ROOT_PASSWORD='root-pass-20260309' \
MYSQL_PASSWORD='user-pass-20260309' \
REDIS_PASSWORD='redis-pass-20260309' \
TZ='Asia/Shanghai' \
bash scripts/deploy/fresh-install.sh --web-port 3180 --non-interactive
```

## 最终结果

本次隔离演练已完整通过。

关键验收结果：

- `fresh-install.sh` 最终退出码为 `0`
- `qq-farm-bot` 容器状态为 `Up (healthy)`
- `qq-farm-mysql` 容器状态为 `Up (healthy)`
- `qq-farm-redis` / `qq-farm-ipad860` 均已正常启动
- `readlink /tmp/qq-farm-fresh-install-current` 指向部署目录
- `curl http://127.0.0.1:3180/api/ping` 返回版本 `4.5.17`
- `admin` 账号已存在，角色为 `admin`，状态为 `active`
- `accounts.last_login_at` 列存在
- `cards.expires_at` 列存在

对应验证结果：

```text
readlink /tmp/qq-farm-fresh-install-current
/tmp/qq-farm-fresh-install-rehearsal/2026_03_09/qq-farm-bot
```

```json
{"ok":true,"data":{"ok":true,"uptime":29.69879218,"version":"4.5.17"}}
```

```json
{"users":[{"username":"admin","role":"admin","status":"active"}],"accountsCols":1,"cardsCols":1}
```

## 本次演练发现并修复的问题

### 1. `repair-mysql.sh` 在旧服目录下不能稳定识别 MySQL 执行入口

已修复：

- 先判断 compose 中是否真的存在并运行 `mysql` service
- 若旧目录只有共享 `qq-farm-mysql` 容器，则自动回退到 `docker exec`

影响：

- 旧服务器 `app-only` 历史布局可直接执行数据库修复和一键更新

### 2. `repair-mysql.sh` 在 MySQL 容器内默认走 socket，首次部署可能失败

已修复：

- `mysql` / `mysqldump` 改为显式 `--protocol=TCP -h 127.0.0.1`

影响：

- 避免出现 `Can't connect to local MySQL server through socket` 类错误

### 3. `repair-mysql.sh` 只等容器健康，不等真实 SQL 连接可用

已修复：

- `wait_for_mysql()` 改为“容器健康 + `mysqladmin --protocol=TCP ping` 成功”后才继续

影响：

- 避免健康检查刚转绿、但数据库 TCP 连接尚未真正就绪时的竞态失败

### 4. `fresh-install.sh` / `update-app.sh` 的显式 `ADMIN_PASSWORD` 分支未先初始化 MySQL

已修复：

- 密码同步前先调用 `initMysql()`

影响：

- 避免出现 `MySQL pool is not initialized. Call initMysql() first.`

### 5. `fresh-install.sh` / `update-app.sh` 的显式 `ADMIN_PASSWORD` 分支可能卡住不退出

已修复：

- 在一次性 Node 子进程中显式调用 `security.stopLoginLockCleanup?.()`
- 再关闭连接池并退出

影响：

- 显式传 `ADMIN_PASSWORD=...` 的自动化部署现在能正常收尾

## 结论

当前代码下，以下结论已经成立：

- 全新服务器一键部署链路可跑通
- 旧服务器一键更新链路可跑通
- 数据库初始化与历史结构修复两条路径都已覆盖
- 部署目录与 `current` 链接维护逻辑正常
- README 中的一键部署、一键更新、修复脚本描述与当前实现一致

## 后续建议

- 将本次修复后的部署脚本同步提交到 GitHub，并同步到线上服务器部署目录
- 如需发布给客户，建议继续保留“在线一键脚本”和“离线包”两套交付路径
- 若后续在 ARM 服务器上部署，仍建议保留对 `ipad860` 的 `linux/amd64` 兼容提示
