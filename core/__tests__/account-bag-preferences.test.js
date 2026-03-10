const test = require('node:test');
const assert = require('node:assert/strict');

const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const accountBagPreferencesModulePath = require.resolve('../src/services/account-bag-preferences');

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

function createMysqlMock(initialState = {}) {
    const state = {
        accounts: Array.isArray(initialState.accounts) ? initialState.accounts.map(item => ({ ...item })) : [],
        preferences: Array.isArray(initialState.preferences) ? initialState.preferences.map(item => ({ ...item })) : [],
    };

    async function handleQuery(sql, params = []) {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

        if (normalizedSql.startsWith('select purchase_memory, activity_history from account_bag_preferences where account_id = ?')) {
            const accountId = String(params[0] || '');
            const row = state.preferences.find(item => String(item.account_id) === accountId) || null;
            return [row ? [row] : []];
        }

        if (normalizedSql.startsWith('insert into account_bag_preferences')) {
            const accountId = String(params[params.length - 1] || '');
            const account = state.accounts.find(item => String(item.id) === accountId);
            if (!account) {
                return [{ affectedRows: 0 }];
            }

            const nextRow = {
                id: state.preferences.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
                account_id: account.id,
                purchase_memory: params[0],
                activity_history: params[1],
            };
            const existingIndex = state.preferences.findIndex(item => String(item.account_id) === accountId);
            if (existingIndex >= 0) {
                nextRow.id = state.preferences[existingIndex].id;
                state.preferences[existingIndex] = nextRow;
            } else {
                state.preferences.push(nextRow);
            }
            return [{ affectedRows: 1 }];
        }

        return [[]];
    }

    return {
        getPool() {
            return {
                query: handleQuery,
                execute: handleQuery,
            };
        },
        __state: state,
    };
}

test('account bag preferences persist purchase memory and activity history per account', async () => {
    const mysqlMock = createMysqlMock({
        accounts: [{ id: 101 }],
    });
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);

    try {
        delete require.cache[accountBagPreferencesModulePath];
        const { getAccountBagPreferences, saveAccountBagPreferences } = require(accountBagPreferencesModulePath);

        const saved = await saveAccountBagPreferences('101', {
            purchaseMemory: {
                'mall:1': { count: 3, lastPurchasedAt: 1710000000000, name: '神奇肥料' },
            },
            activityHistory: [
                {
                    ts: 1710000000001,
                    type: 'purchase',
                    title: '神奇肥料 x3',
                    summary: '购买成功',
                    goodsId: 1,
                },
            ],
        });

        assert.deepEqual(saved, {
            purchaseMemory: {
                'mall:1': { count: 3, lastPurchasedAt: 1710000000000, name: '神奇肥料' },
            },
            activityHistory: [
                {
                    ts: 1710000000001,
                    type: 'purchase',
                    sourceType: '',
                    entryKey: '',
                    goodsId: 1,
                    goodsName: '',
                    itemId: 0,
                    itemName: '',
                    interactionType: '',
                    title: '神奇肥料 x3',
                    summary: '购买成功',
                    count: 0,
                    soldCount: 0,
                    soldKinds: 0,
                    goldEarned: 0,
                    sectionLabel: '',
                    priceLabel: '',
                    itemIds: [],
                    landIds: [],
                    details: [],
                },
            ],
        });

        const loaded = await getAccountBagPreferences('101');
        assert.deepEqual(loaded, saved);
        assert.equal(mysqlMock.__state.preferences.length, 1);
    } finally {
        delete require.cache[accountBagPreferencesModulePath];
        restoreMysql();
    }
});
