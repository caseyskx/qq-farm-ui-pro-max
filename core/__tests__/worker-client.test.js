const test = require('node:test');
const assert = require('node:assert/strict');

const { WorkerClient } = require('../src/cluster/worker-client');

function createLogger() {
    const calls = [];
    return {
        calls,
        info: (...args) => calls.push(['info', ...args]),
        warn: (...args) => calls.push(['warn', ...args]),
        error: (...args) => calls.push(['error', ...args]),
        debug: (...args) => calls.push(['debug', ...args]),
    };
}

function createSocket() {
    const handlers = new Map();
    const emitted = [];
    const calls = [];
    return {
        handlers,
        emitted,
        calls,
        connected: true,
        on(event, handler) {
            handlers.set(event, handler);
        },
        emit(event, payload) {
            emitted.push([event, payload]);
        },
        removeAllListeners() {
            calls.push('removeAllListeners');
            handlers.clear();
        },
        disconnect() {
            calls.push('disconnect');
            this.connected = false;
        },
        close() {
            calls.push('close');
            this.connected = false;
        },
    };
}

test('WorkerClient init wires jobs, runtime engine, shutdown handlers and master socket', async () => {
    const socket = createSocket();
    const logger = createLogger();
    const calls = [];
    const runtimeEngine = {
        async start(options) {
            calls.push(['runtime.start', options]);
        },
        async stop() {
            calls.push(['runtime.stop']);
        },
        startWorker: async () => {},
        stopWorker: () => {},
        restartWorker: async () => {},
    };

    const client = new WorkerClient('http://master:3000', 'worker-token', {
        processRef: { env: {}, pid: 4321 },
        ioFactory: (url, options) => {
            calls.push(['ioFactory', url, options]);
            return socket;
        },
        createRuntimeEngineRef: (options) => {
            calls.push(['createRuntimeEngine', options.processRef.pid]);
            return runtimeEngine;
        },
        initJobsRef: () => {
            calls.push(['initJobs']);
            return { stop() { calls.push(['jobs.stop']); } };
        },
        registerRuntimeShutdownHandlersRef: (options) => {
            calls.push(['registerShutdown', typeof options.runtimeEngine.stop]);
            return { dispose() { calls.push(['shutdown.dispose']); } };
        },
        logger,
    });

    await client.init();

    assert.deepEqual(calls.slice(0, 4), [
        ['initJobs'],
        ['createRuntimeEngine', 4321],
        ['registerShutdown', 'function'],
        ['runtime.start', { startAdminServer: false, autoStartAccounts: false }],
    ]);
    assert.equal(calls[4][0], 'ioFactory');
    assert.equal(calls[4][1], 'http://master:3000');
    assert.equal(calls[4][2].auth.token, 'worker-token');
    assert.match(calls[4][2].auth.nodeId, /^worker-4321-/);

    const connectHandler = socket.handlers.get('connect');
    assert.equal(typeof connectHandler, 'function');
    connectHandler();
    assert.deepEqual(socket.emitted, [['worker:ready', undefined]]);
});

test('WorkerClient stop tears down shutdown hooks, socket, jobs and runtime engine', async () => {
    const socket = createSocket();
    const logger = createLogger();
    const calls = [];
    const client = new WorkerClient('', '', {
        processRef: { env: {}, pid: 1 },
        ioFactory: () => socket,
        createRuntimeEngineRef: () => ({
            async start() {},
            async stop(options) {
                calls.push(['runtime.stop', options]);
            },
            startWorker: async () => {},
            stopWorker: () => {},
            restartWorker: async () => {},
        }),
        initJobsRef: () => ({
            stop() {
                calls.push(['jobs.stop']);
            },
        }),
        registerRuntimeShutdownHandlersRef: () => ({
            dispose() {
                calls.push(['shutdown.dispose']);
            },
        }),
        logger,
    });

    await client.init();
    client.assignedAccounts = new Set(['1']);
    client.assignedAccountData = new Map([['1', '{"id":"1"}']]);

    await client.stop();

    assert.deepEqual(calls, [
        ['shutdown.dispose'],
        ['jobs.stop'],
        ['runtime.stop', { stopAdminServer: false }],
    ]);
    assert.deepEqual(socket.calls, ['removeAllListeners', 'disconnect', 'close']);
    assert.equal(client.assignedAccounts.size, 0);
    assert.equal(client.assignedAccountData.size, 0);
});

test('WorkerClient account diff stops removed accounts, restarts changed accounts and starts new ones', async () => {
    const socket = createSocket();
    const logger = createLogger();
    const calls = [];

    const client = new WorkerClient('', '', {
        processRef: { env: {}, pid: 99 },
        ioFactory: () => socket,
        createRuntimeEngineRef: () => ({
            async start() {},
            async stop() {},
            async startWorker(account) {
                calls.push(['startWorker', account.id]);
            },
            stopWorker(accountId) {
                calls.push(['stopWorker', accountId]);
            },
            async restartWorker(account) {
                calls.push(['restartWorker', account.id]);
            },
        }),
        initJobsRef: () => ({ stop() {} }),
        registerRuntimeShutdownHandlersRef: () => ({ dispose() {} }),
        logger,
    });

    await client.init();
    client.assignedAccounts = new Set(['removed', 'changed', 'same']);
    client.assignedAccountData = new Map([
        ['removed', JSON.stringify({ id: 'removed', name: 'A' })],
        ['changed', JSON.stringify({ id: 'changed', name: 'B', code: 'old' })],
        ['same', JSON.stringify({ id: 'same', name: 'C' })],
    ]);

    const assignHandler = socket.handlers.get('master:assign:accounts');
    await assignHandler({
        accounts: [
            { id: 'changed', name: 'B', code: 'new' },
            { id: 'same', name: 'C' },
            { id: 'new', name: 'D' },
        ],
    });

    assert.deepEqual(calls, [
        ['stopWorker', 'removed'],
        ['restartWorker', 'changed'],
        ['startWorker', 'new'],
    ]);
    assert.deepEqual([...client.assignedAccounts], ['changed', 'same', 'new']);
    assert.equal(client.assignedAccountData.get('same'), JSON.stringify({ id: 'same', name: 'C' }));
    assert.equal(client.assignedAccountData.get('new'), JSON.stringify({ id: 'new', name: 'D' }));
});
