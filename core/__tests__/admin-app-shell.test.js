const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAdminCorsMiddleware,
    createAdminApiGuard,
    createAdminAppShell,
} = require('../src/controllers/admin/app-shell');

function createFakeApp() {
    const uses = [];
    const gets = [];
    return {
        uses,
        gets,
        use(...args) {
            uses.push(args);
        },
        get(...args) {
            gets.push(args);
        },
    };
}

function createResponse() {
    return {
        headers: {},
        statusCode: 200,
        header(name, value) {
            this.headers[name] = value;
            return this;
        },
        sendStatus(code) {
            this.statusCode = code;
            return this;
        },
        send(payload) {
            this.body = payload;
            return this;
        },
    };
}

test('createAdminCorsMiddleware allows configured origins and handles preflight locally', () => {
    const middleware = createAdminCorsMiddleware({
        allowedOrigins: ['https://farm.example.com'],
    });

    const originRes = createResponse();
    let nextCount = 0;
    middleware(
        { headers: { origin: 'https://farm.example.com' }, method: 'GET' },
        originRes,
        () => {
            nextCount += 1;
        },
    );
    assert.equal(nextCount, 1);
    assert.deepEqual(originRes.headers, {
        'Access-Control-Allow-Origin': 'https://farm.example.com',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-account-id, x-admin-token',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
    });

    const optionsRes = createResponse();
    let optionsNext = false;
    middleware(
        { headers: { origin: 'http://localhost:3000' }, method: 'OPTIONS' },
        optionsRes,
        () => {
            optionsNext = true;
        },
    );
    assert.equal(optionsNext, false);
    assert.equal(optionsRes.statusCode, 200);
    assert.equal(optionsRes.headers['Access-Control-Allow-Origin'], 'http://localhost:3000');

    const anonymousRes = createResponse();
    middleware(
        { headers: {}, method: 'GET' },
        anonymousRes,
        () => {},
    );
    assert.equal(anonymousRes.headers['Access-Control-Allow-Origin'], '*');
});

test('createAdminApiGuard bypasses public paths and chains auth then user checks for protected paths', () => {
    const calls = [];
    const guard = createAdminApiGuard({
        publicPaths: new Set(['/ping']),
        authRequired: (_req, _res, next) => {
            calls.push('auth');
            next();
        },
        userRequired: (_req, _res, next) => {
            calls.push('user');
            next();
        },
    });

    let publicNext = 0;
    guard({ path: '/ping' }, createResponse(), () => {
        publicNext += 1;
    });
    assert.equal(publicNext, 1);
    assert.deepEqual(calls, []);

    let protectedNext = 0;
    guard({ path: '/accounts' }, createResponse(), () => {
        protectedNext += 1;
    });
    assert.equal(protectedNext, 1);
    assert.deepEqual(calls, ['auth', 'user']);
});

test('createAdminAppShell mounts parser, ai route and static assets when web dist exists', () => {
    const fakeApp = createFakeApp();
    const cleanupCalls = [];
    const warnings = [];
    const authRequired = () => {};
    const userRequired = () => {};
    const aiStatusRouter = { name: 'ai-router' };
    const result = createAdminAppShell({
        createApp: () => fakeApp,
        jsonMiddleware: { name: 'json' },
        cookieParserMiddleware: { name: 'cookie' },
        aiStatusRouter,
        authRequired,
        userRequired,
        allowedOrigins: ['https://farm.example.com'],
        adminLogger: { warn: (...args) => warnings.push(args) },
        resolveWebDistDir: () => '/tmp/web',
        fsRef: { existsSync: (target) => target === '/tmp/web' },
        expressStatic: (target) => `static:${target}`,
        ensureUiBackgroundDir: () => '/tmp/bg',
        getResourcePath: (target) => `/res/${target}`,
        ensureAssetCacheDir: () => '/tmp/cache',
        runUiBackgroundCleanup: () => cleanupCalls.push('cleanup'),
    });

    assert.equal(result.app, fakeApp);
    assert.equal(result.webDist, '/tmp/web');
    assert.deepEqual(fakeApp.uses, [
        [{ name: 'json' }],
        [{ name: 'cookie' }],
        ['/api/ai', authRequired, userRequired, aiStatusRouter],
        [fakeApp.uses[3][0]],
        ['static:/tmp/web'],
        ['/ui-backgrounds', 'static:/tmp/bg'],
        ['/game-config', 'static:/res/gameConfig'],
        ['/asset-cache', 'static:/tmp/cache'],
    ]);
    assert.equal(typeof fakeApp.uses[3][0], 'function');
    assert.deepEqual(fakeApp.gets, []);
    assert.deepEqual(cleanupCalls, ['cleanup']);
    assert.deepEqual(warnings, []);
});

test('createAdminAppShell registers root fallback and warning when web dist is missing', () => {
    const fakeApp = createFakeApp();
    const warnings = [];
    const result = createAdminAppShell({
        createApp: () => fakeApp,
        jsonMiddleware: { name: 'json' },
        cookieParserMiddleware: { name: 'cookie' },
        aiStatusRouter: {},
        authRequired: () => {},
        userRequired: () => {},
        allowedOrigins: [],
        adminLogger: { warn: (...args) => warnings.push(args) },
        resolveWebDistDir: () => '/tmp/missing-web',
        fsRef: { existsSync: () => false },
        expressStatic: (target) => `static:${target}`,
        ensureUiBackgroundDir: () => '/tmp/bg',
        getResourcePath: (target) => `/res/${target}`,
        ensureAssetCacheDir: () => '/tmp/cache',
        runUiBackgroundCleanup: () => {},
    });

    assert.equal(result.webDist, '/tmp/missing-web');
    assert.deepEqual(warnings, [['web build not found', { webDist: '/tmp/missing-web' }]]);
    assert.equal(fakeApp.gets.length, 1);
    assert.equal(fakeApp.gets[0][0], '/');

    const res = createResponse();
    fakeApp.gets[0][1]({}, res);
    assert.equal(res.body, 'web build not found. Please build the web project.');
});
