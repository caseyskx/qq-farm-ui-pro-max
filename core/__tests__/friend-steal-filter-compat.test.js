const test = require('node:test');
const assert = require('node:assert/strict');

const configModulePath = require.resolve('../src/config/config');
const gameConfigModulePath = require.resolve('../src/config/gameConfig');
const storeModulePath = require.resolve('../src/models/store');
const networkModulePath = require.resolve('../src/utils/network');
const protoModulePath = require.resolve('../src/utils/proto');
const utilsModulePath = require.resolve('../src/utils/utils');
const farmModulePath = require.resolve('../src/services/farm');
const statsModulePath = require.resolve('../src/services/stats');
const warehouseModulePath = require.resolve('../src/services/warehouse');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const platformFactoryModulePath = require.resolve('../src/platform/PlatformFactory');
const friendStateModulePath = require.resolve('../src/services/friend/friend-state');
const friendDecisionModulePath = require.resolve('../src/services/friend/friend-decision');

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

test('shouldStealPlant keeps old seedId-based filter entries compatible with live plantId checks', () => {
    const restoreFns = [
        mockModule(configModulePath, { CONFIG: { platform: 'qq' }, PlantPhase: {}, PHASE_NAMES: {} }),
        mockModule(gameConfigModulePath, {
            getPlantName: () => '',
            getPlantById: () => ({ seed_id: 20249 }),
            getSeedImageBySeedId: () => '',
        }),
        mockModule(storeModulePath, {
            isAutomationOn: () => false,
            getFriendQuietHours: () => ({ enabled: false }),
            getFriendBlacklist: () => [],
            setFriendBlacklist: () => [],
            getStealFilterConfig: () => ({ enabled: true, mode: 'blacklist', plantIds: ['20249'] }),
            getStealFriendFilterConfig: () => ({ enabled: false, mode: 'blacklist', friendIds: [] }),
            getStakeoutStealConfig: () => ({ enabled: false, delaySec: 3 }),
            getSkipStealRadishConfig: () => ({ enabled: false }),
            getConfigSnapshot: () => ({}),
        }),
        mockModule(networkModulePath, {
            sendMsgAsync: async () => ({}),
            sendMsgAsyncUrgent: async () => ({}),
            getUserState: () => ({ gid: 0 }),
            networkEvents: { emit() {} },
        }),
        mockModule(protoModulePath, { types: {} }),
        mockModule(utilsModulePath, {
            toLong: (value) => value,
            toNum: (value) => Number(value) || 0,
            toTimeSec: () => 0,
            getServerTimeSec: () => 0,
            log() {},
            logWarn() {},
            sleep: async () => {},
        }),
        mockModule(farmModulePath, {
            getCurrentPhase: () => null,
            setOperationLimitsCallback() {},
        }),
        mockModule(statsModulePath, { recordOperation() {} }),
        mockModule(warehouseModulePath, { sellAllFruits: async () => {} }),
        mockModule(mysqlDbModulePath, { getPool: () => null }),
        mockModule(platformFactoryModulePath, function PlatformFactory() {}),
        mockModule(friendStateModulePath, {
            filterStats: { friendBlacklist: 0, friendWhitelist: 0, plantBlacklist: 0, plantWhitelist: 0, banned: 0 },
        }),
    ];

    delete require.cache[friendDecisionModulePath];
    const { shouldStealPlant } = require(friendDecisionModulePath);

    assert.equal(shouldStealPlant(1020249), false);

    restoreFns.reverse().forEach(restore => restore());
    delete require.cache[friendDecisionModulePath];
});
