const test = require('node:test');
const assert = require('node:assert/strict');

const { createDataProvider } = require('../src/runtime/data-provider');

test('restartAccount prefers fresh persisted account fields over stale list cache', async () => {
    const restartedAccounts = [];

    const provider = createDataProvider({
        workers: {},
        globalLogs: [],
        accountLogs: [],
        store: {
            getAccountFull: async () => ({
                id: 'acc-1',
                name: '新账号备注',
                platform: 'wx_car',
                uin: 'wxid_new',
                qq: '',
                code: 'fresh-code',
                authTicket: '',
            }),
            getConfigSnapshot: () => ({}),
            resolveAccountZone: () => 'wechat_zone',
        },
        accountRepository: null,
        getAccounts: async () => ({
            accounts: [{
                id: 'acc-1',
                name: '旧账号备注',
                platform: 'wx_car',
                uin: 'wxid_old',
                qq: 'legacy-qq',
                code: 'stale-code',
                authTicket: 'stale-ticket',
            }],
        }),
        callWorkerApi: async () => ({}),
        buildDefaultStatus: () => ({}),
        normalizeStatusForPanel: status => status,
        filterLogs: logs => logs,
        addAccountLog: () => {},
        nextConfigRevision: () => 1,
        broadcastConfigToWorkers: () => {},
        startWorker: async () => true,
        stopWorker: async () => true,
        restartWorker: async (account) => {
            restartedAccounts.push(account);
            return true;
        },
    });

    const ok = await provider.restartAccount('acc-1');

    assert.equal(ok, true);
    assert.equal(restartedAccounts.length, 1);
    assert.deepEqual(restartedAccounts[0], {
        id: 'acc-1',
        name: '新账号备注',
        platform: 'wx_car',
        uin: 'wxid_new',
        qq: '',
        code: 'fresh-code',
        authTicket: '',
    });
});
