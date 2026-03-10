const test = require('node:test');
const assert = require('node:assert/strict');

const { createOfflineCommerceHelpers } = require('../src/controllers/admin/offline-commerce');

function createHelpers() {
    const items = new Map([
        [8, { id: 8, name: '金币', type: 1, rarity: 1 }],
        [16, { id: 16, name: '礼包', type: 2, rarity: 1 }],
        [1, { id: 1, name: '水滴', type: 3, rarity: 1 }],
        [1002, { id: 1002, name: '点券', type: 1, rarity: 3 }],
        [1004, { id: 1004, name: '钻石', type: 1, rarity: 4 }],
        [1005, { id: 1005, name: '金豆豆', type: 1, rarity: 3 }],
        [80013, { id: 80013, name: '有机化肥(8小时)', effectDesc: '加速成长', price: 36, type: 4, rarity: 2 }],
        [80014, { id: 80014, name: '有机化肥(12小时)', effectDesc: '加速成长', price: 52, type: 4, rarity: 3 }],
        [80011, { id: 80011, name: '有机化肥(1小时)', effectDesc: '加速成长', price: 5, type: 4, rarity: 1 }],
        [100003, { id: 100003, name: '测试道具', desc: '测试描述', effectDesc: '测试效果', price: 88, level: 15, type: 6, rarity: 2 }],
        [100006, { id: 100006, name: '高级道具', desc: '高级描述', effectDesc: '高级效果', price: 120, level: 20, type: 6, rarity: 3 }],
        [90001, { id: 90001, name: '田园犬', desc: '忠诚的狗狗', effectDesc: '吃饱后可以看家。', price: 4800, level: 0, type: 8, rarity: 1 }],
        [90002, { id: 90002, name: '牧羊犬', desc: '忠诚的狗狗', effectDesc: '吃饱后可以看家。', price: 500000, level: 0, type: 8, rarity: 2 }],
        [90003, { id: 90003, name: '斑点狗', desc: '忠诚的狗狗', effectDesc: '吃饱后可以看家。', price: 1000000, level: 20, type: 8, rarity: 3 }],
        [90011, { id: 90011, name: '柯基', desc: '活泼的柯基', effectDesc: '吃饱后可以看家。', price: 4800, level: 0, type: 8, rarity: 2 }],
        [21011, { id: 21011, name: '萌宠柯基头像框', desc: '萌宠柯基活动获取，使用后获得萌宠柯基专属头像框。', effectDesc: '萌宠柯基专属头像框', price: 980, level: 0, type: 10, rarity: 4 }],
    ]);

    return createOfflineCommerceHelpers({
        getAllSeeds() {
            return [
                { seedId: 2001, name: '白萝卜', price: 12, requiredLevel: 1, image: '/seed/2001.png' },
                { seedId: 2002, name: '黄金瓜', price: 66, requiredLevel: 18, image: '/seed/2002.png' },
            ];
        },
        getItemById(itemId) {
            return items.get(Number(itemId)) || {};
        },
        getItemImageById(itemId) {
            return `/mock/item-${Number(itemId) || 0}.png`;
        },
    });
}

test('offline shop catalog keeps seed lock state and supports goods lookup by goodsId', () => {
    const { buildOfflineShopCatalog, findShopGoodsById } = createHelpers();

    const catalog = buildOfflineShopCatalog({ level: 10 });
    assert.equal(Array.isArray(catalog.sections), true);
    assert.equal(catalog.sections.length, 3);

    const seedSection = catalog.sections[0];
    const petSection = catalog.sections[1];
    const dressSection = catalog.sections[2];
    assert.equal(seedSection.shopName, '种子商店');
    assert.equal(seedSection.goods.length, 2);
    assert.equal(seedSection.goods[0].unlocked, true);
    assert.equal(seedSection.goods[1].unlocked, false);
    assert.equal(seedSection.goods[1].condSummary, '等级达到 Lv18');

    assert.equal(petSection.shopName, '宠物商店');
    assert.equal(petSection.goods[0].itemId, 90011);
    assert.equal(petSection.goods[0].name, '柯基');
    assert.equal(petSection.goods[0].priceLabel, '4800 金币');
    assert.equal(petSection.goods[2].itemId, 90003);
    assert.equal(petSection.goods[2].condSummary, '等级达到 Lv20');

    assert.equal(dressSection.shopName, '装扮商店');
    assert.equal(dressSection.currencyLabel, '金豆豆');
    assert.equal(dressSection.goods.length, 1);
    assert.equal(dressSection.goods[0].itemId, 21011);
    assert.equal(dressSection.goods[0].name, '萌宠柯基头像框');
    assert.equal(dressSection.goods[0].priceLabel, '980 金豆豆');

    const found = findShopGoodsById(catalog, 2002);
    assert.equal(found.name, '黄金瓜');
    assert.equal(found.purchaseDisabledReason, '账号离线，当前仅展示配置内种子清单');
    assert.equal(findShopGoodsById(catalog, 390001).itemId, 90011);
    assert.equal(findShopGoodsById(catalog, 510011).itemId, 21011);
    assert.equal(findShopGoodsById(catalog, 999999), null);
});

test('offline mall catalog keeps three sections and gift snapshots remain non-purchasable offline', () => {
    const { buildOfflineMallCatalog } = createHelpers();

    const catalog = buildOfflineMallCatalog();
    assert.equal(Array.isArray(catalog.sections), true);
    assert.equal(catalog.sections.length, 3);
    assert.equal(Array.isArray(catalog.monthCards), true);
    assert.equal(catalog.monthCards.length, 0);

    const giftSection = catalog.sections[0];
    const monthCardSection = catalog.sections[1];
    const rechargeSection = catalog.sections[2];
    assert.equal(giftSection.slotKey, 'gift');
    assert.equal(giftSection.supportsPurchase, true);
    assert.equal(giftSection.goods.length, 19);
    assert.equal(giftSection.goods[0].name, '每日福利');
    assert.equal(giftSection.goods[0].image, '/mock/item-80001.png');
    assert.equal(giftSection.goods[1].name, '柯基活动礼包');
    assert.equal(giftSection.goods[1].image, '/game-config/item_icons/mall_gift_corgi_diamond.png');
    assert.equal(giftSection.goods[1].priceLabel, '25 钻石');
    assert.equal(giftSection.goods[2].name, '柯基活动礼包');
    assert.equal(giftSection.goods[2].image, '/game-config/item_icons/mall_gift_corgi_coupon.png');
    assert.equal(giftSection.goods[2].priceLabel, '25 点券');
    assert.equal(giftSection.goods[3].name, '10小时有机化肥');
    assert.equal(giftSection.goods[3].image, '/mock/item-80013.png');
    assert.equal(giftSection.goods[7].name, '狗粮礼包');
    assert.equal(giftSection.goods[0].supportsPurchase, false);
    assert.equal(giftSection.goods[0].purchaseDisabledReason, '账号离线，当前仅展示最近一次抓取到的礼包商城数据');

    assert.equal(monthCardSection.slotKey, 'month_card');
    assert.equal(monthCardSection.goods.length, 1);
    assert.equal(monthCardSection.goods[0].name, '超级月卡');
    assert.equal(monthCardSection.goods[0].priceLabel, '￥18');
    assert.deepEqual(monthCardSection.goods[0].itemIds, [1002, 1004]);
    assert.equal(monthCardSection.goods[0].image, '/game-config/item_icons/mall_monthcard_super.png');

    assert.equal(rechargeSection.slotKey, 'recharge');
    assert.equal(rechargeSection.goods.length, 8);
    assert.equal(rechargeSection.goods[0].name, '10钻石');
    assert.equal(rechargeSection.goods[0].priceLabel, '￥1');
    assert.equal(rechargeSection.goods[0].image, '/game-config/item_icons/mall_recharge_10.png');
    assert.equal(rechargeSection.goods[7].name, '6480钻石');
    assert.equal(rechargeSection.goods[7].priceLabel, '￥648');
    assert.equal(rechargeSection.goods[7].image, '/game-config/item_icons/mall_recharge_6480.png');
});
