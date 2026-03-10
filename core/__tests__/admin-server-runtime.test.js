const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createSocketCorsOriginResolver,
    createAdminRealtimeServer,
    createAdminListenPromise,
    closeAdminRealtimeServer,
} = require('../src/controllers/admin/server-runtime');

function createFakeServer() {
    const listeners = new Map();
    return {
        listenCalls: [],
        offCalls: [],
        once(event, handler) {
            listeners.set(event, handler);
            return this;
        },
        off(event, handler) {
            this.offCalls.push([event, handler]);
            if (listeners.get(event) === handler) {
                listeners.delete(event);
            }
            return this;
        },
        listen(port, host) {
            this.listenCalls.push([port, host]);
        },
        emit(event, payload) {
            const handler = listeners.get(event);
            if (handler) {
                handler(payload);
            }
        },
        listeners,
    };
}

test('createSocketCorsOriginResolver keeps wildcard mode with empty allowed origins', () => {
    assert.equal(createSocketCorsOriginResolver([]), '*');
});

test('createSocketCorsOriginResolver allows configured origins, local dev and blocks others', () => {
    const resolver = createSocketCorsOriginResolver(['https://farm.example.com']);
    const decisions = [];

    resolver('https://farm.example.com', (_err, ok) => decisions.push(['configured', ok]));
    resolver('http://localhost:3000', (_err, ok) => decisions.push(['local', ok]));
    resolver(undefined, (_err, ok) => decisions.push(['missing', ok]));
    resolver('https://blocked.example.com', (_err, ok) => decisions.push(['blocked', ok]));

    assert.deepEqual(decisions, [
        ['configured', true],
        ['local', true],
        ['missing', true],
        ['blocked', false],
    ]);
});

test('createAdminRealtimeServer wires socket auth and connection handlers onto created server', () => {
    const middlewareCalls = [];
    const connectionCalls = [];
    const fakeServer = { id: 'http-server' };
    const socketInstance = {
        use(handler) {
            middlewareCalls.push(handler);
        },
        on(event, handler) {
            connectionCalls.push([event, handler]);
        },
    };
    const realtime = createAdminRealtimeServer({
        httpRef: {
            createServer(app) {
                assert.equal(app.name, 'admin-app');
                return fakeServer;
            },
        },
        socketServerFactory(httpServer, options) {
            assert.equal(httpServer, fakeServer);
            assert.equal(options.path, '/socket.io');
            assert.equal(options.pingTimeout, 5000);
            assert.equal(options.pingInterval, 10000);
            assert.equal(options.cors.methods.length, 2);
            assert.equal(options.cors.credentials, true);
            assert.equal(typeof options.cors.origin, 'function');
            return socketInstance;
        },
        app: { name: 'admin-app' },
        allowedOrigins: ['https://farm.example.com'],
        createSocketAuthMiddleware: (args) => {
            assert.deepEqual(args, {
                jwtService: { name: 'jwt' },
                userStore: { name: 'users' },
            });
            return 'auth-middleware';
        },
        createSocketConnectionHandler: (args) => {
            assert.deepEqual(args, { applySocketSubscription: 'subscription-handler' });
            return 'connection-handler';
        },
        jwtService: { name: 'jwt' },
        userStore: { name: 'users' },
        applySocketSubscription: 'subscription-handler',
    });

    assert.deepEqual(realtime, {
        server: fakeServer,
        io: socketInstance,
    });
    assert.deepEqual(middlewareCalls, ['auth-middleware']);
    assert.deepEqual(connectionCalls, [['connection', 'connection-handler']]);
});

test('createAdminListenPromise resolves on listening and clears startup state', async () => {
    const fakeServer = createFakeServer();
    const infoCalls = [];
    const clearCalls = [];
    const promise = createAdminListenPromise({
        server: fakeServer,
        port: 3000,
        adminLogger: {
            info: (...args) => infoCalls.push(args),
            error: () => {},
        },
        buildAdminListenError: (error) => error,
        cleanupFailedAdminStart: () => {},
        clearServerStartPromise: () => clearCalls.push('cleared'),
    });

    fakeServer.emit('listening');
    const resolved = await promise;

    assert.equal(resolved, fakeServer);
    assert.deepEqual(fakeServer.listenCalls, [[3000, '0.0.0.0']]);
    assert.equal(clearCalls.length, 1);
    assert.equal(infoCalls.length, 1);
    assert.deepEqual(infoCalls[0], ['admin panel started', { url: 'http://localhost:3000', port: 3000 }]);
    assert.equal(fakeServer.offCalls.length, 1);
    assert.equal(fakeServer.offCalls[0][0], 'error');
});

test('createAdminListenPromise rejects async error with wrapped error and cleanup callback', async () => {
    const fakeServer = createFakeServer();
    const errorCalls = [];
    const cleanupCalls = [];
    const wrappedError = new Error('listen failed');
    wrappedError.code = 'EADDRINUSE';
    const promise = createAdminListenPromise({
        server: fakeServer,
        port: 3001,
        adminLogger: {
            info: () => {},
            error: (...args) => errorCalls.push(args),
        },
        buildAdminListenError: (error, port) => {
            assert.equal(port, 3001);
            return Object.assign(new Error(`wrapped:${error.message}`), { code: 'EADDRINUSE' });
        },
        cleanupFailedAdminStart: () => cleanupCalls.push('cleanup'),
        clearServerStartPromise: () => {},
    });

    fakeServer.emit('error', wrappedError);

    await assert.rejects(promise, /wrapped:listen failed/);
    assert.deepEqual(cleanupCalls, ['cleanup']);
    assert.deepEqual(errorCalls, [[
        'admin panel failed to start',
        { port: 3001, code: 'EADDRINUSE', error: 'wrapped:listen failed' },
    ]]);
});

test('createAdminListenPromise handles synchronous listen throw through same error path', async () => {
    const cleanupCalls = [];
    const fakeServer = createFakeServer();
    fakeServer.listen = () => {
        throw new Error('sync listen crash');
    };

    const promise = createAdminListenPromise({
        server: fakeServer,
        port: 3002,
        adminLogger: {
            info: () => {},
            error: () => {},
        },
        buildAdminListenError: (error, port) => Object.assign(new Error(`${port}:${error.message}`), { code: 'SYNC' }),
        cleanupFailedAdminStart: () => cleanupCalls.push('cleanup'),
        clearServerStartPromise: () => {},
    });

    await assert.rejects(promise, /3002:sync listen crash/);
    assert.deepEqual(cleanupCalls, ['cleanup']);
});

test('closeAdminRealtimeServer closes io immediately and waits for listening server close callback', async () => {
    const calls = [];
    const fakeServer = {
        listening: true,
        removeAllListeners(event) {
            calls.push(['removeAllListeners', event]);
        },
        close(callback) {
            calls.push(['close']);
            callback();
        },
    };
    const fakeIo = {
        close() {
            calls.push(['io.close']);
        },
    };

    await closeAdminRealtimeServer({
        server: fakeServer,
        io: fakeIo,
    });

    assert.deepEqual(calls, [
        ['io.close'],
        ['removeAllListeners', 'error'],
        ['removeAllListeners', 'listening'],
        ['close'],
    ]);
});

test('closeAdminRealtimeServer resolves when server is absent or not listening', async () => {
    const calls = [];
    await closeAdminRealtimeServer({
        server: {
            listening: false,
            removeAllListeners(event) {
                calls.push(event);
            },
            close() {
                throw new Error('should not close non-listening server');
            },
        },
        io: {
            close() {
                calls.push('io');
            },
        },
    });
    await closeAdminRealtimeServer({
        server: null,
        io: null,
    });

    assert.deepEqual(calls, ['io', 'error', 'listening']);
});
