const test = require('node:test');
const assert = require('node:assert/strict');

const { createDataProvider } = require('../src/runtime/data-provider');

function createClusterProvider({ accounts, dispatcher } = {}) {
    const updates = [];
    const provider = createDataProvider({
        workers: {},
        globalLogs: [],
        accountLogs: [],
        currentRole: 'master',
        getDispatcherRef: () => dispatcher,
        store: {
            addOrUpdateAccount(payload) {
                updates.push({ ...payload });
                return { touchedAccountId: String(payload.id || '') };
            },
            getConfigSnapshot: () => ({}),
        },
        accountRepository: null,
        getAccounts: async () => ({ accounts: accounts || [] }),
        callWorkerApi: async () => ({}),
        buildDefaultStatus: () => ({}),
        normalizeStatusForPanel: status => status,
        filterLogs: logs => logs,
        addAccountLog: () => {},
        nextConfigRevision: () => 1,
        broadcastConfigToWorkers: () => {},
        startWorker: async () => {
            throw new Error('cluster master should not call local startWorker');
        },
        stopWorker: async () => {
            throw new Error('cluster master should not call local stopWorker');
        },
        restartWorker: async () => {
            throw new Error('cluster master should not call local restartWorker');
        },
    });

    return { provider, updates };
}

test('cluster master startAccount toggles persisted running state and rebalances dispatcher', async () => {
    const dispatcherCalls = [];
    const { provider, updates } = createClusterProvider({
        accounts: [{ id: 'acc-1', name: '测试账号', running: false }],
        dispatcher: {
            async rebalance() {
                dispatcherCalls.push('rebalance');
            },
        },
    });

    const ok = await provider.startAccount('acc-1');

    assert.equal(ok, true);
    assert.deepEqual(updates, [{
        id: 'acc-1',
        running: true,
        connected: false,
        wsError: null,
    }]);
    assert.deepEqual(dispatcherCalls, ['rebalance']);
});

test('cluster master restartAccount clears and restores running state through dispatcher rebalance', async () => {
    const dispatcherCalls = [];
    const { provider, updates } = createClusterProvider({
        accounts: [{ id: 'acc-1', name: '测试账号', running: true }],
        dispatcher: {
            async rebalance() {
                dispatcherCalls.push('rebalance');
            },
        },
    });

    const ok = await provider.restartAccount('acc-1');

    assert.equal(ok, true);
    assert.deepEqual(updates, [
        {
            id: 'acc-1',
            running: false,
            connected: false,
            wsError: null,
        },
        {
            id: 'acc-1',
            running: true,
            connected: false,
            wsError: null,
        },
    ]);
    assert.deepEqual(dispatcherCalls, ['rebalance', 'rebalance']);
});

test('cluster master isAccountRunning falls back to persisted running state when no local worker exists', async () => {
    const { provider } = createClusterProvider({
        accounts: [
            { id: 'acc-1', name: '运行中账号', running: true },
            { id: 'acc-2', name: '已停止账号', running: false },
        ],
    });

    const running = await provider.isAccountRunning('acc-1');
    const stopped = await provider.isAccountRunning('acc-2');
    const missing = await provider.isAccountRunning('missing');

    assert.equal(running, true);
    assert.equal(stopped, false);
    assert.equal(missing, false);
});
