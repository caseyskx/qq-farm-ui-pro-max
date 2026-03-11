const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const accountModePolicyModulePath = require.resolve('../src/services/account-mode-policy');
const configModulePath = require.resolve('../src/config/config');
const friendStateModulePath = require.resolve('../src/services/friend/friend-state');
const networkModulePath = require.resolve('../src/utils/network');
const schedulerModulePath = require.resolve('../src/services/scheduler');
const storeModulePath = require.resolve('../src/models/store');
const taskModulePath = require.resolve('../src/services/task');
const utilsModulePath = require.resolve('../src/utils/utils');
const protoModulePath = require.resolve('../src/utils/proto');
const statsModulePath = require.resolve('../src/services/stats');
const commonModulePath = require.resolve('../src/services/common');

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

test('task runtime reset removes notify listener and clears scheduled work', () => {
    const networkEvents = new EventEmitter();
    let clearAllCalls = 0;
    const restoreStore = mockModule(storeModulePath, {
        isAutomationOn() { return false; },
    });
    const restoreNetwork = mockModule(networkModulePath, {
        sendMsgAsync() {
            throw new Error('unexpected sendMsgAsync call');
        },
        networkEvents,
    });
    const restoreProto = mockModule(protoModulePath, {
        types: {},
    });
    const restoreUtils = mockModule(utilsModulePath, {
        toLong(value) { return value; },
        toNum(value) { return Number(value) || 0; },
        log() {},
        logWarn() {},
        sleep: async () => {},
        getServerTimeSec() { return 0; },
    });
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            return {
                setTimeoutTask() {},
                clearAll() {
                    clearAllCalls += 1;
                },
            };
        },
    });
    const restoreStats = mockModule(statsModulePath, {
        recordOperation() {},
    });
    const restoreCommon = mockModule(commonModulePath, {
        getRewardSummary() {
            return '';
        },
    });

    try {
        delete require.cache[taskModulePath];
        const task = require(taskModulePath);

        assert.equal(networkEvents.listenerCount('taskInfoNotify'), 0);
        task.initTaskSystem();
        assert.equal(networkEvents.listenerCount('taskInfoNotify'), 1);

        task.resetTaskRuntimeState();
        assert.equal(networkEvents.listenerCount('taskInfoNotify'), 0);
        assert.ok(clearAllCalls >= 1);
    } finally {
        delete require.cache[taskModulePath];
        restoreCommon();
        restoreStats();
        restoreScheduler();
        restoreUtils();
        restoreProto();
        restoreNetwork();
        restoreStore();
    }
});

test('account mode policy reset unbinds runtime listener and clears friend snapshots', () => {
    const networkEvents = new EventEmitter();
    const restoreConfig = mockModule(configModulePath, {
        CONFIG: {
            accountId: 'acc-1',
        },
    });
    const restoreStore = mockModule(storeModulePath, {
        getAccounts() {
            return { accounts: [] };
        },
        getConfigSnapshot() {
            return {};
        },
        resolveAccountZone() {
            return 'unknown_zone';
        },
    });
    const restoreNetwork = mockModule(networkModulePath, {
        networkEvents,
    });

    try {
        delete require.cache[accountModePolicyModulePath];
        const accountModePolicy = require(accountModePolicyModulePath);

        assert.equal(networkEvents.listenerCount('friends_updated'), 0);
        accountModePolicy.getRuntimeFriendsSnapshot('acc-1');
        assert.equal(networkEvents.listenerCount('friends_updated'), 1);

        networkEvents.emit('friends_updated', [{ gid: 1, uin: '10001' }]);
        const beforeReset = accountModePolicy.getRuntimeFriendsSnapshot('acc-1');
        assert.equal(beforeReset && beforeReset.total, 1);

        accountModePolicy.resetRuntimeAccountModePolicyState();
        assert.equal(networkEvents.listenerCount('friends_updated'), 0);

        const afterReset = accountModePolicy.getRuntimeFriendsSnapshot('acc-1');
        assert.equal(afterReset, null);
    } finally {
        delete require.cache[accountModePolicyModulePath];
        restoreNetwork();
        restoreStore();
        restoreConfig();
    }
});

test('friend state reset clears loop flags, maps, and scheduler tasks', () => {
    let clearAllCalls = 0;
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            return {
                clearAll() {
                    clearAllCalls += 1;
                },
            };
        },
    });

    try {
        delete require.cache[friendStateModulePath];
        const state = require(friendStateModulePath);

        void state.friendScheduler;
        state.isCheckingFriends = true;
        state.friendLoopRunning = true;
        state.externalSchedulerMode = true;
        state.lastResetDate = '2026-03-11';
        state.activeStakeouts.set('stake_1', { friendGid: 1 });
        state.operationLimits.set('steal', 3);
        state.canGetHelpExp = false;
        state.helpAutoDisabledByLimit = true;
        state.filterStats.friendBlacklist = 2;
        state.filterStats.friendWhitelist = 1;
        state.filterStats.plantBlacklist = 4;
        state.filterStats.plantWhitelist = 5;
        state.filterStats.banned = 6;

        state.resetFriendState();

        assert.equal(clearAllCalls, 1);
        assert.equal(state.isCheckingFriends, false);
        assert.equal(state.friendLoopRunning, false);
        assert.equal(state.externalSchedulerMode, false);
        assert.equal(state.lastResetDate, '');
        assert.equal(state.activeStakeouts.size, 0);
        assert.equal(state.operationLimits.size, 0);
        assert.equal(state.canGetHelpExp, true);
        assert.equal(state.helpAutoDisabledByLimit, false);
        assert.deepEqual(state.filterStats, {
            friendBlacklist: 0,
            friendWhitelist: 0,
            plantBlacklist: 0,
            plantWhitelist: 0,
            banned: 0,
        });
    } finally {
        delete require.cache[friendStateModulePath];
        restoreScheduler();
    }
});
