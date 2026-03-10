import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api'

function getDefaultMallSection(slotType: number) {
  if (slotType === 1) {
    return {
      slotType,
      slotKey: 'gift',
      label: '礼包商城',
      description: '限时礼包、活动礼包与免费福利',
      supportsPurchase: true,
      purchaseHint: '',
      goods: [],
    }
  }
  if (slotType === 2) {
    return {
      slotType,
      slotKey: 'month_card',
      label: '月卡商城',
      description: '月卡购买页与月卡奖励状态',
      supportsPurchase: false,
      purchaseHint: '月卡购买需在游戏内完成支付',
      goods: [],
    }
  }
  if (slotType === 3) {
    return {
      slotType,
      slotKey: 'recharge',
      label: '充值商城',
      description: '钻石充值页，仅展示价格与档位',
      supportsPurchase: false,
      purchaseHint: '充值类商品需在游戏内完成支付',
      goods: [],
    }
  }
  return {
    slotType,
    slotKey: `slot_${slotType}`,
    label: `商城槽位 ${slotType}`,
    description: '未命名商城槽位',
    supportsPurchase: false,
    purchaseHint: '当前槽位未配置购买能力',
    goods: [],
  }
}

function isNotFoundError(error: any) {
  return Number(error?.response?.status || error?.status || 0) === 404
}

function getLegacySeedImage(seedId: number) {
  const cropId = Number(seedId || 0) % 1000
  if (cropId <= 0)
    return ''
  return `/game-config/seed_images_named/Crop_${cropId}_Seed.png`
}

function buildLegacySeedGoods(seed: any) {
  const seedId = Number(seed?.seedId || 0)
  const goodsId = Number(seed?.goodsId || 0) || seedId
  const name = String(seed?.name || `种子#${seedId || goodsId}`)
  const price = Math.max(0, Number(seed?.price || 0))
  const requiredLevel = Math.max(0, Number(seed?.requiredLevel || 0))
  const locked = !!seed?.locked
  const soldOut = !!seed?.soldOut
  const image = getLegacySeedImage(seedId)
  const condSummary = locked ? `等级达到 Lv${requiredLevel}` : ''
  return {
    sourceType: 'shop',
    entryKey: `shop:seed:${goodsId}`,
    goodsId,
    name,
    type: 5,
    shopId: 2,
    shopType: 2,
    shopName: '种子商店',
    tabKey: 'seed',
    label: '种子',
    description: '金币购买种子',
    image,
    summary: condSummary || '购买后可用于种植',
    itemId: seedId,
    itemIds: seedId > 0 ? [seedId] : [],
    itemCount: 1,
    itemPreviews: [
      {
        id: seedId,
        name,
        image,
        type: 5,
        rarity: 0,
        desc: requiredLevel > 0 ? `Lv${requiredLevel} 解锁` : '',
        effectDesc: '用于种植',
        canUse: false,
        level: requiredLevel,
        price,
        interactionType: 'plant',
        count: 1,
      },
    ],
    priceValue: price,
    priceLabel: `${price} 金币`,
    currencyItemId: 1001,
    currencyLabel: '金币',
    isLimited: false,
    boughtNum: 0,
    limitCount: 0,
    remainingCount: 0,
    supportsPurchase: !locked && !soldOut,
    unlocked: !locked,
    soldOut,
    conds: locked
      ? [{ type: 'level', param: requiredLevel, label: condSummary }]
      : [],
    condSummary,
    purchaseDisabledReason: soldOut ? '已售罄' : condSummary,
  }
}

function buildLegacyShopCatalog(seedRows: any[]) {
  return {
    sections: [
      {
        shopId: 2,
        shopType: 2,
        shopName: '种子商店',
        tabKey: 'seed',
        label: '种子',
        description: '金币购买种子',
        currencyLabel: '金币',
        goods: (Array.isArray(seedRows) ? seedRows : []).map(buildLegacySeedGoods),
      },
    ],
  }
}

export const useBagStore = defineStore('bag', () => {
  const allItems = ref<any[]>([])
  const loading = ref(false)
  const mallCatalog = ref<any | null>(null)
  const shopCatalog = ref<any | null>(null)
  const mallLoading = ref(false)
  const shopLoading = ref(false)
  const sellPreview = ref<any | null>(null)
  const sellPreviewLoading = ref(false)
  const actionLoading = ref(false)

  const items = computed(() => {
    // Filter out hidden items (e.g. coins, coupons, exp which are shown in dashboard)
    const hiddenIds = new Set([1, 1001, 1002, 1101, 1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => !hiddenIds.has(Number(it.id || 0)))
  })

  const dashboardItems = computed(() => {
    const targetIds = new Set([1011, 1012, 3001, 3002])
    return allItems.value.filter((it: any) => targetIds.has(Number(it.id || 0)))
  })

  const mallSections = computed(() => {
    return Array.isArray(mallCatalog.value?.sections) ? mallCatalog.value.sections : []
  })

  const shopSections = computed(() => {
    return Array.isArray(shopCatalog.value?.sections) ? shopCatalog.value.sections : []
  })

  const monthCardInfos = computed(() => {
    return Array.isArray(mallCatalog.value?.monthCards) ? mallCatalog.value.monthCards : []
  })

  const mallGoods = computed(() => {
    const giftSection = mallSections.value.find((section: any) => Number(section?.slotType || 0) === 1 || String(section?.slotKey || '') === 'gift')
    return Array.isArray(giftSection?.goods) ? giftSection.goods : []
  })

  function upsertMallSection(nextSection: any) {
    const nextSections = mallSections.value
      .filter((section: any) => Number(section?.slotType || 0) !== Number(nextSection?.slotType || 0))
      .concat(nextSection)
      .sort((a: any, b: any) => Number(a?.slotType || 0) - Number(b?.slotType || 0))
    mallCatalog.value = {
      ...(mallCatalog.value || {}),
      sections: nextSections,
      monthCards: Array.isArray(mallCatalog.value?.monthCards) ? mallCatalog.value.monthCards : [],
    }
  }

  async function fetchBag(accountId: string) {
    if (!accountId)
      return
    loading.value = true
    try {
      const res = await api.get('/api/bag', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok && res.data.data) {
        allItems.value = Array.isArray(res.data.data.items) ? res.data.data.items : []
      }
    }
    catch (e) {
      console.error(e)
    }
    finally {
      loading.value = false
    }
  }

  async function fetchMallCatalog(accountId: string) {
    if (!accountId)
      return null
    mallLoading.value = true
    try {
      const res = await api.get('/api/mall/catalog', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        mallCatalog.value = res.data.data || { sections: [], monthCards: [] }
        return mallCatalog.value
      }
      return null
    }
    catch (e) {
      if (isNotFoundError(e)) {
        try {
          const sectionRows = await Promise.all([1, 2, 3].map(async (slotType) => {
            try {
              const legacyRes = await api.get('/api/mall/goods', {
                headers: { 'x-account-id': accountId },
                params: { slotType },
              })
              return {
                ...getDefaultMallSection(slotType),
                goods: Array.isArray(legacyRes.data?.data) ? legacyRes.data.data : [],
              }
            }
            catch (sectionError) {
              console.error(sectionError)
              return {
                ...getDefaultMallSection(slotType),
                goods: [],
              }
            }
          }))
          mallCatalog.value = {
            sections: sectionRows,
            monthCards: [],
          }
          return mallCatalog.value
        }
        catch (legacyError) {
          console.error(legacyError)
          return null
        }
      }
      console.error(e)
      return null
    }
    finally {
      mallLoading.value = false
    }
  }

  async function fetchMallGoods(accountId: string, slotType = 1) {
    if (!accountId)
      return null
    mallLoading.value = true
    try {
      const res = await api.get('/api/mall/goods', {
        headers: { 'x-account-id': accountId },
        params: { slotType },
      })
      if (res.data.ok) {
        const currentSection = mallSections.value.find((section: any) => Number(section?.slotType || 0) === Number(slotType))
        upsertMallSection({
          ...(currentSection || getDefaultMallSection(Number(slotType) || 1)),
          goods: Array.isArray(res.data.data) ? res.data.data : [],
        })
        return res.data.data || []
      }
      return null
    }
    catch (e) {
      console.error(e)
      return null
    }
    finally {
      mallLoading.value = false
    }
  }

  async function fetchShopCatalog(accountId: string) {
    if (!accountId)
      return null
    shopLoading.value = true
    try {
      const res = await api.get('/api/shop/catalog', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        shopCatalog.value = res.data.data || { sections: [] }
        return shopCatalog.value
      }
      return null
    }
    catch (e) {
      if (isNotFoundError(e)) {
        try {
          const legacyRes = await api.get('/api/seeds', {
            headers: { 'x-account-id': accountId },
          })
          if (legacyRes.data?.ok) {
            shopCatalog.value = buildLegacyShopCatalog(Array.isArray(legacyRes.data?.data) ? legacyRes.data.data : [])
            return shopCatalog.value
          }
          return null
        }
        catch (legacyError) {
          console.error(legacyError)
          return null
        }
      }
      console.error(e)
      return null
    }
    finally {
      shopLoading.value = false
    }
  }

  async function fetchSellPreview(accountId: string) {
    if (!accountId)
      return null
    sellPreviewLoading.value = true
    try {
      const res = await api.get('/api/bag/sell-preview', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        sellPreview.value = res.data.data || null
        return sellPreview.value
      }
      return null
    }
    catch (e) {
      console.error(e)
      return null
    }
    finally {
      sellPreviewLoading.value = false
    }
  }

  async function fetchBagPreferences(accountId: string) {
    if (!accountId)
      return null
    try {
      const res = await api.get('/api/bag/preferences', {
        headers: { 'x-account-id': accountId },
      })
      return res.data?.ok ? (res.data.data || null) : null
    }
    catch (e) {
      console.error(e)
      return null
    }
  }

  async function saveBagPreferences(accountId: string, payload: { purchaseMemory?: Record<string, any>, activityHistory?: any[] }) {
    if (!accountId)
      return null
    try {
      const res = await api.post('/api/bag/preferences', payload, {
        headers: { 'x-account-id': accountId },
      })
      return res.data?.ok ? (res.data.data || null) : null
    }
    catch (e) {
      console.error(e)
      return null
    }
  }

  async function buyMallGoods(accountId: string, goodsId: number, count = 1) {
    if (!accountId || !goodsId)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/mall/purchase', { goodsId, count }, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchMallCatalog(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  async function claimMonthCardReward(accountId: string, goodsId: number) {
    if (!accountId || !goodsId)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/mall/month-card/claim', { goodsId }, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchMallCatalog(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  async function buyShopGoods(accountId: string, goodsId: number, count = 1) {
    if (!accountId || !goodsId)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/shop/purchase', { goodsId, count }, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchShopCatalog(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  async function useBagItem(accountId: string, itemId: number, count = 1, landIds: number[] = []) {
    if (!accountId || !itemId)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/bag/use', { itemId, count, landIds }, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchSellPreview(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  async function sellByPolicy(accountId: string) {
    if (!accountId)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/bag/sell', {}, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchSellPreview(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  async function sellSelected(accountId: string, itemIds: number[], respectPolicy = true) {
    if (!accountId || !itemIds.length)
      return null
    actionLoading.value = true
    try {
      const res = await api.post('/api/bag/sell-selected', { itemIds, respectPolicy }, {
        headers: { 'x-account-id': accountId },
      })
      await Promise.all([
        fetchBag(accountId),
        fetchSellPreview(accountId),
      ])
      return res.data?.data || null
    }
    finally {
      actionLoading.value = false
    }
  }

  return {
    items,
    allItems,
    dashboardItems,
    mallCatalog,
    mallSections,
    mallGoods,
    monthCardInfos,
    shopCatalog,
    shopSections,
    sellPreview,
    loading,
    mallLoading,
    shopLoading,
    sellPreviewLoading,
    actionLoading,
    fetchBag,
    fetchMallCatalog,
    fetchMallGoods,
    fetchShopCatalog,
    fetchSellPreview,
    fetchBagPreferences,
    saveBagPreferences,
    useBagItem,
    buyMallGoods,
    buyShopGoods,
    claimMonthCardReward,
    sellByPolicy,
    sellSelected,
  }
})
