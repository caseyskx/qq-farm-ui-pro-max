const test = require('node:test');
const assert = require('node:assert/strict');

const schedulerModulePath = require.resolve('../src/services/scheduler');
const taskModulePath = require.resolve('../src/services/task');
const farmModulePath = require.resolve('../src/services/farm');
const workerManagerModulePath = require.resolve('../src/runtime/worker-manager');

function mockModule(modulePath, exports) {
    const previous = require.cache[modulePath];
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    };

    return () => {
        if (previous) require.cache[modulePath] = previous;
        else delete require.cache[modulePath];
    };
}

function createSchedulerStub() {
    return {
        setTimeoutTask() {},
        setIntervalTask() {},
        clear() {},
        clearAll() {},
        has() { return false; },
        getTaskNames() { return []; },
    };
}

function buildWorkerManagerOptions() {
    return {
        fork() {},
        WorkerThread: function MockWorkerThread() {},
        runtimeMode: 'thread',
        processRef: { env: {}, pkg: false },
        mainEntryPath: '/tmp/main.js',
        workerScriptPath: '/tmp/worker.js',
        workers: {},
        globalLogs: [],
        log() {},
        addAccountLog() {},
        normalizeStatusForPanel(status) { return status; },
        buildConfigSnapshotForAccount() { return {}; },
        getOfflineAutoDeleteMs() { return 0; },
        triggerOfflineReminder() {},
        addOrUpdateAccount() {},
        markAccountLoginSuccess() {},
        deleteAccount() {},
        upsertFriendBlacklist() { return false; },
        updateFriendsCache() {},
        broadcastConfigToWorkers() {},
        onStatusSync() {},
        onWorkerLog() {},
    };
}

test('requiring task does not create scheduler until task flow actually schedules work', () => {
    let createSchedulerCalls = 0;
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            createSchedulerCalls += 1;
            return createSchedulerStub();
        },
    });

    try {
        delete require.cache[taskModulePath];
        const taskService = require(taskModulePath);
        assert.equal(createSchedulerCalls, 0);

        taskService.cleanupTaskSystem();
        assert.equal(createSchedulerCalls, 0);
    } finally {
        delete require.cache[taskModulePath];
        restoreScheduler();
    }
});

test('requiring farm does not create scheduler until farm loop actually starts', () => {
    let createSchedulerCalls = 0;
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            createSchedulerCalls += 1;
            return createSchedulerStub();
        },
    });

    try {
        delete require.cache[farmModulePath];
        const farmService = require(farmModulePath);
        assert.equal(createSchedulerCalls, 0);

        farmService.stopFarmCheckLoop();
        assert.equal(createSchedulerCalls, 0);
    } finally {
        delete require.cache[farmModulePath];
        restoreScheduler();
    }
});

test('worker-manager starts log flush interval lazily on createWorkerManager and only once', () => {
    let createSchedulerCalls = 0;
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            createSchedulerCalls += 1;
            return createSchedulerStub();
        },
    });
    const originalSetInterval = globalThis.setInterval;
    const intervalCalls = [];
    globalThis.setInterval = (handler, delay) => {
        intervalCalls.push({ handler, delay });
        return {
            unref() {},
        };
    };

    try {
        delete require.cache[workerManagerModulePath];
        const { createWorkerManager } = require(workerManagerModulePath);
        assert.equal(intervalCalls.length, 0);

        createWorkerManager(buildWorkerManagerOptions());
        assert.equal(intervalCalls.length, 1);
        assert.equal(intervalCalls[0].delay, 5000);
        assert.equal(createSchedulerCalls, 1);

        createWorkerManager(buildWorkerManagerOptions());
        assert.equal(intervalCalls.length, 1);
        assert.equal(createSchedulerCalls, 2);
    } finally {
        globalThis.setInterval = originalSetInterval;
        delete require.cache[workerManagerModulePath];
        restoreScheduler();
    }
});
