const test = require('node:test');
const assert = require('node:assert/strict');

const { registerRuntimeShutdownHandlers } = require('../src/runtime/graceful-shutdown');

function createFakeProcess() {
    const listeners = new Map();
    return {
        on(event, handler) {
            const bucket = listeners.get(event) || [];
            bucket.push(handler);
            listeners.set(event, bucket);
        },
        off(event, handler) {
            const bucket = listeners.get(event) || [];
            listeners.set(event, bucket.filter(item => item !== handler));
        },
        emit(event) {
            const bucket = listeners.get(event) || [];
            for (const handler of bucket) {
                handler();
            }
        },
        listenerCount(event) {
            return (listeners.get(event) || []).length;
        },
    };
}

test('registerRuntimeShutdownHandlers stops runtime and exits 0 on shutdown signal', async () => {
    const fakeProcess = createFakeProcess();
    const exits = [];
    const loggerCalls = [];
    let stopCalls = 0;

    registerRuntimeShutdownHandlers({
        processRef: fakeProcess,
        runtimeEngine: {
            async stop() {
                stopCalls += 1;
            },
        },
        logger: {
            info: (...args) => loggerCalls.push(['info', ...args]),
            warn: (...args) => loggerCalls.push(['warn', ...args]),
            error: (...args) => loggerCalls.push(['error', ...args]),
        },
        forceExitAfterMs: 0,
        exitFn: (code) => exits.push(code),
    });

    fakeProcess.emit('SIGINT');
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(stopCalls, 1);
    assert.deepEqual(exits, [0]);
    assert.deepEqual(loggerCalls, [
        ['info', 'received shutdown signal', { signal: 'SIGINT' }],
        ['info', 'graceful shutdown completed', { signal: 'SIGINT' }],
    ]);
});

test('registerRuntimeShutdownHandlers warns on repeated signals while shutdown is in progress', async () => {
    const fakeProcess = createFakeProcess();
    const exits = [];
    const loggerCalls = [];
    let resolveStop;
    let stopCalls = 0;

    registerRuntimeShutdownHandlers({
        processRef: fakeProcess,
        runtimeEngine: {
            stop() {
                stopCalls += 1;
                return new Promise((resolve) => {
                    resolveStop = resolve;
                });
            },
        },
        logger: {
            info: (...args) => loggerCalls.push(['info', ...args]),
            warn: (...args) => loggerCalls.push(['warn', ...args]),
            error: (...args) => loggerCalls.push(['error', ...args]),
        },
        forceExitAfterMs: 0,
        exitFn: (code) => exits.push(code),
    });

    fakeProcess.emit('SIGTERM');
    fakeProcess.emit('SIGTERM');
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(stopCalls, 1);
    assert.deepEqual(exits, []);
    assert.deepEqual(loggerCalls.slice(0, 2), [
        ['info', 'received shutdown signal', { signal: 'SIGTERM' }],
        ['warn', 'graceful shutdown already in progress', { signal: 'SIGTERM' }],
    ]);

    resolveStop();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(exits, [0]);
});

test('registerRuntimeShutdownHandlers exits 1 when runtime stop fails and dispose removes listeners', async () => {
    const fakeProcess = createFakeProcess();
    const exits = [];
    const loggerCalls = [];

    const registration = registerRuntimeShutdownHandlers({
        processRef: fakeProcess,
        runtimeEngine: {
            async stop() {
                throw new Error('stop failed');
            },
        },
        logger: {
            info: (...args) => loggerCalls.push(['info', ...args]),
            warn: (...args) => loggerCalls.push(['warn', ...args]),
            error: (...args) => loggerCalls.push(['error', ...args]),
        },
        forceExitAfterMs: 0,
        exitFn: (code) => exits.push(code),
    });

    assert.equal(fakeProcess.listenerCount('SIGINT'), 1);
    assert.equal(fakeProcess.listenerCount('SIGTERM'), 1);

    fakeProcess.emit('SIGINT');
    await new Promise(resolve => setImmediate(resolve));

    assert.deepEqual(exits, [1]);
    assert.deepEqual(loggerCalls.slice(-1), [[
        'error',
        'graceful shutdown failed',
        { signal: 'SIGINT', error: 'stop failed' },
    ]]);

    registration.dispose();
    assert.equal(fakeProcess.listenerCount('SIGINT'), 0);
    assert.equal(fakeProcess.listenerCount('SIGTERM'), 0);
});

test('registerRuntimeShutdownHandlers forces exit when shutdown exceeds timeout', async () => {
    const fakeProcess = createFakeProcess();
    const exits = [];
    const loggerCalls = [];
    const timers = [];

    registerRuntimeShutdownHandlers({
        processRef: fakeProcess,
        runtimeEngine: {
            stop() {
                return new Promise(() => {});
            },
        },
        logger: {
            info: (...args) => loggerCalls.push(['info', ...args]),
            warn: (...args) => loggerCalls.push(['warn', ...args]),
            error: (...args) => loggerCalls.push(['error', ...args]),
        },
        forceExitAfterMs: 50,
        setTimeoutRef: (handler, delay) => {
            const timer = { handler, delay, unref() {} };
            timers.push(timer);
            return timer;
        },
        clearTimeoutRef: () => {},
        exitFn: (code) => exits.push(code),
    });

    fakeProcess.emit('SIGTERM');
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 50);

    timers[0].handler();

    assert.deepEqual(exits, [1]);
    assert.deepEqual(loggerCalls.slice(-1), [[
        'error',
        'graceful shutdown timed out; forcing exit',
        { signal: 'SIGTERM', timeoutMs: 50 },
    ]]);
});
