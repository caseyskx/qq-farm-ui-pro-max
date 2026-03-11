const test = require('node:test');
const assert = require('node:assert/strict');

const { registerFriendBlacklistRoutes, registerAccountControlRoutes } = require('../src/controllers/admin/account-control-routes');

function createFakeApp() {
    const routes = { get: new Map(), post: new Map() };
    return {
        routes,
        app: {
            get(path, ...handlers) {
                routes.get.set(path, handlers);
            },
            post(path, ...handlers) {
                routes.post.set(path, handlers);
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

function getRouteParts(routes, method, path) {
    const handlers = routes[method].get(path);
    assert.ok(handlers, `missing route: ${method.toUpperCase()} ${path}`);
    assert.ok(handlers.length >= 1);
    assert.equal(typeof handlers[handlers.length - 1], 'function');
    return {
        middleware: handlers.length > 1 ? handlers[0] : null,
        handler: handlers[handlers.length - 1],
    };
}

function createDeps(overrides = {}) {
    const accountOwnershipRequired = (_req, _res, next) => next && next();
    return {
        app: null,
        accountOwnershipRequired,
        getAccId: async () => 'acc-1',
        getProvider: () => ({
            broadcastConfig: () => {},
            startAccount: async () => true,
            stopAccount: async () => true,
            restartAccount: async () => true,
            doFarmOp: async () => {},
        }),
        store: {
            getFriendBlacklist: () => [],
            setFriendBlacklist: (_id, list) => list,
            ACCOUNT_MODE_PRESETS: { main: {}, alt: {}, safe: {} },
            ensureMainAccountUnique: async () => [],
            applyAccountMode: () => ({}),
            getAccountConfigSnapshot: () => ({}),
        },
        resolveAccId: async (value) => String(value || ''),
        getAccountList: async () => [],
        accountRepository: { updateConfig: async () => {} },
        adminLogger: { info: () => {} },
        handleApiError: (res, err) => res.status(500).json({ ok: false, error: err.message }),
        loadGenerateSafeModeBlacklist: () => null,
        loadGetPlantRankings: () => () => [],
        ...overrides,
    };
}

test('friend blacklist toggle keeps middleware and syncs config broadcast', async () => {
    const { app, routes } = createFakeApp();
    const savedCalls = [];
    const broadcastCalls = [];
    const deps = createDeps({
        app,
        store: {
            getFriendBlacklist: () => [1001],
            setFriendBlacklist: (accountId, list) => {
                savedCalls.push({ accountId, list });
                return list;
            },
        },
        getProvider: () => ({
            broadcastConfig: (accountId) => broadcastCalls.push(accountId),
        }),
    });

    registerFriendBlacklistRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'post', '/api/friend-blacklist/toggle');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ body: { gid: 1002 } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(savedCalls, [{ accountId: 'acc-1', list: [1001, 1002] }]);
    assert.deepEqual(broadcastCalls, ['acc-1']);
    assert.deepEqual(res.body, { ok: true, data: [1001, 1002] });
});

test('start route returns 404 when provider cannot find account', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            startAccount: async () => false,
        }),
    });

    registerAccountControlRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'post', '/api/accounts/:id/start');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ params: { id: 'missing' } }, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { ok: false, error: 'Account not found' });
});

test('restart route delegates to provider and returns ok', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        getProvider: () => ({
            restartAccount: async (...args) => {
                calls.push(args);
                return true;
            },
        }),
    });

    registerAccountControlRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'post', '/api/accounts/:id/restart');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ params: { id: 'acc-7' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['acc-7']]);
    assert.deepEqual(res.body, { ok: true });
});

test('restart route returns 404 when provider cannot find account', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            restartAccount: async () => false,
        }),
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'post', '/api/accounts/:id/restart');
    const res = createResponse();

    await handler({ params: { id: 'missing' } }, res);

    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { ok: false, error: 'Account not found' });
});

test('mode route persists main mode change and downgraded peers', async () => {
    const { app, routes } = createFakeApp();
    const updateCalls = [];
    const broadcastCalls = [];
    const deps = createDeps({
        app,
        resolveAccId: async () => 'acc-9',
        getAccountList: async () => [{ id: 'acc-9', username: 'alice' }],
        store: {
            ACCOUNT_MODE_PRESETS: { main: {}, alt: {}, safe: {} },
            ensureMainAccountUnique: async () => [{ id: 'acc-2' }],
            applyAccountMode: () => ({ harvestDelay: { min: 3, max: 6 } }),
            getAccountConfigSnapshot: () => ({ harvestDelay: { min: 1, max: 2 } }),
        },
        accountRepository: {
            updateConfig: async (...args) => updateCalls.push(args),
        },
        getProvider: () => ({
            broadcastConfig: (accountId) => broadcastCalls.push(accountId),
        }),
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'post', '/api/accounts/:id/mode');
    const res = createResponse();

    await handler({
        params: { id: 'raw-id' },
        body: { mode: 'main' },
        currentUser: { username: 'alice', role: 'user' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(updateCalls, [
        ['acc-9', { account_mode: 'main', harvest_delay_min: 3, harvest_delay_max: 6 }],
        ['acc-2', { account_mode: 'alt', harvest_delay_min: 1, harvest_delay_max: 2 }],
    ]);
    assert.deepEqual(broadcastCalls, ['acc-9', 'acc-2']);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            config: { harvestDelay: { min: 3, max: 6 } },
            downgraded: [{ id: 'acc-2' }],
        },
    });
});

test('safe-mode blacklist route applies generated list and broadcasts config', async () => {
    const { app, routes } = createFakeApp();
    const broadcastCalls = [];
    const deps = createDeps({
        app,
        resolveAccId: async () => 'acc-5',
        loadGenerateSafeModeBlacklist: () => async () => ['10001', '10002'],
        getProvider: () => ({
            broadcastConfig: (accountId) => broadcastCalls.push(accountId),
        }),
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'post', '/api/accounts/:id/safe-mode/apply-blacklist');
    const res = createResponse();

    await handler({ params: { id: 'raw-id' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(broadcastCalls, ['acc-5']);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            addedCount: 2,
            addedUins: ['10001', '10002'],
        },
    });
});

test('farm operate route delegates runtime failures to handleApiError', async () => {
    const { app, routes } = createFakeApp();
    const handled = [];
    const runtimeError = new Error('账号未运行');
    const deps = createDeps({
        app,
        getProvider: () => ({
            doFarmOp: async () => { throw runtimeError; },
        }),
        handleApiError: (res, err) => {
            handled.push(err);
            return res.status(418).json({ ok: false, error: err.message });
        },
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'post', '/api/farm/operate');
    const res = createResponse();

    await handler({ body: { opType: 'all' } }, res);

    assert.deepEqual(handled, [runtimeError]);
    assert.equal(res.statusCode, 418);
    assert.deepEqual(res.body, { ok: false, error: '账号未运行' });
});

test('analytics route sanitizes query values before calling ranking service', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        loadGetPlantRankings: () => (...args) => {
            calls.push(args);
            return [{ rank: 1 }];
        },
    });

    registerAccountControlRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'get', '/api/analytics');
    assert.equal(middleware, null);

    const res = createResponse();
    await handler({
        query: { sort: 'bad', timingMode: 'bad', level: '12' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['exp', 12, { timingMode: 'theoretical' }]]);
    assert.deepEqual(res.body, { ok: true, data: [{ rank: 1 }] });
});

test('analytics route falls back to theoretical rankings when the stored account header is stale', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        resolveAccId: async () => 'missing-account',
        getAccountList: async () => [],
        loadGetPlantRankings: () => (...args) => {
            calls.push(args);
            return [{ rank: 2 }];
        },
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'get', '/api/analytics');

    const res = createResponse();
    await handler({
        headers: { 'x-account-id': 'legacy-account' },
        query: { sort: 'profit', timingMode: 'theoretical' },
        currentUser: { username: 'alice', role: 'user' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['profit', null, { timingMode: 'theoretical' }]]);
    assert.deepEqual(res.body, { ok: true, data: [{ rank: 2 }] });
});

test('analytics route keeps actual timing mode behind account ownership checks', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        resolveAccId: async () => 'acc-2',
        getAccountList: async () => [{ id: 'acc-2', username: 'bob' }],
        loadGetPlantRankings: () => (...args) => {
            calls.push(args);
            return [{ rank: 3 }];
        },
    });

    registerAccountControlRoutes(deps);
    const { handler } = getRouteParts(routes, 'get', '/api/analytics');

    const res = createResponse();
    await handler({
        headers: { 'x-account-id': 'acc-2' },
        query: { sort: 'exp', timingMode: 'actual' },
        currentUser: { username: 'alice', role: 'user' },
    }, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(calls, []);
    assert.deepEqual(res.body, { ok: false, error: '无权操作此账号' });
});
