const DEFAULT_OFFLINE_REMINDER = {
    channel: 'webhook',
    reloginUrlMode: 'none',
    endpoint: '',
    token: '',
    title: '账号下线提醒',
    msg: '账号下线',
    offlineDeleteEnabled: false,
    offlineDeleteSec: 1,
    webhookCustomJsonEnabled: false,
    webhookCustomJsonTemplate: '',
};

const DEFAULT_REPORT_CONFIG = {
    enabled: false,
    channel: 'webhook',
    endpoint: '',
    token: '',
    smtpHost: '',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    emailFrom: '',
    emailTo: '',
    title: '经营汇报',
    hourlyEnabled: false,
    hourlyMinute: 5,
    dailyEnabled: true,
    dailyHour: 21,
    dailyMinute: 0,
};

const DEFAULT_TRADE_CONFIG = {
    sell: {
        scope: 'fruit_only',
        keepMinEachFruit: 0,
        keepFruitIds: [],
        rareKeep: { enabled: false, judgeBy: 'either', minPlantLevel: 40, minUnitPrice: 2000 },
        batchSize: 15,
        previewBeforeManualSell: false,
    },
};

const DEFAULT_WORKFLOW_CONFIG = {
    farm: { enabled: false, minInterval: 30, maxInterval: 120, nodes: [] },
    friend: { enabled: false, minInterval: 60, maxInterval: 300, nodes: [] },
};

const DEFAULT_MODE_SCOPE = {
    zoneScope: 'same_zone_only',
    requiresGameFriend: true,
    fallbackBehavior: 'standalone',
};

const DEFAULT_INVENTORY_PLANTING = {
    mode: 'disabled',
    globalKeepCount: 0,
    reserveRules: [],
};

function mergeAutomationConfig(automationRaw, stealFilter, stealFriendFilter, skipStealRadish, forceGetAll) {
    return {
        ...automationRaw,
        stealFilterEnabled: stealFilter.enabled,
        stealFilterMode: stealFilter.mode,
        stealFilterPlantIds: stealFilter.plantIds || [],
        stealFriendFilterEnabled: stealFriendFilter.enabled,
        stealFriendFilterMode: stealFriendFilter.mode,
        stealFriendFilterIds: stealFriendFilter.friendIds || [],
        skipStealRadishEnabled: skipStealRadish.enabled,
        forceGetAllEnabled: forceGetAll.enabled,
    };
}

function blockHardIntervalsForUser(res, inputSettings) {
    const ints = inputSettings.intervals || {};
    const checkBlock = (val, threshold) => {
        return val !== undefined && Number.parseInt(val, 10) < threshold;
    };

    if (checkBlock(ints.farm, 15) || checkBlock(ints.farmMin, 15) || checkBlock(ints.farmMax, 15)) {
        res.status(400).json({
            ok: false,
            error: '系统保护拦截：此配置设定的农场轮询时间过度短频，将导致腾讯 1002003 风控锁定。根据系统防线，普通用户农田循环下限为 15秒。请上调参数后再保存！',
        });
        return true;
    }

    const workflowConfig = inputSettings.workflowConfig || {};
    if (workflowConfig.farm && checkBlock(workflowConfig.farm.minInterval, 15)) {
        res.status(400).json({ ok: false, error: '系统保护拦截：工作流 - 农场最低运行周期被限制为 15 秒' });
        return true;
    }
    if (workflowConfig.friend && checkBlock(workflowConfig.friend.minInterval, 60)) {
        res.status(400).json({ ok: false, error: '系统保护拦截：工作流 - 好友巡查最低运行周期被限制为 60 秒' });
        return true;
    }
    return false;
}

function collectShortIntervalRiskItems(inputSettings) {
    const ints = inputSettings && typeof inputSettings.intervals === 'object'
        ? inputSettings.intervals
        : {};
    const riskItems = [];
    const checkRisk = (key, label, threshold = 60) => {
        const parsed = Number.parseInt(ints[key], 10);
        if (Number.isFinite(parsed) && parsed < threshold) {
            riskItems.push({ key, label, value: parsed, threshold });
        }
    };

    checkRisk('friend', '好友巡查间隔');
    checkRisk('friendMin', '好友巡查最小');
    checkRisk('friendMax', '好友巡查最大');
    checkRisk('helpMin', '帮忙最小');
    checkRisk('helpMax', '帮忙最大');
    checkRisk('stealMin', '偷菜最小');
    checkRisk('stealMax', '偷菜最大');

    return riskItems;
}

function requireShortIntervalRiskAcknowledgement(res, inputSettings) {
    const riskItems = collectShortIntervalRiskItems(inputSettings);
    if (riskItems.length === 0) return false;
    if (inputSettings.acknowledgeShortIntervalRisk === true) return false;

    res.status(400).json({
        ok: false,
        error: '检测到好友相关巡查时间低于 60 秒，风控风险极高。请确认风险后再保存。',
        requiresRiskConfirmation: true,
        riskItems,
    });
    return true;
}

function registerAccountSettingsRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    getProvider,
    store,
    validateSettings,
    adminLogger,
}) {
    app.post('/api/settings/save', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) {
            return res.status(400).json({ ok: false, error: '缺少账号标识 (x-account-id)' });
        }
        try {
            const inputSettings = req.body || {};
            const requestedMode = inputSettings.accountMode !== undefined
                ? String(inputSettings.accountMode || '').trim()
                : '';

            if (requestedMode) {
                if (!store.ACCOUNT_MODE_PRESETS || !store.ACCOUNT_MODE_PRESETS[requestedMode]) {
                    return res.status(400).json({ ok: false, error: '无效的账号模式' });
                }
            }

            if (req.currentUser?.role !== 'admin') {
                if (blockHardIntervalsForUser(res, inputSettings)) return;
                if (requireShortIntervalRiskAcknowledgement(res, inputSettings)) return;
            }

            const {
                strictValidation,
                acknowledgeShortIntervalRisk,
                ...settingsToValidate
            } = inputSettings;
            const validation = validateSettings(settingsToValidate);
            if (!validation.valid) {
                adminLogger.warn('配置校验警告', { accountId: id, errors: validation.errors });
                if (strictValidation === true) {
                    return res.status(400).json({
                        ok: false,
                        error: '配置校验失败',
                        errors: validation.errors,
                    });
                }
            }

            const provider = getProvider();
            const data = await provider.saveSettings(id, validation.coerced || settingsToValidate);
            res.json({ ok: true, data: data || {} });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/settings', accountOwnershipRequired, async (req, res) => {
        try {
            const id = await getAccId(req);
            const intervals = store.getIntervals(id);
            const strategy = store.getPlantingStrategy(id);
            const preferredSeed = store.getPreferredSeed(id);
            const friendQuietHours = store.getFriendQuietHours(id);
            const automationRaw = store.getAutomation(id);
            const stealFilter = store.getStealFilterConfig ? store.getStealFilterConfig(id) : { enabled: false, mode: 'blacklist', plantIds: [] };
            const stealFriendFilter = store.getStealFriendFilterConfig ? store.getStealFriendFilterConfig(id) : { enabled: false, mode: 'blacklist', friendIds: [] };
            const stakeoutSteal = store.getStakeoutStealConfig ? store.getStakeoutStealConfig(id) : { enabled: false, delaySec: 3 };
            const skipStealRadish = store.getSkipStealRadishConfig ? store.getSkipStealRadishConfig(id) : { enabled: false };
            const forceGetAll = store.getForceGetAllConfig ? store.getForceGetAllConfig(id) : { enabled: false };
            const automation = mergeAutomationConfig(automationRaw, stealFilter, stealFriendFilter, skipStealRadish, forceGetAll);
            const ui = store.getUI();
            const offlineReminder = store.getOfflineReminder
                ? store.getOfflineReminder()
                : DEFAULT_OFFLINE_REMINDER;
            const reportConfig = store.getReportConfig
                ? store.getReportConfig(id)
                : DEFAULT_REPORT_CONFIG;
            const tradeConfig = store.getTradeConfig
                ? store.getTradeConfig(id)
                : DEFAULT_TRADE_CONFIG;
            const fullSnapshot = store.getConfigSnapshot(id);
            const workflowConfig = fullSnapshot.workflowConfig || DEFAULT_WORKFLOW_CONFIG;

            res.json({
                ok: true,
                data: {
                    accountMode: fullSnapshot.accountMode || 'main',
                    harvestDelay: fullSnapshot.harvestDelay || { min: 0, max: 0 },
                    riskPromptEnabled: fullSnapshot.riskPromptEnabled !== false,
                    modeScope: fullSnapshot.modeScope || DEFAULT_MODE_SCOPE,
                    intervals,
                    strategy,
                    plantingStrategy: strategy,
                    plantingFallbackStrategy: fullSnapshot.plantingFallbackStrategy || 'level',
                    preferredSeed,
                    preferredSeedId: preferredSeed,
                    inventoryPlanting: fullSnapshot.inventoryPlanting || DEFAULT_INVENTORY_PLANTING,
                    friendQuietHours,
                    automation,
                    stakeoutSteal,
                    workflowConfig,
                    tradeConfig,
                    reportConfig,
                    ui,
                    offlineReminder,
                },
            });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = {
    registerAccountSettingsRoutes,
};
