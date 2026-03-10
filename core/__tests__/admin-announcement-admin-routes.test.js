const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAnnouncementAdminRoutes } = require('../src/controllers/admin/announcement-admin-routes');

function createFakeApp() {
    const routes = { get: new Map(), post: new Map(), put: new Map(), delete: new Map() };
    return {
        routes,
        app: {
            get(path, ...handlers) {
                routes.get.set(path, handlers);
            },
            post(path, ...handlers) {
                routes.post.set(path, handlers);
            },
            put(path, ...handlers) {
                routes.put.set(path, handlers);
            },
            delete(path, ...handlers) {
                routes.delete.set(path, handlers);
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
    const middleware = handlers.length > 1 ? handlers.slice(0, -1) : [];
    const handler = handlers[handlers.length - 1];
    assert.equal(typeof handler, 'function');
    middleware.forEach((fn) => assert.equal(typeof fn, 'function'));
    return { middleware, handler };
}

function createDeps(overrides = {}) {
    const authRequired = (_req, _res, next) => next && next();
    const userRequired = (_req, _res, next) => next && next();
    return {
        app: null,
        authRequired,
        userRequired,
        adminLogger: { error: () => {} },
        getAnnouncements: async () => [],
        saveAnnouncement: async () => {},
        deleteAnnouncement: async () => {},
        parseUpdateLog: () => [],
        getIo: () => null,
        store: {
            getThirdPartyApiConfig: () => ({}),
            setThirdPartyApiConfig: (body) => body,
            getClusterConfig: () => ({ dispatcherStrategy: 'round_robin' }),
            setClusterConfig: (body) => body,
            flushGlobalConfigSave: async () => {},
        },
        ...overrides,
    };
}

test('announcement list route stays public and returns stored announcements', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        app,
        getAnnouncements: async () => [{ id: 1, title: '公告' }],
    });

    registerAnnouncementAdminRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'get', '/api/announcement');
    assert.deepEqual(middleware, []);

    const res = createResponse();
    await handler({}, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, data: [{ id: 1, title: '公告' }] });
});

test('announcement put route keeps admin middlewares and emits update event', async () => {
    const { app, routes } = createFakeApp();
    const saveCalls = [];
    const ioCalls = [];
    const deps = createDeps({
        app,
        saveAnnouncement: async (payload) => saveCalls.push(payload),
        getIo: () => ({
            emit: (...args) => ioCalls.push(args),
        }),
    });

    registerAnnouncementAdminRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'put', '/api/announcement');
    assert.deepEqual(middleware, [deps.authRequired, deps.userRequired]);

    const res = createResponse();
    await handler({
        body: { id: '7', title: '标题', version: 'v1', publish_date: '2026-03-10', content: '内容', enabled: 1 },
        currentUser: { username: 'admin-user', role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(saveCalls, [{
        id: 7,
        title: '标题',
        version: 'v1',
        publish_date: '2026-03-10',
        content: '内容',
        enabled: true,
        createdBy: 'admin-user',
    }]);
    assert.deepEqual(ioCalls, [['announcement:update', { ok: true }]]);
    assert.deepEqual(res.body, { ok: true });
});

test('announcement sync route deduplicates parsed entries before saving', async () => {
    const { app, routes } = createFakeApp();
    const saveCalls = [];
    const ioCalls = [];
    const deps = createDeps({
        app,
        parseUpdateLog: () => [
            { date: '2026-03-08', title: '旧公告', version: 'v1', content: 'old' },
            { date: '2026-03-09', title: '新公告', version: 'v2', content: 'new' },
        ],
        getAnnouncements: async () => [
            { title: '旧公告', version: 'v1', publish_date: '2026-03-08' },
        ],
        saveAnnouncement: async (payload) => saveCalls.push(payload),
        getIo: () => ({
            emit: (...args) => ioCalls.push(args),
        }),
    });

    registerAnnouncementAdminRoutes(deps);
    const { handler } = getRouteParts(routes, 'post', '/api/announcement/sync');
    const res = createResponse();
    await handler({ currentUser: { role: 'admin' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(saveCalls, [{
        title: '新公告',
        version: 'v2',
        publish_date: '2026-03-09',
        content: 'new',
        enabled: true,
        createdBy: 'system_sync',
    }]);
    assert.deepEqual(ioCalls, [['announcement:update', { ok: true }]]);
    assert.deepEqual(res.body, { ok: true, added: 1, totalParsed: 2 });
});

test('third-party api get route blocks non-admin users', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({ app });

    registerAnnouncementAdminRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'get', '/api/admin/third-party-api');
    assert.deepEqual(middleware, [deps.authRequired, deps.userRequired]);

    const res = createResponse();
    await handler({ currentUser: { role: 'user' } }, res);

    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { ok: false, error: 'Forbidden' });
});

test('cluster-config post route persists config and flushes global save', async () => {
    const { app, routes } = createFakeApp();
    const flushCalls = [];
    const deps = createDeps({
        app,
        store: {
            setClusterConfig: (body) => ({ ...body, saved: true }),
            flushGlobalConfigSave: async () => { flushCalls.push('flush'); },
        },
    });

    registerAnnouncementAdminRoutes(deps);
    const { middleware, handler } = getRouteParts(routes, 'post', '/api/admin/cluster-config');
    assert.deepEqual(middleware, [deps.authRequired, deps.userRequired]);

    const res = createResponse();
    await handler({
        body: { dispatcherStrategy: 'weighted' },
        currentUser: { role: 'admin' },
    }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(flushCalls, ['flush']);
    assert.deepEqual(res.body, { ok: true, data: { dispatcherStrategy: 'weighted', saved: true } });
});
