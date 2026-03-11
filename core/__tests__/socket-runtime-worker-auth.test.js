const test = require('node:test');
const assert = require('node:assert/strict');

const { createSocketAuthMiddleware } = require('../src/controllers/admin/socket-runtime');

function createSocket(overrides = {}) {
    return {
        handshake: {
            headers: {},
            auth: {},
            ...(overrides.handshake || {}),
        },
        data: {},
    };
}

test('socket auth middleware accepts worker token when master role and node id are present', async () => {
    const middleware = createSocketAuthMiddleware({
        jwtService: {
            verifyAccessToken() {
                throw new Error('worker auth should not verify user jwt');
            },
        },
        userStore: {
            async getUserInfo() {
                throw new Error('worker auth should not query user store');
            },
        },
        currentRole: 'master',
        workerToken: 'cluster-secret',
    });

    const socket = createSocket({
        handshake: {
            auth: {
                token: 'cluster-secret',
                nodeId: 'worker-2500',
            },
        },
    });

    let authError = null;
    await middleware(socket, (error) => {
        authError = error || null;
    });

    assert.equal(authError, null);
    assert.equal(socket.data.authKind, 'worker');
    assert.equal(socket.data.workerNodeId, 'worker-2500');
    assert.deepEqual(socket.data.currentUser, {
        username: 'worker:worker-2500',
        role: 'worker',
    });
});

test('socket auth middleware still rejects worker node when token mismatches', async () => {
    const middleware = createSocketAuthMiddleware({
        jwtService: {
            verifyAccessToken() {
                return null;
            },
        },
        userStore: {
            async getUserInfo() {
                return null;
            },
        },
        currentRole: 'master',
        workerToken: 'cluster-secret',
    });

    const socket = createSocket({
        handshake: {
            auth: {
                token: 'wrong-token',
                nodeId: 'worker-2500',
            },
        },
    });

    let authError = null;
    await middleware(socket, (error) => {
        authError = error || null;
    });

    assert.equal(authError && authError.message, 'Unauthorized');
});
