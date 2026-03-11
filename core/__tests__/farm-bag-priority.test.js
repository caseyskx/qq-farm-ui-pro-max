const test = require('node:test');
const assert = require('node:assert/strict');

const farmModulePath = require.resolve('../src/services/farm');
const configModulePath = require.resolve('../src/config/config');
const gameConfigModulePath = require.resolve('../src/config/gameConfig');
const storeModulePath = require.resolve('../src/models/store');
const networkModulePath = require.resolve('../src/utils/network');
const protoModulePath = require.resolve('../src/utils/proto');
const utilsModulePath = require.resolve('../src/utils/utils');
const analyticsModulePath = require.resolve('../src/services/analytics');
const accountModePolicyModulePath = require.resolve('../src/services/account-mode-policy');
const warehouseModulePath = require.resolve('../src/services/warehouse');
const plantingStrategyModulePath = require.resolve('../src/services/planting-strategy');
const schedulerModulePath = require.resolve('../src/services/scheduler');
const loggerModulePath = require.resolve('../src/services/logger');
const statsModulePath = require.resolve('../src/services/stats');
const rateLimiterModulePath = require.resolve('../src/services/rate-limiter');
const friendCacheSeedsModulePath = require.resolve('../src/services/friend-cache-seeds');
const visitorIdentityModulePath = require.resolve('../src/services/visitor-identity');

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

function createBaseRestores(options = {}) {
    const sendPlant = options.sendPlant || (async () => ({ body: Buffer.alloc(0) }));
    const plantableBagSeeds = options.plantableBagSeeds || (async () => []);
    const decodePlantReply = options.decodePlantReply || (() => ({ land: [] }));
    const configSnapshot = options.configSnapshot || { bagSeedPriority: [] };

    return [
        mockModule(configModulePath, {
            CONFIG: { accountId: 'acc-1' },
            PlantPhase: {},
            PHASE_NAMES: {},
        }),
        mockModule(gameConfigModulePath, {
            getPlantNameBySeedId: (seedId) => {
                if (Number(seedId) === 20061) return '大南瓜';
                if (Number(seedId) === 20059) return '小土豆';
                return `Seed#${seedId}`;
            },
            getPlantName: () => '',
            getPlantExp: () => 0,
            formatGrowTime: () => '',
            getPlantGrowTime: () => 0,
            getAllSeeds: () => [],
            getPlantById: () => null,
            getPlantBySeedId: (seedId) => ({ size: Number(seedId) === 20061 ? 2 : 1 }),
            getSeedImageBySeedId: () => '',
        }),
        mockModule(storeModulePath, {
            isAutomationOn: () => false,
            getPreferredSeed: () => 0,
            getAutomation: () => ({}),
            getPlantingStrategy: () => 'preferred',
            recordSuspendUntil() {},
            getTimingConfig: () => ({}),
            getConfigSnapshot: () => configSnapshot,
        }),
        mockModule(networkModulePath, {
            sendMsgAsync: async (_serviceName, methodName) => {
                if (methodName === 'Plant') {
                    return await sendPlant();
                }
                throw new Error(`unexpected method: ${methodName}`);
            },
            sendMsgAsyncUrgent: async () => ({ body: Buffer.alloc(0) }),
            getUserState: () => ({ gid: 1001 }),
            getWsErrorState: () => ({ code: 0, at: 0, message: '' }),
            networkEvents: { emit() {}, on() {}, removeListener() {} },
        }),
        mockModule(protoModulePath, {
            types: {
                PlantReply: {
                    decode: decodePlantReply,
                },
            },
        }),
        mockModule(utilsModulePath, {
            toLong: (value) => value,
            toNum: (value) => Number(value) || 0,
            getServerTimeSec: () => 0,
            toTimeSec: () => 0,
            log() {},
            logWarn() {},
            sleep: async () => {},
        }),
        mockModule(analyticsModulePath, {
            getPlantRankings: () => [],
        }),
        mockModule(accountModePolicyModulePath, {
            getRuntimeAccountModePolicy: () => ({ collaborationEnabled: true }),
        }),
        mockModule(warehouseModulePath, {
            getBagDetail: async () => ({ items: [] }),
            getPlantableBagSeeds: plantableBagSeeds,
        }),
        mockModule(plantingStrategyModulePath, {
            ANALYTICS_SORT_BY_MAP: {},
            getInventorySourcePlan: () => null,
            getWorkflowSelectSeedOverride: () => null,
            normalizeInventoryPlantingMode: (mode) => mode || 'disabled',
            pickBudgetOptimizedPlan: () => null,
            pickSeedByStrategy: () => null,
        }),
        mockModule(schedulerModulePath, {
            createScheduler: () => ({
                setTimeoutTask() {},
                clearAll() {},
            }),
        }),
        mockModule(loggerModulePath, {
            createModuleLogger: () => ({
                info() {},
                warn() {},
                error() {},
            }),
        }),
        mockModule(statsModulePath, {
            recordOperation() {},
        }),
        mockModule(rateLimiterModulePath, {
            getDefaultLimiter: () => ({ bucket: { waitForToken: async () => {} } }),
        }),
        mockModule(friendCacheSeedsModulePath, {
            cacheFriendSeeds: async () => {},
            buildFriendSeedsFromLands: () => [],
            resolveFriendSeedAccountId: () => 'acc-1',
        }),
        mockModule(visitorIdentityModulePath, {
            resolveVisitorIdentity: async () => ({ gid: 0, name: '', known: false, source: '' }),
        }),
    ];
}

test('bag priority plants 2x2 seed first and removes occupied lands before next seed', async () => {
    const replies = [Buffer.from('big-2x2'), Buffer.from('small-1x1')];
    const restoreFns = createBaseRestores({
        configSnapshot: {
            bagSeedPriority: [20061, 20059],
        },
        plantableBagSeeds: async () => ([
            { seedId: 20059, usableCount: 3, plantSize: 1, requiredLevel: 5 },
            { seedId: 20061, usableCount: 1, plantSize: 2, requiredLevel: 6 },
        ]),
        sendPlant: async () => ({ body: replies.shift() || Buffer.from('unexpected') }),
        decodePlantReply: (body) => {
            const key = Buffer.from(body).toString();
            if (key === 'big-2x2') {
                return {
                    land: [
                        { id: 1, master_land_id: 1, slave_land_ids: [2, 3, 4], plant: { phases: [{}] } },
                        { id: 2, master_land_id: 1, slave_land_ids: [] },
                        { id: 3, master_land_id: 1, slave_land_ids: [] },
                        { id: 4, master_land_id: 1, slave_land_ids: [] },
                    ],
                };
            }
            return {
                land: [
                    { id: 5, master_land_id: 0, slave_land_ids: [], plant: { phases: [{}] } },
                ],
            };
        },
    });

    try {
        delete require.cache[farmModulePath];
        const farm = require(farmModulePath);

        const result = await farm.__test__.plantFromBagPriority([1, 2, 3, 4, 5], {
            configSnapshot: {
                bagSeedPriority: [20061, 20059],
            },
        });

        assert.deepEqual(result.summary.plantedLandIds, [1, 5]);
        assert.deepEqual(result.summary.occupiedLandIds, [1, 2, 3, 4, 5]);
        assert.deepEqual(result.remainingLandIds, []);
    } finally {
        delete require.cache[farmModulePath];
        restoreFns.reverse().forEach(restore => restore());
    }
});

test('bag priority skips 2x2 seed when remaining lands are insufficient and falls through to 1x1 seeds', async () => {
    const plantBodies = [];
    const replies = [Buffer.from('single-a'), Buffer.from('single-b')];
    const restoreFns = createBaseRestores({
        configSnapshot: {
            bagSeedPriority: [20061, 20059],
        },
        plantableBagSeeds: async () => ([
            { seedId: 20061, usableCount: 1, plantSize: 2, requiredLevel: 6 },
            { seedId: 20059, usableCount: 2, plantSize: 1, requiredLevel: 5 },
        ]),
        sendPlant: async () => {
            const next = replies.shift() || Buffer.from('unexpected');
            plantBodies.push(next.toString());
            return { body: next };
        },
        decodePlantReply: (body) => {
            const key = Buffer.from(body).toString();
            if (key === 'single-a') {
                return {
                    land: [
                        { id: 11, master_land_id: 0, slave_land_ids: [], plant: { phases: [{}] } },
                    ],
                };
            }
            return {
                land: [
                    { id: 12, master_land_id: 0, slave_land_ids: [], plant: { phases: [{}] } },
                ],
            };
        },
    });

    try {
        delete require.cache[farmModulePath];
        const farm = require(farmModulePath);

        const result = await farm.__test__.plantFromBagPriority([11, 12, 13], {
            configSnapshot: {
                bagSeedPriority: [20061, 20059],
            },
        });

        assert.deepEqual(plantBodies, ['single-a', 'single-b']);
        assert.deepEqual(result.summary.plantedLandIds, [11, 12]);
        assert.deepEqual(result.summary.occupiedLandIds, [11, 12]);
        assert.deepEqual(result.remainingLandIds, [13]);
    } finally {
        delete require.cache[farmModulePath];
        restoreFns.reverse().forEach(restore => restore());
    }
});
