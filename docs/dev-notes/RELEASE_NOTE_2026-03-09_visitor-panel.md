# 发布说明（2026-03-09）- 访客面板专用链路升级

## 1. 本次发布重点

- 访客面板从“日志聚合”升级为“专用接口优先 + 日志降级”。
- 新增专用后端链路：`interactpb.proto` + `interact service` + `/api/interact-records`。
- 前端支持动作筛选（全部/偷菜/帮忙/捣乱）、头像、等级、相对时间。
- 新增数据源标识（专用接口/日志降级）与最近刷新时间。
- 错误处理升级为结构化 `errorCode`，提示更稳定。

## 2. 已修复问题

- 修复快速切换账号导致访客数据被旧请求覆盖（竞态覆盖）。
- 修复无账号时访客面板残留上一个账号数据。
- 修复进程通信层错误码丢失，前端无法稳定识别错误类型。

## 3. 兼容与影响

- 若游戏侧不支持访客 RPC：页面会自动回退日志视图，不影响主流程。
- 本次改动不进入农场巡查/好友巡查核心调度逻辑，挂机主链路影响可控。
- 访客接口错误会返回 `errorCode`（`INTERACT_*`），便于后续观测与统计。

## 4. 使用提示（可发给用户）

- 访客面板优先显示专用记录；若看到“数据源: 日志降级”，说明接口暂不可用，系统已自动降级。
- 可使用顶部筛选快速查看“偷菜/帮忙/捣乱”。
- “最近刷新”用于确认当前数据新鲜度。

## 5. 回滚点（如需）

- 前端回滚：`web/src/components/VisitorPanel.vue`、`web/src/stores/friend.ts`
- 后端回滚：`core/src/services/interact.js`、`core/src/controllers/admin.js`、`core/src/core/worker.js`、`core/src/runtime/worker-manager.js`、`core/src/runtime/data-provider.js`、`core/src/utils/proto.js`、`core/src/proto/interactpb.proto`

## 6. 当前待办（非阻塞）

- 增加“快速切号 + 慢响应”自动化回归用例（本次按你的要求未执行测试链路）。
