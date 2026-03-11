const test = require('node:test');
const assert = require('node:assert/strict');

const { registerCommerceRoutes } = require('../src/controllers/admin/commerce-routes');

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
        send(payload) {
            this.body = payload;
            return this;
        },
    };
}

function getRouteHandler(routes, method, path) {
    const handlers = routes[method].get(path);
    assert.ok(handlers, `missing route: ${method.toUpperCase()} ${path}`);
    assert.equal(typeof handlers[0], 'function');
    assert.equal(typeof handlers[1], 'function');
    return { middleware: handlers[0], handler: handlers[1] };
}

function createDeps(overrides = {}) {
    const accountOwnershipRequired = (_req, _res, next) => next && next();
    return {
        accountOwnershipRequired,
        getAccId: async () => 'acc-1',
        getAccountSnapshotById: async () => ({ level: 12 }),
        getProvider: () => ({
            getBag: async () => [],
            useBagItem: async () => ({ ok: true }),
            getSeeds: async () => [],
            getShopCatalog: async () => ({ sections: [] }),
            buyShopGoods: async () => ({}),
            getMallCatalog: async () => ({ sections: [], monthCards: [] }),
            getMallGoods: async () => [],
            buyMallGoods: async () => ({}),
            claimMonthCardReward: async () => ({}),
            getSellPreview: async () => ({}),
            sellByPolicy: async () => ({}),
            sellSelected: async () => ({}),
            getDailyGifts: async () => ({}),
        }),
        buildOfflineSeeds: (account) => [{ goodsId: 1, accountLevel: Number(account.level) || 0 }],
        buildOfflineShopCatalog: () => ({ sections: [] }),
        findShopGoodsById: () => null,
        buildOfflineMallCatalog: () => ({ sections: [{ slotType: 1, goods: [] }], monthCards: [] }),
        buildOfflineMallGoods: (slotType) => [{ slotType }],
        getAccountBagPreferences: async () => ({
            purchaseMemory: {},
            activityHistory: [],
            plantableSeedSnapshot: { generatedAt: 0, seeds: [] },
            mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
        }),
        saveAccountBagPreferences: async (_accountId, payload) => payload,
        isSoftRuntimeError: () => false,
        handleApiError: (res, err) => res.status(500).json({ ok: false, error: err.message }),
        formatUseResult: (data) => data,
        ...overrides,
    };
}

test('registerCommerceRoutes keeps account middleware and seeds route falls back to offline data', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        getProvider: () => null,
        buildOfflineSeeds: (account) => [{ goodsId: 2001, level: account.level }],
    });

    registerCommerceRoutes({ app, ...deps });
    const { middleware, handler } = getRouteHandler(routes, 'get', '/api/seeds');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ headers: {}, query: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, data: [{ goodsId: 2001, level: 12 }] });
});

test('shop purchase resolves price from catalog instead of trusting request body', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        getProvider: () => ({
            getShopCatalog: async () => ({
                sections: [
                    { goods: [{ goodsId: 321, priceValue: 88, supportsPurchase: true, isLimited: false }] },
                ],
            }),
            buyShopGoods: async (...args) => {
                calls.push(args);
                return { done: true };
            },
        }),
        findShopGoodsById: (catalog, goodsId) => catalog.sections[0].goods.find(item => item.goodsId === goodsId) || null,
    });

    registerCommerceRoutes({ app, ...deps });
    const { handler } = getRouteHandler(routes, 'post', '/api/shop/purchase');
    const res = createResponse();
    await handler({ body: { goodsId: 321, count: 2, price: 1 } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['acc-1', 321, 2, 88]]);
    assert.deepEqual(res.body, { ok: true, data: { done: true } });
});

test('mall catalog falls back to offline snapshot on soft runtime error', async () => {
    const { app, routes } = createFakeApp();
    const softError = new Error('offline');
    const deps = createDeps({
        getProvider: () => ({
            getMallCatalog: async () => { throw softError; },
        }),
        isSoftRuntimeError: (error) => error === softError,
        buildOfflineMallCatalog: () => ({ sections: [{ slotType: 1, goods: [{ goodsId: 1 }] }], monthCards: [] }),
    });

    registerCommerceRoutes({ app, ...deps });
    const { handler } = getRouteHandler(routes, 'get', '/api/mall/catalog');
    const res = createResponse();
    await handler({ query: {} }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { ok: true, data: { sections: [{ slotType: 1, goods: [{ goodsId: 1 }] }], monthCards: [] } });
});

test('bag use route formats worker response before returning', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        getProvider: () => ({
            useBagItem: async () => ({ raw: true }),
        }),
        formatUseResult: (data, payload) => ({ data, payload, formatted: true }),
    });

    registerCommerceRoutes({ app, ...deps });
    const { handler } = getRouteHandler(routes, 'post', '/api/bag/use');
    const res = createResponse();
    await handler({ body: { itemId: 9001, count: 3, landIds: [1, '2', 0] } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: {
            data: { raw: true },
            payload: { itemId: 9001, count: 3, landIds: [1, 2] },
            formatted: true,
        },
    });
});

test('bag preferences routes return persisted snapshot and keep account middleware', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        getAccountBagPreferences: async () => ({
            purchaseMemory: { 'mall:1': { count: 2, lastPurchasedAt: 1, name: '化肥' } },
            activityHistory: [{ ts: 2, type: 'purchase', title: '化肥 x2' }],
            plantableSeedSnapshot: { generatedAt: 11, seeds: [{ seedId: 20059 }] },
            mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
        }),
        saveAccountBagPreferences: async (...args) => {
            calls.push(args);
            return {
                purchaseMemory: {},
                activityHistory: [{ ts: 3, type: 'sell', title: '出售果实' }],
                plantableSeedSnapshot: { generatedAt: 12, seeds: [] },
                mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
            };
        },
    });

    registerCommerceRoutes({ app, ...deps });

    const getRoute = getRouteHandler(routes, 'get', '/api/bag/preferences');
    assert.equal(getRoute.middleware, deps.accountOwnershipRequired);
    const getRes = createResponse();
    await getRoute.handler({ query: {} }, getRes);
    assert.equal(getRes.statusCode, 200);
    assert.deepEqual(getRes.body, {
        ok: true,
        data: {
            purchaseMemory: { 'mall:1': { count: 2, lastPurchasedAt: 1, name: '化肥' } },
            activityHistory: [{ ts: 2, type: 'purchase', title: '化肥 x2' }],
            plantableSeedSnapshot: { generatedAt: 11, seeds: [{ seedId: 20059 }] },
            mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
        },
    });

    const postRoute = getRouteHandler(routes, 'post', '/api/bag/preferences');
    assert.equal(postRoute.middleware, deps.accountOwnershipRequired);
    const postRes = createResponse();
    await postRoute.handler({
        body: {
            purchaseMemory: { 'mall:9': { count: 1, lastPurchasedAt: 9, name: '礼包' } },
            activityHistory: [{ ts: 9, type: 'purchase', title: '礼包 x1' }],
        },
    }, postRes);
    assert.equal(postRes.statusCode, 200);
    assert.deepEqual(calls, [[
        'acc-1',
        {
            purchaseMemory: { 'mall:9': { count: 1, lastPurchasedAt: 9, name: '礼包' } },
            activityHistory: [{ ts: 9, type: 'purchase', title: '礼包 x1' }],
            plantableSeedSnapshot: undefined,
            mallResolverCache: undefined,
        },
    ]]);
    assert.deepEqual(postRes.body, {
        ok: true,
        data: {
            purchaseMemory: {},
            activityHistory: [{ ts: 3, type: 'sell', title: '出售果实' }],
            plantableSeedSnapshot: { generatedAt: 12, seeds: [] },
            mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
        },
    });
});

test('plantable bag seeds route forwards query flags to provider and keeps account middleware', async () => {
    const { app, routes } = createFakeApp();
    const calls = [];
    const deps = createDeps({
        getProvider: () => ({
            getPlantableBagSeeds: async (...args) => {
                calls.push(args);
                return [{ seedId: 20059, usableCount: 3 }];
            },
        }),
    });

    registerCommerceRoutes({ app, ...deps });
    const { middleware, handler } = getRouteHandler(routes, 'get', '/api/bag/plantable-seeds');
    assert.equal(middleware, deps.accountOwnershipRequired);

    const res = createResponse();
    await handler({ query: { includeZeroUsable: '1', includeLocked: '1' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls, [['acc-1', { includeZeroUsable: true, includeLocked: true }]]);
    assert.deepEqual(res.body, {
        ok: true,
        data: [{ seedId: 20059, usableCount: 3 }],
    });
});

test('plantable bag seeds route falls back to offline snapshot when worker is unavailable', async () => {
    const { app, routes } = createFakeApp();
    const deps = createDeps({
        getProvider: () => null,
        getAccountBagPreferences: async () => ({
            purchaseMemory: {},
            activityHistory: [],
            plantableSeedSnapshot: {
                generatedAt: 99,
                seeds: [
                    { seedId: 20059, usableCount: 3, unlocked: true },
                    { seedId: 20061, usableCount: 0, unlocked: true },
                    { seedId: 20062, usableCount: 5, unlocked: false },
                ],
            },
            mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
        }),
    });

    registerCommerceRoutes({ app, ...deps });
    const { handler } = getRouteHandler(routes, 'get', '/api/bag/plantable-seeds');
    const res = createResponse();
    await handler({ query: { includeZeroUsable: '0', includeLocked: '0' } }, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
        ok: true,
        data: [{ seedId: 20059, usableCount: 3, unlocked: true }],
    });
});
