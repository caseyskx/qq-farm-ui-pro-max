# Viking-Context 二次审查报告

> 审查范围：近期功能优化、已修复问题验证、新发现问题、优化建议  
> 审查时间：2026-03-03（二次）

---

## 一、本次审查新增内容

### 1.1 偷菜设置点击不显示（RouterView 懒加载空白）✅ 已修复

**现象**：点击左侧「偷菜设置」时，右侧内容区域空白，需手动刷新浏览器才能显示。

**原因**：
- `StealSettings.vue` 使用 `defineAsyncComponent` 懒加载
- 客户端导航时，Vue Router 先开始导航，再异步加载组件
- 在组件加载完成前，`RouterView` 的 slot 中 `Component` 为 `undefined`
- `<component :is="undefined" />` 渲染为空
- 配合 `Transition mode="out-in"`：旧页面离开后，新组件未就绪，出现空白

**修复**（`web/src/layouts/DefaultLayout.vue`）：
1. 当 `Component` 为 `undefined` 时，显示加载占位（旋转图标），避免空白
2. 将 `key` 从 `route.path` 改为 `route.fullPath`，确保嵌套路由下正确触发重渲染

**验证**：修复已落地，点击偷菜设置后应显示加载动画，随后正常展示内容。

---

## 二、近期优化与已修复问题（复核）

| 模块 | 改动 | 复核结果 |
|------|------|----------|
| `DefaultLayout.vue` | RouterView 懒加载空白修复 | ✅ 已落实 |
| `data-provider.js` | workflowConfig 保存到 snapshot | ✅ 已落实（L121-122） |
| `config-validator.js` | stealFriendFilter、workflowConfig Schema | ✅ 已落实 |
| `setting.ts` | 各保存操作移除 loading 修改 | ✅ 已落实 |
| `store.js` | 密码变更 saveGlobalConfigImmediate | ✅ 已落实 |
| `admin.js` | getStatus/getLogs/getCachedFriends await | ✅ 已落实 |
| `worker-manager.js` | updateFriendsCache .catch() | ✅ 已落实 |

---

## 三、潜在问题与影响

### 3.1 StealSettings 与 setting store 的 loading 职责

**说明**：`StealSettings.vue` 使用 `settingsLoading`（来自 `settingStore.loading`）控制页面内加载态。`fetchSettings` 仍会设置 `loading = true/false`，这是**正确行为**——用于首次进入偷菜设置时的数据拉取。

**结论**：无问题。与 Settings 页面「保存时整页闪烁」不同，StealSettings 的 loading 仅影响本页加载态，不涉及整页替换。

---

### 3.2 懒加载组件加载失败时的表现

**说明**：若 `StealSettings.vue` 等懒加载组件因网络或打包问题加载失败，当前会显示 DefaultLayout 的 loading 占位并可能一直停留。

**建议**：可在路由配置中为懒加载增加 `onError` 或使用 Vue Router 的 `beforeResolve` 做超时/错误提示；当前实现可接受，后续可增强。

---

### 3.3 已知未接入模块（无新增）

| 模块 | 说明 |
|------|------|
| `rate-limiter.js` | 预留，已标注；实际限流由 network.js 承担 |
| `scheduler-optimized.js` | 可选实现，已标注 |
| `common.js` 工具库 | 未被引用，建议在需要时优先引入 |

---

## 四、优化建议

### 4.1 高优先级（已完成）

- [x] 偷菜设置点击空白 → DefaultLayout RouterView 修复
- [x] workflowConfig 保存丢失 → data-provider 补充
- [x] stealFriendFilter Schema → config-validator 补充

### 4.2 中优先级（可选）

1. **懒加载错误处理**：为路由懒加载增加 `onError` 回调，失败时提示用户刷新或重试。
2. **Transition 性能**：若在低端设备上过渡动画卡顿，可考虑为 `prefers-reduced-motion` 用户禁用或简化。

### 4.3 低优先级（建议）

1. **common.js 使用**：在需要重试、超时、限流或格式化时，优先从 `common.js` 引入，减少重复实现。
2. **热重载说明**：`security.js` 的 `stopLoginLockCleanup` 与热重载说明已补充，测试前显式调用即可。

---

## 五、文件索引（更新）

| 文件 | 说明 |
|------|------|
| `web/src/layouts/DefaultLayout.vue` | RouterView 懒加载占位、route.fullPath 作为 key |
| `web/src/stores/setting.ts` | 各保存函数已移除 loading 修改 |
| `web/src/views/StealSettings.vue` | 使用 settingsLoading 控制本页加载态 |
| `core/src/runtime/data-provider.js` | saveSettings 已补充 workflowConfig 到 snapshot |
| `core/src/services/config-validator.js` | stealFriendFilter、workflowConfig Schema 已补充 |

---

## 六、总结

| 类别 | 数量 | 说明 |
|------|------|------|
| 本次新修复 | 1 | 偷菜设置点击空白（RouterView 懒加载） |
| 已复核无问题 | 7 | workflowConfig、Schema、await、loading 等 |
| 潜在优化 | 2 | 懒加载错误处理、Transition 可访问性 |
| 已知未接入 | 3 | rate-limiter、scheduler-optimized、common.js |

**结论**：近期功能优化未引入新的运行问题；偷菜设置点击空白已修复。当前实现可正常使用，建议按优先级逐步落实可选优化。

---

*报告生成于 viking-context 二次审查流程*
