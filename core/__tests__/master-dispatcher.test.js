const test = require('node:test');
const assert = require('node:assert/strict');

const { MasterDispatcher } = require('../src/cluster/master-dispatcher');

function createSocket(id, nodeId = id) {
    const handlers = new Map();
    const emitted = [];
    return {
        id,
        handshake: {
            auth: {
                nodeId,
            },
        },
        handlers,
        emitted,
        on(event, handler) {
            handlers.set(event, handler);
        },
        emit(event, payload) {
            emitted.push([event, payload]);
        },
    };
}

test('MasterDispatcher rebalance avoids assigning new accounts to draining workers', async () => {
    const ioHandlers = new Map();
    const io = {
        on(event, handler) {
            ioHandlers.set(event, handler);
        },
        to() {
            return { emit() {} };
        },
    };
    const savedSnapshots = [];
    const dispatcher = new MasterDispatcher(io, {
        logger: { info() {}, warn() {}, error() {} },
        store: {
            async getAccounts() {
                return {
                    accounts: [
                        { id: 'acc-1', running: true, name: 'A' },
                        { id: 'acc-2', running: true, name: 'B' },
                    ],
                };
            },
            getClusterConfig() {
                return { dispatcherStrategy: 'round_robin' };
            },
        },
        getSystemUpdateRuntimeRef: async () => ({
            clusterNodes: [
                {
                    nodeId: 'worker-a',
                    role: 'worker',
                    status: 'draining',
                    connected: true,
                    draining: true,
                    assignedCount: 0,
                    assignedAccountIds: [],
                    updatedAt: Date.now(),
                },
            ],
        }),
        saveClusterNodeRuntimeSnapshotRef: async (snapshot) => {
            savedSnapshots.push(snapshot);
            return snapshot;
        },
        version: 'v4.5.18',
    });

    const socketA = createSocket('socket-a');
    const socketB = createSocket('socket-b');
    dispatcher.workers.set('socket-a', {
        nodeId: 'worker-a',
        socket: socketA,
        assigned: [],
        draining: false,
        version: 'v4.5.18',
        lastSeenAt: Date.now(),
    });
    dispatcher.workers.set('socket-b', {
        nodeId: 'worker-b',
        socket: socketB,
        assigned: [],
        draining: false,
        version: 'v4.5.18',
        lastSeenAt: Date.now(),
    });

    await dispatcher.rebalance();

    assert.deepEqual(socketA.emitted, [['master:assign:accounts', { accounts: [] }]]);
    assert.deepEqual(socketB.emitted, [[
        'master:assign:accounts',
        {
            accounts: [
                { id: 'acc-1', running: true, name: 'A' },
                { id: 'acc-2', running: true, name: 'B' },
            ],
        },
    ]]);
    assert.equal(dispatcher.workers.get('socket-a').draining, true);
    assert.equal(dispatcher.workers.get('socket-b').draining, false);
    assert.equal(savedSnapshots.length, 1);
    assert.equal(savedSnapshots[0][0].nodeId, 'worker-a');
    assert.equal(savedSnapshots[0][0].draining, true);
    assert.equal(savedSnapshots[0][0].assignedCount, 0);
    assert.equal(savedSnapshots[0][1].nodeId, 'worker-b');
    assert.equal(savedSnapshots[0][1].assignedCount, 2);
});

test('MasterDispatcher heartbeat picks up drain-state changes and rebalances automatically', async () => {
    const ioHandlers = new Map();
    const io = {
        on(event, handler) {
            ioHandlers.set(event, handler);
        },
        to() {
            return { emit() {} };
        },
    };
    let drainWorkerA = false;
    const dispatcher = new MasterDispatcher(io, {
        logger: { info() {}, warn() {}, error() {} },
        store: {
            async getAccounts() {
                return {
                    accounts: [
                        { id: 'acc-1', running: true, name: 'A' },
                        { id: 'acc-2', running: true, name: 'B' },
                    ],
                };
            },
            getClusterConfig() {
                return { dispatcherStrategy: 'round_robin' };
            },
        },
        getSystemUpdateRuntimeRef: async () => ({
            clusterNodes: drainWorkerA
                ? [{
                    nodeId: 'worker-a',
                    role: 'worker',
                    status: 'draining',
                    connected: true,
                    draining: true,
                    assignedCount: 0,
                    assignedAccountIds: [],
                    updatedAt: Date.now(),
                }]
                : [],
        }),
        saveClusterNodeRuntimeSnapshotRef: async (snapshot) => snapshot,
        version: 'v4.5.18',
    });

    dispatcher.init();
    const socketA = createSocket('socket-a', 'worker-a');
    const socketB = createSocket('socket-b', 'worker-b');
    ioHandlers.get('connection')(socketA);
    ioHandlers.get('connection')(socketB);

    await socketA.handlers.get('worker:ready')();
    await socketB.handlers.get('worker:ready')();
    socketA.emitted.length = 0;
    socketB.emitted.length = 0;

    drainWorkerA = true;
    await socketA.handlers.get('worker:heartbeat')({
        nodeId: 'worker-a',
        status: 'active',
        version: 'v4.5.18',
    });

    assert.deepEqual(socketA.emitted, [['master:assign:accounts', { accounts: [] }]]);
    assert.deepEqual(socketB.emitted, [[
        'master:assign:accounts',
        {
            accounts: [
                { id: 'acc-1', running: true, name: 'A' },
                { id: 'acc-2', running: true, name: 'B' },
            ],
        },
    ]]);
    assert.equal(dispatcher.workers.get('socket-a').draining, true);
    assert.equal(dispatcher.workers.get('socket-b').draining, false);

    dispatcher.dispose();
});
