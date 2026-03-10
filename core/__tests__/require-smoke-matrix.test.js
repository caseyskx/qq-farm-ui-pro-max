const test = require('node:test');
const assert = require('node:assert/strict');

const projectSrcMarker = '/core/src/';
const loadEnvModulePath = require.resolve('../src/config/load-env');
const loggerModulePath = require.resolve('../src/services/logger');
const schedulerModulePath = require.resolve('../src/services/scheduler');
const circuitBreakerModulePath = require.resolve('../src/services/circuit-breaker');
const mysqlDriverModulePath = require.resolve('mysql2/promise');
const redisDriverModulePath = require.resolve('ioredis');

const REQUIRE_SMOKE_CASES = [
    ['config/config', require.resolve('../src/config/config')],
    ['services/ai-workspace', require.resolve('../src/services/ai-workspace')],
    ['services/security', require.resolve('../src/services/security')],
    ['services/mysql-db', require.resolve('../src/services/mysql-db')],
    ['services/redis-cache', require.resolve('../src/services/redis-cache')],
    ['services/database', require.resolve('../src/services/database')],
    ['models/store', require.resolve('../src/models/store')],
    ['services/friend/friend-state', require.resolve('../src/services/friend/friend-state')],
    ['services/account-mode-policy', require.resolve('../src/services/account-mode-policy')],
    ['services/task', require.resolve('../src/services/task')],
    ['services/farm', require.resolve('../src/services/farm')],
    ['runtime/worker-manager', require.resolve('../src/runtime/worker-manager')],
    ['utils/network', require.resolve('../src/utils/network')],
];

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

function clearProjectSourceModuleCache() {
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.includes(projectSrcMarker)) {
            delete require.cache[modulePath];
        }
    }
}

function createLoggerMock() {
    return {
        createModuleLogger() {
            return {
                info() { },
                warn() { },
                error() { },
                debug() { },
            };
        },
        sanitizeMeta(value) {
            return value;
        },
        redactString(value) {
            return String(value || '');
        },
    };
}

function installCommonMocks(tracker) {
    const restoreFns = [];

    restoreFns.push(mockModule(loadEnvModulePath, {
        loadProjectEnv() { },
    }));

    restoreFns.push(mockModule(loggerModulePath, createLoggerMock()));

    restoreFns.push(mockModule(schedulerModulePath, {
        createScheduler(namespace) {
            tracker.schedulerCalls.push(namespace);
            return {
                setTimeoutTask() { },
                setIntervalTask() { },
                clear() { },
                clearAll() { },
                has() { return false; },
                getTaskNames() { return []; },
            };
        },
    }));

    restoreFns.push(mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            allowRequest() { return true; },
            isAvailable() { return true; },
            recordSuccess() { },
            recordFailure() { },
        },
    }));

    restoreFns.push(mockModule(mysqlDriverModulePath, {
        createPool() {
            tracker.mysqlPoolCalls += 1;
            return {
                query: async () => [[]],
                execute: async () => [[]],
                getConnection: async () => ({
                    beginTransaction: async () => { },
                    commit: async () => { },
                    rollback: async () => { },
                    release() { },
                }),
                end: async () => { },
                pool: {},
            };
        },
        createConnection: async () => ({
            query: async () => [[]],
            end: async () => { },
        }),
    }));

    class MockRedis {
        constructor() {
            tracker.redisClientCalls += 1;
            this.status = 'wait';
        }

        on() {
            return this;
        }

        async connect() {
            this.status = 'ready';
        }

        async ping() {
            return 'PONG';
        }

        async quit() {
            this.status = 'end';
        }

        disconnect() {
            this.status = 'end';
        }

        async get() {
            return null;
        }

        async set() {
            return 'OK';
        }

        async del() {
            return 1;
        }
    }

    restoreFns.push(mockModule(redisDriverModulePath, MockRedis));

    return () => {
        while (restoreFns.length > 0) {
            const restore = restoreFns.pop();
            restore();
        }
    };
}

function withIntervalTracking(run) {
    const intervalCalls = [];
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    globalThis.setInterval = (handler, delay, ...args) => {
        const handle = {
            handler,
            delay,
            args,
            cleared: false,
            unref() {
                return handle;
            },
        };
        intervalCalls.push(handle);
        return handle;
    };
    globalThis.clearInterval = (handle) => {
        if (handle && typeof handle === 'object') {
            handle.cleared = true;
        }
    };

    return Promise.resolve()
        .then(() => run({ intervalCalls }))
        .finally(() => {
            globalThis.setInterval = originalSetInterval;
            globalThis.clearInterval = originalClearInterval;
        });
}

for (const [label, modulePath] of REQUIRE_SMOKE_CASES) {
    test(`require smoke: ${label} does not start runtime handles or external clients`, async () => {
        const tracker = {
            schedulerCalls: [],
            mysqlPoolCalls: 0,
            redisClientCalls: 0,
        };

        clearProjectSourceModuleCache();
        const restoreMocks = installCommonMocks(tracker);

        try {
            await withIntervalTracking(async ({ intervalCalls }) => {
                require(modulePath);
                assert.equal(intervalCalls.length, 0);
                assert.equal(tracker.schedulerCalls.length, 0);
                assert.equal(tracker.mysqlPoolCalls, 0);
                assert.equal(tracker.redisClientCalls, 0);
            });
        } finally {
            clearProjectSourceModuleCache();
            restoreMocks();
        }
    });
}
