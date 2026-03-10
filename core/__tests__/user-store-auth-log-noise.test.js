const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const userStoreModulePath = require.resolve('../src/models/user-store');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const securityModulePath = require.resolve('../src/services/security');
const loggerModulePath = require.resolve('../src/services/logger');
const systemSettingsModulePath = require.resolve('../src/services/system-settings');
const userActionLoggerModulePath = require.resolve('../src/utils/logger');

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
    const createdAt = new Date('2026-03-10T00:00:00.000Z');
    return {
        getPool() {
            return {
                async query(sql) {
                    const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
                    if (normalizedSql === 'select * from users') {
                        return [[{
                            id: 1,
                            username: 'alice',
                            password_hash: 'hashed-password',
                            role: 'user',
                            status: 'active',
                            created_at: createdAt,
                        }]];
                    }
                    if (normalizedSql.includes('from cards inner join users')) {
                        return [[]];
                    }
                    if (normalizedSql.includes('from cards left join users')) {
                        return [[]];
                    }
                    return [[]];
                },
            };
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
    };
}

async function runValidateUserScenario(verboseEnabled) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'user-store-auth-log-'));
    const loggerRecords = [];
    const previousVerbose = process.env.FARM_VERBOSE_AUTH_LOGS;
    if (verboseEnabled) process.env.FARM_VERBOSE_AUTH_LOGS = '1';
    else delete process.env.FARM_VERBOSE_AUTH_LOGS;

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreMysql = mockModule(mysqlDbModulePath, createMysqlMock());
    const restoreSecurity = mockModule(securityModulePath, {
        hashPassword(value) {
            return `hashed:${value}`;
        },
        verifyPassword() {
            return { valid: true, needsMigration: false };
        },
        checkPasswordStrength() {
            return { strong: true, errors: [] };
        },
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock(loggerRecords));
    const restoreSystemSettings = mockModule(systemSettingsModulePath, {
        SYSTEM_SETTING_KEYS: { TRIAL_IP_HISTORY: 'trial_ip_history' },
        async getSystemSetting() {
            return null;
        },
        async setSystemSetting() {},
    });
    const restoreUserActionLogger = mockModule(userActionLoggerModulePath, {
        logUserAction() {},
    });

    try {
        delete require.cache[userStoreModulePath];
        const userStore = require(userStoreModulePath);
        const result = await userStore.validateUser('alice', 'plain-password');
        return { loggerRecords, result };
    } finally {
        if (previousVerbose === undefined) delete process.env.FARM_VERBOSE_AUTH_LOGS;
        else process.env.FARM_VERBOSE_AUTH_LOGS = previousVerbose;
        delete require.cache[userStoreModulePath];
        restoreUserActionLogger();
        restoreSystemSettings();
        restoreLogger();
        restoreSecurity();
        restoreMysql();
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

test('validateUser stays quiet by default and does not emit auth detail logs', async () => {
    const { loggerRecords, result } = await runValidateUserScenario(false);

    assert.equal(result.username, 'alice');
    assert.equal(
        loggerRecords.some(record => record.message === '用户登录校验通过'),
        false,
    );
});

test('validateUser emits auth detail logs only when FARM_VERBOSE_AUTH_LOGS is enabled', async () => {
    const { loggerRecords, result } = await runValidateUserScenario(true);

    assert.equal(result.username, 'alice');
    assert.equal(
        loggerRecords.some(record => record.message === '用户登录校验通过' && record.level === 'info'),
        true,
    );
});
