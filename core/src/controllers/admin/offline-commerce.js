const OFFLINE_MALL_GIFT_SNAPSHOT = Object.freeze([
    { goodsId: 1001, name: '每日福利', itemIds: [80001], isFree: true, isLimited: true, priceValue: 0, priceItemId: 0, priceLabel: '免费领取', summary: '每日限购 0/1' },
    { goodsId: 10901, name: '柯基活动礼包', itemIds: [], image: '/game-config/item_icons/mall_gift_corgi_diamond.png', isFree: false, isLimited: true, priceValue: 25, priceItemId: 1004, priceLabel: '25 钻石', summary: '柯基活动限时礼包，永久限购 500/500。' },
    { goodsId: 10902, name: '柯基活动礼包', itemIds: [], image: '/game-config/item_icons/mall_gift_corgi_coupon.png', isFree: false, isLimited: true, priceValue: 25, priceItemId: 1002, priceLabel: '25 点券', summary: '柯基活动限时礼包，永久限购 0/3。' },
    { goodsId: 1002, name: '10小时有机化肥', itemIds: [80013, 80011, 80011], isFree: false, isLimited: false, priceValue: 42, priceItemId: 1002, priceLabel: '42 点券' },
    { goodsId: 1003, name: '10小时化肥', itemIds: [80003, 80001, 80001], isFree: false, isLimited: false, priceValue: 34, priceItemId: 1002, priceLabel: '34 点券' },
    { goodsId: 1004, name: '20小时有机化肥', itemIds: [80014, 80013], isFree: false, isLimited: false, priceValue: 80, priceItemId: 1004, priceLabel: '80 钻石' },
    { goodsId: 1005, name: '20小时化肥', itemIds: [80004, 80003], isFree: false, isLimited: false, priceValue: 64, priceItemId: 1004, priceLabel: '64 钻石' },
    { goodsId: 1006, name: '狗粮礼包', itemIds: [90006, 90005, 90004], isFree: false, isLimited: false, priceValue: 33, priceItemId: 1002, priceLabel: '33 点券' },
    { goodsId: 1007, name: '有机化肥(1小时)', itemIds: [80011], isFree: false, isLimited: false, priceValue: 5, priceItemId: 1004, priceLabel: '5 钻石' },
    { goodsId: 1008, name: '有机化肥(4小时)', itemIds: [80012], isFree: false, isLimited: false, priceValue: 19, priceItemId: 1004, priceLabel: '19 钻石' },
    { goodsId: 1009, name: '有机化肥(8小时)', itemIds: [80013], isFree: false, isLimited: false, priceValue: 36, priceItemId: 1004, priceLabel: '36 钻石' },
    { goodsId: 1010, name: '有机化肥(12小时)', itemIds: [80014], isFree: false, isLimited: false, priceValue: 52, priceItemId: 1004, priceLabel: '52 钻石' },
    { goodsId: 1011, name: '化肥(1小时)', itemIds: [80001], isFree: false, isLimited: false, priceValue: 4, priceItemId: 1004, priceLabel: '4 钻石' },
    { goodsId: 1012, name: '化肥(4小时)', itemIds: [80002], isFree: false, isLimited: false, priceValue: 15, priceItemId: 1004, priceLabel: '15 钻石' },
    { goodsId: 1013, name: '化肥(8小时)', itemIds: [80003], isFree: false, isLimited: false, priceValue: 28, priceItemId: 1004, priceLabel: '28 钻石' },
    { goodsId: 1014, name: '化肥(12小时)', itemIds: [80004], isFree: false, isLimited: false, priceValue: 40, priceItemId: 1004, priceLabel: '40 钻石' },
    { goodsId: 1015, name: '1天狗粮', itemIds: [90004], isFree: false, isLimited: false, priceValue: 4, priceItemId: 1004, priceLabel: '4 钻石' },
    { goodsId: 1016, name: '3天狗粮', itemIds: [90005], isFree: false, isLimited: false, priceValue: 11, priceItemId: 1004, priceLabel: '11 钻石' },
    { goodsId: 1017, name: '5天狗粮', itemIds: [90006], isFree: false, isLimited: false, priceValue: 18, priceItemId: 1004, priceLabel: '18 钻石' },
]);

const OFFLINE_SHOP_PET_SNAPSHOT = Object.freeze([
    { goodsId: 390001, itemId: 90011, itemCount: 1, priceValue: 4800, priceLabel: '4800 金币' },
    { goodsId: 390002, itemId: 90002, itemCount: 1, priceValue: 500000, priceLabel: '500000 金币' },
    { goodsId: 390003, itemId: 90003, itemCount: 1, priceValue: 1000000, priceLabel: '1000000 金币', requiredLevel: 20, summary: '20 级解锁后可购买' },
]);

const OFFLINE_SHOP_PROP_SNAPSHOT = Object.freeze([
    {
        goodsId: 510011,
        itemId: 21011,
        itemCount: 1,
        priceValue: 980,
        priceLabel: '980 金豆豆',
        currencyItemId: 1005,
        currencyLabel: '金豆豆',
        summary: '萌宠柯基活动获取，使用后获得萌宠柯基专属头像框。',
    },
]);

const OFFLINE_MALL_PLACEHOLDER_SNAPSHOT = Object.freeze([
    {
        slotType: 2,
        goodsId: 20001,
        name: '超级月卡',
        itemIds: [1002, 1004],
        image: '/game-config/item_icons/mall_monthcard_super.png',
        priceValue: 18,
        priceLabel: '￥18',
        summary: '当前月卡未激活。购买后 30 天可获得 3600 点券，并额外获得 180 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30001,
        name: '10钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_10.png',
        priceValue: 1,
        priceLabel: '￥1',
        summary: '首充额外赠送 20 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30002,
        name: '60钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_60.png',
        priceValue: 6,
        priceLabel: '￥6',
        summary: '首充额外赠送 120 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30003,
        name: '300钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_300.png',
        priceValue: 30,
        priceLabel: '￥30',
        summary: '首充额外赠送 300 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30004,
        name: '680钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_680.png',
        priceValue: 68,
        priceLabel: '￥68',
        summary: '首充额外赠送 680 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30005,
        name: '1280钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_1280.png',
        priceValue: 128,
        priceLabel: '￥128',
        summary: '首充额外赠送 1280 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30006,
        name: '1980钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_1980.png',
        priceValue: 198,
        priceLabel: '￥198',
        summary: '首充额外赠送 1980 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30007,
        name: '3280钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_3280.png',
        priceValue: 328,
        priceLabel: '￥328',
        summary: '首充额外赠送 3280 钻石。',
    },
    {
        slotType: 3,
        goodsId: 30008,
        name: '6480钻石',
        itemIds: [1004],
        image: '/game-config/item_icons/mall_recharge_6480.png',
        priceValue: 648,
        priceLabel: '￥648',
        summary: '首充额外赠送 6480 钻石。',
    },
]);

function createOfflineCommerceHelpers(deps) {
    const { getAllSeeds, getItemById, getItemImageById } = deps;

    function isGenericItemIcon(image = '') {
        return /^\/asset-cache\/item-icons\/item-\d+\.svg$/i.test(String(image || ''));
    }

    function buildOfflineItemPreview(itemId) {
        const id = Number(itemId) || 0;
        const item = id > 0 ? (getItemById(id) || {}) : {};
        return {
            id,
            name: String(item.name || `物品#${id}`),
            image: id > 0 ? getItemImageById(id) : '',
            type: Number(item.type) || 0,
            rarity: Number(item.rarity) || 0,
            desc: String(item.desc || ''),
            effectDesc: String(item.effectDesc || ''),
            canUse: Number(item.can_use) === 1,
            level: Number(item.level) || 0,
            price: Number(item.price) || 0,
            interactionType: String(item.interaction_type || ''),
            count: 1,
        };
    }

    function pickOfflinePrimaryPreview(itemPreviews = []) {
        const list = Array.isArray(itemPreviews) ? itemPreviews : [];
        return list.find(item => item.image && !isGenericItemIcon(item.image))
            || list.find(item => !!item.image)
            || list[0]
            || null;
    }

    function buildOfflineSeeds(account) {
        const accountLevel = Math.max(0, Number(account && account.level) || 0);
        return (getAllSeeds() || []).map((seed) => {
            const seedId = Number(seed && seed.seedId) || 0;
            const requiredLevel = Math.max(0, Number(seed && seed.requiredLevel) || 0);
            return {
                seedId,
                goodsId: seedId,
                name: String(seed && seed.name) || `种子#${seedId}`,
                price: Math.max(0, Number(seed && seed.price) || 0) * 2,
                requiredLevel,
                locked: requiredLevel > accountLevel,
                soldOut: false,
                image: String(seed && seed.image) || '',
            };
        });
    }

    function getOfflineMallSectionMeta(slotType = 1) {
        if (Number(slotType) === 1) {
            return {
                slotType: 1,
                slotKey: 'gift',
                slotLabel: '礼包商城',
                slotDescription: '限时礼包、活动礼包与免费福利',
                purchaseHint: '',
            };
        }
        if (Number(slotType) === 2) {
            return {
                slotType: 2,
                slotKey: 'month_card',
                slotLabel: '月卡商城',
                slotDescription: '月卡购买页与月卡奖励状态',
                purchaseHint: '月卡购买需在游戏内完成支付',
            };
        }
        return {
            slotType: 3,
            slotKey: 'recharge',
            slotLabel: '充值商城',
            slotDescription: '钻石充值页，仅展示价格与档位',
            purchaseHint: '充值类商品需在游戏内完成支付',
        };
    }

    function buildOfflineShopSeedGoods(account) {
        return buildOfflineSeeds(account).map((seed) => {
            const seedId = Number(seed.seedId) || 0;
            const requiredLevel = Math.max(0, Number(seed.requiredLevel) || 0);
            const preview = {
                id: seedId,
                name: String(seed.name || `种子#${seedId}`),
                image: String(seed.image || ''),
                type: 5,
                rarity: 0,
                desc: requiredLevel > 0 ? `Lv${requiredLevel} 解锁` : '',
                effectDesc: '用于种植',
                canUse: false,
                level: requiredLevel,
                price: Math.max(0, Number(seed.price) || 0),
                interactionType: 'plant',
                count: 1,
            };
            return {
                sourceType: 'shop',
                entryKey: `shop:seed:${Number(seed.goodsId) || seedId}`,
                goodsId: Number(seed.goodsId) || seedId,
                name: preview.name,
                type: 5,
                shopId: 2,
                shopType: 2,
                shopName: '种子商店',
                tabKey: 'seed',
                label: '种子',
                description: '金币购买种子',
                image: preview.image,
                summary: preview.desc || preview.effectDesc,
                itemId: seedId,
                itemIds: seedId > 0 ? [seedId] : [],
                itemCount: 1,
                itemPreviews: [preview],
                priceValue: preview.price,
                priceLabel: `${preview.price} 金币`,
                currencyItemId: 1001,
                currencyLabel: '金币',
                isLimited: false,
                boughtNum: 0,
                limitCount: 0,
                remainingCount: 0,
                supportsPurchase: false,
                unlocked: !seed.locked,
                soldOut: false,
                conds: seed.locked ? [{ type: 'level', param: requiredLevel, label: `等级达到 Lv${requiredLevel}` }] : [],
                condSummary: seed.locked ? `等级达到 Lv${requiredLevel}` : '',
                purchaseDisabledReason: '账号离线，当前仅展示配置内种子清单',
            };
        });
    }

    function buildOfflineShopItemGoods(row, sectionMeta) {
        const itemId = Number(row && row.itemId) || 0;
        const itemCount = Math.max(1, Number(row && row.itemCount) || 1);
        const preview = buildOfflineItemPreview(itemId);
        const requiredLevel = Math.max(0, Number(row && row.requiredLevel) || Number(preview.level) || 0);
        const accountLevel = Math.max(0, Number(sectionMeta && sectionMeta.accountLevel) || 0);
        const unlocked = requiredLevel <= 0 || accountLevel >= requiredLevel;
        const condSummary = !unlocked && requiredLevel > 0 ? `等级达到 Lv${requiredLevel}` : '';
        const priceValue = Math.max(0, Number(row && row.priceValue) || Number(preview.price) || 0);
        const currencyItemId = Math.max(0, Number(row && row.currencyItemId) || 1001);
        const currencyLabel = String((row && row.currencyLabel) || (currencyItemId === 1005 ? '金豆豆' : '金币'));

        preview.count = itemCount;
        preview.level = requiredLevel;
        if (!String(preview.desc || '').trim() && requiredLevel > 0) {
            preview.desc = `Lv${requiredLevel} 解锁`;
        }

        const image = String(preview.image || '');
        return {
            sourceType: 'shop',
            entryKey: `shop:${Number(sectionMeta.shopId) || 0}:${Number(row && row.goodsId) || itemId}`,
            goodsId: Number(row && row.goodsId) || itemId,
            name: String((row && row.name) || preview.name || `商品#${Number(row && row.goodsId) || itemId}`),
            image,
            summary: String((row && row.summary) || condSummary || preview.effectDesc || preview.desc || sectionMeta.description || ''),
            itemId,
            itemIds: itemId > 0 ? [itemId] : [],
            itemCount,
            itemPreviews: itemId > 0 ? [preview] : [],
            primaryItemId: itemId,
            shopId: Number(sectionMeta.shopId) || 0,
            shopType: Number(sectionMeta.shopType) || 0,
            shopName: String(sectionMeta.shopName || ''),
            tabKey: String(sectionMeta.tabKey || ''),
            priceValue,
            priceLabel: String((row && row.priceLabel) || (priceValue > 0 ? `${priceValue} ${currencyLabel}` : '需在线读取价格')),
            currencyItemId,
            currencyLabel,
            boughtNum: 0,
            limitCount: 0,
            remainingCount: 0,
            isLimited: false,
            unlocked,
            conds: !unlocked ? [{ type: 'level', param: requiredLevel, label: condSummary }] : [],
            condSummary,
            supportsPurchase: false,
            purchaseDisabledReason: condSummary || '账号离线，当前仅展示最近一次推导出的商店快照',
        };
    }

    function buildOfflineShopCatalog(account) {
        const seedSection = {
            shopId: 2,
            shopType: 2,
            shopName: '种子商店',
            tabKey: 'seed',
            label: '种子',
            description: '金币购买种子',
            supportsPurchase: false,
            currencyItemId: 1001,
            currencyLabel: '金币',
            goods: buildOfflineShopSeedGoods(account),
        };
        const petSectionMeta = {
            shopId: 3,
            shopType: 3,
            shopName: '宠物商店',
            tabKey: 'pet',
            description: '宠物离线快照，包含待解锁等级',
            accountLevel: Math.max(0, Number(account && account.level) || 0),
        };
        const propSectionMeta = {
            shopId: 1,
            shopType: 1,
            shopName: '装扮商店',
            tabKey: 'dress',
            description: '头像框与装扮离线快照',
        };
        return {
            sections: [
                seedSection,
                {
                    ...petSectionMeta,
                    label: '宠物',
                    supportsPurchase: false,
                    currencyItemId: 1001,
                    currencyLabel: '金币',
                    goods: OFFLINE_SHOP_PET_SNAPSHOT.map(row => buildOfflineShopItemGoods(row, petSectionMeta)),
                },
                {
                    ...propSectionMeta,
                    label: '装扮',
                    supportsPurchase: false,
                    currencyItemId: 1005,
                    currencyLabel: '金豆豆',
                    goods: OFFLINE_SHOP_PROP_SNAPSHOT.map(row => buildOfflineShopItemGoods(row, propSectionMeta)),
                },
            ],
        };
    }

    function findShopGoodsById(shopCatalog, goodsId) {
        const normalizedGoodsId = Number(goodsId) || 0;
        if (normalizedGoodsId <= 0) return null;
        const sections = Array.isArray(shopCatalog && shopCatalog.sections) ? shopCatalog.sections : [];
        for (const section of sections) {
            const goods = Array.isArray(section && section.goods) ? section.goods : [];
            const found = goods.find(item => Number(item && item.goodsId) === normalizedGoodsId);
            if (found) return found;
        }
        return null;
    }

    function buildOfflineMallGoods(slotType = 1) {
        const normalizedSlotType = Number(slotType) || 1;
        const slotMeta = getOfflineMallSectionMeta(normalizedSlotType);
        const rows = normalizedSlotType === 1
            ? OFFLINE_MALL_GIFT_SNAPSHOT
            : OFFLINE_MALL_PLACEHOLDER_SNAPSHOT.filter(row => Number(row.slotType) === normalizedSlotType);

        return rows.map((row) => {
            const itemIds = Array.isArray(row.itemIds) ? row.itemIds.map(itemId => Number(itemId) || 0).filter(itemId => itemId > 0) : [];
            const itemPreviews = itemIds.map(buildOfflineItemPreview);
            const primaryItem = pickOfflinePrimaryPreview(itemPreviews);
            const priceItem = Number(row.priceItemId) > 0 ? (getItemById(row.priceItemId) || {}) : {};
            const image = String((row && row.image) || (primaryItem ? primaryItem.image : '') || '');
            return {
                sourceType: 'mall',
                entryKey: `mall:${normalizedSlotType}:${Number(row.goodsId) || 0}`,
                goodsId: Number(row.goodsId) || 0,
                name: String(row.name || `商品#${Number(row.goodsId) || 0}`),
                type: normalizedSlotType,
                slotType: normalizedSlotType,
                slotKey: slotMeta.slotKey,
                slotLabel: slotMeta.slotLabel,
                slotDescription: slotMeta.slotDescription,
                isFree: !!row.isFree,
                isLimited: !!row.isLimited,
                discount: '',
                priceValue: Math.max(0, Number(row.priceValue) || 0),
                priceItemId: Number(row.priceItemId) || 0,
                priceItemName: String(priceItem.name || ''),
                priceLabel: String(row.priceLabel || slotMeta.purchaseHint || ''),
                itemIds,
                image,
                primaryItemId: primaryItem ? Number(primaryItem.id || 0) : 0,
                summary: String(row.summary || (primaryItem ? (primaryItem.effectDesc || primaryItem.desc || '') : '离线展示的商城快照')),
                itemPreviews,
                supportsPurchase: false,
                purchaseDisabledReason: normalizedSlotType === 1
                    ? '账号离线，当前仅展示最近一次抓取到的礼包商城数据'
                    : '账号离线，当前仅展示最近一次抓取到的商城页面快照',
            };
        });
    }

    function buildOfflineMallCatalog() {
        return {
            sections: [1, 2, 3].map((slotType) => {
                const slotMeta = getOfflineMallSectionMeta(slotType);
                return {
                    slotType,
                    slotKey: slotMeta.slotKey,
                    label: slotMeta.slotLabel,
                    description: slotMeta.slotDescription,
                    supportsPurchase: slotType === 1,
                    purchaseHint: slotMeta.purchaseHint,
                    goods: buildOfflineMallGoods(slotType),
                };
            }),
            monthCards: [],
        };
    }

    return {
        buildOfflineSeeds,
        buildOfflineShopCatalog,
        findShopGoodsById,
        buildOfflineMallGoods,
        buildOfflineMallCatalog,
    };
}

module.exports = {
    createOfflineCommerceHelpers,
};
