const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const dataProviderModulePath = require.resolve('../src/runtime/data-provider');
const storeModulePath = require.resolve('../src/models/store');
const systemSettingsModulePath = require.resolve('../src/services/system-settings');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const warehouseModulePath = require.resolve('../src/services/warehouse');

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

function createRuntimePathsMock(rootDir) {
    const dataDir = path.join(rootDir, 'data');
    const logDir = path.join(rootDir, 'logs');
    const resourceRoot = path.join(process.cwd(), 'core', 'src');
    return {
        getResourcePath(...segments) {
            return path.join(resourceRoot, ...segments);
        },
        getDataFile(filename) {
            return path.join(dataDir, filename);
        },
        ensureDataDir() {
            fs.mkdirSync(dataDir, { recursive: true });
            return dataDir;
        },
        ensureLogDir() {
            fs.mkdirSync(logDir, { recursive: true });
            return logDir;
        },
        getAssetCacheDir(...segments) {
            return path.join(dataDir, 'asset-cache', ...segments);
        },
        ensureAssetCacheDir(...segments) {
            const dir = path.join(dataDir, 'asset-cache', ...segments);
            fs.mkdirSync(dir, { recursive: true });
            return dir;
        },
    };
}

function createMysqlMock(initialState = {}) {
    const state = {
        accounts: { ...(initialState.accounts || {}) },
        accountConfigs: { ...(initialState.accountConfigs || {}) },
        systemSettings: { ...(initialState.systemSettings || {}) },
    };

    async function handleQuery(sql, params = []) {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

        if (normalizedSql.startsWith('select * from accounts where id = ?')) {
            const id = String(Array.isArray(params) ? params[0] : '');
            return [[state.accounts[id]].filter(Boolean)];
        }

        if (normalizedSql.startsWith('select * from accounts')) {
            return [Object.values(state.accounts)];
        }

        if (normalizedSql.startsWith('insert into accounts')) {
            const [
                id,
                uin,
                nick,
                name,
                platform,
                running,
                code,
                username,
                avatar,
                lastLoginAt,
                authData,
            ] = params;
            const existing = state.accounts[String(id)] || {};
            state.accounts[String(id)] = {
                id: String(id),
                uin: String(uin || existing.uin || ''),
                nick: String(nick || ''),
                name: String(name || ''),
                platform: String(platform || existing.platform || 'qq'),
                running: Number(running) === 1 ? 1 : 0,
                code: String(code || existing.code || ''),
                username: String(username || ''),
                avatar: String(avatar || existing.avatar || ''),
                last_login_at: lastLoginAt || existing.last_login_at || null,
                auth_data: String(authData || existing.auth_data || ''),
                created_at: existing.created_at || new Date(),
                updated_at: new Date(),
            };
            return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith('delete from accounts where id = ?')) {
            const id = String(Array.isArray(params) ? params[0] : '');
            delete state.accounts[id];
            return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith('select * from account_configs')) {
            return [Object.values(state.accountConfigs)];
        }

        if (normalizedSql.startsWith('insert into account_configs')) {
            const [
                accountId,
                accountMode,
                harvestDelayMin,
                harvestDelayMax,
                plantingStrategy,
                preferredSeedId,
                automationFarm,
                automationFarmPush,
                automationLandUpgrade,
                automationFriend,
                automationFriendSteal,
                automationFriendHelp,
                automationFriendBad,
                automationTask,
                automationEmail,
                automationFreeGifts,
                automationShareReward,
                automationVipGift,
                automationMonthCard,
                automationSell,
                automationFertilizer,
                advancedSettings,
            ] = params;

            state.accountConfigs[String(accountId)] = {
                account_id: String(accountId),
                account_mode: accountMode,
                harvest_delay_min: harvestDelayMin,
                harvest_delay_max: harvestDelayMax,
                planting_strategy: plantingStrategy,
                preferred_seed_id: preferredSeedId,
                automation_farm: automationFarm,
                automation_farm_push: automationFarmPush,
                automation_land_upgrade: automationLandUpgrade,
                automation_friend: automationFriend,
                automation_friend_steal: automationFriendSteal,
                automation_friend_help: automationFriendHelp,
                automation_friend_bad: automationFriendBad,
                automation_task: automationTask,
                automation_email: automationEmail,
                automation_free_gifts: automationFreeGifts,
                automation_share_reward: automationShareReward,
                automation_vip_gift: automationVipGift,
                automation_month_card: automationMonthCard,
                automation_sell: automationSell,
                automation_fertilizer: automationFertilizer,
                advanced_settings: advancedSettings,
            };
            return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith('delete from account_configs where account_id = ?')) {
            const accountId = String(Array.isArray(params) ? params[0] : '');
            delete state.accountConfigs[accountId];
            return [{ affectedRows: 1 }];
        }

        if (normalizedSql.startsWith('select setting_key, setting_value from system_settings')) {
            const keys = Array.isArray(params) ? params.map(item => String(item)) : [];
            const rows = Object.entries(state.systemSettings)
                .filter(([key]) => keys.length === 0 || keys.includes(key))
                .map(([setting_key, value]) => ({
                    setting_key,
                    setting_value: JSON.stringify(value),
                }));
            return [rows];
        }

        if (normalizedSql.startsWith('insert into system_settings')) {
            const [key, value] = params;
            state.systemSettings[String(key)] = JSON.parse(String(value));
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
        async transaction(handler) {
            return await handler({
                query: handleQuery,
                execute: handleQuery,
            });
        },
        __state: state,
    };
}

test('account config archive restores settings when same owner re-adds the same account identity', async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'store-account-identity-archive-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const mysqlMock = createMysqlMock();
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);

    try {
        delete require.cache[dataProviderModulePath];
        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];
        delete require.cache[warehouseModulePath];

        let store = require(storeModulePath);

        const firstCreate = store.addOrUpdateAccount({ name: '主账号', platform: 'qq', uin: '1001', username: 'owner' });
        const firstAccountId = String(firstCreate.touchedAccountId || '');
        store.addOrUpdateAccount({ name: '陪跑号', platform: 'qq', uin: '1002', username: 'owner' });

        store.applyConfigSnapshot({
            intervals: {
                farmMin: 45,
                farmMax: 90,
                friendMin: 600,
                friendMax: 900,
                helpMin: 660,
                helpMax: 930,
                stealMin: 720,
                stealMax: 960,
            },
            friendQuietHours: {
                enabled: true,
                start: '01:30',
                end: '07:45',
            },
            automation: {
                friend: false,
                friend_help: false,
            },
        }, { accountId: firstAccountId });

        await store.persistAccountsNow(['1', '2'], { strict: true });
        await store.flushGlobalConfigSave();

        store.deleteAccount(firstAccountId);
        await store.flushGlobalConfigSave();

        const persistedGlobalConfig = mysqlMock.__state.systemSettings.qq_farm_bot_global_config
            || mysqlMock.__state.systemSettings['qq-farm-bot-global-config']
            || Object.values(mysqlMock.__state.systemSettings)[0];
        assert.ok(persistedGlobalConfig, 'expected global config snapshot to be persisted');
        assert.deepEqual(
            persistedGlobalConfig.accountConfigIdentityArchive['owner::qq::1001'].friendQuietHours,
            { enabled: true, start: '01:30', end: '07:45' },
        );

        delete require.cache[dataProviderModulePath];
        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];
        delete require.cache[warehouseModulePath];

        store = require(storeModulePath);
        await store.loadAllFromDB();

        const recreated = store.addOrUpdateAccount({ name: '主账号-重登', platform: 'qq', uin: '1001', username: 'owner' });
        const recreatedId = String(recreated.touchedAccountId || '');

        assert.notEqual(recreatedId, firstAccountId);
        assert.deepEqual(store.getFriendQuietHours(recreatedId), {
            enabled: true,
            start: '01:30',
            end: '07:45',
        });
        assert.equal(store.getIntervals(recreatedId).friendMin, 600);
        assert.equal(store.getIntervals(recreatedId).friendMax, 900);
        assert.equal(store.getIntervals(recreatedId).helpMin, 660);
        assert.equal(store.getIntervals(recreatedId).stealMax, 960);
        assert.equal(store.getConfigSnapshot(recreatedId).automation.friend, false);
        assert.equal(store.getConfigSnapshot(recreatedId).automation.friend_help, false);
    } finally {
        restoreMysql();
        restoreRuntimePaths();
        delete require.cache[dataProviderModulePath];
        delete require.cache[storeModulePath];
        delete require.cache[systemSettingsModulePath];
        delete require.cache[warehouseModulePath];
    }
});
