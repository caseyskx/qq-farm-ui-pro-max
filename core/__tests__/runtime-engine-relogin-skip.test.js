const test = require('node:test');
const assert = require('node:assert/strict');

const runtimeEngineModulePath = require.resolve('../src/runtime/runtime-engine');
const storeModulePath = require.resolve('../src/models/store');
const dataProviderModulePath = require.resolve('../src/runtime/data-provider');
const reloginReminderModulePath = require.resolve('../src/runtime/relogin-reminder');
const runtimeStateModulePath = require.resolve('../src/runtime/runtime-state');
const workerManagerModulePath = require.resolve('../src/runtime/worker-manager');
const databaseModulePath = require.resolve('../src/services/database');
const reportServiceModulePath = require.resolve('../src/services/report-service');
const accountRepositoryModulePath = require.resolve('../src/repositories/account-repository');

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

test('runtime engine skips auto-start for accounts that require relogin after ws 400', async () => {
    const startedAccounts = [];
    const logs = [];

    const restoreStore = mockModule(storeModulePath, {
        getAccounts: () => ({ accounts: [] }),
        getAccountsFresh: async () => ({ accounts: [] }),
        getAccountsFullPaged: async () => ({
            accounts: [
                { id: '1', name: '需要重登', platform: 'qq', code: 'expired', wsError: { code: 400, message: 'Unexpected server response: 400', at: 1 } },
                { id: '2', name: '正常账号', platform: 'qq', code: 'fresh' },
            ],
            total: 2,
            page: 1,
            pageSize: 50,
            totalPages: 1,
        }),
        addOrUpdateAccount: () => ({}),
        markAccountLoginSuccess: async () => null,
        getConfigSnapshot: () => ({}),
    });
    const restoreDataProvider = mockModule(dataProviderModulePath, {
        createDataProvider: () => ({}),
    });
    const restoreReloginReminder = mockModule(reloginReminderModulePath, {
        createReloginReminderService: () => ({
            getOfflineAutoDeleteMs: () => 0,
            triggerOfflineReminder: () => {},
        }),
    });
    const restoreRuntimeState = mockModule(runtimeStateModulePath, {
        createRuntimeState: () => ({
            workers: {},
            globalLogs: [],
            accountLogs: [],
            runtimeEvents: { on() {}, emit() {} },
            nextConfigRevision: () => 1,
            buildConfigSnapshotForAccount: () => ({}),
            log: (_tag, msg) => logs.push(String(msg || '')),
            addAccountLog: () => {},
            normalizeStatusForPanel: (status) => status,
            buildDefaultStatus: () => ({}),
            filterLogs: (items) => items,
        }),
    });
    const restoreWorkerManager = mockModule(workerManagerModulePath, {
        createWorkerManager: () => ({
            startWorker: async (account) => {
                startedAccounts.push(account);
                return true;
            },
            stopWorker: () => {},
            restartWorker: async () => true,
            callWorkerApi: async () => ({}),
        }),
    });
    const restoreDatabase = mockModule(databaseModulePath, {
        updateFriendsCache: async () => {},
        mergeFriendsCache: async () => {},
    });
    const restoreReportService = mockModule(reportServiceModulePath, {
        createReportService: () => ({
            start() {},
            stop() {},
            sendTestReport: async () => ({}),
            sendHourlyReport: async () => ({}),
            sendDailyReport: async () => ({}),
        }),
    });
    const restoreAccountRepository = mockModule(accountRepositoryModulePath, {});

    try {
        delete require.cache[runtimeEngineModulePath];
        const { createRuntimeEngine } = require(runtimeEngineModulePath);

        const engine = createRuntimeEngine({
            processRef: { env: {} },
            startAdminServer: async () => {},
            stopAdminServer: async () => {},
        });

        await engine.start({
            startAdminServer: false,
            autoStartAccounts: true,
        });

        assert.deepEqual(startedAccounts.map(account => account.id), ['2']);
        assert.ok(logs.some(msg => msg.includes('跳过 1 个登录已失效账号')));
    } finally {
        delete require.cache[runtimeEngineModulePath];
        restoreStore();
        restoreDataProvider();
        restoreReloginReminder();
        restoreRuntimeState();
        restoreWorkerManager();
        restoreDatabase();
        restoreReportService();
        restoreAccountRepository();
    }
});
