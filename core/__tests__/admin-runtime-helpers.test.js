const test = require('node:test');
const assert = require('node:assert/strict');

const {
    createAccountRuntimeHelpers,
    createTrialRateLimiter,
    createUpdateLogParser,
} = require('../src/controllers/admin/runtime-helpers');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

test('createAccountRuntimeHelpers falls back to snapshot accounts and resolves ids across runtime aliases', async () => {
    const helperCalls = [];
    let providerState = {
        getAccounts: async () => {
            throw new Error('runtime unavailable');
        },
        resolveAccountId: async (input) => {
            helperCalls.push(['resolveAccountId', input]);
            return '';
        },
    };
    const helpers = createAccountRuntimeHelpers({
        getProvider: () => providerState,
        getAccountsSnapshot: async () => ({
            accounts: [
                { id: 'acc-1', accountId: 'account-1', qq: '10001', username: 'alice' },
                { id: 'acc-2', accountId: 'account-2', qq: '10002', username: 'bob' },
            ],
        }),
        normalizeAccountRef: (value) => String(value || '').trim(),
        resolveAccountId: (accounts, input) => {
            helperCalls.push(['fallbackResolve', input]);
            return accounts.find((item) => item.qq === input || item.username === input)?.id || '';
        },
    });

    const snapshot = await helpers.getAccountSnapshotById('10002');
    assert.equal(snapshot.id, 'acc-2');

    const resolvedByFallback = await helpers.resolveAccId(' alice ');
    assert.equal(resolvedByFallback, 'acc-1');

    providerState = {
        getAccounts: async () => ({ accounts: [{ id: 'acc-9', qq: '90009', username: 'worker' }] }),
        resolveAccountId: async (input) => {
            helperCalls.push(['resolveAccountId', input]);
            return input === 'worker' ? 'acc-9' : '';
        },
    };

    const accountList = await helpers.getAccountList();
    assert.deepEqual(accountList, [{ id: 'acc-9', qq: '90009', username: 'worker' }]);
    assert.equal(await helpers.resolveAccId('worker'), 'acc-9');
    assert.deepEqual(helperCalls, [
        ['resolveAccountId', 'alice'],
        ['fallbackResolve', 'alice'],
        ['resolveAccountId', 'worker'],
    ]);
});

test('createAccountRuntimeHelpers maps soft runtime errors to 200 json and hard errors to 500', () => {
    const helpers = createAccountRuntimeHelpers({
        getProvider: () => null,
        getAccountsSnapshot: async () => ({ accounts: [] }),
        normalizeAccountRef: (value) => String(value || '').trim(),
        resolveAccountId: () => '',
    });

    const softRes = createResponse();
    helpers.handleApiError(softRes, new Error('账号未运行'));
    assert.equal(softRes.statusCode, 200);
    assert.deepEqual(softRes.body, { ok: false, error: '账号未运行' });
    assert.equal(helpers.isSoftRuntimeError(new Error('API Timeout')), true);

    const hardRes = createResponse();
    helpers.handleApiError(hardRes, new Error('boom'));
    assert.equal(hardRes.statusCode, 500);
    assert.deepEqual(hardRes.body, { ok: false, error: 'boom' });
});

test('createAccountRuntimeHelpers getAccId reads x-account-id header through resolveAccId', async () => {
    const helpers = createAccountRuntimeHelpers({
        getProvider: () => ({
            resolveAccountId: async () => 'acc-3',
        }),
        getAccountsSnapshot: async () => ({ accounts: [] }),
        normalizeAccountRef: (value) => String(value || '').trim(),
        resolveAccountId: () => '',
    });

    const accountId = await helpers.getAccId({
        headers: { 'x-account-id': '  qq-ref  ' },
    });

    assert.equal(accountId, 'acc-3');
});

test('createTrialRateLimiter enforces per-ip window and resets after expiration', () => {
    const trialRateLimitMap = new Map();
    const limiter = createTrialRateLimiter({
        getClientIP: () => '1.2.3.4',
        trialRateLimitMap,
        windowMs: 1000,
        maxCalls: 2,
    });

    const okRes1 = createResponse();
    let nextCount = 0;
    limiter({}, okRes1, () => {
        nextCount += 1;
    });
    limiter({}, createResponse(), () => {
        nextCount += 1;
    });

    const blockedRes = createResponse();
    limiter({}, blockedRes, () => {
        nextCount += 1;
    });

    assert.equal(nextCount, 2);
    assert.equal(blockedRes.statusCode, 429);
    assert.match(blockedRes.body.error, /体验卡申请频率过高/);

    const record = trialRateLimitMap.get('1.2.3.4');
    record.resetTime = Date.now() - 1;
    const afterResetRes = createResponse();
    limiter({}, afterResetRes, () => {
        nextCount += 1;
    });
    assert.equal(nextCount, 3);
    assert.equal(afterResetRes.statusCode, 200);
});

test('createUpdateLogParser parses entries, extracts version and caches within ttl', () => {
    const fileReads = [];
    let nowMs = 1000;
    const parser = createUpdateLogParser({
        fsRef: {
            existsSync: () => true,
            readFileSync: (target, encoding) => {
                fileReads.push([target, encoding]);
                return [
                    '2026-03-10 前端：v4.5.18 管理面板优化',
                    '修复了跨日礼包逻辑',
                    '',
                    '2026-03-09 服务器维护',
                    '例行巡检完成',
                ].join('\n');
            },
        },
        pathRef: {
            join: (...parts) => parts.join('/'),
        },
        baseDir: '/workspace/core/src/controllers',
        cacheTtlMs: 500,
        nowFn: () => nowMs,
    });

    const first = parser();
    const second = parser();
    nowMs = 2000;
    const third = parser();

    assert.equal(fileReads.length, 2);
    assert.deepEqual(first, [
        {
            date: '2026-03-10',
            title: '前端：v4.5.18 管理面板优化',
            version: 'v4.5.18',
            content: '修复了跨日礼包逻辑',
        },
        {
            date: '2026-03-09',
            title: '服务器维护',
            version: '',
            content: '例行巡检完成',
        },
    ]);
    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
    assert.deepEqual(fileReads.map(([target]) => target), [
        '/workspace/core/src/controllers/../../../logs/development/Update.log',
        '/workspace/core/src/controllers/../../../logs/development/Update.log',
    ]);
});
