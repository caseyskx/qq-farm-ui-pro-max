const test = require('node:test');
const assert = require('node:assert/strict');

const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const redisCacheModulePath = require.resolve('../src/services/redis-cache');
const circuitBreakerModulePath = require.resolve('../src/services/circuit-breaker');
const jwtServiceModulePath = require.resolve('../src/services/jwt-service');
const loggerModulePath = require.resolve('../src/services/logger');
const databaseModulePath = require.resolve('../src/services/database');

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

function createLoggerMock() {
    return {
        createModuleLogger() {
            return {
                info() {},
                warn() {},
                error() {},
                debug() {},
            };
        },
    };
}

test('mergeFriendsCache preserves meaningful fields while adding visitor seeds', async () => {
    const kv = new Map();
    const redis = {
        async set(key, value) {
            kv.set(String(key), String(value));
        },
        async get(key) {
            return kv.get(String(key)) || null;
        },
        async keys(pattern) {
            if (pattern !== 'account:*:friends_cache') return [];
            return Array.from(kv.keys()).filter(key => /^account:.+:friends_cache$/.test(key));
        },
    };

    const restoreMysqlDb = mockModule(mysqlDbModulePath, {
        async initMysql() {},
        async closeMysql() {},
        getPool() {
            return {
                query: async () => [[]],
                execute: async () => [[]],
            };
        },
        isMysqlInitialized() {
            return true;
        },
    });
    const restoreRedisCache = mockModule(redisCacheModulePath, {
        async initRedis() { return true; },
        async closeRedis() {},
        getRedisClient() { return redis; },
    });
    const restoreCircuitBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            isAvailable() { return true; },
            recordSuccess() {},
            recordFailure() {},
        },
    });
    const restoreJwtService = mockModule(jwtServiceModulePath, {
        async initJwtSecretPersistence() {},
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[databaseModulePath];
        const { updateFriendsCache, mergeFriendsCache, getCachedFriends } = require(databaseModulePath);

        await updateFriendsCache('acc-1', [
            { gid: 1001, uin: '123456', name: '老朋友', avatarUrl: 'https://img/a.png' },
        ]);
        await mergeFriendsCache('acc-1', [
            { gid: 1001, name: 'GID:1001', avatarUrl: '' },
            { gid: 1002, name: '', avatarUrl: '' },
        ]);

        const friends = await getCachedFriends('acc-1');
        assert.deepEqual(friends, [
            { gid: 1001, uin: '123456', name: '老朋友', avatarUrl: 'https://img/a.png' },
            { gid: 1002, uin: '', name: 'GID:1002', avatarUrl: '' },
        ]);
    } finally {
        delete require.cache[databaseModulePath];
        restoreLogger();
        restoreJwtService();
        restoreCircuitBreaker();
        restoreRedisCache();
        restoreMysqlDb();
    }
});

test('findReusableFriendsCache can reuse historical cache for the same QQ self gid', async () => {
    const kv = new Map();
    const redis = {
        async set(key, value) {
            kv.set(String(key), String(value));
        },
        async get(key) {
            return kv.get(String(key)) || null;
        },
        async keys(pattern) {
            if (pattern !== 'account:*:friends_cache') return [];
            return Array.from(kv.keys()).filter(key => /^account:.+:friends_cache$/.test(key)).sort();
        },
    };

    const restoreMysqlDb = mockModule(mysqlDbModulePath, {
        async initMysql() {},
        async closeMysql() {},
        getPool() {
            return {
                query: async () => [[]],
                execute: async () => [[]],
            };
        },
        isMysqlInitialized() {
            return true;
        },
    });
    const restoreRedisCache = mockModule(redisCacheModulePath, {
        async initRedis() { return true; },
        async closeRedis() {},
        getRedisClient() { return redis; },
    });
    const restoreCircuitBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            isAvailable() { return true; },
            recordSuccess() {},
            recordFailure() {},
        },
    });
    const restoreJwtService = mockModule(jwtServiceModulePath, {
        async initJwtSecretPersistence() {},
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[databaseModulePath];
        const { updateFriendsCache, findReusableFriendsCache } = require(databaseModulePath);

        await updateFriendsCache('1008', [
            { gid: 1087791399, name: '悠然恍若隔世梦', avatarUrl: 'https://img/self.png' },
            { gid: 1098611337, name: '未来可期', avatarUrl: 'https://img/friend.png' },
        ]);
        await updateFriendsCache('1009', [
            { gid: 2000000001, name: '其他账号', avatarUrl: 'https://img/other.png' },
        ]);

        const reusable = await findReusableFriendsCache('1016', {
            selfGid: 1087791399,
            selfName: '悠然恍若隔世梦',
        });

        assert.deepEqual(reusable, {
            sourceAccountId: '1008',
            friends: [
                { gid: 1087791399, uin: '', name: '悠然恍若隔世梦', avatarUrl: 'https://img/self.png' },
                { gid: 1098611337, uin: '', name: '未来可期', avatarUrl: 'https://img/friend.png' },
            ],
        });
    } finally {
        delete require.cache[databaseModulePath];
        restoreLogger();
        restoreJwtService();
        restoreCircuitBreaker();
        restoreRedisCache();
        restoreMysqlDb();
    }
});

test('findReusableFriendsCache can reuse related account cache by same QQ nickname when self gid is not cached', async () => {
    const kv = new Map();
    const redis = {
        async set(key, value) {
            kv.set(String(key), String(value));
        },
        async get(key) {
            return kv.get(String(key)) || null;
        },
        async keys(pattern) {
            if (pattern !== 'account:*:friends_cache') return [];
            return Array.from(kv.keys()).filter(key => /^account:.+:friends_cache$/.test(key)).sort();
        },
    };

    const restoreMysqlDb = mockModule(mysqlDbModulePath, {
        async initMysql() {},
        async closeMysql() {},
        getPool() {
            return {
                query: async (sql, params) => {
                    if (String(sql).includes('FROM accounts WHERE id <> ? AND platform = ?')) {
                        assert.deepEqual(params, ['1002', 'qq']);
                        return [[
                            {
                                id: '1001',
                                uin: '__ACCOUNT_ID__:1001',
                                nick: '',
                                name: '悠然恍若隔世梦',
                                platform: 'qq',
                                auth_data: JSON.stringify({ qq: '416409364', uin: '416409364' }),
                                last_login_at: new Date('2026-03-11T00:23:28.000Z'),
                                updated_at: new Date('2026-03-11T00:23:28.000Z'),
                            },
                        ]];
                    }
                    return [[]];
                },
                execute: async () => [[]],
            };
        },
        isMysqlInitialized() {
            return true;
        },
    });
    const restoreRedisCache = mockModule(redisCacheModulePath, {
        async initRedis() { return true; },
        async closeRedis() {},
        getRedisClient() { return redis; },
    });
    const restoreCircuitBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            isAvailable() { return true; },
            recordSuccess() {},
            recordFailure() {},
        },
    });
    const restoreJwtService = mockModule(jwtServiceModulePath, {
        async initJwtSecretPersistence() {},
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[databaseModulePath];
        const { updateFriendsCache, findReusableFriendsCache } = require(databaseModulePath);

        await updateFriendsCache('1001', [
            { gid: 1093441253, name: '♡', avatarUrl: 'https://img/a.png' },
            { gid: 1172159984, name: '我是大飞哥', avatarUrl: 'https://img/b.png' },
            { gid: 1182182338, name: '桀殇→辉', avatarUrl: 'https://img/c.png' },
        ]);

        const reusable = await findReusableFriendsCache('1002', {
            selfGid: 1087791399,
            selfName: '悠然恍若隔世梦',
            platform: 'qq',
        });

        assert.deepEqual(reusable, {
            sourceAccountId: '1001',
            friends: [
                { gid: 1093441253, uin: '', name: '♡', avatarUrl: 'https://img/a.png' },
                { gid: 1172159984, uin: '', name: '我是大飞哥', avatarUrl: 'https://img/b.png' },
                { gid: 1182182338, uin: '', name: '桀殇→辉', avatarUrl: 'https://img/c.png' },
            ],
        });
    } finally {
        delete require.cache[databaseModulePath];
        restoreLogger();
        restoreJwtService();
        restoreCircuitBreaker();
        restoreRedisCache();
        restoreMysqlDb();
    }
});

test('findFriendInSharedCaches can resolve nickname from another account cache by gid', async () => {
    const kv = new Map();
    const redis = {
        async set(key, value) {
            kv.set(String(key), String(value));
        },
        async get(key) {
            return kv.get(String(key)) || null;
        },
        async keys(pattern) {
            if (pattern !== 'account:*:friends_cache') return [];
            return Array.from(kv.keys()).filter(key => /^account:.+:friends_cache$/.test(key)).sort();
        },
    };

    const restoreMysqlDb = mockModule(mysqlDbModulePath, {
        async initMysql() {},
        async closeMysql() {},
        getPool() {
            return {
                query: async () => [[]],
                execute: async () => [[]],
            };
        },
        isMysqlInitialized() {
            return true;
        },
    });
    const restoreRedisCache = mockModule(redisCacheModulePath, {
        async initRedis() { return true; },
        async closeRedis() {},
        getRedisClient() { return redis; },
    });
    const restoreCircuitBreaker = mockModule(circuitBreakerModulePath, {
        circuitBreaker: {
            isAvailable() { return true; },
            recordSuccess() {},
            recordFailure() {},
        },
    });
    const restoreJwtService = mockModule(jwtServiceModulePath, {
        async initJwtSecretPersistence() {},
    });
    const restoreLogger = mockModule(loggerModulePath, createLoggerMock());

    try {
        delete require.cache[databaseModulePath];
        const { updateFriendsCache, findFriendInSharedCaches } = require(databaseModulePath);

        await updateFriendsCache('1001', [
            { gid: 1172159984, name: '我是大飞哥', avatarUrl: 'https://img/friend.png' },
        ]);
        await updateFriendsCache('1003', [
            { gid: 1172159984, name: 'GID:1172159984', avatarUrl: '' },
        ]);

        const reusable = await findFriendInSharedCaches(1172159984, { accountId: '1003' });

        assert.deepEqual(reusable, {
            sourceAccountId: '1001',
            friend: {
                gid: 1172159984,
                uin: '',
                name: '我是大飞哥',
                avatarUrl: 'https://img/friend.png',
            },
        });
    } finally {
        delete require.cache[databaseModulePath];
        restoreLogger();
        restoreJwtService();
        restoreCircuitBreaker();
        restoreRedisCache();
        restoreMysqlDb();
    }
});
