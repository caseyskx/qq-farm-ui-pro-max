const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const storeModulePath = require.resolve('../src/models/store');
const systemSettingsModulePath = require.resolve('../src/services/system-settings');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');

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

function createMysqlMock(initialState = {}) {
    const state = {
        accountConfigs: Array.isArray(initialState.accountConfigs)
            ? initialState.accountConfigs.map(item => ({ ...item }))
            : [],
        systemSettings: { ...(initialState.systemSettings || {}) },
    };

    async function handleQuery(sql, params = []) {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

        if (normalizedSql.startsWith('select * from account_configs')) {
            return [state.accountConfigs];
        }

        if (normalizedSql.startsWith('select setting_key, setting_value from system_settings')) {
            const keys = Array.isArray(params) ? params.map(item => String(item)) : [];
            const rows = Object.entries(state.systemSettings)
                .filter(([key]) => keys.length === 0 || keys.includes(key))
                .map(([setting_key, value]) => ({
                    setting_key,
                    setting_value: JSON.stringify(value),
                }));
            return [rows];
        }

        if (normalizedSql.startsWith('insert into system_settings')) {
            const [key, value] = params;
            state.systemSettings[String(key)] = JSON.parse(String(value));
            return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith('insert into account_configs')) {
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }

    return {
        getPool() {
            return {
                query: handleQuery,
                execute: handleQuery,
            };
        },
        async transaction(handler) {
            return await handler({
                query: handleQuery,
                execute: handleQuery,
            });
        },
        __state: state,
    };
}

test('global settings persist to system_settings and reload from MySQL without store.json', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-system-settings-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const mysqlMock = createMysqlMock();
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);

    try {
        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];

        let store = require(storeModulePath);

        store.setTrialCardConfig({
            enabled: false,
            days: 30,
            dailyLimit: 88,
            cooldownMs: 6 * 60 * 60 * 1000,
            adminRenewEnabled: false,
            userRenewEnabled: true,
            maxAccounts: 5,
        });

        await store.flushGlobalConfigSave();

        assert.deepEqual(mysqlMock.__state.systemSettings.global_config.trialCardConfig, {
            enabled: false,
            dailyLimit: 88,
            cooldownMs: 6 * 60 * 60 * 1000,
            days: 30,
            maxAccounts: 5,
            adminRenewEnabled: false,
            userRenewEnabled: true,
        });
        assert.equal(fs.existsSync(path.join(tempRoot, 'data', 'store.json')), false);

        const storeFile = path.join(tempRoot, 'data', 'store.json');
        fs.rmSync(storeFile, { force: true });

        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];

        store = require(storeModulePath);
        await store.initStoreRuntime();

        assert.deepEqual(store.getTrialCardConfig(), {
            enabled: false,
            dailyLimit: 88,
            cooldownMs: 6 * 60 * 60 * 1000,
            days: 30,
            maxAccounts: 5,
            adminRenewEnabled: false,
            userRenewEnabled: true,
        });
    } finally {
        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];
        restoreRuntimePaths();
        restoreMysql();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
