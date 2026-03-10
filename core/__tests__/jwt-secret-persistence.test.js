const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const jwtServiceModulePath = require.resolve('../src/services/jwt-service');
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

        if (normalizedSql.startsWith('insert into system_settings')) {
            const [key, value] = params;
            state.systemSettings[String(key)] = JSON.parse(String(value));
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }

    return {
        isMysqlInitialized() {
            return true;
        },
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

test('jwt secret reloads from system_settings so existing tokens survive restart without legacy file', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jwt-secret-persistence-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const mysqlMock = createMysqlMock();
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);
    const previousEnvSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;

    try {
        delete require.cache[jwtServiceModulePath];
        delete require.cache[systemSettingsModulePath];

        let jwtService = require(jwtServiceModulePath);
        const secret = await jwtService.initJwtSecretPersistence();
        const token = jwtService.signAccessToken({ username: 'alice', role: 'user' });

        assert.equal(typeof secret, 'string');
        assert.equal(secret.length >= 32, true);
        assert.equal(mysqlMock.__state.systemSettings.jwt_secret, secret);
        assert.equal(fs.existsSync(path.join(tempRoot, 'data', '.jwt-secret')), false);

        fs.rmSync(path.join(tempRoot, 'data', '.jwt-secret'), { force: true });

        delete require.cache[jwtServiceModulePath];
        delete require.cache[systemSettingsModulePath];

        jwtService = require(jwtServiceModulePath);
        const reloadedSecret = await jwtService.initJwtSecretPersistence();
        const decoded = jwtService.verifyAccessToken(token);

        assert.equal(reloadedSecret, secret);
        assert.equal(decoded.username, 'alice');
        assert.equal(decoded.role, 'user');
    } finally {
        if (previousEnvSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previousEnvSecret;
        }
        delete require.cache[jwtServiceModulePath];
        delete require.cache[systemSettingsModulePath];
        restoreRuntimePaths();
        restoreMysql();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
