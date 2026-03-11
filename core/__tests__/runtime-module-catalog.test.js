const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildRuntimeModuleReloadView,
    createRuntimeModuleDefinitions,
    getRuntimeModuleReloadPlan,
    listReloadableRuntimeModules,
} = require('../src/runtime/runtime-module-catalog');

test('runtime module catalog exposes module definitions and reload plans with dependency expansion', () => {
    const definitions = createRuntimeModuleDefinitions({});
    const names = definitions.map(item => item.name);

    assert.deepEqual(names, ['session-control', 'farm', 'friend', 'task', 'warehouse']);
    assert.equal(definitions.find(item => item.name === 'session-control').reloadable, false);
    assert.equal(definitions.find(item => item.name === 'farm').reloadable, true);

    const farmPlan = getRuntimeModuleReloadPlan('farm');
    const warehousePlan = getRuntimeModuleReloadPlan('warehouse');
    const businessPlan = getRuntimeModuleReloadPlan('business');

    assert.deepEqual(farmPlan.modules, ['farm', 'friend']);
    assert.deepEqual(warehousePlan.modules, ['warehouse', 'farm', 'friend']);
    assert.deepEqual(businessPlan.modules, ['farm', 'friend', 'task', 'warehouse']);
    assert.ok(farmPlan.cacheKeys.length >= 2);
    assert.ok(warehousePlan.cacheKeys.length >= farmPlan.cacheKeys.length);
    assert.equal(getRuntimeModuleReloadPlan('missing'), null);
    assert.deepEqual(
        listReloadableRuntimeModules().map(item => item.target),
        ['farm', 'friend', 'task', 'warehouse', 'business'],
    );
    assert.equal(listReloadableRuntimeModules().find(item => item.target === 'business').riskLevel, 'high');
});

test('runtime module catalog builds dynamic reload previews with queue impact and cooldown state', () => {
    const item = buildRuntimeModuleReloadView('farm', {
        now: 20_000,
        loginReady: true,
        unifiedSchedulerRunning: true,
        workerSchedulerSnapshot: {
            taskCount: 4,
            tasks: [
                { name: 'farm_cycle', running: true },
                { name: 'friend_cycle', running: false },
                { name: 'task_scan', running: true },
                { name: 'status_sync', running: false },
            ],
        },
        activityByTarget: {
            farm: {
                lastReloadAt: 10_000,
                lastReloadResult: 'ok',
                lastReloadSource: 'admin_api',
                lastReloadTarget: 'business',
                cooldownMs: 15_000,
                lastReloadSummary: {
                    target: 'business',
                    modules: ['farm', 'friend', 'task', 'warehouse'],
                    forced: true,
                    result: 'ok',
                    source: 'admin_api',
                    startedAt: 9_100,
                    finishedAt: 10_000,
                    durationMs: 900,
                    beforeTaskCount: 4,
                    beforeRunningTaskCount: 2,
                    afterTaskCount: 3,
                    afterRunningTaskCount: 1,
                    unifiedSchedulerResumed: true,
                },
            },
        },
    });

    assert.equal(item.target, 'farm');
    assert.equal(item.riskLevel, 'medium');
    assert.equal(item.affectsUnifiedScheduler, true);
    assert.equal(item.workerTaskCount, 4);
    assert.equal(item.workerRunningTaskCount, 2);
    assert.equal(item.inCooldown, true);
    assert.equal(item.requiresForce, true);
    assert.equal(item.cooldownRemainingMs, 5_000);
    assert.match(item.queueImpactSummary, /当前 worker 队列 4 个任务/);
    assert.equal(item.lastReloadSource, 'admin_api');
    assert.equal(item.lastReloadTarget, 'business');
    assert.equal(item.lastReloadForced, true);
    assert.equal(item.lastReloadDurationMs, 900);
    assert.equal(item.lastReloadSummary.target, 'business');
    assert.equal(item.lastReloadSummary.afterTaskCount, 3);
    assert.equal(item.lastReloadSummary.unifiedSchedulerResumed, true);
});
