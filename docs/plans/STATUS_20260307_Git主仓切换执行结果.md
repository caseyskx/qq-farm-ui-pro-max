# Git 主仓切换执行结果

日期：2026-03-07

## 已完成

- 当前根目录已接管为正式 Git 主仓。
- 当前分支：`codex/root-cutover`
- 远端跟踪：`origin/codex/root-cutover`
- 旧 `github-sync/` 目录已从根目录退役，并归档到 `archive/retired-repos/github-sync-main-20260307/`
- 旧目录保留其自身 `.git` 与本地状态，未做破坏性删除。
- `github-sync/CHANGELOG.DEVELOPMENT.md` 中未吸收到主仓的 `v4.4.0` 更新记录，已并入根目录 `CHANGELOG.DEVELOPMENT.md`
- 运行数据已统一到根目录 `data/`，`core/data` 已改为兼容软链接入口。
- 运行日志已统一到根目录 `logs/`，`scripts/service/logs` 已改为兼容软链接入口。
- 路径收敛前的原始状态已快照到 `archive/runtime-snapshots/20260307-path-unify/`
- 根目录 `nc_local_version/` 权限残留已清除，仅保留归档副本 `archive/tools-data/nc_local_version/`
- 根目录 `图鉴/` 已归档到 `archive/tools-data/图鉴/`，根目录原件已移除
- 现行部署与维护文档已统一到根目录主仓工作流，并补充了历史文档说明索引

## 当前未处理

- 部分历史 HTML 计划与旧版本发布页仍保留旧 `github-sync`、旧日志挂载表述，但已通过历史说明文档进行隔离提示。

## 说明

- 本文件用于记录“主仓切换 + 旧仓退役 + 路径收敛”实际执行结果，不替代完整治理计划。
- 后续如继续推进，应优先处理剩余文档口径统一与历史草稿清理。
