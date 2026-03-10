const test = require('node:test');
const assert = require('node:assert/strict');

const { createAiServiceRuntime, createMainShutdownRuntime } = require('../src/runtime/main-process-runtime');

function createLogger() {
    const calls = [];
    return {
        calls,
        info: (...args) => calls.push(['info', ...args]),
        warn: (...args) => calls.push(['warn', ...args]),
    };
}

test('createAiServiceRuntime only stops daemon when current process started it', async () => {
    const scheduled = [];
    const logger = createLogger();
    let running = false;
    const calls = [];

    const runtime = createAiServiceRuntime({
        logger,
        loadAutostartModule: () => ({
            getPidFileStatus: () => ({ running }),
            async start() {
                calls.push('start');
                running = true;
            },
            async stop(startOptions, stopOptions) {
                calls.push(['stop', startOptions, stopOptions]);
                return true;
            },
        }),
        deferStartRef: (handler) => {
            scheduled.push(handler);
        },
    });

    const startPromise = runtime.start();
    assert.equal(calls.length, 0);
    assert.equal(runtime.isOwned(), false);

    await scheduled[0]();
    await startPromise;

    assert.equal(runtime.isOwned(), true);
    const stopped = await runtime.stop();
    assert.equal(stopped, true);
    assert.deepEqual(calls, [
        'start',
        ['stop', {}, { waitForExit: true, timeoutMs: 12000 }],
    ]);
});

test('createAiServiceRuntime does not stop pre-existing external daemon', async () => {
    const scheduled = [];
    const running = true;
    let stopCalled = false;

    const runtime = createAiServiceRuntime({
        logger: createLogger(),
        loadAutostartModule: () => ({
            getPidFileStatus: () => ({ running }),
            async start() {},
            async stop() {
                stopCalled = true;
                return true;
            },
        }),
        deferStartRef: (handler) => {
            scheduled.push(handler);
        },
    });

    const startPromise = runtime.start();
    await scheduled[0]();
    await startPromise;

    assert.equal(runtime.isOwned(), false);
    assert.equal(await runtime.stop(), false);
    assert.equal(stopCalled, false);
});

test('createMainShutdownRuntime runs every cleanup step in order and surfaces the first error', async () => {
    const calls = [];
    const logger = createLogger();
    const runtime = createMainShutdownRuntime({
        logger,
        stopJobs: () => {
            calls.push('jobs');
        },
        disposeMasterDispatcher: () => {
            calls.push('dispatcher');
            throw new Error('dispatcher dispose failed');
        },
        stopRuntimeEngine: async () => {
            calls.push('runtime');
        },
        closeDatabase: async () => {
            calls.push('database');
        },
        stopAiServices: async () => {
            calls.push('ai');
        },
    });

    await assert.rejects(runtime.stop(), /dispatcher dispose failed/);
    assert.deepEqual(calls, ['jobs', 'dispatcher', 'runtime', 'database', 'ai']);
    assert.deepEqual(logger.calls, [[
        'warn',
        'master dispatcher dispose failed during shutdown',
        { error: 'dispatcher dispose failed' },
    ]]);
});
