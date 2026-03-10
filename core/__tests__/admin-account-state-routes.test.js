const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAccountStateRoutes } = require('../src/controllers/admin/account-state-routes');

function createFakeApp() {
    const routes = { get: new Map() };
    return {
        routes,
        app: {
            get(path, ...handlers) {
                routes.get.set(path, handlers);
            },
        },
    };
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

function getRouteParts(routes, path) {
    const handlers = routes.get.get(path);
    assert.ok(handlers, `missing route: GET ${path}`);
    assert.equal(typeof handlers[0], 'function');
    assert.equal(typeof handlers[1], 'function');
    return { middleware: handlers[0], handler: handlers[1] };
}

function createDeps(overrides = {}) {
    const accountOwnershipRequired = (_req, _res, next) => next && next();
    return {
        app: null,
        accountOwnershipRequired,
        getAccId: async () => 'acc-1',
        getProvider: () => ({
            getStatus: async () => ({ status: { level: 11, exp: 88 } }),
            getLands: async () => [],
            getFriends: async () => [],
            getFriendLands: async () => [],
            getInteractRecords: async () => [],
        }),
        handleApiError: (res, err) => res.status(500).json({ ok: false, error: err.message }),
        getLevelExpProgress: (level, exp) => ({ level, exp, percent: 42 }),
        loadFriendsCacheApi: () => ({
            getCachedFriends: async () => [],
            updateFriendsCache: async () => {},
        }),
        ...overrides,
    };
}

test('status route keeps middleware and appends level progress', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerAccountStateRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, '/api/status');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            status: { level: 11, exp: 88 },
            levelProgress: { level: 11, exp: 88, percent: 42 },
        },
    });
});

test('friends cache route falls back to realtime list and updates cache asynchronously', async () => {
    const { app, routes } = createFakeApp();
    const cacheWrites = [];
    const deps = createDeps({
        app,
        getProvider: () => ({
            getFriends: async () => [{ gid: 1001 }],
        }),
        loadFriendsCacheApi: () => ({
            getCachedFriends: async () => [],
            updateFriendsCache: (accountId, data) => {
                cacheWrites.push({ accountId, data });
                return Promise.resolve();
            },
        }),
    });

    registerAccountStateRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/friends/cache');
    const res = createResponse();
    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(cacheWrites, [{ accountId: 'acc-1', data: [{ gid: 1001 }] }]);
    assert.deepEqual(res.body, { ok: true, data: [{ gid: 1001 }] });
});

test('lands route delegates runtime failures to handleApiError', async () => {
    const { app, routes } = createFakeApp();
    const handled = [];
    const err = new Error('账号未运行');
    const deps = createDeps({
        app,
        getProvider: () => ({
            getLands: async () => { throw err; },
        }),
        handleApiError: (res, error) => {
            handled.push(error);
            return res.status(418).json({ ok: false, error: error.message });
        },
    });

    registerAccountStateRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/lands');
    const res = createResponse();
    await handler({}, res);

    assert.deepEqual(handled, [err]);
    assert.equal(res.statusCode, 418);
    assert.deepEqual(res.body, { ok: false, error: '账号未运行' });
});

test('friend lands route keeps ownership middleware', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerAccountStateRoutes(deps);
    const { middleware } = getRouteParts(routes, '/api/friend/:gid/lands');

    assert.equal(middleware, deps.accountOwnershipRequired);
});

test('interact records route returns business error for INTERACT-prefixed code', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            getInteractRecords: async () => {
                const error = new Error('访客接口维护中');
                error.code = 'INTERACT_TEMP';
                throw error;
            },
        }),
    });

    registerAccountStateRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/interact-records');
    const res = createResponse();
    await handler({ query: { limit: '20' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: false,
        error: '访客接口维护中',
        errorCode: 'INTERACT_TEMP',
    });
});
