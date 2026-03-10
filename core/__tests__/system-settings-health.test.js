const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

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
    return {
        getDataFile(filename) {
            return path.join(dataDir, filename);
        },
        ensureDataDir() {
            fs.mkdirSync(dataDir, { recursive: true });
            return dataDir;
        },
    };
}

function createMysqlMock(initialSettings = {}) {
    const state = {
        systemSettings: { ...initialSettings },
    };

    async function handleQuery(sql, params = []) {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
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

test('system settings health reports missing keys and whether legacy fallback would activate', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'system-settings-health-'));
    fs.mkdirSync(path.join(tempRoot, 'data'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'data', 'trial-ip-history.json'), JSON.stringify({ dailyTotal: 0 }, null, 2), 'utf8');

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const mysqlMock = createMysqlMock({
        global_config: { trialCardConfig: { enabled: true } },
        jwt_secret: 'x'.repeat(64),
    });
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);

    try {
        delete require.cache[systemSettingsModulePath];
        const { inspectSystemSettingsHealth, SYSTEM_SETTING_KEYS } = require(systemSettingsModulePath);

        const health = await inspectSystemSettingsHealth();
        assert.equal(health.ok, false);
        assert.deepEqual(health.missingRequiredKeys, [SYSTEM_SETTING_KEYS.TRIAL_IP_HISTORY]);
        assert.deepEqual(health.fallbackWouldActivateKeys, [SYSTEM_SETTING_KEYS.TRIAL_IP_HISTORY]);

        mysqlMock.__state.systemSettings[SYSTEM_SETTING_KEYS.TRIAL_IP_HISTORY] = {
            dailyTotal: 0,
            dailyDate: '2026-03-09',
            ipMap: {},
        };

        const healed = await inspectSystemSettingsHealth();
        assert.equal(healed.ok, true);
        assert.deepEqual(healed.missingRequiredKeys, []);
        assert.deepEqual(healed.fallbackWouldActivateKeys, []);
    } finally {
        delete require.cache[systemSettingsModulePath];
        restoreRuntimePaths();
        restoreMysql();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
