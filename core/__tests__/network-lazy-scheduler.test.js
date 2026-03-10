const test = require('node:test');
const assert = require('node:assert/strict');

const networkModulePath = require.resolve('../src/utils/network');
const configModulePath = require.resolve('../src/config/config');
const schedulerModulePath = require.resolve('../src/services/scheduler');
const statusModulePath = require.resolve('../src/services/status');
const statsModulePath = require.resolve('../src/services/stats');
const protoModulePath = require.resolve('../src/utils/proto');
const utilsModulePath = require.resolve('../src/utils/utils');
const storeModulePath = require.resolve('../src/models/store');
const circuitBreakerModulePath = require.resolve('../src/services/circuit-breaker');
const cryptoWasmModulePath = require.resolve('../src/utils/crypto-wasm');

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

test('requiring network does not create scheduler until timed work is actually needed', async () => {
    let createSchedulerCalls = 0;
    const restoreConfig = mockModule(configModulePath, {
        CONFIG: {
            accountId: '',
            heartbeatInterval: 30000,
            clientVersion: 'test',
            platform: 'qq',
            os: 'ios',
            serverUrl: 'ws://localhost',
        },
    });
    const restoreScheduler = mockModule(schedulerModulePath, {
        createScheduler() {
            createSchedulerCalls += 1;
            return {
                setTimeoutTask() {},
                setIntervalTask() {},
                clear() {},
                clearAll() {},
            };
        },
    });
    const restoreStatus = mockModule(statusModulePath, {
        updateStatusFromLogin() {},
        updateStatusGold() {},
        updateStatusLevel() {},
    });
    const restoreStats = mockModule(statsModulePath, {
        recordOperation() {},
    });
    const restoreProto = mockModule(protoModulePath, {
        types: {},
    });
    const restoreUtils = mockModule(utilsModulePath, {
        toLong(value) { return value; },
        toNum(value) { return Number(value) || 0; },
        syncServerTime() {},
        log() {},
        logWarn() {},
    });
    const restoreStore = mockModule(storeModulePath, {
        getSuspendUntil() { return 0; },
        getTimingConfig() { return {}; },
    });
    const restoreBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            allowRequest() { return true; },
        },
    });
    const restoreCrypto = mockModule(cryptoWasmModulePath, {
        async encryptBuffer(buffer) {
            return buffer;
        },
    });

    try {
        delete require.cache[networkModulePath];
        const network = require(networkModulePath);

        assert.equal(createSchedulerCalls, 0);
        network.cleanup();
        assert.equal(createSchedulerCalls, 0);
        await assert.rejects(
            network.sendMsgAsync('svc', 'method', Buffer.alloc(0)),
            /连接未打开/,
        );
        assert.equal(createSchedulerCalls, 0);
    } finally {
        delete require.cache[networkModulePath];
        restoreCrypto();
        restoreBreaker();
        restoreStore();
        restoreUtils();
        restoreProto();
        restoreStats();
        restoreStatus();
        restoreScheduler();
        restoreConfig();
    }
});
