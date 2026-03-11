function registerCommerceRoutes({
    app,
    accountOwnershipRequired,
    getAccId,
    getAccountSnapshotById,
    getProvider,
    buildOfflineSeeds,
    buildOfflineShopCatalog,
    findShopGoodsById,
    buildOfflineMallCatalog,
    buildOfflineMallGoods,
    getAccountBagPreferences,
    saveAccountBagPreferences,
    isSoftRuntimeError,
    handleApiError,
    formatUseResult,
}) {
    function filterOfflinePlantableSeeds(snapshot, options = {}) {
        const source = (snapshot && typeof snapshot === 'object') ? snapshot : {};
        const seeds = Array.isArray(source.seeds) ? source.seeds : [];
        const includeZeroUsable = options.includeZeroUsable === true;
        const includeLocked = options.includeLocked === true;
        return seeds.filter((seed) => {
            const usableCount = Math.max(0, Number(seed && seed.usableCount) || 0);
            const unlocked = seed && seed.unlocked !== false;
            if (!includeLocked && !unlocked) return false;
            if (!includeZeroUsable && usableCount <= 0) return false;
            return true;
        });
    }

    app.get('/api/seeds', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const provider = getProvider();
            if (!provider || typeof provider.getSeeds !== 'function') {
                const account = await getAccountSnapshotById(id);
                return res.json({ ok: true, data: buildOfflineSeeds(account) });
            }
            const data = await provider.getSeeds(id);
            res.json({ ok: true, data });
        } catch (e) {
            if (isSoftRuntimeError(e)) {
                const account = await getAccountSnapshotById(id);
                return res.json({ ok: true, data: buildOfflineSeeds(account) });
            }
            handleApiError(res, e);
        }
    });

    app.get('/api/bag', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getBag(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/bag/plantable-seeds', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        const includeZeroUsable = String(req.query.includeZeroUsable || '') === '1';
        const includeLocked = String(req.query.includeLocked || '') === '1';
        try {
            const provider = getProvider();
            if (!provider || typeof provider.getPlantableBagSeeds !== 'function') {
                const preferences = await getAccountBagPreferences(id).catch(() => null);
                return res.json({
                    ok: true,
                    data: filterOfflinePlantableSeeds(preferences && preferences.plantableSeedSnapshot, { includeZeroUsable, includeLocked }),
                });
            }
            const data = await provider.getPlantableBagSeeds(id, { includeZeroUsable, includeLocked });
            res.json({ ok: true, data });
        } catch (e) {
            if (isSoftRuntimeError(e)) {
                const preferences = await getAccountBagPreferences(id).catch(() => null);
                return res.json({
                    ok: true,
                    data: filterOfflinePlantableSeeds(preferences && preferences.plantableSeedSnapshot, { includeZeroUsable, includeLocked }),
                });
            }
            handleApiError(res, e);
        }
    });

    app.get('/api/bag/preferences', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getAccountBagPreferences(id);
            return res.json({
                ok: true,
                data: data || {
                    purchaseMemory: {},
                    activityHistory: [],
                    plantableSeedSnapshot: { generatedAt: 0, seeds: [] },
                    mallResolverCache: { fertilizerGoodsByType: { normal: null, organic: null }, lastAlertAt: 0, lastAlertReason: '' },
                },
            });
        } catch (e) {
            return handleApiError(res, e);
        }
    });

    app.post('/api/bag/preferences', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const data = await saveAccountBagPreferences(id, {
                purchaseMemory: body.purchaseMemory,
                activityHistory: body.activityHistory,
                plantableSeedSnapshot: body.plantableSeedSnapshot,
                mallResolverCache: body.mallResolverCache,
            });
            return res.json({ ok: true, data });
        } catch (e) {
            return handleApiError(res, e);
        }
    });

    app.post('/api/bag/use', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const itemId = Number((req.body || {}).itemId || 0);
            const count = Math.max(1, Number((req.body || {}).count || 1));
            const landIds = Array.isArray((req.body || {}).landIds) ? req.body.landIds.map(v => Number(v || 0)).filter(v => v > 0) : [];
            if (itemId <= 0) {
                return res.status(400).json({ ok: false, error: 'Missing itemId' });
            }
            const data = await getProvider().useBagItem(id, itemId, count, landIds);
            const formatted = formatUseResult(data, { itemId, count, landIds });
            res.json({ ok: true, data: formatted });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/shop/catalog', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const provider = getProvider();
            if (!provider || typeof provider.getShopCatalog !== 'function') {
                const account = await getAccountSnapshotById(id);
                return res.json({ ok: true, data: buildOfflineShopCatalog(account) });
            }
            const data = await provider.getShopCatalog(id);
            return res.json({ ok: true, data });
        } catch (e) {
            if (isSoftRuntimeError(e)) {
                const account = await getAccountSnapshotById(id);
                return res.json({ ok: true, data: buildOfflineShopCatalog(account) });
            }
            return handleApiError(res, e);
        }
    });

    app.post('/api/shop/purchase', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const provider = getProvider();
            if (!provider || typeof provider.buyShopGoods !== 'function' || typeof provider.getShopCatalog !== 'function') {
                return res.status(501).json({ ok: false, error: 'Shop purchase not supported' });
            }
            const goodsId = Number((req.body || {}).goodsId);
            const count = Math.max(1, Number((req.body || {}).count || 1));
            if (!goodsId || goodsId <= 0) {
                return res.status(400).json({ ok: false, error: 'Missing goodsId' });
            }
            const catalog = await provider.getShopCatalog(id);
            const goods = findShopGoodsById(catalog, goodsId);
            if (!goods) {
                return res.status(404).json({ ok: false, error: '商品不存在或价格尚未同步，请刷新商店后重试' });
            }
            if (goods.supportsPurchase === false) {
                return res.status(400).json({ ok: false, error: goods.purchaseDisabledReason || '当前商品暂不支持购买' });
            }
            if (goods.isLimited) {
                const remainingCount = Math.max(0, Number(goods.remainingCount) || 0);
                if (remainingCount <= 0) {
                    return res.status(400).json({ ok: false, error: '当前商品已售罄或已达购买上限' });
                }
                if (count > remainingCount) {
                    return res.status(400).json({ ok: false, error: `当前商品最多还能购买 ${remainingCount} 件` });
                }
            }
            const resolvedPrice = Math.max(0, Number(goods.priceValue) || 0);
            const data = await provider.buyShopGoods(id, goodsId, count, resolvedPrice);
            return res.json({ ok: true, data });
        } catch (e) {
            return handleApiError(res, e);
        }
    });

    app.get('/api/mall/catalog', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const provider = getProvider();
            if (!provider || typeof provider.getMallCatalog !== 'function') {
                return res.json({ ok: true, data: buildOfflineMallCatalog() });
            }
            const data = await provider.getMallCatalog(id);
            return res.json({ ok: true, data });
        } catch (e) {
            if (isSoftRuntimeError(e)) {
                return res.json({ ok: true, data: buildOfflineMallCatalog() });
            }
            return handleApiError(res, e);
        }
    });

    app.get('/api/mall/goods', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const slotType = Number(req.query.slotType || 1) || 1;
            const provider = getProvider();
            if (!provider || typeof provider.getMallGoods !== 'function') {
                return res.json({ ok: true, data: buildOfflineMallGoods(slotType) });
            }
            const data = await provider.getMallGoods(id, slotType);
            res.json({ ok: true, data });
        } catch (e) {
            if (isSoftRuntimeError(e)) {
                const slotType = Number(req.query.slotType || 1) || 1;
                return res.json({ ok: true, data: buildOfflineMallGoods(slotType) });
            }
            handleApiError(res, e);
        }
    });

    app.post('/api/mall/purchase', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const goodsId = Number((req.body || {}).goodsId);
            const count = Number((req.body || {}).count || 1);
            if (!goodsId || goodsId <= 0) {
                return res.status(400).json({ ok: false, error: 'Missing goodsId' });
            }
            const data = await getProvider().buyMallGoods(id, goodsId, Math.max(1, count || 1));
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.post('/api/mall/month-card/claim', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const provider = getProvider();
            if (!provider || typeof provider.claimMonthCardReward !== 'function') {
                return res.status(501).json({ ok: false, error: 'Month card reward not supported' });
            }
            const goodsId = Number((req.body || {}).goodsId || 0);
            if (goodsId <= 0) {
                return res.status(400).json({ ok: false, error: 'Missing goodsId' });
            }
            const data = await provider.claimMonthCardReward(id, goodsId);
            return res.json({ ok: true, data });
        } catch (e) {
            return handleApiError(res, e);
        }
    });

    app.get('/api/bag/sell-preview', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getSellPreview(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.post('/api/bag/sell', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().sellByPolicy(id, (req.body || {}).tradeConfig, {
                manual: true,
                reason: 'manual_policy',
            });
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.post('/api/bag/sell-selected', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const itemIds = Array.isArray((req.body || {}).itemIds) ? req.body.itemIds : [];
            const data = await getProvider().sellSelected(id, itemIds, {
                respectPolicy: (req.body || {}).respectPolicy !== false,
                reason: 'manual_selected',
            });
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });

    app.get('/api/daily-gifts', accountOwnershipRequired, async (req, res) => {
        const id = await getAccId(req);
        if (!id) return res.status(400).json({ ok: false });
        try {
            const data = await getProvider().getDailyGifts(id);
            res.json({ ok: true, data });
        } catch (e) {
            handleApiError(res, e);
        }
    });
}

module.exports = {
    registerCommerceRoutes,
};
