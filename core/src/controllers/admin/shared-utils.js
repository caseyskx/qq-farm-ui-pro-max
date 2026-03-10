function escapeCsvCell(value) {
    const text = String(value === undefined || value === null ? '' : value);
    return `"${text.replace(/"/g, '""')}"`;
}

function buildReportHistoryCsv(rows = []) {
    const header = ['ID', '账号ID', '账号名称', '类型', '结果', '渠道', '标题', '正文', '失败原因', '创建时间'];
    const lines = [header.map(escapeCsvCell).join(',')];
    for (const item of (Array.isArray(rows) ? rows : [])) {
        lines.push([
            item.id,
            item.accountId,
            item.accountName,
            item.mode,
            item.ok ? '成功' : '失败',
            item.channel,
            item.title,
            item.content,
            item.errorMessage,
            item.createdAt,
        ].map(escapeCsvCell).join(','));
    }
    return `\uFEFF${lines.join('\n')}`;
}

function toLeaderboardMetricNumber(value) {
    return Math.max(0, Number(value) || 0);
}

function getLeaderboardStatePriority(account) {
    if (account && account.connected) return 2;
    if (account && account.running) return 1;
    return 0;
}

function compareLeaderboardAccounts(a, b, sortBy) {
    const stateDiff = getLeaderboardStatePriority(b) - getLeaderboardStatePriority(a);
    if (stateDiff) return stateDiff;

    const metricOrder = Array.from(new Set([sortBy, 'level', 'gold', 'coupon', 'uptime', 'exp']));
    for (const key of metricOrder) {
        const diff = toLeaderboardMetricNumber(b[key]) - toLeaderboardMetricNumber(a[key]);
        if (diff) return diff;
    }

    const lastOnlineDiff = toLeaderboardMetricNumber(b.lastOnlineAt) - toLeaderboardMetricNumber(a.lastOnlineAt);
    if (lastOnlineDiff) return lastOnlineDiff;

    const lastStatusDiff = toLeaderboardMetricNumber(b.lastStatusAt) - toLeaderboardMetricNumber(a.lastStatusAt);
    if (lastStatusDiff) return lastStatusDiff;

    return String(a.id || '').localeCompare(String(b.id || ''), 'zh-CN', { numeric: true });
}

function buildAdminListenError(error, port) {
    const wrapped = new Error(
        error && error.code === 'EADDRINUSE'
            ? `管理面板端口 ${port} 已被占用，请先关闭旧进程，或修改 FARM_PORT / ADMIN_PORT 后重试`
            : `管理面板启动失败: ${error && error.message ? error.message : String(error || 'unknown error')}`
    );
    wrapped.code = error && error.code ? error.code : '';
    wrapped.port = Number(port || 0);
    wrapped.cause = error;
    return wrapped;
}

module.exports = {
    buildReportHistoryCsv,
    compareLeaderboardAccounts,
    buildAdminListenError,
    toLeaderboardMetricNumber,
};
