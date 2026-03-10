const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const friendStateModulePath = require.resolve('../src/services/friend/friend-state');
const schedulerModulePath = require.resolve('../src/services/scheduler');
const policyModulePath = require.resolve('../src/services/account-mode-policy');
const configModulePath = require.resolve('../src/config/config');
const storeModulePath = require.resolve('../src/models/store');
const networkModulePath = require.resolve('../src/utils/network');

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

function createStoreMock() {
    return {
        getConfigSnapshot() {
            return {
                accountMode: 'alt',
                modeScope: {
                    zoneScope: 'same_zone_only',
                    requiresGameFriend: true,
                    fallbackBehavior: 'standalone',
                },
            };
        },
        getAccounts() {
            return {
                accounts: [
                    { id: '1', username: 'admin', platform: 'qq', uin: '10001' },
                    { id: '2', username: 'admin', platform: 'qq', uin: '10002' },
                ],
            };
        },
        resolveAccountZone(platform) {
            return String(platform || '').trim().toLowerCase().startsWith('wx') ? 'wechat_zone' : 'qq_zone';
        },
    };
}

test('requiring friend-state does not create scheduler until friendScheduler is accessed', () => {
    let schedulerCreateCalls = 0;
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler(namespace) {
            schedulerCreateCalls += 1;
            return { namespace };
        },
    });

    try {
        delete require.cache[friendStateModulePath];
        const state = require(friendStateModulePath);
        assert.equal(schedulerCreateCalls, 0);

        const scheduler = state.friendScheduler;
        assert.equal(scheduler.namespace, 'friend');
        assert.equal(schedulerCreateCalls, 1);
    } finally {
        delete require.cache[friendStateModulePath];
        restoreScheduler();
    }
});

test('requiring account-mode-policy does not bind network listener until runtime policy is queried', () => {
    const networkEvents = new EventEmitter();
    const restoreConfig = mockModule(configModulePath, { CONFIG: { accountId: '2' } });
    const restoreStore = mockModule(storeModulePath, createStoreMock());
    const restoreNetwork = mockModule(networkModulePath, { networkEvents });

    try {
        delete require.cache[policyModulePath];
        const policyService = require(policyModulePath);
        assert.equal(networkEvents.listenerCount('friends_updated'), 0);

        const policy = policyService.getRuntimeAccountModePolicy('2');
        assert.equal(policy.accountId, '2');
        assert.equal(networkEvents.listenerCount('friends_updated'), 1);
    } finally {
        delete require.cache[policyModulePath];
        restoreNetwork();
        restoreStore();
        restoreConfig();
    }
});
