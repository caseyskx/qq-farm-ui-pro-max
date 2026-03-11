
const { createScheduler } = require('../scheduler');

let friendScheduler = null;

function getFriendScheduler() {
    if (!friendScheduler) {
        friendScheduler = createScheduler('friend');
    }
    return friendScheduler;
}

const state = {
    isCheckingFriends: false,
    friendLoopRunning: false,
    externalSchedulerMode: false,
    lastResetDate: '',
    activeStakeouts: new Map(),
    MAX_STAKEOUT_AHEAD_SEC: 4 * 3600,
    operationLimits: new Map(),
    OP_NAMES: {
        10001: '收获', 10002: '铲除', 10003: '放草', 10004: '放虫',
        10005: '除草', 10006: '除虫', 10007: '浇水', 10008: '偷菜',
    },
    canGetHelpExp: true,
    helpAutoDisabledByLimit: false,
    filterStats: { friendBlacklist: 0, friendWhitelist: 0, plantBlacklist: 0, plantWhitelist: 0, banned: 0 }
};

Object.defineProperty(state, 'friendScheduler', {
    enumerable: true,
    configurable: false,
    get: getFriendScheduler,
});

function resetFriendState() {
    if (friendScheduler) {
        friendScheduler.clearAll();
    }
    state.isCheckingFriends = false;
    state.friendLoopRunning = false;
    state.externalSchedulerMode = false;
    state.lastResetDate = '';
    state.activeStakeouts.clear();
    state.operationLimits.clear();
    state.canGetHelpExp = true;
    state.helpAutoDisabledByLimit = false;
    state.filterStats.friendBlacklist = 0;
    state.filterStats.friendWhitelist = 0;
    state.filterStats.plantBlacklist = 0;
    state.filterStats.plantWhitelist = 0;
    state.filterStats.banned = 0;
}

module.exports = state;
module.exports.resetFriendState = resetFriendState;
