const MODULE_CACHE_KEYS = Object.freeze({
    sessionControlRuntimeModule: require.resolve('./modules/session-control-runtime-module'),
    farmRuntimeModule: require.resolve('./modules/farm-runtime-module'),
    friendRuntimeModule: require.resolve('./modules/friend-runtime-module'),
    taskRuntimeModule: require.resolve('./modules/task-runtime-module'),
    warehouseRuntimeModule: require.resolve('./modules/warehouse-runtime-module'),
    farmService: require.resolve('../services/farm'),
    friendService: require.resolve('../services/friend'),
    friendActionsService: require.resolve('../services/friend/friend-actions'),
    friendDecisionService: require.resolve('../services/friend/friend-decision'),
    friendScannerService: require.resolve('../services/friend/friend-scanner'),
    friendStateService: require.resolve('../services/friend/friend-state'),
    taskService: require.resolve('../services/task'),
    warehouseService: require.resolve('../services/warehouse'),
    accountModePolicyService: require.resolve('../services/account-mode-policy'),
});
const DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS = 15 * 1000;

function uniqueList(values = []) {
    return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function farmCacheKeys() {
    return [
        MODULE_CACHE_KEYS.farmRuntimeModule,
        MODULE_CACHE_KEYS.farmService,
    ];
}

function friendCacheKeys() {
    return [
        MODULE_CACHE_KEYS.friendRuntimeModule,
        MODULE_CACHE_KEYS.friendService,
        MODULE_CACHE_KEYS.friendActionsService,
        MODULE_CACHE_KEYS.friendDecisionService,
        MODULE_CACHE_KEYS.friendScannerService,
        MODULE_CACHE_KEYS.friendStateService,
        MODULE_CACHE_KEYS.accountModePolicyService,
    ];
}

function taskCacheKeys() {
    return [
        MODULE_CACHE_KEYS.taskRuntimeModule,
        MODULE_CACHE_KEYS.taskService,
    ];
}

function warehouseCacheKeys() {
    return [
        MODULE_CACHE_KEYS.warehouseRuntimeModule,
        MODULE_CACHE_KEYS.warehouseService,
    ];
}

function createRuntimeModuleDefinitions(context = {}) {
    return [
        {
            name: 'session-control',
            reloadable: false,
            cacheKeys: [MODULE_CACHE_KEYS.sessionControlRuntimeModule],
            create() {
                return require('./modules/session-control-runtime-module').createSessionControlRuntimeModule(context);
            },
        },
        {
            name: 'farm',
            reloadable: true,
            cacheKeys: farmCacheKeys(),
            create() {
                return require('./modules/farm-runtime-module').createFarmRuntimeModule(context);
            },
        },
        {
            name: 'friend',
            reloadable: true,
            cacheKeys: friendCacheKeys(),
            create() {
                return require('./modules/friend-runtime-module').createFriendRuntimeModule(context);
            },
        },
        {
            name: 'task',
            reloadable: true,
            cacheKeys: taskCacheKeys(),
            create() {
                return require('./modules/task-runtime-module').createTaskRuntimeModule(context);
            },
        },
        {
            name: 'warehouse',
            reloadable: true,
            cacheKeys: warehouseCacheKeys(),
            create() {
                return require('./modules/warehouse-runtime-module').createWarehouseRuntimeModule(context);
            },
        },
    ];
}

const RUNTIME_MODULE_RELOAD_PLANS = Object.freeze({
    farm: Object.freeze({
        target: 'farm',
        modules: Object.freeze(['farm', 'friend']),
        cacheKeys: Object.freeze(uniqueList([
            ...farmCacheKeys(),
            ...friendCacheKeys(),
        ])),
        description: '重载农场模块，并重建依赖它的好友模块',
        riskLevel: 'medium',
        riskSummary: '会短暂停止统一调度，并重建农场与好友相关监听、循环和缓存。',
        affectedTaskGroups: Object.freeze(['农场', '好友']),
        affectsUnifiedScheduler: true,
        cooldownMs: DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    }),
    friend: Object.freeze({
        target: 'friend',
        modules: Object.freeze(['friend']),
        cacheKeys: Object.freeze(uniqueList(friendCacheKeys())),
        description: '仅重载好友模块族',
        riskLevel: 'low',
        riskSummary: '会重建好友扫描、蹲守与协作相关监听，但不会主动断开当前连接。',
        affectedTaskGroups: Object.freeze(['好友']),
        affectsUnifiedScheduler: false,
        cooldownMs: DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    }),
    task: Object.freeze({
        target: 'task',
        modules: Object.freeze(['task']),
        cacheKeys: Object.freeze(uniqueList(taskCacheKeys())),
        description: '仅重载任务模块族',
        riskLevel: 'low',
        riskSummary: '会重建任务监听、防抖器与任务类定时器，不影响当前连接。',
        affectedTaskGroups: Object.freeze(['任务']),
        affectsUnifiedScheduler: false,
        cooldownMs: DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    }),
    warehouse: Object.freeze({
        target: 'warehouse',
        modules: Object.freeze(['warehouse', 'farm', 'friend']),
        cacheKeys: Object.freeze(uniqueList([
            ...warehouseCacheKeys(),
            ...farmCacheKeys(),
            ...friendCacheKeys(),
        ])),
        description: '重载仓库模块，并重建依赖仓库实现的农场与好友模块',
        riskLevel: 'medium',
        riskSummary: '会重建仓库、农场和好友模块，统一调度会短暂停顿后恢复。',
        affectedTaskGroups: Object.freeze(['仓库', '农场', '好友']),
        affectsUnifiedScheduler: true,
        cooldownMs: DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    }),
    business: Object.freeze({
        target: 'business',
        modules: Object.freeze(['farm', 'friend', 'task', 'warehouse']),
        cacheKeys: Object.freeze(uniqueList([
            ...farmCacheKeys(),
            ...friendCacheKeys(),
            ...taskCacheKeys(),
            ...warehouseCacheKeys(),
        ])),
        description: '重载全部业务模块族',
        riskLevel: 'high',
        riskSummary: '会重建全部业务模块，当前业务调度队列会整体短暂停顿后再恢复。',
        affectedTaskGroups: Object.freeze(['全部业务']),
        affectsUnifiedScheduler: true,
        cooldownMs: DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    }),
});

function getRuntimeModuleReloadPlan(targetName = '') {
    const normalized = String(targetName || '').trim();
    if (!normalized) return null;
    return RUNTIME_MODULE_RELOAD_PLANS[normalized] || null;
}

function listRuntimeModuleReloadPlans() {
    return Object.values(RUNTIME_MODULE_RELOAD_PLANS);
}

function formatQueueImpactSummary(plan, runtimeState = {}) {
    const snapshot = runtimeState && typeof runtimeState.workerSchedulerSnapshot === 'object'
        ? runtimeState.workerSchedulerSnapshot
        : {};
    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    const taskCount = Math.max(0, Number(snapshot.taskCount) || tasks.length);
    const runningTaskCount = tasks.filter(task => task && task.running).length;
    const moduleLabel = plan.modules.join(' / ');

    if (plan.affectsUnifiedScheduler) {
        if (runtimeState.unifiedSchedulerRunning === false) {
            return `将重建 ${moduleLabel}，当前统一调度未运行。`;
        }
        return `会短暂停止统一调度并重建 ${moduleLabel}；当前 worker 队列 ${taskCount} 个任务，运行中 ${runningTaskCount} 个。`;
    }

    return `会重建 ${moduleLabel} 的监听与定时器；当前 worker 队列 ${taskCount} 个任务，运行中 ${runningTaskCount} 个。`;
}

function buildRuntimeModuleReloadView(targetName = '', runtimeState = {}) {
    const plan = typeof targetName === 'string' || typeof targetName === 'number'
        ? getRuntimeModuleReloadPlan(targetName)
        : targetName;
    if (!plan) return null;

    const activityByTarget = runtimeState && typeof runtimeState.activityByTarget === 'object'
        ? runtimeState.activityByTarget
        : {};
    const activity = activityByTarget[plan.target] && typeof activityByTarget[plan.target] === 'object'
        ? activityByTarget[plan.target]
        : {};
    const now = Math.max(0, Number(runtimeState.now) || Date.now());
    const lastReloadAt = Math.max(0, Number(activity.lastReloadAt) || 0);
    const cooldownMs = Math.max(0, Number(activity.cooldownMs || plan.cooldownMs || DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS));
    const cooldownRemainingMs = lastReloadAt > 0 ? Math.max(0, cooldownMs - Math.max(0, now - lastReloadAt)) : 0;
    const lastReloadSummary = activity.lastReloadSummary && typeof activity.lastReloadSummary === 'object'
        ? {
            target: String(activity.lastReloadSummary.target || '').trim(),
            modules: Array.isArray(activity.lastReloadSummary.modules) ? [...activity.lastReloadSummary.modules] : [],
            forced: !!activity.lastReloadSummary.forced,
            result: String(activity.lastReloadSummary.result || '').trim(),
            source: String(activity.lastReloadSummary.source || '').trim(),
            startedAt: Math.max(0, Number(activity.lastReloadSummary.startedAt) || 0),
            finishedAt: Math.max(0, Number(activity.lastReloadSummary.finishedAt) || 0),
            durationMs: Math.max(0, Number(activity.lastReloadSummary.durationMs) || 0),
            beforeTaskCount: Math.max(0, Number(activity.lastReloadSummary.beforeTaskCount) || 0),
            beforeRunningTaskCount: Math.max(0, Number(activity.lastReloadSummary.beforeRunningTaskCount) || 0),
            afterTaskCount: Math.max(0, Number(activity.lastReloadSummary.afterTaskCount) || 0),
            afterRunningTaskCount: Math.max(0, Number(activity.lastReloadSummary.afterRunningTaskCount) || 0),
            unifiedSchedulerResumed: activity.lastReloadSummary.unifiedSchedulerResumed === true,
            error: String(activity.lastReloadSummary.error || '').trim(),
        }
        : null;
    const snapshot = runtimeState && typeof runtimeState.workerSchedulerSnapshot === 'object'
        ? runtimeState.workerSchedulerSnapshot
        : {};
    const tasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
    const taskCount = Math.max(0, Number(snapshot.taskCount) || tasks.length);
    const runningTaskCount = tasks.filter(task => task && task.running).length;

    return {
        target: plan.target,
        modules: [...plan.modules],
        description: plan.description,
        riskLevel: plan.riskLevel || 'low',
        riskSummary: plan.riskSummary || '',
        affectedTaskGroups: [...(plan.affectedTaskGroups || [])],
        affectsUnifiedScheduler: plan.affectsUnifiedScheduler !== false,
        workerTaskCount: taskCount,
        workerRunningTaskCount: runningTaskCount,
        queueImpactSummary: formatQueueImpactSummary(plan, runtimeState),
        cooldownMs,
        cooldownRemainingMs,
        inCooldown: cooldownRemainingMs > 0,
        requiresForce: cooldownRemainingMs > 0,
        lastReloadAt,
        lastReloadTarget: String(activity.lastReloadTarget || '').trim(),
        lastReloadSource: String(activity.lastReloadSource || '').trim(),
        lastReloadResult: String(activity.lastReloadResult || '').trim(),
        lastReloadForced: !!(lastReloadSummary && lastReloadSummary.forced),
        lastReloadDurationMs: Math.max(0, Number(lastReloadSummary && lastReloadSummary.durationMs) || 0),
        lastReloadSummary,
        loginReady: runtimeState.loginReady !== false,
        confirmationRequired: true,
    };
}

function listReloadableRuntimeModules(runtimeState = {}) {
    return Object.values(RUNTIME_MODULE_RELOAD_PLANS).map(item => buildRuntimeModuleReloadView(item, runtimeState));
}

module.exports = {
    DEFAULT_RUNTIME_RELOAD_COOLDOWN_MS,
    MODULE_CACHE_KEYS,
    createRuntimeModuleDefinitions,
    getRuntimeModuleReloadPlan,
    buildRuntimeModuleReloadView,
    listReloadableRuntimeModules,
    listRuntimeModuleReloadPlans,
};
