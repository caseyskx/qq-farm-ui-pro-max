const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('disposeDispatcher clears interval, detaches io/socket listeners and resets singleton', () => {
    const script = `
        const { initDispatcher, getDispatcher, disposeDispatcher } = require('./src/cluster/master-dispatcher');

        function createIO() {
            const handlers = new Map();
            return {
                handlers,
                on(event, handler) {
                    handlers.set(event, handler);
                },
                off(event, handler) {
                    if (handlers.get(event) === handler) {
                        handlers.delete(event);
                    }
                },
                to() {
                    return { emit() {} };
                },
            };
        }

        function createSocket(id = 'worker-1') {
            const handlers = new Map();
            return {
                id,
                handshake: {
                    auth: {
                        nodeId: 'node-' + id,
                    },
                },
                handlers,
                on(event, handler) {
                    handlers.set(event, handler);
                },
                off(event, handler) {
                    if (handlers.get(event) === handler) {
                        handlers.delete(event);
                    }
                },
            };
        }

        disposeDispatcher();

        const io = createIO();
        const socket = createSocket();
        const originalSetInterval = globalThis.setInterval;
        const originalClearInterval = globalThis.clearInterval;
        const intervalHandles = [];
        const clearedHandles = [];

        globalThis.setInterval = (handler, delay) => {
            const intervalHandle = {
                handler,
                delay,
                unrefCalled: false,
                unref() {
                    this.unrefCalled = true;
                    return this;
                },
            };
            intervalHandles.push(intervalHandle);
            return intervalHandle;
        };
        globalThis.clearInterval = (handle) => {
            clearedHandles.push(handle);
        };

        try {
            const dispatcher = initDispatcher(io);
            const connectionHandler = io.handlers.get('connection');
            connectionHandler(socket);

            dispatcher.workers.set(socket.id, { nodeId: 'node-worker-1', socket, assigned: [] });
            dispatcher.accountToWorker.set('1001', socket.id);

            disposeDispatcher();

            console.log('__RESULT__' + JSON.stringify({
                singletonCleared: getDispatcher() === null,
                connectionHandlerRemoved: io.handlers.has('connection') === false,
                socketHandlerCount: socket.handlers.size,
                workersSize: dispatcher.workers.size,
                accountToWorkerSize: dispatcher.accountToWorker.size,
                intervalDelay: intervalHandles[0] && intervalHandles[0].delay,
                intervalUnrefCalled: !!(intervalHandles[0] && intervalHandles[0].unrefCalled),
                clearedHandleCount: clearedHandles.length,
            }));
        } finally {
            globalThis.setInterval = originalSetInterval;
            globalThis.clearInterval = originalClearInterval;
            disposeDispatcher();
        }

        process.exit(0);
    `;

    const result = spawnSync(process.execPath, ['-e', script], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const match = result.stdout.match(/__RESULT__(.+)/);
    assert.ok(match, result.stdout);

    const parsed = JSON.parse(match[1]);
    assert.deepEqual(parsed, {
        singletonCleared: true,
        connectionHandlerRemoved: true,
        socketHandlerCount: 0,
        workersSize: 0,
        accountToWorkerSize: 0,
        intervalDelay: 15 * 60 * 1000,
        intervalUnrefCalled: true,
        clearedHandleCount: 1,
    });
});
