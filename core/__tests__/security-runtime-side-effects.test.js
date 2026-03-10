const test = require('node:test');
const assert = require('node:assert/strict');

const securityModulePath = require.resolve('../src/services/security');
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

test('requiring security does not start login lock cleanup until loginLock is used', async () => {
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[securityModulePath];
        await withIntervalTracking(async ({ intervalCalls, clearCalls }) => {
            const security = require(securityModulePath);
            assert.equal(intervalCalls.length, 0);

            security.loginLock.checkLock('alice');
            assert.equal(intervalCalls.length, 1);

            security.stopLoginLockCleanup();
            assert.equal(clearCalls.length, 1);
        });
    } finally {
        delete require.cache[securityModulePath];
        restoreLogger();
    }
});
