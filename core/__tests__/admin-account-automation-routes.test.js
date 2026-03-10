const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAutomationRoutes, registerFriendOperationRoutes } = require('../src/controllers/admin/account-automation-routes');

function createFakeApp() {
    const routes = { post: new Map() };
    return {
        routes,
        app: {
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

function getRouteParts(routes, path) {
    const handlers = routes.post.get(path);
    assert.ok(handlers, `missing route: POST ${path}`);
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
        store: {
            getSkipStealRadishConfig: () => ({ enabled: false }),
            setSkipStealRadishConfig: () => {},
            getForceGetAllConfig: () => ({ enabled: false }),
            setForceGetAllConfig: () => {},
            getStealFilterConfig: () => ({ enabled: false, mode: 'blacklist', plantIds: [] }),
            setStealFilterConfig: () => {},
            getStealFriendFilterConfig: () => ({ enabled: false, mode: 'blacklist', friendIds: [] }),
            setStealFriendFilterConfig: () => {},
            flushGlobalConfigSave: async () => {},
            getAutomation: () => ({ enabled: true }),
            getFriendBlacklist: () => [],
            setFriendBlacklist: (_id, list) => list,
        },
        getProvider: () => ({
            setAutomation: async () => ({ saved: true }),
            doFriendOp: async () => ({ ok: true }),
            doFriendBatchOp: async () => ({ ok: true }),
            broadcastConfig: () => {},
        }),
        handleApiError: (res, err) => res.status(500).json({ ok: false, error: err.message }),
        ...overrides,
    };
}

test('automation route keeps ownership middleware and normalizes direct config fields', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const flushCalls = [];
    const deps = createDeps({
        app,
        store: {
            getSkipStealRadishConfig: () => ({ enabled: false }),
            setSkipStealRadishConfig: (...args) => calls.push(['skip', ...args]),
            getForceGetAllConfig: () => ({ enabled: false }),
            setForceGetAllConfig: (...args) => calls.push(['force', ...args]),
            getStealFilterConfig: () => ({ enabled: false, mode: 'blacklist', plantIds: ['old'] }),
            setStealFilterConfig: (...args) => calls.push(['steal', ...args]),
            getStealFriendFilterConfig: () => ({ enabled: true, mode: 'blacklist', friendIds: ['9'] }),
            setStealFriendFilterConfig: (...args) => calls.push(['friend', ...args]),
            flushGlobalConfigSave: async () => { flushCalls.push('flush'); },
            getAutomation: () => ({ enabled: true }),
        },
        getProvider: () => ({
            setAutomation: async (_id, key, value) => ({ key, value }),
        }),
    });

    registerAutomationRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, '/api/automation');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({
        body: {
            skipStealRadishEnabled: 1,
            forceGetAllEnabled: 0,
            stealFilterEnabled: true,
            stealFilterMode: 'whitelist',
            stealFilterPlantIds: [1, 2],
            stealFriendFilterEnabled: false,
            stealFriendFilterMode: 'bad',
            stealFriendFilterIds: [3, 4],
            patrol: 30,
        },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [
        ['skip', 'acc-1', { enabled: true }],
        ['force', 'acc-1', { enabled: false }],
        ['steal', 'acc-1', { enabled: true, mode: 'whitelist', plantIds: ['1', '2'] }],
        ['friend', 'acc-1', { enabled: false, mode: 'blacklist', friendIds: ['3', '4'] }],
    ]);
    assert.deepEqual(flushCalls, ['flush']);
    assert.deepEqual(res.body, { ok: true, data: { key: 'patrol', value: 30 } });
});

test('automation route flushes and falls back to stored automation snapshot when no provider write happens', async () => {
    const { app, routes } = createFakeApp();
    const flushCalls = [];
    const deps = createDeps({
        app,
        store: {
            getSkipStealRadishConfig: () => ({ enabled: false }),
            setSkipStealRadishConfig: () => {},
            flushGlobalConfigSave: async () => { flushCalls.push('flush'); },
            getAutomation: () => ({ cycle: 60 }),
        },
        getProvider: () => ({
            setAutomation: async () => {
                throw new Error('should not be called');
            },
        }),
    });

    registerAutomationRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/automation');
    const res = createResponse();
    await handler({ body: { skipStealRadishEnabled: true } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(flushCalls, ['flush']);
    assert.deepEqual(res.body, { ok: true, data: { automation: { cycle: 60 } } });
});

test('friend op route delegates runtime failures to handleApiError', async () => {
    const { app, routes } = createFakeApp();
    const handled = [];
    const err = new Error('账号未运行');
    const deps = createDeps({
        app,
        getProvider: () => ({
            doFriendOp: async () => { throw err; },
        }),
        handleApiError: (res, error) => {
            handled.push(error);
            return res.status(418).json({ ok: false, error: error.message });
        },
    });

    registerFriendOperationRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, '/api/friend/:gid/op');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ params: { gid: '1001' }, body: { opType: 'help' } }, res);

    assert.deepEqual(handled, [err]);
    assert.equal(res.statusCode, 418);
    assert.deepEqual(res.body, { ok: false, error: '账号未运行' });
});

test('friends batch-op blacklist branch updates config and broadcasts once', async () => {
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

    registerFriendOperationRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/friends/batch-op');
    const res = createResponse();
    await handler({ body: { gids: [1002, '1003'], opType: 'blacklist_add' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(savedCalls, [{ accountId: 'acc-1', list: [1001, 1002, 1003] }]);
    assert.deepEqual(broadcastCalls, ['acc-1']);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            ok: true,
            opType: 'blacklist_add',
            total: 2,
            successCount: 2,
            failCount: 0,
            totalAffectedCount: 2,
            blacklist: [1001, 1002, 1003],
            results: [
                { gid: 1002, ok: true, opType: 'blacklist_add', message: '已加入黑名单' },
                { gid: 1003, ok: true, opType: 'blacklist_add', message: '已加入黑名单' },
            ],
        },
    });
});

test('friends batch-op delegates non-blacklist operations to provider', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        getProvider: () => ({
            doFriendBatchOp: async (...args) => {
                calls.push(args);
                return { done: true };
            },
        }),
    });

    registerFriendOperationRoutes(deps);
    const { handler } = getRouteParts(routes, '/api/friends/batch-op');
    const res = createResponse();
    await handler({
        body: {
            gids: ['1001', '1002', 0],
            opType: 'water',
            options: { count: 2 },
        },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['acc-1', [1001, 1002], 'water', { count: 2 }]]);
    assert.deepEqual(res.body, { ok: true, data: { done: true } });
});
