const { Buffer } = require('node:buffer');
/**
 * 商城自动购买
 * 当前实现：自动购买有机化肥（item_id=1012）
 */

const { getItemById, getItemImageById } = require('../config/gameConfig');
const { sendMsgAsync, getUserState } = require('../utils/network');
const { types } = require('../utils/proto');
const { toNum, log, sleep } = require('../utils/utils');
const { getMonthCardInfos, claimMonthCardReward } = require('./monthcard');

const ORGANIC_FERTILIZER_MALL_GOODS_ID = 1002;
const BUY_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_ROUNDS = 100;
const BUY_PER_ROUND = 10;
const FREE_GIFTS_DAILY_KEY = 'mall_free_gifts';
const MALL_SLOT_META = Object.freeze({
    1: {
        key: 'gift',
        label: '礼包商城',
        description: '限时礼包、活动礼包与免费福利',
        supportsPurchase: true,
        purchaseHint: '',
    },
    2: {
        key: 'month_card',
        label: '月卡商城',
        description: '月卡购买页与月卡奖励状态',
        supportsPurchase: false,
        purchaseHint: '月卡购买需在游戏内完成支付',
    },
    3: {
        key: 'recharge',
        label: '充值商城',
        description: '钻石充值页，仅展示价格与档位',
        supportsPurchase: false,
        purchaseHint: '充值类商品需在游戏内完成支付',
    },
});

let lastBuyAt = 0;
let buyDoneDateKey = '';
let buyLastSuccessAt = 0;
let buyPausedNoGoldDateKey = '';
let freeGiftDoneDateKey = '';
let freeGiftLastAt = 0;
let freeGiftLastCheckAt = 0;

function getMallSlotMeta(slotType = 1) {
    return MALL_SLOT_META[Number(slotType) || 1] || {
        key: `slot_${Number(slotType) || 1}`,
        label: `商城槽位 ${Number(slotType) || 1}`,
        description: '未命名商城槽位',
        supportsPurchase: false,
        purchaseHint: '当前槽位未配置购买能力',
    };
}

function getDateKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function getMallListBySlotType(slotType = 1) {
    const body = types.GetMallListBySlotTypeRequest.encode(types.GetMallListBySlotTypeRequest.create({
        slot_type: Number(slotType) || 1,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'GetMallListBySlotType', body);
    return types.GetMallListBySlotTypeResponse.decode(replyBody);
}

async function purchaseMallGoods(goodsId, count = 1) {
    const body = types.PurchaseRequest.encode(types.PurchaseRequest.create({
        goods_id: Number(goodsId) || 0,
        count: Number(count) || 1,
    })).finish();
    const { body: replyBody } = await sendMsgAsync('gamepb.mallpb.MallService', 'Purchase', body);
    return types.PurchaseResponse.decode(replyBody);
}

async function getMallGoodsList(slotType = 1) {
    const mall = await getMallListBySlotType(slotType);
    const raw = Array.isArray(mall && mall.goods_list) ? mall.goods_list : [];
    const goods = [];
    for (const b of raw) {
        try {
            goods.push(types.MallGoods.decode(b));
        } catch {
            // ignore
        }
    }
    return goods;
}

function parseMallPriceMeta(priceField, slotType = 1) {
    if (priceField == null) {
        return {
            itemId: 0,
            value: 0,
            itemName: '',
            itemImage: '',
            label: '',
        };
    }
    if (typeof priceField === 'number') {
        const value = Math.max(0, Math.floor(priceField));
        return {
            itemId: 0,
            value,
            itemName: '',
            itemImage: '',
            label: (Number(slotType) === 2 || Number(slotType) === 3) ? `￥${value}` : String(value),
        };
    }
    const bytes = Buffer.isBuffer(priceField) ? priceField : Buffer.from(priceField || []);
    if (!bytes.length) {
        return {
            itemId: 0,
            value: 0,
            itemName: '',
            itemImage: '',
            label: '',
        };
    }

    let itemId = 0;
    let value = 0;
    try {
        const decoded = types.CoreItem.decode(bytes);
        itemId = toNum(decoded && decoded.id);
        value = Math.max(0, toNum(decoded && decoded.count));
    } catch {
        // ignore and fall back to raw varint scan below
    }

    if (!value) {
        // 从 bytes 中读取 field=2 的 varint 作为价格
        let idx = 0;
        let parsed = 0;
        while (idx < bytes.length) {
            const key = bytes[idx++];
            const field = key >> 3;
            const wire = key & 0x07;
            if (wire !== 0) break;
            let val = 0;
            let shift = 0;
            while (idx < bytes.length) {
                const b = bytes[idx++];
                val |= (b & 0x7F) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
            }
            if (field === 1 && !itemId) itemId = val;
            if (field === 2) parsed = val;
        }
        value = Math.max(0, Math.floor(parsed || 0));
    }

    const priceItem = itemId > 0 ? (getItemById(itemId) || {}) : {};
    let label = '';
    if (itemId === 1001) label = `${value} 金币`;
    else if (itemId === 1002) label = `${value} 点券`;
    else if (itemId === 1004) label = `${value} 钻石`;
    else if (itemId > 0 && priceItem.name) label = `${value} ${priceItem.name}`;
    else if (Number(slotType) === 2 || Number(slotType) === 3) label = `￥${value}`;
    else label = String(value);

    return {
        itemId,
        value,
        itemName: String(priceItem.name || ''),
        itemImage: itemId > 0 ? getItemImageById(itemId) : '',
        label,
    };
}

function parseMallPriceValue(priceField, slotType = 1) {
    return Math.max(0, Number(parseMallPriceMeta(priceField, slotType).value || 0));
}

function parseMallIntList(bytesField) {
    const bytes = Buffer.isBuffer(bytesField) ? bytesField : Buffer.from(bytesField || []);
    if (!bytes.length) return [];
    const values = [];
    let idx = 0;
    while (idx < bytes.length) {
        let value = 0;
        let shift = 0;
        while (idx < bytes.length) {
            const b = bytes[idx++];
            value |= (b & 0x7F) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
        }
        if (value > 0) values.push(value);
    }
    return values;
}

function buildMallItemPreviews(itemIds = []) {
    return (Array.isArray(itemIds) ? itemIds : [])
        .filter(itemId => Number(itemId) > 0)
        .map((itemId) => {
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
            };
        });
}

function isGenericItemIcon(image = '') {
    return /^\/asset-cache\/item-icons\/item-\d+\.svg$/i.test(String(image || ''));
}

function pickPrimaryMallItem(itemPreviews = []) {
    const previews = Array.isArray(itemPreviews) ? itemPreviews : [];
    return previews.find(item => item.image && !isGenericItemIcon(item.image))
        || previews.find(item => !!item.image)
        || previews[0]
        || null;
}

function normalizeMallGoods(goods, slotType = 1) {
    const row = goods || {};
    const slotMeta = getMallSlotMeta(slotType);
    const itemIds = parseMallIntList(row.item_ids);
    const itemPreviews = buildMallItemPreviews(itemIds);
    const primaryItem = pickPrimaryMallItem(itemPreviews);
    const priceMeta = parseMallPriceMeta(row.price, slotType);
    return {
        sourceType: 'mall',
        entryKey: `mall:${Number(slotType) || 1}:${toNum(row.goods_id)}`,
        goodsId: toNum(row.goods_id),
        name: String(row.name || `商品#${toNum(row.goods_id)}`),
        type: toNum(row.type),
        slotType: Number(slotType) || 1,
        slotKey: slotMeta.key,
        slotLabel: slotMeta.label,
        slotDescription: slotMeta.description,
        isFree: row.is_free === true,
        isLimited: row.is_limited === true,
        discount: String(row.discount || ''),
        priceValue: priceMeta.value,
        priceItemId: priceMeta.itemId,
        priceItemName: priceMeta.itemName,
        priceLabel: row.is_free === true ? '免费领取' : priceMeta.label,
        itemIds,
        image: primaryItem ? String(primaryItem.image || '') : '',
        primaryItemId: primaryItem ? Number(primaryItem.id || 0) : 0,
        summary: primaryItem ? String(primaryItem.effectDesc || primaryItem.desc || '') : String(slotMeta.description || ''),
        itemPreviews,
        supportsPurchase: !!slotMeta.supportsPurchase,
        purchaseDisabledReason: slotMeta.supportsPurchase ? '' : slotMeta.purchaseHint,
    };
}

async function getMallGoodsCatalog(slotType = 1) {
    const goods = await getMallGoodsList(slotType);
    return goods.map(item => normalizeMallGoods(item, slotType));
}

function normalizeMonthCardInfo(info) {
    const goodsId = Number(info && info.goods_id) || 0;
    const reward = info && info.reward ? info.reward : null;
    const rewardId = toNum(reward && reward.id);
    const rewardCount = Math.max(0, toNum(reward && reward.count));
    const item = rewardId > 0 ? (getItemById(rewardId) || {}) : {};
    return {
        goodsId,
        canClaim: !!(info && info.can_claim),
        reward: rewardId > 0
            ? {
                id: rewardId,
                count: rewardCount,
                name: String(item.name || `物品#${rewardId}`),
                image: getItemImageById(rewardId),
                desc: String(item.desc || ''),
                effectDesc: String(item.effectDesc || ''),
            }
            : null,
    };
}

async function getMallCatalog() {
    const sections = [];
    for (const slotType of [1, 2, 3]) {
        const slotMeta = getMallSlotMeta(slotType);
        try {
            const goods = await getMallGoodsCatalog(slotType);
            sections.push({
                slotType,
                slotKey: slotMeta.key,
                label: slotMeta.label,
                description: slotMeta.description,
                supportsPurchase: !!slotMeta.supportsPurchase,
                purchaseHint: slotMeta.purchaseHint,
                goods,
            });
        } catch (error) {
            sections.push({
                slotType,
                slotKey: slotMeta.key,
                label: slotMeta.label,
                description: slotMeta.description,
                supportsPurchase: !!slotMeta.supportsPurchase,
                purchaseHint: slotMeta.purchaseHint,
                goods: [],
                error: error && error.message ? String(error.message) : '加载商城失败',
            });
        }
    }

    let monthCards = [];
    try {
        const reply = await getMonthCardInfos();
        monthCards = (Array.isArray(reply && reply.infos) ? reply.infos : []).map(normalizeMonthCardInfo);
    } catch {
        monthCards = [];
    }

    return { sections, monthCards };
}

function findOrganicFertilizerMallGoods(goodsList) {
    const list = Array.isArray(goodsList) ? goodsList : [];
    return list.find((g) => toNum(g && g.goods_id) === ORGANIC_FERTILIZER_MALL_GOODS_ID) || null;
}

async function autoBuyOrganicFertilizerViaMall() {
    const today = getDateKey();
    const { getAutomation, getFertilizerBoughtData, recordFertilizerBought } = require('../models/store');

    let boughtData = getFertilizerBoughtData();
    let dailyBoughtCount = 0;
    if (boughtData.date === today) {
        dailyBoughtCount = boughtData.count || 0;
    }

    const limit = Number((getAutomation() || {}).fertilizer_buy_limit) || 100;

    if (dailyBoughtCount >= limit) {
        buyDoneDateKey = today; // 视为今日已完成任务
        return 0;
    }

    const goodsList = await getMallGoodsList(1);
    const goods = findOrganicFertilizerMallGoods(goodsList);
    if (!goods) return 0;

    const goodsId = toNum(goods.goods_id);
    if (goodsId <= 0) return 0;
    const singlePrice = parseMallPriceValue(goods.price);
    let ticket = Math.max(0, toNum((getUserState() || {}).ticket));
    let totalBought = 0;

    // 最大可买单数，受到配置余额、本身剩余份额和后端购买限制（如每把10单）的三重制约
    let maxCanBuy = limit - dailyBoughtCount;
    if (singlePrice > 0 && ticket > 0) {
        maxCanBuy = Math.min(maxCanBuy, Math.floor(ticket / singlePrice) || 1);
    }

    let perRound = Math.min(BUY_PER_ROUND, Math.max(1, maxCanBuy));

    for (let i = 0; i < MAX_ROUNDS; i++) {
        if (singlePrice > 0 && ticket > 0 && ticket < singlePrice) {
            buyPausedNoGoldDateKey = getDateKey();
            break;
        }

        if (totalBought >= maxCanBuy) {
            buyDoneDateKey = getDateKey();
            break;
        }

        const thisRoundBuy = Math.min(perRound, maxCanBuy - totalBought);
        if (thisRoundBuy <= 0) break;

        try {
            await purchaseMallGoods(goodsId, thisRoundBuy);
            totalBought += thisRoundBuy;
            dailyBoughtCount += thisRoundBuy;

            recordFertilizerBought(null, dailyBoughtCount, getDateKey());

            if (singlePrice > 0 && ticket > 0) {
                ticket = Math.max(0, ticket - (singlePrice * thisRoundBuy));
                if (ticket < singlePrice) break;
            }
            await sleep(300);
        } catch (e) {
            const msg = String((e && e.message) || '');
            if (msg.includes('余额不足') || msg.includes('点券不足') || msg.includes('code=1000019')) {
                if (perRound > 1) {
                    perRound = 1;
                    continue;
                }
                buyPausedNoGoldDateKey = getDateKey();
            }
            break;
        }
    }
    return totalBought;
}

async function autoBuyOrganicFertilizer(force = false) {
    const now = Date.now();
    if (!force && now - lastBuyAt < BUY_COOLDOWN_MS) return 0;
    lastBuyAt = now;

    try {
        // 使用 MallService 购买链路（点券）
        const totalBought = await autoBuyOrganicFertilizerViaMall();
        if (totalBought > 0) {
            buyDoneDateKey = getDateKey();
            buyLastSuccessAt = Date.now();
            log('商城', `自动购买有机化肥 x${totalBought}`, {
                module: 'warehouse',
                event: 'fertilizer_buy',
                result: 'ok',
                count: totalBought,
            });
        }
        return totalBought;
    } catch {
        return 0;
    }
}

function isDoneTodayByKey(key) {
    return String(key || '') === getDateKey();
}

async function buyFreeGifts(force = false) {
    const now = Date.now();
    if (!force && isDoneTodayByKey(freeGiftDoneDateKey)) return 0;
    if (!force && now - freeGiftLastCheckAt < BUY_COOLDOWN_MS) return 0;
    freeGiftLastCheckAt = now;

    try {
        const mall = await getMallListBySlotType(1);
        const raw = Array.isArray(mall && mall.goods_list) ? mall.goods_list : [];
        const goods = [];
        for (const b of raw) {
            try {
                goods.push(types.MallGoods.decode(b));
            } catch {
                // ignore
            }
        }
        const free = goods.filter((g) => !!g && g.is_free === true && Number(g.goods_id || 0) > 0);
        if (!free.length) {
            freeGiftDoneDateKey = getDateKey();
            log('商城', '今日暂无可领取免费礼包', {
                module: 'task',
                event: FREE_GIFTS_DAILY_KEY,
                result: 'none',
            });
            return 0;
        }

        let bought = 0;
        for (const g of free) {
            try {
                await purchaseMallGoods(Number(g.goods_id || 0), 1);
                bought += 1;
            } catch {
                // 单个失败跳过
            }
        }
        freeGiftDoneDateKey = getDateKey();
        if (bought > 0) {
            freeGiftLastAt = Date.now();
            log('商城', `自动购买免费礼包 x${bought}`, {
                module: 'task',
                event: FREE_GIFTS_DAILY_KEY,
                result: 'ok',
                count: bought,
            });
        } else {
            log('商城', '本次未成功领取免费礼包', {
                module: 'task',
                event: FREE_GIFTS_DAILY_KEY,
                result: 'none',
            });
        }
        return bought;
    } catch (e) {
        log('商城', `领取免费礼包失败: ${e.message}`, {
            module: 'task',
            event: FREE_GIFTS_DAILY_KEY,
            result: 'error',
        });
        return 0;
    }
}

module.exports = {
    getMallListBySlotType,
    getMallGoodsList,
    getMallGoodsCatalog,
    getMallCatalog,
    purchaseMallGoods,
    claimMonthCardRewardByGoodsId: claimMonthCardReward,
    autoBuyOrganicFertilizer,
    buyFreeGifts,
    getFertilizerBuyDailyState: () => ({
        key: 'fertilizer_buy',
        doneToday: buyDoneDateKey === getDateKey(),
        pausedNoGoldToday: buyPausedNoGoldDateKey === getDateKey(),
        lastSuccessAt: buyLastSuccessAt,
    }),
    getFreeGiftDailyState: () => ({
        key: FREE_GIFTS_DAILY_KEY,
        doneToday: freeGiftDoneDateKey === getDateKey(),
        lastCheckAt: freeGiftLastCheckAt,
        lastClaimAt: freeGiftLastAt,
    }),
};
