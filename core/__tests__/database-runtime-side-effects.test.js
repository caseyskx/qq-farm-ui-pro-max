const test = require('node:test');
const assert = require('node:assert/strict');

const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const databaseModulePath = require.resolve('../src/services/database');
const mysqlDriverModulePath = require.resolve('mysql2/promise');
const loadEnvModulePath = require.resolve('../src/config/load-env');
const loggerModulePath = require.resolve('../src/services/logger');
const redisCacheModulePath = require.resolve('../src/services/redis-cache');
const circuitBreakerModulePath = require.resolve('../src/services/circuit-breaker');
const jwtServiceModulePath = require.resolve('../src/services/jwt-service');

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
    };
}

function withIntervalTracking(run) {
    const intervalCalls = [];
    const clearCalls = [];
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
        clearCalls.push(handle);
        if (handle && typeof handle === 'object') {
            handle.cleared = true;
        }
    };

    return Promise.resolve()
        .then(() => run({ intervalCalls, clearCalls }))
        .finally(() => {
            globalThis.setInterval = originalSetInterval;
            globalThis.clearInterval = originalClearInterval;
        });
}

test('requiring mysql-db does not start pool monitor interval eagerly', async () => {
    let createPoolCalls = 0;
    const restoreLoadEnv = mockModule(loadEnvModulePath, {
        loadProjectEnv() {},
    });
    const restoreMysqlDriver = mockModule(mysqlDriverModulePath, {
        createPool() {
            createPoolCalls += 1;
            return {
                query: async () => [[]],
                execute: async () => [[]],
                getConnection: async () => ({ release() {} }),
                end: async () => {},
                pool: {},
            };
        },
        createConnection: async () => ({
            query: async () => [[]],
            end: async () => {},
        }),
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[mysqlDbModulePath];
        await withIntervalTracking(async ({ intervalCalls }) => {
            require(mysqlDbModulePath);
            assert.equal(intervalCalls.length, 0);
            assert.equal(createPoolCalls, 0);
        });
    } finally {
        delete require.cache[mysqlDbModulePath];
        restoreLogger();
        restoreMysqlDriver();
        restoreLoadEnv();
    }
});

test('requiring database stays side-effect free and buffered logs start flush loop lazily', async () => {
    const restoreMysqlDb = mockModule(mysqlDbModulePath, {
        async initMysql() {},
        async closeMysql() {},
        getPool() {
            return {
                query: async () => [[]],
                execute: async () => [[]],
            };
        },
        isMysqlInitialized() {
            return true;
        },
    });
    const restoreRedisCache = mockModule(redisCacheModulePath, {
        async initRedis() {
            return false;
        },
        async closeRedis() {},
        getRedisClient() {
            return null;
        },
    });
    const restoreCircuitBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            isAvailable() {
                return true;
            },
            recordSuccess() {},
            recordFailure() {},
        },
    });
    const restoreJwtService = mockModule(jwtServiceModulePath, {
        async initJwtSecretPersistence() {},
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[databaseModulePath];
        await withIntervalTracking(async ({ intervalCalls, clearCalls }) => {
            const database = require(databaseModulePath);
            assert.equal(intervalCalls.length, 0);

            database.bufferedInsertLog('1001', 'login', 'ok', { source: 'test' });
            assert.equal(intervalCalls.length, 1);

            await database.closeDatabase();
            assert.equal(clearCalls.length, 1);
        });
    } finally {
        delete require.cache[databaseModulePath];
        restoreLogger();
        restoreJwtService();
        restoreCircuitBreaker();
        restoreRedisCache();
        restoreMysqlDb();
    }
});
