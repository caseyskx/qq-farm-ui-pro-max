function registerAutomationRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    store,
    getProvider,
}) {
    app.post('/api/automation', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) {
            return res.status(400).json({ ok: false, error: '缺少账号标识 (x-account-id)' });
        }
        try {
            const body = req.body || {};
            const stealFilterKeys = ['stealFilterEnabled', 'stealFilterMode', 'stealFilterPlantIds'];
            const stealFriendFilterKeys = ['stealFriendFilterEnabled', 'stealFriendFilterMode', 'stealFriendFilterIds'];
            const skipStealRadishKeys = ['skipStealRadishEnabled'];
            const forceGetAllKeys = ['forceGetAllEnabled'];
            let touchedDirectConfig = false;

            if (store.setSkipStealRadishConfig && skipStealRadishKeys.some(k => body[k] !== undefined)) {
                const cur = store.getSkipStealRadishConfig ? store.getSkipStealRadishConfig(id) : { enabled: false };
                store.setSkipStealRadishConfig(id, {
                    enabled: body.skipStealRadishEnabled !== undefined ? !!body.skipStealRadishEnabled : cur.enabled,
                });
                touchedDirectConfig = true;
            }

            if (store.setForceGetAllConfig && forceGetAllKeys.some(k => body[k] !== undefined)) {
                const cur = store.getForceGetAllConfig ? store.getForceGetAllConfig(id) : { enabled: false };
                store.setForceGetAllConfig(id, {
                    enabled: body.forceGetAllEnabled !== undefined ? !!body.forceGetAllEnabled : cur.enabled,
                });
                touchedDirectConfig = true;
            }

            if (store.setStealFilterConfig && stealFilterKeys.some(k => body[k] !== undefined)) {
                const cur = store.getStealFilterConfig ? store.getStealFilterConfig(id) : { enabled: false, mode: 'blacklist', plantIds: [] };
                store.setStealFilterConfig(id, {
                    enabled: body.stealFilterEnabled !== undefined ? !!body.stealFilterEnabled : cur.enabled,
                    mode: body.stealFilterMode !== undefined ? (body.stealFilterMode === 'whitelist' ? 'whitelist' : 'blacklist') : cur.mode,
                    plantIds: Array.isArray(body.stealFilterPlantIds) ? body.stealFilterPlantIds.map(String) : (cur.plantIds || []),
                });
                touchedDirectConfig = true;
            }

            if (store.setStealFriendFilterConfig && stealFriendFilterKeys.some(k => body[k] !== undefined)) {
                const cur = store.getStealFriendFilterConfig ? store.getStealFriendFilterConfig(id) : { enabled: false, mode: 'blacklist', friendIds: [] };
                store.setStealFriendFilterConfig(id, {
                    enabled: body.stealFriendFilterEnabled !== undefined ? !!body.stealFriendFilterEnabled : cur.enabled,
                    mode: body.stealFriendFilterMode !== undefined ? (body.stealFriendFilterMode === 'whitelist' ? 'whitelist' : 'blacklist') : cur.mode,
                    friendIds: Array.isArray(body.stealFriendFilterIds) ? body.stealFriendFilterIds.map(String) : (cur.friendIds || []),
                });
                touchedDirectConfig = true;
            }

            let lastData = null;
            const provider = getProvider();
            for (const [k, v] of Object.entries(body)) {
                if (stealFilterKeys.includes(k) || stealFriendFilterKeys.includes(k) || skipStealRadishKeys.includes(k) || forceGetAllKeys.includes(k)) continue;
                lastData = await provider.setAutomation(id, k, v);
            }

            if ((touchedDirectConfig || !lastData) && typeof store.flushGlobalConfigSave === 'function') {
                await store.flushGlobalConfigSave();
            }

            res.json({ ok: true, data: lastData || { automation: store.getAutomation ? store.getAutomation(id) : {} } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

function registerFriendOperationRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    store,
    getProvider,
    handleApiError,
}) {
    app.post('/api/friend/:gid/op', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false, error: '缺少账号标识 (x-account-id)' });
        try {
            const opType = String((req.body || {}).opType || '');
            const data = await getProvider().doFriendOp(id, req.params.gid, opType);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.post('/api/friends/batch-op', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false, error: '缺少账号标识 (x-account-id)' });
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const gids = Array.isArray(body.gids) ? body.gids.map(Number).filter(n => Number.isFinite(n) && n > 0) : [];
            const opType = String(body.opType || '').trim();
            const options = (body.options && typeof body.options === 'object') ? body.options : {};

            if (!gids.length) return res.status(400).json({ ok: false, error: 'Missing gids' });
            if (!opType) return res.status(400).json({ ok: false, error: 'Missing opType' });

            if (opType === 'blacklist_add' || opType === 'blacklist_remove') {
                const current = store.getFriendBlacklist ? store.getFriendBlacklist(id) : [];
                const currentSet = new Set(current.map(Number));
                const results = [];
                for (const gid of gids) {
                    if (opType === 'blacklist_add') {
                        currentSet.add(gid);
                        results.push({ gid, ok: true, opType, message: '已加入黑名单' });
                    } else {
                        currentSet.delete(gid);
                        results.push({ gid, ok: true, opType, message: '已移出黑名单' });
                    }
                }
                const saved = store.setFriendBlacklist ? store.setFriendBlacklist(id, Array.from(currentSet)) : Array.from(currentSet);
                const provider = getProvider();
                if (provider && typeof provider.broadcastConfig === 'function') {
                    provider.broadcastConfig(id);
                }
                return res.json({
                    ok: true,
                    data: {
                        ok: true,
                        opType,
                        total: gids.length,
                        successCount: gids.length,
                        failCount: 0,
                        totalAffectedCount: gids.length,
                        blacklist: saved,
                        results,
                    },
                });
            }

            const data = await getProvider().doFriendBatchOp(id, gids, opType, options);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });
}

module.exports = {
    registerAutomationRoutes,
    registerFriendOperationRoutes,
};
