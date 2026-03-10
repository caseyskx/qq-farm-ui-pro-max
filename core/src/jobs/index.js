function initJobs({
    createSchedulerRef = null,
    startLogCleanupJobRef = null,
    startDailyStatsJobRef = null,
} = {}) {
    const createScheduler = createSchedulerRef || require('../services/scheduler').createScheduler;
    const startLogCleanupJob = startLogCleanupJobRef || require('./logCleanupJob').startLogCleanupJob;
    const startDailyStatsJob = startDailyStatsJobRef || require('./dailyStatsJob').startDailyStatsJob;

    const jobScheduler = createScheduler('system-jobs');

    // 启动日志清理任务（保留最近7天记录）
    startLogCleanupJob(jobScheduler);

    // 启动每日数据汇总任务（记录每日收益数据）
    startDailyStatsJob(jobScheduler);

    return {
        scheduler: jobScheduler,
        stop() {
            if (jobScheduler && typeof jobScheduler.clearAll === 'function') {
                jobScheduler.clearAll();
            }
            if (jobScheduler && typeof jobScheduler.destroy === 'function') {
                jobScheduler.destroy();
            }
        },
    };
}

module.exports = { initJobs };
