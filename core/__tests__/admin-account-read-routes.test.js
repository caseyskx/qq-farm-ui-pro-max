const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAccountReadRoutes, registerLogReadRoutes } = require('../src/controllers/admin/account-read-routes');

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

function getHandler(routes, path) {
    const handlers = routes.get.get(path);
    assert.ok(handlers, `missing route: GET ${path}`);
    assert.equal(handlers.length, 1);
    assert.equal(typeof handlers[0], 'function');
    return handlers[0];
}

function createDeps(overrides = {}) {
    return {
        app: null,
        getProvider: () => ({
            getAccounts: async () => ({ accounts: [] }),
            getAccountLogs: () => [],
            getLogs: async () => [],
        }),
        getAccountsSnapshot: async () => ({ accounts: [] }),
        compareLeaderboardAccounts: (a, b, sortBy) => (b[sortBy] || 0) - (a[sortBy] || 0),
        toLeaderboardMetricNumber: (value) => Number(value) || 0,
        resolveAccId: async (value) => String(value || ''),
        getAccId: async () => '',
        ...overrides,
    };
}

test('accounts route filters non-admin accounts and keeps runtime-state sort order', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            getAccounts: async () => ({
                accounts: [
                    { id: '2', username: 'alice', running: true, connected: false, level: 20 },
                    { id: '3', username: 'bob', running: true, connected: true, level: 99 },
                    { id: '4', username: 'alice', running: false, connected: false, level: 50 },
                    { id: '1', username: 'alice', running: true, connected: true, level: 5 },
                ],
                total: 4,
            }),
        }),
    });

    registerAccountReadRoutes(deps);
    const handler = getHandler(routes, '/api/accounts');
    const res = createResponse();

    await handler({ currentUser: { username: 'alice', role: 'user' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            total: 4,
            accounts: [
                { id: '1', username: 'alice', running: true, connected: true, level: 5 },
                { id: '2', username: 'alice', running: true, connected: false, level: 20 },
                { id: '4', username: 'alice', running: false, connected: false, level: 50 },
            ],
        },
    });
});

test('leaderboard route normalizes metrics, strips secrets and ranks filtered accounts', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            getAccounts: async () => ({
                accounts: [
                    { id: '1', username: 'alice', gold: '5', level: '3', exp: '7', coupon: '1', uptime: '2', password: 'p1', authTicket: 't1' },
                    { id: '2', username: 'alice', gold: '12', level: '4', exp: '6', coupon: '2', uptime: '1', code: 'c2', authData: 'a2' },
                    { id: '3', username: 'bob', gold: '999', level: '9', exp: '9', coupon: '9', uptime: '9', password: 'p3' },
                ],
            }),
        }),
    });

    registerAccountReadRoutes(deps);
    const handler = getHandler(routes, '/api/leaderboard');
    const res = createResponse();

    await handler({ query: { sort_by: 'gold', limit: '1' }, currentUser: { username: 'alice', role: 'user' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            accounts: [
                { id: '2', username: 'alice', gold: 12, level: 4, exp: 6, coupon: 2, uptime: 1, lastStatusAt: 0, lastOnlineAt: 0, ranking: 1 },
            ],
            total: 2,
        },
    });
});

test('account logs route only returns logs for owned accounts', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getProvider: () => ({
            getAccountLogs: () => [
                { accountId: 'acc-1', message: 'mine' },
                { accountId: 'acc-2', message: 'other' },
                { message: 'no-account' },
            ],
        }),
        getAccountsSnapshot: async () => ({
            accounts: [
                { id: 'acc-1', username: 'alice' },
                { id: 'acc-2', username: 'bob' },
            ],
        }),
    });

    registerLogReadRoutes(deps);
    const handler = getHandler(routes, '/api/account-logs');
    const res = createResponse();

    await handler({ query: { limit: '50' }, currentUser: { username: 'alice', role: 'user' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, [{ accountId: 'acc-1', message: 'mine' }]);
});

test('logs route rejects explicit access to another user account', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        resolveAccId: async () => 'acc-2',
        getAccountsSnapshot: async () => ({
            accounts: [
                { id: 'acc-1', username: 'alice' },
                { id: 'acc-2', username: 'bob' },
            ],
        }),
    });

    registerLogReadRoutes(deps);
    const handler = getHandler(routes, '/api/logs');
    const res = createResponse();

    await handler({ query: { accountId: 'acc-2' }, currentUser: { username: 'alice', role: 'user' } }, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { ok: false, error: '无权查看此账号日志' });
});

test('logs route filters mixed results when non-admin queries all accounts', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        app,
        getProvider: () => ({
            getLogs: async (targetId, options) => {
                calls.push({ targetId, options });
                return [
                    { accountId: 'acc-1', message: 'mine' },
                    { accountId: 'acc-2', message: 'other' },
                    { message: 'system' },
                ];
            },
        }),
        getAccountsSnapshot: async () => ({
            accounts: [
                { id: 'acc-1', username: 'alice' },
                { id: 'acc-2', username: 'bob' },
            ],
        }),
    });

    registerLogReadRoutes(deps);
    const handler = getHandler(routes, '/api/logs');
    const res = createResponse();

    await handler({
        query: { accountId: 'all', limit: '30', module: 'farm', keyword: 'abc' },
        currentUser: { username: 'alice', role: 'user' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [{
        targetId: '',
        options: {
            limit: 30,
            tag: '',
            module: 'farm',
            event: '',
            keyword: 'abc',
            isWarn: undefined,
            timeFrom: '',
            timeTo: '',
        },
    }]);
    assert.deepEqual(res.body, {
        ok: true,
        data: [{ accountId: 'acc-1', message: 'mine' }],
    });
});
