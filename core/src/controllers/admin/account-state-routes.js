function registerAccountStateRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    getProvider,
    handleApiError,
    getLevelExpProgress,
    loadFriendsCacheApi,
}) {
    async function getCachedFriendsData(id) {
        const { getCachedFriends } = loadFriendsCacheApi();
        if (!getCachedFriends) return [];
        const data = await getCachedFriends(id);
        return Array.isArray(data) ? data : [];
    }

    function syncFriendsCache(id, data) {
        const { updateFriendsCache, mergeFriendsCache } = loadFriendsCacheApi();
        const syncFn = mergeFriendsCache || updateFriendsCache;
        if (!syncFn || !Array.isArray(data) || data.length === 0) return;
        syncFn(id, data).catch(() => { });
    }

    async function getFriendsWithFallback(id) {
        try {
            const data = await getProvider().getFriends(id);
            if (Array.isArray(data) && data.length > 0) {
                syncFriendsCache(id, data);
                return data;
            }
            const cached = await getCachedFriendsData(id);
            return cached.length > 0 ? cached : (Array.isArray(data) ? data : []);
        } catch (err) {
            const cached = await getCachedFriendsData(id);
            if (cached.length > 0) return cached;
            throw err;
        }
    }

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
            const data = await getFriendsWithFallback(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/friends/cache', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            let data = await getCachedFriendsData(id);
            if (data.length === 0) {
                data = await getFriendsWithFallback(id);
            }
            res.json({ ok: true, data });
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
