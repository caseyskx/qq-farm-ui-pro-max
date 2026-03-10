const test = require('node:test');
const assert = require('node:assert/strict');

const { buildReportHistoryCsv, compareLeaderboardAccounts, buildAdminListenError } = require('../src/controllers/admin/shared-utils');

test('buildReportHistoryCsv keeps BOM and escapes quotes/newlines safely', () => {
    const csv = buildReportHistoryCsv([
        {
            id: 7,
            accountId: '10001',
            accountName: '主号"A"',
            mode: 'daily',
            ok: false,
            channel: 'qq',
            title: '标题',
            content: '第一行\n第二行',
            errorMessage: '失败"原因"',
            createdAt: '2026-03-10 09:00:00',
        },
    ]);

    assert.equal(csv.startsWith('\uFEFF'), true);
    assert.match(csv, /"主号""A"""/);
    assert.match(csv, /"第一行\n第二行"/);
    assert.match(csv, /"失败""原因"""/);
});

test('compareLeaderboardAccounts prioritizes runtime state before metrics', () => {
    const offlineHighLevel = { id: '2', connected: false, running: false, level: 99, gold: 99999 };
    const connectedLowLevel = { id: '1', connected: true, running: true, level: 10, gold: 1 };
    const runningMidLevel = { id: '3', connected: false, running: true, level: 50, gold: 10 };

    assert(compareLeaderboardAccounts(connectedLowLevel, offlineHighLevel, 'level') < 0);
    assert(compareLeaderboardAccounts(runningMidLevel, offlineHighLevel, 'level') < 0);
    assert(compareLeaderboardAccounts(offlineHighLevel, runningMidLevel, 'level') > 0);
});

test('buildAdminListenError preserves code, port and readable message', () => {
    const original = new Error('listen EADDRINUSE');
    original.code = 'EADDRINUSE';

    const wrapped = buildAdminListenError(original, 3000);
    assert.equal(wrapped.code, 'EADDRINUSE');
    assert.equal(wrapped.port, 3000);
    assert.equal(wrapped.cause, original);
    assert.match(wrapped.message, /3000/);
});
