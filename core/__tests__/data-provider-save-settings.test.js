const test = require('node:test');
const assert = require('node:assert/strict');

const { createDataProvider } = require('../src/runtime/data-provider');

function createStoreMock(timeline = []) {
    const snapshots = {
        '1': {
            accountMode: 'alt',
            harvestDelay: { min: 180, max: 300 },
            inventoryPlanting: { mode: 'disabled', globalKeepCount: 0, reserveRules: [] },
            intervals: {},
            friendQuietHours: { enabled: false, start: '23:00', end: '07:00' },
            tradeConfig: {},
            reportConfig: {},
        },
        '2': {
            accountMode: 'main',
            harvestDelay: { min: 0, max: 0 },
            inventoryPlanting: { mode: 'disabled', globalKeepCount: 0, reserveRules: [] },
            intervals: {},
            friendQuietHours: { enabled: false, start: '23:00', end: '07:00' },
            tradeConfig: {},
            reportConfig: {},
        },
        '3': {
            accountMode: 'main',
            harvestDelay: { min: 0, max: 0 },
            inventoryPlanting: { mode: 'disabled', globalKeepCount: 0, reserveRules: [] },
            intervals: {},
            friendQuietHours: { enabled: false, start: '23:00', end: '07:00' },
            tradeConfig: {},
            reportConfig: {},
        },
    };
    const calls = {
        ensureMainAccountUnique: [],
        applyAccountMode: [],
        applyConfigSnapshot: [],
        flushGlobalConfigSave: 0,
    };

    return {
        ACCOUNT_MODE_PRESETS: {
            main: { accountMode: 'main' },
            alt: { accountMode: 'alt' },
            safe: { accountMode: 'safe' },
        },
        calls,
        ensureMainAccountUnique: async (accountId, ownerUsername) => {
            calls.ensureMainAccountUnique.push({ accountId, ownerUsername });
            snapshots['2'] = {
                ...snapshots['2'],
                accountMode: 'alt',
                harvestDelay: { min: 180, max: 300 },
            };
            return [{ id: '2', username: ownerUsername }];
        },
        applyAccountMode: (accountId, mode) => {
            calls.applyAccountMode.push({ accountId, mode });
            const presetDelay = mode === 'main' ? { min: 0, max: 0 } : mode === 'alt' ? { min: 180, max: 300 } : { min: 240, max: 420 };
            snapshots[String(accountId)] = {
                ...snapshots[String(accountId)],
                accountMode: mode,
                harvestDelay: presetDelay,
            };
            return { ...snapshots[String(accountId)] };
        },
        applyConfigSnapshot: (snapshot, options = {}) => {
            const accountId = String(options.accountId || '');
            calls.applyConfigSnapshot.push({ accountId, snapshot });
            snapshots[accountId] = {
                ...snapshots[accountId],
                ...snapshot,
            };
        },
        flushGlobalConfigSave: async () => {
            calls.flushGlobalConfigSave += 1;
            timeline.push('flush');
            return true;
        },
        getConfigSnapshot: (accountId) => ({ ...snapshots[String(accountId)] }),
        getPlantingStrategy: () => 'preferred',
        getPreferredSeed: () => 0,
        getIntervals: (accountId) => ({ ...(snapshots[String(accountId)].intervals || {}) }),
        getFriendQuietHours: (accountId) => ({ ...(snapshots[String(accountId)].friendQuietHours || {}) }),
        getTradeConfig: (accountId) => ({ ...(snapshots[String(accountId)].tradeConfig || {}) }),
        getReportConfig: (accountId) => ({ ...(snapshots[String(accountId)].reportConfig || {}) }),
    };
}

test('saveSettings applies account mode and persists downgraded sibling accounts in one backend chain', async () => {
    const timeline = [];
    const store = createStoreMock(timeline);
    const updatedConfigs = [];
    const broadcasted = [];

    const provider = createDataProvider({
        workers: {},
        globalLogs: [],
        accountLogs: [],
        store,
        accountRepository: {
            async updateConfig(accountId, config) {
                updatedConfigs.push({ accountId: String(accountId), config: { ...config } });
                timeline.push(`persist:${accountId}`);
                return { changes: 1 };
            },
        },
        getAccounts: async () => ({
            accounts: [
                { id: '1', username: 'admin', platform: 'qq' },
                { id: '2', username: 'admin', platform: 'qq' },
                { id: '3', username: 'admin', platform: 'wx_car' },
            ],
        }),
        callWorkerApi: async () => ({}),
        buildDefaultStatus: () => ({}),
        normalizeStatusForPanel: status => status,
        filterLogs: logs => logs,
        addAccountLog: () => {},
        nextConfigRevision: () => {
            timeline.push('revision');
            return 9;
        },
        broadcastConfigToWorkers: (accountId) => {
            broadcasted.push(String(accountId));
            timeline.push(`broadcast:${accountId}`);
        },
        startWorker: async () => {},
        stopWorker: async () => {},
        restartWorker: async () => {},
    });

    const result = await provider.saveSettings('1', {
        accountMode: 'main',
        harvestDelay: { min: 12, max: 34 },
        inventoryPlanting: {
            mode: 'prefer_inventory',
            globalKeepCount: 2,
            reserveRules: [{ seedId: 20059, keepCount: 5 }],
        },
        intervals: {
            farmMin: 45,
            farmMax: 90,
            friendMin: 120,
            friendMax: 240,
        },
        friendQuietHours: { enabled: true, start: '00:00', end: '06:00' },
        stakeoutSteal: { enabled: true, delaySec: 5 },
        reportConfig: { enabled: true, channel: 'email' },
        automation: { farm: false, friend_help: false, forceGetAllEnabled: true },
    });

    assert.deepEqual(store.calls.ensureMainAccountUnique, [{ accountId: '1', ownerUsername: 'admin' }]);
    assert.deepEqual(store.calls.applyAccountMode, [{ accountId: '1', mode: 'main' }]);
    assert.equal(store.calls.flushGlobalConfigSave, 1);
    assert.equal(result.configRevision, 9);
    assert.equal(store.getConfigSnapshot('1').accountMode, 'main');
    assert.deepEqual(store.getConfigSnapshot('1').harvestDelay, { min: 12, max: 34 });
    assert.deepEqual(store.getConfigSnapshot('1').inventoryPlanting, {
        mode: 'prefer_inventory',
        globalKeepCount: 2,
        reserveRules: [{ seedId: 20059, keepCount: 5 }],
    });
    assert.deepEqual(store.getConfigSnapshot('1').intervals, {
        farmMin: 45,
        farmMax: 90,
        friendMin: 120,
        friendMax: 240,
    });
    assert.deepEqual(store.getConfigSnapshot('1').stakeoutSteal, {
        enabled: true,
        delaySec: 5,
    });
    assert.deepEqual(store.getConfigSnapshot('1').automation, {
        farm: false,
        friend_help: false,
        forceGetAllEnabled: true,
    });
    assert.deepEqual(store.getConfigSnapshot('1').forceGetAll, { enabled: true });
    assert.equal(store.getConfigSnapshot('2').accountMode, 'alt');
    assert.equal(timeline.indexOf('flush') < timeline.indexOf('revision'), true);
    assert.equal(timeline.indexOf('persist:2') < timeline.indexOf('revision'), true);
    assert.equal(timeline.indexOf('revision') < timeline.indexOf('broadcast:1'), true);

    assert.deepEqual(
        updatedConfigs,
        [
            { accountId: '1', config: { account_mode: 'main', harvest_delay_min: 12, harvest_delay_max: 34 } },
            { accountId: '2', config: { account_mode: 'alt', harvest_delay_min: 180, harvest_delay_max: 300 } },
        ],
    );
    assert.deepEqual(broadcasted, ['1', '2']);
});

test('saveSettings persists bag priority planting fields and fertilizer buy automation fields', async () => {
    const store = createStoreMock([]);
    const provider = createDataProvider({
        workers: {},
        globalLogs: [],
        accountLogs: [],
        store,
        accountRepository: {
            async updateConfig() {
                return { changes: 1 };
            },
        },
        getAccounts: async () => ({
            accounts: [
                { id: '1', username: 'admin', platform: 'qq' },
            ],
        }),
        callWorkerApi: async () => ({}),
        buildDefaultStatus: () => ({}),
        normalizeStatusForPanel: status => status,
        filterLogs: logs => logs,
        addAccountLog: () => {},
        nextConfigRevision: () => 10,
        broadcastConfigToWorkers: () => {},
        startWorker: async () => {},
        stopWorker: async () => {},
        restartWorker: async () => {},
    });

    await provider.saveSettings('1', {
        plantingStrategy: 'bag_priority',
        bagSeedPriority: [20061, 20059],
        bagSeedFallbackStrategy: 'max_profit',
        inventoryPlanting: {
            mode: 'prefer_inventory',
            globalKeepCount: 1,
            reserveRules: [{ seedId: 20059, keepCount: 2 }],
        },
        automation: {
            fertilizer_buy: true,
            fertilizer_buy_limit: 12,
            fertilizer_buy_type: 'both',
            fertilizer_buy_mode: 'threshold',
            fertilizer_buy_threshold_normal: 18,
            fertilizer_buy_threshold_organic: 9,
        },
    });

    assert.equal(store.getConfigSnapshot('1').plantingStrategy, 'bag_priority');
    assert.deepEqual(store.getConfigSnapshot('1').bagSeedPriority, [20061, 20059]);
    assert.equal(store.getConfigSnapshot('1').bagSeedFallbackStrategy, 'max_profit');
    assert.deepEqual(store.getConfigSnapshot('1').inventoryPlanting, {
        mode: 'prefer_inventory',
        globalKeepCount: 1,
        reserveRules: [{ seedId: 20059, keepCount: 2 }],
    });
    assert.deepEqual(store.getConfigSnapshot('1').automation, {
        fertilizer_buy: true,
        fertilizer_buy_limit: 12,
        fertilizer_buy_type: 'both',
        fertilizer_buy_mode: 'threshold',
        fertilizer_buy_threshold_normal: 18,
        fertilizer_buy_threshold_organic: 9,
    });
});
