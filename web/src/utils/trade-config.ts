export type TradeSellJudgeBy = 'plant_level' | 'unit_price' | 'either'

export interface TradeSellStrategyDraft {
  keepMinEachFruit: number
  keepFruitIds: number[]
  rareKeepEnabled: boolean
  judgeBy: TradeSellJudgeBy
  minPlantLevel: number
  minUnitPrice: number
  batchSize: number
  previewBeforeManualSell: boolean
}

const TRADE_KEEP_MIN_EACH_FRUIT_MAX = 999999
const TRADE_RARE_KEEP_MIN_PLANT_LEVEL_MAX = 999
const TRADE_RARE_KEEP_MIN_UNIT_PRICE_MAX = 999999999
const TRADE_BATCH_SIZE_MAX = 50

const DEFAULT_TRADE_SELL_RARE_KEEP = {
  enabled: false,
  judgeBy: 'either' as TradeSellJudgeBy,
  minPlantLevel: 40,
  minUnitPrice: 2000,
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value), 10)
  const base = Number.isFinite(parsed) ? parsed : Number.parseInt(String(fallback), 10)
  const next = Number.isFinite(base) ? base : min
  return Math.max(min, Math.min(max, next))
}

function resolveTradeSellJudgeBy(value: unknown): TradeSellJudgeBy {
  return ['either', 'plant_level', 'unit_price'].includes(String(value))
    ? String(value) as TradeSellJudgeBy
    : DEFAULT_TRADE_SELL_RARE_KEEP.judgeBy
}

export function createDefaultTradeSellConfig() {
  return {
    scope: 'fruit_only' as const,
    keepMinEachFruit: 0,
    keepFruitIds: [] as number[],
    rareKeep: { ...DEFAULT_TRADE_SELL_RARE_KEEP },
    batchSize: 15,
    previewBeforeManualSell: false,
  }
}

export function createDefaultTradeConfig() {
  return {
    sell: createDefaultTradeSellConfig(),
  }
}

export function normalizeTradeKeepFruitIds(input: unknown) {
  const rawItems = Array.isArray(input)
    ? input
    : String(input || '').split(/[\s,，]+/)
  const normalizedIds = rawItems
    .map(item => Number(item))
    .filter(item => Number.isFinite(item) && item > 0)
  return Array.from(new Set(normalizedIds))
}

export function normalizeTradeSellConfig(rawTradeConfig: any) {
  const defaults = createDefaultTradeSellConfig()
  const rawSell = rawTradeConfig?.sell && typeof rawTradeConfig.sell === 'object'
    ? rawTradeConfig.sell
    : {}
  const rawRareKeep = rawSell.rareKeep && typeof rawSell.rareKeep === 'object'
    ? rawSell.rareKeep
    : {}
  return {
    scope: defaults.scope,
    keepMinEachFruit: clampInteger(rawSell.keepMinEachFruit, defaults.keepMinEachFruit, 0, TRADE_KEEP_MIN_EACH_FRUIT_MAX),
    keepFruitIds: normalizeTradeKeepFruitIds(rawSell.keepFruitIds),
    rareKeep: {
      ...defaults.rareKeep,
      enabled: !!rawRareKeep.enabled,
      judgeBy: resolveTradeSellJudgeBy(rawRareKeep.judgeBy),
      minPlantLevel: clampInteger(rawRareKeep.minPlantLevel, defaults.rareKeep.minPlantLevel, 0, TRADE_RARE_KEEP_MIN_PLANT_LEVEL_MAX),
      minUnitPrice: clampInteger(rawRareKeep.minUnitPrice, defaults.rareKeep.minUnitPrice, 0, TRADE_RARE_KEEP_MIN_UNIT_PRICE_MAX),
    },
    batchSize: clampInteger(rawSell.batchSize, defaults.batchSize, 1, TRADE_BATCH_SIZE_MAX),
    previewBeforeManualSell: !!rawSell.previewBeforeManualSell,
  }
}

export function normalizeTradeConfig(rawTradeConfig: any) {
  return {
    sell: normalizeTradeSellConfig(rawTradeConfig),
  }
}

export function buildTradeSellStrategyDraft(rawTradeConfig?: any): TradeSellStrategyDraft {
  const sell = normalizeTradeSellConfig(rawTradeConfig)
  return {
    keepMinEachFruit: sell.keepMinEachFruit,
    keepFruitIds: [...sell.keepFruitIds],
    rareKeepEnabled: !!sell.rareKeep.enabled,
    judgeBy: sell.rareKeep.judgeBy,
    minPlantLevel: sell.rareKeep.minPlantLevel,
    minUnitPrice: sell.rareKeep.minUnitPrice,
    batchSize: sell.batchSize,
    previewBeforeManualSell: !!sell.previewBeforeManualSell,
  }
}

export function buildTradeSellConfigFromDraft(draft: Partial<TradeSellStrategyDraft>, keepFruitIdsSource?: unknown) {
  return normalizeTradeSellConfig({
    sell: {
      scope: 'fruit_only',
      keepMinEachFruit: draft.keepMinEachFruit,
      keepFruitIds: keepFruitIdsSource ?? draft.keepFruitIds,
      rareKeep: {
        enabled: draft.rareKeepEnabled,
        judgeBy: draft.judgeBy,
        minPlantLevel: draft.minPlantLevel,
        minUnitPrice: draft.minUnitPrice,
      },
      batchSize: draft.batchSize,
      previewBeforeManualSell: draft.previewBeforeManualSell,
    },
  })
}
