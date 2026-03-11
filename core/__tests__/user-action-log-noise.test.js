const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const userActionLoggerModulePath = require.resolve('../src/utils/logger');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const serviceLoggerModulePath = require.resolve('../src/services/logger');

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

function createRuntimePathsMock(rootDir) {
    const logDir = path.join(rootDir, 'logs');
    return {
        ensureLogDir() {
            fs.mkdirSync(logDir, { recursive: true });
            return logDir;
        },
    };
}

async function runUserActionLogScenario(verboseEnabled) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'user-action-log-'));
    const loggerRecords = [];
    const previousVerbose = process.env.FARM_VERBOSE_USER_ACTION_LOGS;
    if (verboseEnabled) process.env.FARM_VERBOSE_USER_ACTION_LOGS = '1';
    else delete process.env.FARM_VERBOSE_USER_ACTION_LOGS;

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreLogger = mockModule(serviceLoggerModulePath, createLoggerMock(loggerRecords));

    try {
        delete require.cache[userActionLoggerModulePath];
        const { logUserAction } = require(userActionLoggerModulePath);
        logUserAction('register', 'alice', { days: 30 });

        const logFile = path.join(tempRoot, 'logs', 'user-actions.log');
        const content = fs.readFileSync(logFile, 'utf8');
        return { loggerRecords, content };
    } finally {
        delete require.cache[userActionLoggerModulePath];
        restoreLogger();
        restoreRuntimePaths();
        if (previousVerbose === undefined) delete process.env.FARM_VERBOSE_USER_ACTION_LOGS;
        else process.env.FARM_VERBOSE_USER_ACTION_LOGS = previousVerbose;
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

test('logUserAction writes file without verbose runtime output by default', async () => {
    const { loggerRecords, content } = await runUserActionLogScenario(false);

    assert.match(content, /"action":"register"/);
    assert.equal(
        loggerRecords.some(record => record.moduleName === 'user-actions' && record.message === '用户操作记录'),
        false,
    );
});

test('logUserAction emits structured runtime output only when FARM_VERBOSE_USER_ACTION_LOGS is enabled', async () => {
    const { loggerRecords, content } = await runUserActionLogScenario(true);

    assert.match(content, /"username":"alice"/);
    assert.equal(
        loggerRecords.some(record => record.moduleName === 'user-actions' && record.message === '用户操作记录' && record.level === 'info'),
        true,
    );
});
