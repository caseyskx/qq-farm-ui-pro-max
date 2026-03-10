const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const storeModulePath = require.resolve('../src/models/store');
const statsModulePath = require.resolve('../src/services/stats');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const loggerModulePath = require.resolve('../src/services/logger');

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

function createRuntimePathsMock(rootDir) {
    const dataDir = path.join(rootDir, 'data');
    const logDir = path.join(rootDir, 'logs');
    return {
        getDataFile(filename) {
            return path.join(dataDir, filename);
        },
        ensureDataDir() {
            fs.mkdirSync(dataDir, { recursive: true });
            return dataDir;
        },
        ensureLogDir() {
            fs.mkdirSync(logDir, { recursive: true });
            return logDir;
        },
    };
}

function createLoggerMock(records) {
    return {
        createModuleLogger(moduleName) {
            return {
                info(message, meta = {}) {
                    records.push({ level: 'info', moduleName, message, meta });
                },
                warn(message, meta = {}) {
                    records.push({ level: 'warn', moduleName, message, meta });
                },
                error(message, meta = {}) {
                    records.push({ level: 'error', moduleName, message, meta });
                },
                debug(message, meta = {}) {
                    records.push({ level: 'debug', moduleName, message, meta });
                },
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

test('store initStoreRuntime skips uninitialized MySQL noise without emitting error logs', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-noise-control-'));
    const loggerRecords = [];
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreMysql = mockModule(mysqlDbModulePath, {
        getPool() {
            throw new Error('MySQL pool is not initialized. Call initMysql() first.');
        },
        async transaction(handler) {
            return await handler({
                async query() {
                    return [[]];
                },
            });
        },
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock(loggerRecords));

    try {
        delete require.cache[storeModulePath];
        const store = require(storeModulePath);
        const result = await store.initStoreRuntime();

        assert.equal(result, false);
        assert.equal(
            loggerRecords.some(record => record.message === '加载全局配置失败'),
            false,
        );
    } finally {
        delete require.cache[storeModulePath];
        restoreLogger();
        restoreMysql();
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

async function runStatsNoiseScenario(verboseEnabled) {
    const loggerRecords = [];
    const previousVerbose = process.env.FARM_VERBOSE_STATS_DELTA;
    if (verboseEnabled) process.env.FARM_VERBOSE_STATS_DELTA = '1';
    else delete process.env.FARM_VERBOSE_STATS_DELTA;
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock(loggerRecords));

    try {
        delete require.cache[statsModulePath];
        const stats = require(statsModulePath);
        stats.initStats(100, 100, 0);
        stats.updateStats(100, 120);
        stats.updateStats(100, 140);
        return loggerRecords;
    } finally {
        delete require.cache[statsModulePath];
        restoreLogger();
        if (previousVerbose === undefined) delete process.env.FARM_VERBOSE_STATS_DELTA;
        else process.env.FARM_VERBOSE_STATS_DELTA = previousVerbose;
    }
}

test('stats delta logs stay quiet by default', async () => {
    const loggerRecords = await runStatsNoiseScenario(false);
    assert.equal(
        loggerRecords.some(record => record.moduleName === 'stats' && record.message === '经验增量记录'),
        false,
    );
});

test('stats delta logs emit only when FARM_VERBOSE_STATS_DELTA is enabled', async () => {
    const loggerRecords = await runStatsNoiseScenario(true);
    assert.equal(
        loggerRecords.some(record => record.moduleName === 'stats' && record.message === '经验增量记录' && record.level === 'info'),
        true,
    );
});
