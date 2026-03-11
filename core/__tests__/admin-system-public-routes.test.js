const test = require('node:test');
const assert = require('node:assert/strict');

const { registerSystemPublicRoutes, registerNotificationsRoute } = require('../src/controllers/admin/system-public-routes');

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
        getPool: () => ({
            query: async () => [[]],
        }),
        getAccountsSnapshot: async () => ({ accounts: [] }),
        inspectSystemSettingsHealth: async () => ({ ok: true }),
        inspectWebDistState: () => ({
            activeDirRelative: 'web/dist',
            activeSource: 'default',
            selectionReason: 'default_ready',
            selectionReasonLabel: '默认目录存在有效产物',
            buildTargetDirRelative: 'web/dist',
            buildTargetSource: 'default',
            defaultDirRelative: 'web/dist',
            defaultHasAssets: true,
            defaultWritable: true,
            fallbackDirRelative: 'web/dist-runtime',
            fallbackHasAssets: false,
            fallbackWritable: true,
        }),
        version: 'v-test',
        processRef: { uptime: () => 12.34 },
        store: {
            getUI: () => ({ theme: 'light', siteTitle: 'global' }),
        },
        resolveRequestUser: async () => null,
        getUserUiConfig: async () => ({}),
        mergeUiConfig: (globalUi, userUi) => ({ ...globalUi, ...userUi }),
        getUserPreferences: async () => null,
        getAccId: async () => 'acc-1',
        getProvider: () => ({}),
        getSchedulerRegistrySnapshot: () => ({ schedulerCount: 1 }),
        handleApiError: (res, err) => res.status(500).json({ ok: false, error: err.message }),
        parseUpdateLog: () => [],
        readLatestQqFriendDiagnostics: () => null,
        ...overrides,
    };
}

test('system logs route returns empty result for non-admin without owned accounts', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getPool: () => ({
            query: async () => {
                throw new Error('should not query database');
            },
        }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/system-logs');
    const res = createResponse();

    await handler({ query: {}, currentUser: { username: 'alice', role: 'user' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: { total: 0, page: 1, limit: 50, items: [] },
    });
});

test('system settings health route blocks non-admin users', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/system-settings/health');
    const res = createResponse();

    await handler({ currentUser: { role: 'user' } }, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { ok: false, error: '仅管理员可查看 system_settings 自检结果' });
});

test('system settings health route includes web asset selection snapshot for admins', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        inspectSystemSettingsHealth: async () => ({
            ok: true,
            missingRequiredKeys: [],
        }),
        inspectWebDistState: () => ({
            activeDirRelative: 'web/dist-runtime',
            activeSource: 'fallback',
            selectionReason: 'fallback_missing_default_assets',
            selectionReasonLabel: '默认目录缺少有效产物，回退目录可用',
            buildTargetDirRelative: 'web/dist',
            buildTargetSource: 'default',
            defaultDirRelative: 'web/dist',
            defaultHasAssets: false,
            defaultWritable: true,
            fallbackDirRelative: 'web/dist-runtime',
            fallbackHasAssets: true,
            fallbackWritable: true,
        }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/system-settings/health');
    const res = createResponse();

    await handler({ currentUser: { role: 'admin' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            ok: true,
            missingRequiredKeys: [],
            webAssets: {
                activeDir: 'web/dist-runtime',
                activeSource: 'fallback',
                selectionReason: 'fallback_missing_default_assets',
                selectionReasonLabel: '默认目录缺少有效产物，回退目录可用',
                buildTargetDir: 'web/dist',
                buildTargetSource: 'default',
                defaultDir: 'web/dist',
                defaultHasAssets: false,
                defaultWritable: true,
                fallbackDir: 'web/dist-runtime',
                fallbackHasAssets: true,
                fallbackWritable: true,
            },
        },
    });
});

test('stats trend route returns one zero-filled point when database is empty', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/stats/trend');
    const res = createResponse();

    await handler({ currentUser: { role: 'admin' } }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.data.dates.length, 1);
    assert.deepEqual(res.body.data.series, { exp: [0], gold: [0], steal: [0] });
});

test('auth validate route echoes current user marker', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/auth/validate');
    const res = createResponse();

    await handler({ currentUser: { username: 'alice', role: 'user', card: { code: 'c1' } } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            valid: true,
            user: {
                username: 'alice',
                role: 'user',
                card: { code: 'c1' },
            },
        },
    });
});

test('ping route exposes lightweight web asset routing status', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        version: 'v-4.5.17',
        processRef: { uptime: () => 88.5 },
        inspectWebDistState: () => ({
            activeDirRelative: 'web/dist',
            activeSource: 'default',
            selectionReason: 'default_ready',
            selectionReasonLabel: '默认目录存在有效产物',
            buildTargetDirRelative: 'web/dist',
            buildTargetSource: 'default',
            defaultDirRelative: 'web/dist',
            defaultHasAssets: true,
            defaultWritable: true,
            fallbackDirRelative: 'web/dist-runtime',
            fallbackHasAssets: true,
            fallbackWritable: true,
        }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/ping');
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            ok: true,
            uptime: 88.5,
            version: 'v-4.5.17',
            webAssets: {
                activeDir: 'web/dist',
                activeSource: 'default',
                selectionReason: 'default_ready',
                selectionReasonLabel: '默认目录存在有效产物',
                buildTargetDir: 'web/dist',
                buildTargetSource: 'default',
                defaultDir: 'web/dist',
                defaultHasAssets: true,
                defaultWritable: true,
                fallbackDir: 'web/dist-runtime',
                fallbackHasAssets: true,
                fallbackWritable: true,
            },
        },
    });
});

test('ui config route merges per-user overrides for non-admin users', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        resolveRequestUser: async () => ({ username: 'alice', role: 'user' }),
        getUserUiConfig: async () => ({ siteTitle: 'user-title' }),
        getUserPreferences: async () => ({ currentAccountId: 'acc-9' }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/ui-config');
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: { theme: 'light', siteTitle: 'user-title', currentAccountId: 'acc-9' },
    });
});

test('scheduler route falls back to runtime snapshot when worker status is unavailable', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getSchedulerRegistrySnapshot: () => ({ schedulerCount: 2 }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/scheduler');
    const res = createResponse();

    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            runtime: { schedulerCount: 2 },
            worker: null,
            workerError: '当前运行环境不支持调度器状态查询',
        },
    });
});

test('qq friend diagnostics route blocks non-admin users', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/qq-friend-diagnostics');
    const res = createResponse();

    await handler({ currentUser: { role: 'user' }, query: {} }, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { ok: false, error: '仅管理员可查看 QQ 好友诊断结果' });
});

test('qq friend diagnostics route returns latest parsed snapshot for admins', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        readLatestQqFriendDiagnostics: (appid) => ({
            appid: appid || '1112386029',
            qqVersion: '9.2.70',
            summary: { protocolLikely: 'qq-host-bridge' },
        }),
    });

    registerSystemPublicRoutes(deps);
    const handler = getHandler(routes, '/api/qq-friend-diagnostics');
    const res = createResponse();

    await handler({ currentUser: { role: 'admin' }, query: { appid: '1112386029' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            appid: '1112386029',
            qqVersion: '9.2.70',
            summary: { protocolLikely: 'qq-host-bridge' },
        },
    });
});

test('notifications route respects limit parameter', async () => {
    const { app, routes } = createFakeApp();
    registerNotificationsRoute({
        app,
        parseUpdateLog: () => [
            { title: 'A' },
            { title: 'B' },
        ],
    });

    const handler = getHandler(routes, '/api/notifications');
    const res = createResponse();

    await handler({ query: { limit: '1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, data: [{ title: 'A' }] });
});
