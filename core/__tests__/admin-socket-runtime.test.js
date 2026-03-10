const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseCookieHeader,
    createSocketAuthMiddleware,
    createSocketSubscriptionHandler,
    createSocketConnectionHandler,
} = require('../src/controllers/admin/socket-runtime');

function createSocket(overrides = {}) {
    const joined = [];
    const left = [];
    const emitted = [];
    const listeners = new Map();
    const socket = {
        rooms: new Set(['socket-self', 'account:old-1', 'random-room']),
        data: {},
        handshake: {
            headers: {},
            auth: {},
            query: {},
        },
        join(room) {
            joined.push(room);
            this.rooms.add(room);
        },
        leave(room) {
            left.push(room);
            this.rooms.delete(room);
        },
        emit(event, payload) {
            emitted.push([event, payload]);
        },
        on(event, handler) {
            listeners.set(event, handler);
        },
        joined,
        left,
        emitted,
        listeners,
        ...overrides,
    };
    socket.handshake = {
        headers: {},
        auth: {},
        query: {},
        ...(overrides.handshake || {}),
    };
    socket.data = {
        ...(overrides.data || {}),
    };
    return socket;
}

function createSocketDeps(overrides = {}) {
    return {
        getAccountsSnapshot: async () => ({
            accounts: [
                { id: 'acc-1', username: 'alice' },
                { id: 'acc-2', username: 'bob' },
            ],
        }),
        resolveAccId: async (ref) => String(ref || '').trim(),
        getProvider: () => ({
            getStatus: async (id) => ({ running: true, id }),
            getLogs: async (_targetId, _options) => [
                { accountId: 'acc-1', message: 'mine' },
                { accountId: 'acc-2', message: 'other' },
                { message: 'system' },
            ],
            getAccountLogs: () => [
                { accountId: 'acc-1', message: 'account-mine' },
                { accountId: 'acc-2', message: 'account-other' },
            ],
        }),
        ...overrides,
    };
}

test('parseCookieHeader decodes values and ignores empty parts', () => {
    assert.deepEqual(
        parseCookieHeader('foo=bar; access_token=abc%20123; ; malformed'),
        { foo: 'bar', access_token: 'abc 123', malformed: '' },
    );
});

test('socket auth middleware accepts cookie token and falls back to auth token', async () => {
    const calls = [];
    const middleware = createSocketAuthMiddleware({
        jwtService: {
            verifyAccessToken: (token) => {
                calls.push(['verifyAccessToken', token]);
                return token === 'cookie token' || token === 'auth-token' ? { username: 'alice' } : null;
            },
        },
        userStore: {
            getUserInfo: async (username) => {
                calls.push(['getUserInfo', username]);
                return { username, role: 'user' };
            },
        },
    });

    const cookieSocket = createSocket({
        handshake: { headers: { cookie: 'access_token=cookie%20token' }, auth: {}, query: {} },
    });
    let cookieNextError = null;
    await middleware(cookieSocket, (err) => {
        cookieNextError = err || null;
    });
    assert.equal(cookieNextError, null);
    assert.deepEqual(cookieSocket.data.currentUser, { username: 'alice', role: 'user' });

    const authSocket = createSocket({
        handshake: { headers: {}, auth: { token: 'auth-token' }, query: {} },
    });
    let authNextError = null;
    await middleware(authSocket, (err) => {
        authNextError = err || null;
    });
    assert.equal(authNextError, null);
    assert.deepEqual(authSocket.data.currentUser, { username: 'alice', role: 'user' });

    const deniedSocket = createSocket();
    let deniedError = null;
    await middleware(deniedSocket, (err) => {
        deniedError = err || null;
    });
    assert.equal(deniedError.message, 'Unauthorized');
    assert.deepEqual(calls, [
        ['verifyAccessToken', 'cookie token'],
        ['getUserInfo', 'alice'],
        ['verifyAccessToken', 'auth-token'],
        ['getUserInfo', 'alice'],
    ]);
});

test('socket subscription for user all joins owned rooms and filters snapshots', async () => {
    const socket = createSocket({
        data: { currentUser: { username: 'alice', role: 'user' } },
    });
    const applySubscription = createSocketSubscriptionHandler(createSocketDeps());

    await applySubscription(socket, 'all');

    assert.deepEqual(socket.left, ['account:old-1']);
    assert.deepEqual(socket.joined, ['account:acc-1']);
    assert.deepEqual(socket.emitted, [
        ['subscribed', { accountId: 'user_all' }],
        ['logs:snapshot', {
            accountId: 'user_all',
            logs: [{ accountId: 'acc-1', message: 'mine' }],
        }],
        ['account-logs:snapshot', {
            logs: [{ accountId: 'acc-1', message: 'account-mine' }],
        }],
    ]);
});

test('socket subscription rejects unauthorized single-account subscribe without pushing snapshots', async () => {
    const socket = createSocket({
        data: { currentUser: { username: 'alice', role: 'user' } },
    });
    const applySubscription = createSocketSubscriptionHandler(createSocketDeps());

    await applySubscription(socket, 'acc-2');

    assert.deepEqual(socket.joined, []);
    assert.deepEqual(socket.emitted, [
        ['subscribed', { accountId: '' }],
    ]);
    assert.equal(socket.data.accountId, '');
});

test('socket multi-subscribe keeps only authorized ids and emits status snapshot for each', async () => {
    const socket = createSocket({
        data: { currentUser: { username: 'alice', role: 'user' } },
    });
    const applySubscription = createSocketSubscriptionHandler(createSocketDeps());

    await applySubscription(socket, ['acc-1', 'acc-2', 'missing']);

    assert.deepEqual(socket.joined, ['account:acc-1']);
    assert.deepEqual(socket.emitted, [
        ['subscribed', { accountId: 'multi', count: 1 }],
        ['status:update', { accountId: 'acc-1', status: { running: true, id: 'acc-1' } }],
    ]);
    assert.deepEqual(socket.data.accountIds, ['acc-1', 'acc-2', 'missing']);
});

test('socket connection handler subscribes initial account and handles later subscribe payloads', async () => {
    const calls = [];
    const applySocketSubscription = async (...args) => {
        calls.push(args);
    };
    const socket = createSocket({
        handshake: {
            headers: {},
            auth: { accountId: 'acc-1' },
            query: {},
        },
    });
    const handler = createSocketConnectionHandler({
        applySocketSubscription,
        nowFn: () => 1234567890,
    });

    await handler(socket);

    assert.deepEqual(calls, [[socket, 'acc-1']]);
    assert.deepEqual(socket.emitted, [['ready', { ok: true, ts: 1234567890 }]]);
    assert.equal(typeof socket.listeners.get('subscribe'), 'function');

    await socket.listeners.get('subscribe')({ accountIds: ['acc-2', 'acc-3'] });
    await socket.listeners.get('subscribe')({ accountId: 'acc-9' });

    assert.deepEqual(calls, [
        [socket, 'acc-1'],
        [socket, ['acc-2', 'acc-3']],
        [socket, 'acc-9'],
    ]);
});
