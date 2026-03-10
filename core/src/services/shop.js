const { getItemById, getItemImageById } = require('../config/gameConfig');
const { sendMsgAsync } = require('../utils/network');
const { types } = require('../utils/proto');
const { toLong, toNum } = require('../utils/utils');

const FALLBACK_SHOP_PROFILES = Object.freeze([
    { shop_id: 2, shop_name: '种子商店', shop_type: 2 },
]);

function getDefaultShopName(shopType) {
    if (Number(shopType) === 2) return '种子商店';
    if (Number(shopType) === 3) return '宠物商店';
    return '装扮商店';
}

function getShopTabKey(profile) {
    const type = Number(profile && profile.shop_type) || 0;
    if (type === 2) return 'seed';
    if (type === 3) return 'pet';
    return 'dress';
}

function normalizeShopProfile(profile) {
    const shopId = toNum(profile && profile.shop_id);
    const shopType = toNum(profile && profile.shop_type);
    const shopName = String((profile && profile.shop_name) || getDefaultShopName(shopType) || `商店#${shopId}`);
    const tabKey = getShopTabKey({ shop_type: shopType });
    return {
        shopId,
        shopType,
        shopName,
        tabKey,
        label: shopName,
        description: tabKey === 'seed'
            ? '金币购买种子'
            : (tabKey === 'pet' ? '金币购买宠物相关物品' : '金币购买装扮与陈设'),
        supportsPurchase: true,
        currencyItemId: 1001,
        currencyLabel: '金币',
    };
}

function normalizeShopCond(cond) {
    const type = toNum(cond && cond.type);
    const param = toNum(cond && cond.param);
    if (type === 1) {
        return { type, param, label: `等级达到 Lv${param}` };
    }
    if (type === 2) {
        const item = getItemById(param) || {};
        return { type, param, label: item.name ? `需要 ${item.name}` : `需要解锁卡 #${param}` };
    }
    return { type, param, label: param > 0 ? `条件 #${param}` : '未知条件' };
}

function buildShopItemPreview(itemId, itemCount = 1) {
    const item = getItemById(itemId) || {};
    return {
        id: Number(itemId) || 0,
        name: String(item.name || `物品#${Number(itemId) || 0}`),
        image: getItemImageById(itemId),
        type: Number(item.type) || 0,
        rarity: Number(item.rarity) || 0,
        desc: String(item.desc || ''),
        effectDesc: String(item.effectDesc || ''),
        canUse: Number(item.can_use) === 1,
        level: Number(item.level) || 0,
        price: Number(item.price) || 0,
        interactionType: String(item.interaction_type || ''),
        count: Math.max(1, Number(itemCount) || 1),
    };
}

function normalizeShopGoods(goods, profile) {
    const itemId = toNum(goods && goods.item_id);
    const itemCount = Math.max(1, toNum(goods && goods.item_count) || 1);
    const itemPreview = buildShopItemPreview(itemId, itemCount);
    const conds = Array.isArray(goods && goods.conds) ? goods.conds.map(normalizeShopCond) : [];
    const boughtNum = Math.max(0, toNum(goods && goods.bought_num));
    const limitCount = Math.max(0, toNum(goods && goods.limit_count));
    const remainingCount = limitCount > 0 ? Math.max(0, limitCount - boughtNum) : 0;
    const unlocked = goods && goods.unlocked !== false;

    return {
        sourceType: 'shop',
        entryKey: `shop:${toNum(profile && profile.shop_id)}:${toNum(goods && goods.id)}`,
        goodsId: toNum(goods && goods.id),
        name: String(itemPreview.name || `商品#${toNum(goods && goods.id)}`),
        image: String(itemPreview.image || ''),
        summary: String(itemPreview.effectDesc || itemPreview.desc || conds.map(cond => cond.label).join(' / ') || ''),
        itemId,
        itemIds: itemId > 0 ? [itemId] : [],
        itemCount,
        itemPreviews: itemId > 0 ? [itemPreview] : [],
        primaryItemId: itemId,
        shopId: toNum(profile && profile.shop_id),
        shopType: toNum(profile && profile.shop_type),
        shopName: String(profile && profile.shop_name) || getDefaultShopName(profile && profile.shop_type),
        tabKey: String(profile && profile.tabKey) || getShopTabKey(profile),
        priceValue: Math.max(0, toNum(goods && goods.price)),
        priceLabel: `${Math.max(0, toNum(goods && goods.price))} 金币`,
        currencyItemId: 1001,
        currencyLabel: '金币',
        boughtNum,
        limitCount,
        remainingCount,
        isLimited: limitCount > 0,
        unlocked,
        conds,
        condSummary: conds.map(cond => cond.label).join(' / '),
        supportsPurchase: unlocked,
        purchaseDisabledReason: unlocked ? '' : (conds.map(cond => cond.label).join(' / ') || '暂未解锁'),
    };
}

async function getShopProfiles() {
    const body = types.ShopProfilesRequest.encode(types.ShopProfilesRequest.create({})).finish();
    try {
        const { body: replyBody } = await sendMsgAsync('gamepb.shoppb.ShopService', 'ShopProfiles', body);
        return types.ShopProfilesReply.decode(replyBody);
    } catch (error) {
        return { shop_profiles: [...FALLBACK_SHOP_PROFILES], _fallback: true, _error: error };
    }
}

async function getShopInfo(shopId) {
    const body = types.ShopInfoRequest.encode(types.ShopInfoRequest.create({
        shop_id: toLong(shopId),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.shoppb.ShopService', 'ShopInfo', body);
    return types.ShopInfoReply.decode(replyBody);
}

async function buyShopGoods(goodsId, num = 1, price = 0) {
    const body = types.BuyGoodsRequest.encode(types.BuyGoodsRequest.create({
        goods_id: toLong(goodsId),
        num: toLong(Math.max(1, Number(num) || 1)),
        price: toLong(Math.max(0, Number(price) || 0)),
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.shoppb.ShopService', 'BuyGoods', body);
    return types.BuyGoodsReply.decode(replyBody);
}

async function getShopCatalog() {
    const reply = await getShopProfiles();
    const rawProfiles = Array.isArray(reply && reply.shop_profiles) && reply.shop_profiles.length
        ? reply.shop_profiles
        : [...FALLBACK_SHOP_PROFILES];
    const profiles = rawProfiles
        .map(normalizeShopProfile)
        .filter(profile => profile.shopId > 0);

    const sections = [];
    for (const profile of profiles) {
        try {
            const info = await getShopInfo(profile.shopId);
            const goods = (Array.isArray(info && info.goods_list) ? info.goods_list : [])
                .map(goods => normalizeShopGoods(goods, profile))
                .filter(goods => goods.goodsId > 0);
            sections.push({
                ...profile,
                goods,
            });
        } catch (error) {
            sections.push({
                ...profile,
                goods: [],
                error: error && error.message ? String(error.message) : '加载商店失败',
            });
        }
    }

    sections.sort((a, b) => {
        const rank = { seed: 0, pet: 1, dress: 2 };
        return (rank[a.tabKey] ?? 99) - (rank[b.tabKey] ?? 99);
    });

    return {
        sections,
        usedFallbackProfiles: !!(reply && reply._fallback),
    };
}

module.exports = {
    getShopProfiles,
    getShopInfo,
    buyShopGoods,
    getShopCatalog,
};
