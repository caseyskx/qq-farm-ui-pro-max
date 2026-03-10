const test = require('node:test');
const assert = require('node:assert/strict');

const databasePath = require.resolve('../src/services/database');
const mysqlPath = require.resolve('../src/services/mysql-db');
const redisPath = require.resolve('../src/services/redis-cache');

test('closeDatabase flushes shutdown sequence through redis and mysql closers', async () => {
    const mysqlDb = require(mysqlPath);
    const redisCache = require(redisPath);
    const originalCloseMysql = mysqlDb.closeMysql;
    const originalIsMysqlInitialized = mysqlDb.isMysqlInitialized;
    const originalCloseRedis = redisCache.closeRedis;
    const calls = [];
    let mysqlInitialized = true;

    mysqlDb.closeMysql = async () => {
        calls.push('closeMysql');
        mysqlInitialized = false;
    };
    mysqlDb.isMysqlInitialized = () => mysqlInitialized;
    redisCache.closeRedis = async () => {
        calls.push('closeRedis');
    };

    delete require.cache[databasePath];

    try {
        const database = require(databasePath);
        await database.closeDatabase();
        assert.deepEqual(calls, ['closeRedis', 'closeMysql']);
    } finally {
        mysqlDb.closeMysql = originalCloseMysql;
        mysqlDb.isMysqlInitialized = originalIsMysqlInitialized;
        redisCache.closeRedis = originalCloseRedis;
        delete require.cache[databasePath];
    }
});
