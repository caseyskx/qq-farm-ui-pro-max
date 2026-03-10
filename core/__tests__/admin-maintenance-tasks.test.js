const test = require('node:test');
const assert = require('node:assert/strict');

const {
    formatDateKey,
    cleanupExpiredTrialRateLimitEntries,
    createDailySettlementRunner,
    registerAdminMaintenanceTasks,
} = require('../src/controllers/admin/maintenance-tasks');

function createLogger() {
    const calls = {
        info: [],
        warn: [],
        error: [],
    };
    return {
        calls,
        info: (...args) => calls.info.push(args),
        warn: (...args) => calls.warn.push(args),
        error: (...args) => calls.error.push(args),
    };
}

test('formatDateKey formats local date parts as yyyy-mm-dd', () => {
    const date = new Date('2026-03-10T08:09:10+08:00');
    assert.equal(formatDateKey(date), '2026-03-10');
});

test('cleanupExpiredTrialRateLimitEntries removes expired records only', () => {
    const map = new Map([
        ['expired', { resetTime: 100 }],
        ['active', { resetTime: 500 }],
    ]);

    cleanupExpiredTrialRateLimitEntries(map, 200);

    assert.deepEqual([...map.keys()], ['active']);
});

test('createDailySettlementRunner aggregates account gains, resets session counters and writes one stats row', async () => {
    const poolCalls = [];
    const accounts = [
        {
            stats: {
                sessionExpGained: 12,
                sessionGoldGained: 34,
                operations: {
                    steal: 2,
                    helpWater: 3,
                    helpWeed: 4,
                    helpBug: 5,
                },
            },
        },
        {
            stats: {
                sessionExpGained: 1,
                sessionGoldGained: 2,
                operations: {
                    steal: 6,
                    helpWater: 7,
                    helpWeed: 8,
                    helpBug: 9,
                },
            },
        },
        {
            stats: null,
        },
    ];
    const logger = createLogger();
    const runDailySettlement = createDailySettlementRunner({
        getProvider: () => ({
            getAccounts: async () => ({ accounts }),
        }),
        getPool: () => ({
            query: async (...args) => {
                poolCalls.push(args);
            },
        }),
        adminLogger: logger,
        getNow: () => new Date('2026-03-10T23:59:50+08:00'),
    });

    await runDailySettlement();

    assert.equal(poolCalls.length, 1);
    assert.match(poolCalls[0][0], /INSERT INTO stats_daily/);
    assert.deepEqual(poolCalls[0][1], ['2026-03-10', 13, 36, 8, 36]);
    assert.deepEqual(accounts[0].stats, {
        sessionExpGained: 0,
        sessionGoldGained: 0,
        operations: {
            steal: 0,
            helpWater: 0,
            helpWeed: 0,
            helpBug: 0,
        },
    });
    assert.deepEqual(accounts[1].stats, {
        sessionExpGained: 0,
        sessionGoldGained: 0,
        operations: {
            steal: 0,
            helpWater: 0,
            helpWeed: 0,
            helpBug: 0,
        },
    });
    assert.deepEqual(logger.calls.info, [
        ['触发每日系统产出清算，正在聚合所有运行中账号收益并落表...'],
        ['【CRON】清算完成: 经验+13, 金币+36, 偷取+8'],
    ]);
});

test('createDailySettlementRunner blocks duplicate writes on the same utc day', async () => {
    const logger = createLogger();
    let queryCount = 0;
    const runDailySettlement = createDailySettlementRunner({
        getProvider: () => ({
            getAccounts: async () => ({
                accounts: [{
                    stats: {
                        sessionExpGained: 5,
                        sessionGoldGained: 6,
                        operations: { steal: 1, helpWater: 1, helpWeed: 1, helpBug: 1 },
                    },
                }],
            }),
        }),
        getPool: () => ({
            query: async () => {
                queryCount += 1;
            },
        }),
        adminLogger: logger,
        getNow: () => new Date('2026-03-10T23:59:50+08:00'),
    });

    await runDailySettlement();
    await runDailySettlement();

    assert.equal(queryCount, 1);
    assert.deepEqual(logger.calls.warn, [
        ['【CRON】清算拦截: 今日 (2026-03-10) 的账单已聚合写库，防止 Dirty Write 双倍数据'],
    ]);
});

test('registerAdminMaintenanceTasks wires cron, cleanup intervals and stop hooks', () => {
    const logger = createLogger();
    const schedules = [];
    const intervals = [];
    const cleared = [];
    const nowMs = Date.now();
    const dailyTask = {
        stopped: 0,
        destroyed: 0,
        stop() {
            this.stopped += 1;
        },
        destroy() {
            this.destroyed += 1;
        },
    };
    const trialRateLimitMap = new Map([
        ['expired', { resetTime: nowMs - 1 }],
        ['active', { resetTime: nowMs + 60 * 1000 }],
    ]);
    const jwtCalls = [];
    const result = registerAdminMaintenanceTasks({
        cronRef: {
            schedule(expression, handler) {
                schedules.push([expression, handler]);
                return dailyTask;
            },
        },
        getProvider: () => ({ getAccounts: async () => ({ accounts: [] }) }),
        getPool: () => null,
        adminLogger: logger,
        trialRateLimitMap,
        jwtService: {
            cleanExpiredTokens() {
                jwtCalls.push('clean');
            },
        },
        setIntervalRef(handler, delay) {
            const handle = { handler, delay };
            intervals.push(handle);
            return handle;
        },
        clearIntervalRef(handle) {
            cleared.push(handle);
        },
        getNow: () => new Date('2026-03-10T23:59:50+08:00'),
    });

    assert.equal(typeof result.runDailySettlement, 'function');
    assert.deepEqual(schedules.map(([expression]) => expression), ['50 59 23 * * *']);
    assert.deepEqual(intervals.map((item) => item.delay), [60 * 60 * 1000, 60 * 60 * 1000]);
    assert.deepEqual(jwtCalls, ['clean']);

    intervals[0].handler();
    assert.deepEqual([...trialRateLimitMap.keys()], ['active']);

    intervals[1].handler();
    assert.deepEqual(jwtCalls, ['clean', 'clean']);

    result.stop();
    assert.equal(dailyTask.stopped, 1);
    assert.equal(dailyTask.destroyed, 1);
    assert.deepEqual(cleared, intervals);
});
