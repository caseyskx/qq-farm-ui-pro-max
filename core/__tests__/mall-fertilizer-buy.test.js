const test = require('node:test');
const assert = require('node:assert/strict');

const mallModulePath = require.resolve('../src/services/mall');
const gameConfigModulePath = require.resolve('../src/config/gameConfig');
const networkModulePath = require.resolve('../src/utils/network');
const protoModulePath = require.resolve('../src/utils/proto');
const utilsModulePath = require.resolve('../src/utils/utils');
const monthcardModulePath = require.resolve('../src/services/monthcard');
const warehouseModulePath = require.resolve('../src/services/warehouse');
const storeModulePath = require.resolve('../src/models/store');

function mockModule(modulePath, exports) {
    const previous = require.cache[modulePath];
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    };

    return () => {
        if (previous) require.cache[modulePath] = previous;
        else delete require.cache[modulePath];
    };
}

function createMallTypes(goodsList) {
    return {
        GetMallListBySlotTypeRequest: {
            create: (value) => value || {},
            encode: (value) => ({ finish: () => value }),
        },
        GetMallListBySlotTypeResponse: {
            decode: () => ({ goods_list: goodsList }),
        },
        MallGoods: {
            decode: (value) => value,
        },
        PurchaseRequest: {
            create: (value) => value || {},
            encode: (value) => ({ finish: () => value }),
        },
        PurchaseResponse: {
            decode: () => ({ ok: true }),
        },
    };
}

test('autoBuyFertilizer buys lower-remaining fertilizer type first under threshold mode', async () => {
    const purchaseCalls = [];
    const restoreFns = [
        mockModule(gameConfigModulePath, {
            getItemById: () => ({}),
            getItemImageById: () => '',
        }),
        mockModule(networkModulePath, {
            sendMsgAsync: async (_serviceName, methodName, body) => {
                if (methodName === 'GetMallListBySlotType') {
                    return { body: Buffer.alloc(0) };
                }
                if (methodName === 'Purchase') {
                    purchaseCalls.push({ goodsId: Number(body.goods_id || 0), count: Number(body.count || 0) });
                    return { body: Buffer.alloc(0) };
                }
                throw new Error(`unexpected method: ${methodName}`);
            },
            getUserState: () => ({ coupon: 999 }),
        }),
        mockModule(protoModulePath, {
            types: createMallTypes([
                { goods_id: 1002, name: '10小时有机化肥', price: 42 },
                { goods_id: 1003, name: '10小时化肥', price: 34 },
            ]),
        }),
        mockModule(utilsModulePath, {
            toNum: (value) => Number(value) || 0,
            log() {},
            logWarn() {},
            sleep: async () => {},
        }),
        mockModule(monthcardModulePath, {
            getMonthCardInfos: async () => ({ infos: [] }),
            claimMonthCardReward: async () => ({}),
        }),
        mockModule(warehouseModulePath, {
            getBag: async () => ({ ok: true }),
            getBagItems: () => ([
                { id: 1002, count: 999 },
                { id: 1011, count: 2 * 3600 },
                { id: 1012, count: 6 * 3600 },
            ]),
            getContainerHoursFromBagItems: () => ({ normal: 2, organic: 6 }),
        }),
        mockModule(storeModulePath, {
            getAutomation: () => ({
                fertilizer_buy_limit: 10,
                fertilizer_buy_type: 'both',
                fertilizer_buy_mode: 'threshold',
                fertilizer_buy_threshold_normal: 24,
                fertilizer_buy_threshold_organic: 10,
            }),
        }),
    ];

    try {
        delete require.cache[mallModulePath];
        const { autoBuyFertilizer, getFertilizerBuyDailyState } = require(mallModulePath);

        const bought = await autoBuyFertilizer(true);
        const dailyState = getFertilizerBuyDailyState();

        assert.equal(bought, 4);
        assert.deepEqual(purchaseCalls, [
            { goodsId: 1003, count: 3 },
            { goodsId: 1002, count: 1 },
        ]);
        assert.equal(dailyState.result, 'purchased');
        assert.equal(dailyState.count, 4);
        assert.deepEqual(dailyState.typeCounts, { normal: 3, organic: 1 });
    } finally {
        delete require.cache[mallModulePath];
        restoreFns.reverse().forEach(restore => restore());
    }
});

test('autoBuyFertilizer skips mall purchase when threshold is already satisfied', async () => {
    const purchaseCalls = [];
    const restoreFns = [
        mockModule(gameConfigModulePath, {
            getItemById: () => ({}),
            getItemImageById: () => '',
        }),
        mockModule(networkModulePath, {
            sendMsgAsync: async (_serviceName, methodName, body) => {
                if (methodName === 'GetMallListBySlotType') {
                    return { body: Buffer.alloc(0) };
                }
                if (methodName === 'Purchase') {
                    purchaseCalls.push({ goodsId: Number(body.goods_id || 0), count: Number(body.count || 0) });
                    return { body: Buffer.alloc(0) };
                }
                throw new Error(`unexpected method: ${methodName}`);
            },
            getUserState: () => ({ coupon: 999 }),
        }),
        mockModule(protoModulePath, {
            types: createMallTypes([
                { goods_id: 1003, name: '10小时化肥', price: 34 },
            ]),
        }),
        mockModule(utilsModulePath, {
            toNum: (value) => Number(value) || 0,
            log() {},
            logWarn() {},
            sleep: async () => {},
        }),
        mockModule(monthcardModulePath, {
            getMonthCardInfos: async () => ({ infos: [] }),
            claimMonthCardReward: async () => ({}),
        }),
        mockModule(warehouseModulePath, {
            getBag: async () => ({ ok: true }),
            getBagItems: () => ([
                { id: 1002, count: 999 },
                { id: 1011, count: 30 * 3600 },
            ]),
            getContainerHoursFromBagItems: () => ({ normal: 30, organic: 0 }),
        }),
        mockModule(storeModulePath, {
            getAutomation: () => ({
                fertilizer_buy_limit: 10,
                fertilizer_buy_type: 'normal',
                fertilizer_buy_mode: 'threshold',
                fertilizer_buy_threshold_normal: 24,
                fertilizer_buy_threshold_organic: 24,
            }),
        }),
    ];

    try {
        delete require.cache[mallModulePath];
        const { autoBuyFertilizer, getFertilizerBuyDailyState } = require(mallModulePath);

        const bought = await autoBuyFertilizer(true);
        const dailyState = getFertilizerBuyDailyState();

        assert.equal(bought, 0);
        assert.deepEqual(purchaseCalls, []);
        assert.equal(dailyState.reason, 'threshold_not_reached');
    } finally {
        delete require.cache[mallModulePath];
        restoreFns.reverse().forEach(restore => restore());
    }
});
