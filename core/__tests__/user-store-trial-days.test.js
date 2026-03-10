const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const userStoreModulePath = require.resolve('../src/models/user-store');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const securityModulePath = require.resolve('../src/services/security');

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

function createMysqlMock() {
    return {
        getPool() {
            return null;
        },
        async transaction(handler) {
            return await handler({
                async query() {
                    return [[]];
                },
            });
        },
    };
}

test('trial cards keep a configured 0-day duration as permanent instead of falling back to 1 day', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'user-store-trial-days-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreMysql = mockModule(mysqlDbModulePath, createMysqlMock());

    try {
        delete require.cache[userStoreModulePath];
        const userStore = require(userStoreModulePath);
        const security = require(securityModulePath);
        const helpers = userStore.__test__;

        assert.equal(helpers.normalizeCardDaysByType(0, 'T'), 0);
        assert.equal(helpers.normalizeCardDaysByType('0', 'T'), 0);
        assert.equal(helpers.getStoredCardDays({ type: 'T', days: 0 }), 0);
        assert.equal(helpers.isPermanentCardRecord({ type: 'T', days: 0 }), true);
        assert.equal(helpers.isPermanentCardRecord({ type: 'T', days: 1 }), false);
        security.stopLoginLockCleanup();
    } finally {
        delete require.cache[userStoreModulePath];
        delete require.cache[securityModulePath];
        restoreRuntimePaths();
        restoreMysql();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
