const test = require('node:test');
const assert = require('node:assert/strict');

const axiosModulePath = require.resolve('axios');
const qwenAssistantModulePath = require.resolve('../src/services/qwenAIAssistant');
const contextManagerModulePath = require.resolve('../src/services/contextManager');
const serviceLoggerModulePath = require.resolve('../src/services/logger');
const openVikingClientModulePath = require.resolve('../../services/openviking/client');

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

function createLoggerMock(records) {
    return {
        createModuleLogger(moduleName) {
            return {
                info(message, meta = {}) {
                    records.push({ level: 'info', moduleName, message, meta });
                },
                warn(message, meta = {}) {
                    records.push({ level: 'warn', moduleName, message, meta });
                },
                error(message, meta = {}) {
                    records.push({ level: 'error', moduleName, message, meta });
                },
                debug(message, meta = {}) {
                    records.push({ level: 'debug', moduleName, message, meta });
                },
            };
        },
    };
}

test('requiring qwen assistant stays quiet until API key is actually needed', async () => {
    const loggerRecords = [];
    const previousApiKey = process.env.DASHSCOPE_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;

    const restoreLogger = mockModule(serviceLoggerModulePath, createLoggerMock(loggerRecords));
    const restoreAxios = mockModule(axiosModulePath, {
        create() {
            return {
                async post() {
                    throw new Error('should not call axios when api key is missing');
                },
            };
        },
    });
    const restoreContextManager = mockModule(contextManagerModulePath, {
        contextManager: {
            isEnabled() {
                return false;
            },
        },
    });

    try {
        delete require.cache[qwenAssistantModulePath];
        const { qwenAIAssistant } = require(qwenAssistantModulePath);

        assert.equal(
            loggerRecords.some(record => record.moduleName === 'qwen-ai-assistant' && record.message.includes('未配置 DASHSCOPE_API_KEY')),
            false,
        );

        await assert.rejects(
            qwenAIAssistant.generateWithContext('hello'),
            /未配置 DASHSCOPE_API_KEY/,
        );

        assert.equal(
            loggerRecords.some(record => record.moduleName === 'qwen-ai-assistant' && record.message.includes('未配置 DASHSCOPE_API_KEY') && record.level === 'error'),
            true,
        );
    } finally {
        delete require.cache[qwenAssistantModulePath];
        restoreContextManager();
        restoreAxios();
        restoreLogger();
        if (previousApiKey === undefined) delete process.env.DASHSCOPE_API_KEY;
        else process.env.DASHSCOPE_API_KEY = previousApiKey;
    }
});

test('requiring contextManager uses service logger path and exports singleton normally', () => {
    const loggerRecords = [];
    const restoreLogger = mockModule(serviceLoggerModulePath, createLoggerMock(loggerRecords));
    const restoreOpenVikingClient = mockModule(openVikingClientModulePath, class FakeOpenVikingClient {});

    try {
        delete require.cache[contextManagerModulePath];
        const contextManagerModule = require(contextManagerModulePath);
        assert.equal(typeof contextManagerModule.ContextManager, 'function');
        assert.equal(typeof contextManagerModule.contextManager, 'object');
        assert.deepEqual(loggerRecords, []);
    } finally {
        delete require.cache[contextManagerModulePath];
        restoreOpenVikingClient();
        restoreLogger();
    }
});
