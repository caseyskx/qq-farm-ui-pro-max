const fs = require('fs');

const latestUpdate = `
### 🗄️ 架构治理与性能提速 (Phase 1-4 深度优化)
- **终局化数据库迁移**: 移除原有 JSON 文件的高频写操作，将核心配置底座彻底切入 MySQL 连接池，化解并发环境下的数据竞态与存档丢失风险。
- **排队超时与优先仲裁**: 升级底层 \`TokenBucket\` 调度网络，现当普通操作的排队等待超过 5000ms 时自动丢弃让权，确保“抢收”、“防偷”享有毫秒级最高下发优先级。
- **微信软降级防封壁垒**: 隔离微信登录平台下的高危探测。系统主动剥离好友扫描与群发偷菜，且巡回心跳间隔从常规放大至 15~30 分钟，大幅衰减风控红线惩罚率。
- **内存防溢出与多端告警**:
  - 前端执行 LRU 阻断阀将日志与状态栈强制收束至 300 条以内，根治了长期挂机下浏览器内存泄露引起的白屏、闪退及卡顿。
  - 网络层拦截接入自定义 \`Webhook\` 通知。目前遭遇系统封禁 (1002003) 及被踢下线等 P0 级事件将直接同步至移动端/第三方群组端通知。

`;

const filesToUpdate = ['CHANGELOG.md', 'CHANGELOG.DEVELOPMENT.md'];
for (const file of filesToUpdate) {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf-8');
        // Find the spot after #### 🐛 通路修润与防封补充 block
        content = content.replace(/(### 🐛 通路修润与防封补充[\s\S]*?)(---)/, `$1\n${latestUpdate}\n$2`);
        fs.writeFileSync(file, content, 'utf-8');
        console.log(`Updated ${file}`);
    }
}

const updateLog = 'logs/development/Update.log';
if (fs.existsSync(updateLog)) {
    let content = fs.readFileSync(updateLog, 'utf-8');
    const updateLogEntry = `
2026-03-06 Phase 1-4 深度性能治理发布 v4.3.0 补充
新增：多端 Webhook 平台级推送告警能力。现对于系统被踢以及1002003风控休眠将触发跨设备警告。
新增：网络端 Request Dropping，超5秒超时的一般操作实施防堵塞强清策略机制。
调整：彻底使用 MySQL 接管文件配置写入方案，弃用旧式的 FS JSON 同步。
调整：对平台标记进行全方位隔离。涉及特征为(wx)的微信扫码端被阻断执行全量列表以及跨组偷菜，且周期拉长，保证低频率苟活。
调整：前端面板数据结构精简约束。
`;
    // Prepend to top instead of replacing
    fs.writeFileSync(updateLog, updateLogEntry + content, 'utf-8');
    console.log(`Updated ${updateLog}`);
}
