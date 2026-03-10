function registerAccountStateRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    getProvider,
    handleApiError,
    getLevelExpProgress,
    loadFriendsCacheApi,
}) {
    app.get('/api/status', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.json({ ok: false, error: '缺少账号标识 (x-account-id)' });

        try {
            const data = await getProvider().getStatus(id);
            if (data && data.status) {
                const { level, exp } = data.status;
                data.levelProgress = getLevelExpProgress(level, exp);
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.json({ ok: false, error: e.message });
        }
    });

    app.get('/api/lands', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getLands(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/friends', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getFriends(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/friends/cache', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const { getCachedFriends, updateFriendsCache } = loadFriendsCacheApi();
            let data = [];
            if (getCachedFriends) {
                data = await getCachedFriends(id);
            }
            const provider = getProvider();
            if (Array.isArray(data) && data.length === 0 && provider && provider.getFriends) {
                try {
                    data = await provider.getFriends(id);
                    if (Array.isArray(data) && data.length > 0 && updateFriendsCache) {
                        updateFriendsCache(id, data).catch(() => { });
                    }
                } catch {
                    // 忽略回退失败（如 Worker 未运行）
                }
            }
            res.json({ ok: true, data: Array.isArray(data) ? data : [] });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/friend/:gid/lands', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getFriendLands(id, req.params.gid);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/interact-records', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false, error: '缺少账号标识 (x-account-id)' });
        try {
            const limit = Math.max(1, Math.min(200, Number(req.query.limit || 50) || 50));
            const data = await getProvider().getInteractRecords(id, limit);
            res.json({ ok: true, data });
        } catch (e) {
            const errorCode = String((e && e.code) || '').trim();
            if (errorCode.startsWith('INTERACT_')) {
                return res.json({ ok: false, error: String(e.message || '访客记录接口失败'), errorCode });
            }
            handleApiError(res, e);
        }
    });
}

module.exports = {
    registerAccountStateRoutes,
};
