const test = require('node:test');
const assert = require('node:assert/strict');

const friendActionsModulePath = require.resolve('../src/services/friend/friend-actions');
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
const databaseModulePath = require.resolve('../src/services/database');
const interactModulePath = require.resolve('../src/services/interact');
const platformFactoryModulePath = require.resolve('../src/platform/PlatformFactory');
const friendStateModulePath = require.resolve('../src/services/friend/friend-state');
const friendScannerModulePath = require.resolve('../src/services/friend/friend-scanner');
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

test('QQ getAllFriends falls back to direct GetGameFriends when SyncAll is self-only and no cached gids exist', async () => {
    let syncAllCalls = 0;
    let getGameFriendsCalls = 0;
    let getAllCalls = 0;
    const previousAccountId = process.env.FARM_ACCOUNT_ID;
    process.env.FARM_ACCOUNT_ID = '3002';

    const restoreFns = [
        mockModule(configModulePath, { CONFIG: { platform: 'qq' }, PlantPhase: {}, PHASE_NAMES: {} }),
        mockModule(gameConfigModulePath, {
            getPlantName: () => '',
            getPlantById: () => null,
            getSeedImageBySeedId: () => '',
        }),
        mockModule(storeModulePath, {
            isAutomationOn: () => false,
            getFriendQuietHours: () => ({ enabled: false }),
            getFriendBlacklist: () => [],
            setFriendBlacklist: () => [],
            getStealFilterConfig: () => ({ enabled: false, mode: 'blacklist', plantIds: [] }),
            getStealFriendFilterConfig: () => ({ enabled: false, mode: 'blacklist', friendIds: [] }),
            getStakeoutStealConfig: () => ({ enabled: false, delaySec: 3 }),
            getConfigSnapshot: () => ({}),
            getForceGetAllConfig: () => ({ enabled: false }),
        }),
        mockModule(networkModulePath, {
            sendMsgAsync: async (_serviceName, methodName) => {
                if (methodName === 'SyncAll') {
                    syncAllCalls += 1;
                    return { body: Buffer.from('sync-all') };
                }
                if (methodName === 'GetGameFriends') {
                    getGameFriendsCalls += 1;
                    return { body: Buffer.from('game-friends') };
                }
                if (methodName === 'GetAll') {
                    getAllCalls += 1;
                    return { body: Buffer.from('get-all') };
                }
                throw new Error(`unexpected method: ${methodName}`);
            },
            sendMsgAsyncUrgent: async () => ({ body: Buffer.alloc(0) }),
            getUserState: () => ({ gid: 999 }),
            networkEvents: { emit() {} },
        }),
        mockModule(protoModulePath, {
            types: {
                SyncAllFriendsRequest: {
                    create: (value) => value || {},
                    encode: () => ({ finish: () => Buffer.alloc(0) }),
                },
                SyncAllFriendsReply: {
                    decode: () => ({
                        game_friends: [{ gid: 999, name: 'self' }],
                        invitations: [],
                        application_count: 0,
                    }),
                },
                GetGameFriendsRequest: {
                    create: (value) => value || {},
                    encode: () => ({ finish: () => Buffer.alloc(0) }),
                },
                GetAllFriendsRequest: {
                    create: (value) => value || {},
                    encode: () => ({ finish: () => Buffer.alloc(0) }),
                },
                GetAllFriendsReply: {
                    decode: (body) => {
                        const key = Buffer.from(body).toString();
                        if (key === 'game-friends') {
                            return {
                                game_friends: [
                                    { gid: 201, name: '阿丙' },
                                    { gid: 202, name: '阿丁' },
                                ],
                                invitations: [],
                                application_count: 0,
                            };
                        }
                        if (key === 'get-all') {
                            return { game_friends: [], invitations: [], application_count: 0 };
                        }
                        return { game_friends: [], invitations: [], application_count: 0 };
                    },
                },
            },
        }),
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
        mockModule(mysqlDbModulePath, { getPool: () => ({}) }),
        mockModule(databaseModulePath, {
            getCachedFriends: async () => ([]),
        }),
        mockModule(interactModulePath, {
            getInteractRecords: async () => [],
        }),
        mockModule(platformFactoryModulePath, {
            createPlatform: () => ({ allowSyncAll: () => true }),
        }),
        mockModule(friendStateModulePath, {}),
        mockModule(friendScannerModulePath, {}),
        mockModule(friendDecisionModulePath, {}),
    ];

    try {
        delete require.cache[friendActionsModulePath];
        const { getAllFriends } = require(friendActionsModulePath);

        const firstReply = await getAllFriends();
        assert.deepEqual(firstReply.game_friends.map(friend => Number(friend.gid)), [201, 202]);

        const secondReply = await getAllFriends();
        assert.deepEqual(secondReply.game_friends.map(friend => String(friend.name)), ['阿丙', '阿丁']);

        assert.equal(syncAllCalls, 1);
        assert.equal(getGameFriendsCalls, 2);
        assert.equal(getAllCalls, 0);
    } finally {
        if (previousAccountId === undefined) delete process.env.FARM_ACCOUNT_ID;
        else process.env.FARM_ACCOUNT_ID = previousAccountId;
        delete require.cache[friendActionsModulePath];
        restoreFns.reverse().forEach(restore => restore());
    }
});
