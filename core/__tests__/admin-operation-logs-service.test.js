const test = require('node:test');
const assert = require('node:assert/strict');

const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const serviceModulePath = require.resolve('../src/services/admin-operation-logs');

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

test('listAdminOperationLogs inlines sanitized limit and keeps filters parameterized', async () => {
    const calls = [];
    const restoreMysql = mockModule(mysqlDbModulePath, {
        getPool() {
            return {
                async query(sql, params) {
                    calls.push({ sql, params });
                    return [[{
                        id: 1,
                        client_id: 'log-1',
                        actor_username: 'admin',
                        scope: 'account_ownership',
                        action_label: '批量转移归属',
                        status: 'success',
                        total_count: 2,
                        success_count: 2,
                        failed_count: 0,
                        affected_names: JSON.stringify(['账号A', '账号B']),
                        failed_names: JSON.stringify([]),
                        detail_lines: JSON.stringify(['成功 2']),
                        created_at: new Date('2026-03-10T08:00:00Z'),
                    }]];
                },
            };
        },
    });

    try {
        delete require.cache[serviceModulePath];
        const service = require(serviceModulePath);

        const items = await service.listAdminOperationLogs({
            actorUsername: 'admin',
            scope: 'account_ownership',
            limit: 24,
        });

        assert.equal(calls.length, 1);
        assert.match(calls[0].sql, /LIMIT 24$/);
        assert.deepEqual(calls[0].params, ['admin', 'account_ownership']);
        assert.equal(items.length, 1);
        assert.equal(items[0].id, 'log-1');
        assert.equal(items[0].scope, 'account_ownership');
    } finally {
        delete require.cache[serviceModulePath];
        restoreMysql();
    }
});
