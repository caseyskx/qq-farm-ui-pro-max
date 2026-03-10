function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function cleanupExpiredTrialRateLimitEntries(trialRateLimitMap, nowMs = Date.now()) {
    for (const [ip, record] of trialRateLimitMap.entries()) {
        if (nowMs > record.resetTime) {
            trialRateLimitMap.delete(ip);
        }
    }
}

function createDailySettlementRunner({
    getProvider,
    getPool,
    adminLogger,
    getNow = () => new Date(),
}) {
    let lastCronSyncDate = '';

    return async () => {
        try {
            const now = getNow();
            const todayStr = now.toISOString().split('T')[0];
            if (lastCronSyncDate === todayStr) {
                adminLogger.warn(`【CRON】清算拦截: 今日 (${todayStr}) 的账单已聚合写库，防止 Dirty Write 双倍数据`);
                return;
            }
            lastCronSyncDate = todayStr;

            adminLogger.info('触发每日系统产出清算，正在聚合所有运行中账号收益并落表...');

            const provider = getProvider();
            if (!provider || typeof provider.getAccounts !== 'function') {
                return;
            }

            const data = await provider.getAccounts();
            if (!data || !Array.isArray(data.accounts)) {
                return;
            }

            let totalExp = 0;
            let totalGold = 0;
            let totalSteal = 0;
            let totalHelp = 0;

            for (const account of data.accounts) {
                if (!account.stats) {
                    continue;
                }
                totalExp += (account.stats.sessionExpGained || 0);
                totalGold += (account.stats.sessionGoldGained || 0);
                totalSteal += (account.stats.operations?.steal || 0);
                totalHelp += (account.stats.operations?.helpWater || 0)
                    + (account.stats.operations?.helpWeed || 0)
                    + (account.stats.operations?.helpBug || 0);

                account.stats.sessionExpGained = 0;
                account.stats.sessionGoldGained = 0;
                if (account.stats.operations) {
                    account.stats.operations.steal = 0;
                    account.stats.operations.helpWater = 0;
                    account.stats.operations.helpWeed = 0;
                    account.stats.operations.helpBug = 0;
                }
            }

            const pool = getPool();
            if (!pool) {
                return;
            }

            const recordDate = formatDateKey(now);
            await pool.query(
                `INSERT INTO stats_daily (record_date, total_exp, total_gold, total_steal, total_help) 
                 VALUES (?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 total_exp = total_exp + VALUES(total_exp), 
                 total_gold = total_gold + VALUES(total_gold), 
                 total_steal = total_steal + VALUES(total_steal), 
                 total_help = total_help + VALUES(total_help)`,
                [recordDate, totalExp, totalGold, totalSteal, totalHelp],
            );
            adminLogger.info(`【CRON】清算完成: 经验+${totalExp}, 金币+${totalGold}, 偷取+${totalSteal}`);
        } catch (error) {
            adminLogger.error('CRON 清算产生异常:', error.message);
        }
    };
}

function registerAdminMaintenanceTasks({
    cronRef,
    getProvider,
    getPool,
    adminLogger,
    trialRateLimitMap,
    jwtService,
    setIntervalRef = setInterval,
    clearIntervalRef = clearInterval,
    getNow,
    trialCleanupIntervalMs = 60 * 60 * 1000,
    tokenCleanupIntervalMs = 60 * 60 * 1000,
}) {
    const runDailySettlement = createDailySettlementRunner({
        getProvider,
        getPool,
        adminLogger,
        getNow,
    });

    const dailyTask = cronRef.schedule('50 59 23 * * *', runDailySettlement);
    const trialCleanupHandle = setIntervalRef(() => {
        cleanupExpiredTrialRateLimitEntries(trialRateLimitMap);
    }, trialCleanupIntervalMs);
    const tokenCleanupHandle = setIntervalRef(() => {
        jwtService.cleanExpiredTokens();
    }, tokenCleanupIntervalMs);

    jwtService.cleanExpiredTokens();

    return {
        runDailySettlement,
        stop() {
            if (dailyTask && typeof dailyTask.stop === 'function') {
                dailyTask.stop();
            }
            if (dailyTask && typeof dailyTask.destroy === 'function') {
                dailyTask.destroy();
            }
            clearIntervalRef(trialCleanupHandle);
            clearIntervalRef(tokenCleanupHandle);
        },
    };
}

module.exports = {
    formatDateKey,
    cleanupExpiredTrialRateLimitEntries,
    createDailySettlementRunner,
    registerAdminMaintenanceTasks,
};
