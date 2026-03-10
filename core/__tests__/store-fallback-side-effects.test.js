const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const storeModulePath = require.resolve('../src/models/store');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const systemSettingsModulePath = require.resolve('../src/services/system-settings');
const jsonDbModulePath = require.resolve('../src/services/json-db');
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
    return {
        getDataFile(filename) {
            return path.join(dataDir, filename);
        },
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

test('requiring store does not load local fallback file eagerly', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-fallback-side-effects-'));
    let readJsonCalls = 0;

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreMysql = mockModule(mysqlDbModulePath, {
        getPool() {
            throw new Error('should not touch mysql in this test');
        },
        async transaction(handler) {
            return await handler({
                async query() {
                    return [[]];
                },
            });
        },
        isMysqlInitialized() {
            return false;
        },
    });
    const restoreSystemSettings = mockModule(systemSettingsModulePath, {
        SYSTEM_SETTING_KEYS: { GLOBAL_CONFIG: 'global_config' },
        async getSystemSettings() {
            return {};
        },
        async setSystemSettings() {},
    });
    const restoreJsonDb = mockModule(jsonDbModulePath, {
        readJsonFile() {
            readJsonCalls += 1;
            return {};
        },
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[storeModulePath];
        const store = require(storeModulePath);
        assert.equal(readJsonCalls, 0);

        store.getUI();
        assert.equal(readJsonCalls, 1);
    } finally {
        delete require.cache[storeModulePath];
        restoreLogger();
        restoreJsonDb();
        restoreSystemSettings();
        restoreMysql();
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
