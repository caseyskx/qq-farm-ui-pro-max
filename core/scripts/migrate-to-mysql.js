#!/usr/bin/env node

/**
 * JSON 到 MySQL 数据迁移脚本
 * 
 * 使用方法：
 * node scripts/migrate-to-mysql.js
 * 
 */

const fs = require('fs');
const path = require('path');
const { getDataFile } = require('../src/config/runtime-paths');
const { initMysql, getPool } = require('../src/services/mysql-db');

// 文件路径
const OLD_STORE = getDataFile('store.json');
const OLD_ACCOUNTS = getDataFile('accounts.json');
const OLD_USERS = getDataFile('users.json');
const OLD_CARDS = getDataFile('cards.json');

// 备份路径
const BACKUP_DIR = getDataFile('backup');
const BACKUP_DATE = new Date().toISOString().replace(/[:.]/g, '-');

console.log('========================================');
console.log('  QA 农场机器人 - 数据迁移工具 (To MySQL)');
console.log('========================================\n');

/**
 * 备份旧数据文件
 */
function backupOldFiles() {
    console.log('📦 步骤 1: 备份旧数据文件...');

    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const filesToBackup = [
        OLD_STORE,
        OLD_ACCOUNTS,
        OLD_USERS,
        OLD_CARDS,
    ];

    let backedUp = 0;
    filesToBackup.forEach(file => {
        if (fs.existsSync(file)) {
            const backupPath = path.join(
                BACKUP_DIR,
                `${path.basename(file)}.${BACKUP_DATE}.mysqlbak`
            );
            fs.copyFileSync(file, backupPath);
            console.log(`  ✅ 已备份：${file}`);
            backedUp++;
        } else {
            console.log(`  ⚠️  文件不存在，跳过：${file}`);
        }
    });

    console.log(`✅ 备份完成，共 ${backedUp} 个文件\n`);
}

/**
 * 迁移用户数据
 */
async function migrateUsers(pool) {
    console.log('📦 步骤 2: 迁移用户数据...');

    if (!fs.existsSync(OLD_USERS)) {
        console.log('  ⚠️  用户文件不存在，跳过\n');
        return 0;
    }

    const usersData = JSON.parse(fs.readFileSync(OLD_USERS, 'utf8'));
    const users = usersData.users || [];

    let migrated = 0;
    for (const user of users) {
        try {
            const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [user.username]);
            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)`,
                    [user.username, user.password, user.role || 'user']
                );
                migrated++;
                console.log(`  ✅ 迁移用户：${user.username}`);
            } else {
                console.log(`  ⏭️  用户已存在，跳过：${user.username}`);
            }
        } catch (error) {
            console.log(`  ❌ 迁移用户失败：${user.username}`, error.message);
        }
    }

    console.log(`✅ 用户迁移完成，共插入 ${migrated} 个新用户\n`);
    return migrated;
}

/**
 * 迁移卡密数据
 */
async function migrateCards(pool) {
    console.log('📦 步骤 3: 迁移卡密数据...');

    if (!fs.existsSync(OLD_CARDS)) {
        console.log('  ⚠️  卡密文件不存在，跳过\n');
        return 0;
    }

    const cardsData = JSON.parse(fs.readFileSync(OLD_CARDS, 'utf8'));
    const cards = cardsData.cards || [];

    let migrated = 0;
    for (const card of cards) {
        try {
            const [existing] = await pool.query('SELECT id FROM cards WHERE code = ?', [card.code]);
            if (existing.length === 0) {
                await pool.query(
                    `INSERT INTO cards (code, type, description, enabled, expires_at) VALUES (?, ?, ?, ?, ?)`,
                    [
                        card.code,
                        card.type || 'month',
                        card.description || '',
                        card.enabled !== false ? 1 : 0,
                        card.expiresAt ? new Date(card.expiresAt) : null
                    ]
                );
                migrated++;
                console.log(`  ✅ 迁移卡密：${card.code}`);
            } else {
                console.log(`  ⏭️  卡密已存在，跳过：${card.code}`);
            }
        } catch (error) {
            console.log(`  ❌ 迁移卡密失败：${card.code}`, error.message);
        }
    }

    console.log(`✅ 卡密迁移完成，共插入 ${migrated} 个新卡密\n`);
    return migrated;
}


/**
 * 迁移账号与配置数据
 */
async function migrateAccountsAndConfigs(pool) {
    console.log('📦 步骤 4: 迁移游戏账号与配置数据...');

    let accounts = [];
    if (fs.existsSync(OLD_ACCOUNTS)) {
        const accountsData = JSON.parse(fs.readFileSync(OLD_ACCOUNTS, 'utf8'));
        accounts = accountsData.accounts || [];
    } else {
        console.log('  ⚠️  账号文件不存在\n');
    }

    let storeData = {};
    if (fs.existsSync(OLD_STORE)) {
        storeData = JSON.parse(fs.readFileSync(OLD_STORE, 'utf8'));
    } else {
        console.log('  ⚠️  store文件不存在\n');
    }

    let migrated = 0;
    for (const acc of accounts) {
        try {
            // Check account existence
            const [existing] = await pool.query('SELECT id FROM accounts WHERE uin = ?', [acc.uin]);
            let accountId;

            if (existing.length === 0) {
                const [result] = await pool.query(
                    `INSERT INTO accounts (uin, nick, name, platform, running) VALUES (?, ?, ?, ?, ?)`,
                    [
                        acc.uin,
                        acc.nick || '',
                        acc.name || '',
                        acc.platform || 'qq',
                        acc.running ? 1 : 0
                    ]
                );
                accountId = result.insertId;

                // If we just inserted, insert into account_configs to build base frame
                await pool.query(`INSERT INTO account_configs (account_id) VALUES (?)`, [accountId]);
                console.log(`  ✅ 迁移账号：${acc.uin} (${acc.name || acc.nick || '未命名'})`);
            } else {
                accountId = existing[0].id;
                console.log(`  ⏭️  账号已存在，将合入配置更新：${acc.uin}`);
            }

            // Sync Config
            if (storeData.accountConfigs && storeData.accountConfigs[acc.id]) {
                const cfg = storeData.accountConfigs[acc.id];

                let automationKeys = {};
                if (cfg.automation) {
                    automationKeys = { ...cfg.automation };
                }
                const advSetting = JSON.stringify({
                    intervals: cfg.intervals || {},
                    friendQuietHours: cfg.friendQuietHours || {},
                    friendBlacklist: cfg.friendBlacklist || [],
                    ui: storeData.ui || {}
                });

                await pool.query(`
                    UPDATE account_configs 
                    SET 
                        planting_strategy = ?,
                        preferred_seed_id = ?,
                        automation_farm = ?,
                        automation_farm_push = ?,
                        automation_land_upgrade = ?,
                        automation_friend = ?,
                        automation_friend_steal = ?,
                        automation_friend_help = ?,
                        automation_friend_bad = ?,
                        automation_task = ?,
                        automation_email = ?,
                        automation_free_gifts = ?,
                        automation_share_reward = ?,
                        automation_vip_gift = ?,
                        automation_month_card = ?,
                        automation_sell = ?,
                        automation_fertilizer = ?,
                        advanced_settings = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE account_id = ?
                `, [
                    cfg.plantingStrategy || 'preferred',
                    cfg.preferredSeedId || 0,
                    automationKeys.farm === false ? 0 : 1,
                    automationKeys.farm_push === false ? 0 : 1,
                    automationKeys.land_upgrade === false ? 0 : 1,
                    automationKeys.friend === false ? 0 : 1,
                    automationKeys.friend_steal === false ? 0 : 1,
                    automationKeys.friend_help === false ? 0 : 1,
                    automationKeys.friend_bad === true ? 1 : 0,
                    automationKeys.task === false ? 0 : 1,
                    automationKeys.email === false ? 0 : 1,
                    automationKeys.free_gifts === false ? 0 : 1,
                    automationKeys.share_reward === false ? 0 : 1,
                    automationKeys.vip_gift === false ? 0 : 1,
                    automationKeys.month_card === false ? 0 : 1,
                    automationKeys.sell === false ? 0 : 1,
                    automationKeys.fertilizer || 'none',
                    advSetting,
                    accountId
                ]);
                console.log(`    ✅ 覆盖配置信息`);
            }

            migrated++;
        } catch (error) {
            console.log(`  ❌ 处理账号/配置失败：${acc.uin}`, error.message);
        }
    }

    console.log(`✅ 账号配置迁移/更新完成，共处理 ${migrated} 个终端\n`);
    return migrated;
}

/**
 * 主函数
 */
async function main() {
    try {
        const startTime = Date.now();

        // 1. 备份旧文件
        backupOldFiles();

        // 2. 初始化数据库 (触发自动建表)
        console.log('📦 正在连接和校验 MySQL...');
        await initMysql();
        const pool = getPool();

        // 3. 迁移数据
        await migrateUsers(pool);
        await migrateCards(pool);
        await migrateAccountsAndConfigs(pool);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('========================================');
        console.log('  ✅ 数据迁移到 MySQL 完成！');
        console.log(`  ⏱️  耗时：${duration}秒`);
        console.log('========================================\n');

        console.log('📋 后续步骤：');
        console.log('  1. 请重启服务以使数据库底层应用');
        console.log('  2. 如有问题，可从备份恢复\n');
        console.log('💾 备份文件位置：', BACKUP_DIR);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ 迁移失败:', error);
        process.exit(1);
    }
}

// 运行迁移
main();
