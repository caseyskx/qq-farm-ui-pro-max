<script setup lang="ts">
import type { AnalyticsViewState } from '@/utils/view-preferences'
import { useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api from '@/api'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { useAccountStore } from '@/stores/account'
import { useStatusStore } from '@/stores/status'
import { DEFAULT_ANALYTICS_VIEW_STATE, fetchViewPreferences, normalizeAnalyticsViewState, saveViewPreferences } from '@/utils/view-preferences'

interface AnalyticsCrop {
  seedId?: number | string
  name?: string
  image?: string
  level?: number | null
  seasons?: number
  growTime?: number
  expPerHour?: number
  profitPerHour?: number
  normalFertilizerExpPerHour?: number
  normalFertilizerProfitPerHour?: number
}

interface CalculatorCrop {
  seedId?: number | string
  name?: string
  thumb?: string
  requiredLevel?: number | null
  level?: number | null
  expPerHourNoFert?: number
  expPerHourFert?: number
  expPerDayNoFert?: number
  expPerDayFert?: number
  gainPercent?: number
  growTimeSec?: number
  growTimeStr?: string
  growTimeFert?: number
  growTimeFertStr?: string
  fullCycleGrowSec?: number
  fullCycleGrowStr?: string
  fullCycleGrowFertWithS2Sec?: number
  fullCycleGrowFertWithS2Str?: string
  cycleNoFert?: number
  cycleFert?: number
  twoSeasonDiff?: boolean
  secondSeasonGrowStr?: string
  secondSeasonGrowFertStr?: string
  secondSeasonFertActive?: boolean
  fertBestPhaseNames?: string[]
}

interface RawToolCropPhase {
  name?: string
  seconds?: number
  img?: string
}

interface RawToolCrop {
  seed_id?: number | string
  name?: string
  level?: number
  land_level_need?: number
  asset_name?: string
  price?: number
  exp?: number
  fruitCount?: number
  fruitSellPrice?: number
  seasons?: number
  phases?: RawToolCropPhase[]
}

interface CalculatorResult {
  level?: number
  lands?: number
  landDist?: Partial<Record<string, number>>
  totalCrops?: number
  smartFert?: boolean
  ideal?: boolean
  secondSeasonFert?: boolean
  plantSecNoFert?: number
  fertActionSec?: number
  rowsFert?: CalculatorCrop[]
  rowsNoFert?: CalculatorCrop[]
  bestFert?: CalculatorCrop | null
  bestNoFert?: CalculatorCrop | null
}

type RecommendationMode = 'noFert' | 'fert'

interface RecommendationCard {
  key: string
  label: string
  icon: string
  crop: CalculatorCrop | null
  metricLabel: string
  metricValue: string
  details: Array<{
    label: string
    value: string
    tone?: 'success' | 'info'
  }>
  note: string
}

const accountStore = useAccountStore()
const statusStore = useStatusStore()
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { status, realtimeConnected } = storeToRefs(statusStore)

const loading = ref(false)
const recommendationLoading = ref(false)
const recommendationError = ref('')
const list = ref<AnalyticsCrop[]>([])
const calculatorResult = ref<CalculatorResult | null>(null)
const sortKey = useStorage<AnalyticsViewState['sortKey']>('analytics_sort_key', DEFAULT_ANALYTICS_VIEW_STATE.sortKey)
const imageErrors = ref<Record<string | number, boolean>>({})
const strategyPanelCollapsed = useStorage('analytics_strategy_collapsed', false)
const strategyLevel = ref(0)
const strategyLevelMode = ref<'account' | 'manual'>('account')
const liveAccountLevel = ref<number | null>(null)
const ANALYTICS_BROWSER_PREF_NOTE = '排序方式和推荐面板状态会跟随当前登录用户同步到服务器；顶部推荐按农场工具默认口径自动计算，底部始终展示完整作物图鉴。'
let analyticsViewSyncTimer: ReturnType<typeof setTimeout> | null = null
let analyticsViewHydrating = false
let analyticsViewSyncEnabled = false

const analyticsViewSignature = computed(() => JSON.stringify(buildAnalyticsViewState()))

const sortOptions = [
  { value: 'exp', label: '经验/小时' },
  { value: 'fert', label: '普通肥经验/小时' },
  { value: 'profit', label: '利润/小时' },
  { value: 'fert_profit', label: '普通肥利润/小时' },
  { value: 'level', label: '等级' },
]

const currentAccountLevel = computed(() => normalizeLevel(currentAccount.value?.level))
const effectiveAccountLevel = computed(() => liveAccountLevel.value ?? currentAccountLevel.value)
const recommendationLevel = computed(() => strategyLevel.value > 0 ? strategyLevel.value : 0)

const atlasImageMap = computed(() => {
  const entries = list.value
    .map((item) => {
      const seedId = Number(item.seedId)
      return Number.isFinite(seedId) && item.image ? [seedId, item.image] as const : null
    })
    .filter(Boolean) as Array<readonly [number, string]>
  return new Map(entries)
})

const analyticsSummaryChips = computed(() => [
  { key: 'total', label: `共 ${list.value.length} 个作物`, tone: 'ui-meta-chip--info' },
  { key: 'sort', label: `排序 ${sortOptions.find(option => option.value === sortKey.value)?.label || '未知'}`, tone: 'ui-meta-chip--neutral' },
  {
    key: 'level',
    label: currentAccountId.value
      ? (effectiveAccountLevel.value > 0 ? `当前账号 Lv${effectiveAccountLevel.value}` : '当前账号等级未知')
      : '未选择账号',
    tone: currentAccountId.value
      ? (effectiveAccountLevel.value > 0 ? 'ui-meta-chip--brand' : 'ui-meta-chip--warning')
      : 'ui-meta-chip--neutral',
  },
  {
    key: 'recommendation',
    label: recommendationLevel.value > 0
      ? `推荐按 Lv${recommendationLevel.value} 工具链计算`
      : '推荐等待等级输入',
    tone: recommendationLevel.value > 0 ? 'ui-meta-chip--success' : 'ui-meta-chip--warning',
  },
])

const strategySummaryText = computed(() => {
  if (strategyLevelMode.value === 'account') {
    return effectiveAccountLevel.value > 0
      ? `已按当前账号 Lv${effectiveAccountLevel.value} 自动计算经验推荐和时间推荐`
      : '当前账号等级未知，可手动输入等级查看推荐'
  }
  return strategyLevel.value > 0
    ? `当前按 Lv${strategyLevel.value} 计算推荐，底部图鉴仍显示完整作物`
    : '请输入等级以查看推荐'
})

const strategyInputValue = computed(() => (strategyLevel.value > 0 ? String(strategyLevel.value) : ''))

const recommendationOverviewCards = computed(() => {
  const result = calculatorResult.value
  return [
    {
      key: 'level',
      label: '计算等级',
      value: recommendationLevel.value > 0 ? `Lv${recommendationLevel.value}` : '未设置',
      meta: strategyLevelMode.value === 'account' ? '跟随当前账号' : '手动预览等级',
    },
    {
      key: 'lands',
      label: '默认土地',
      value: result ? formatLandDistribution(result.landDist, result.lands) : '等待计算',
      meta: result?.lands ? `${result.lands} 块地自动分布` : '按农场工具默认分布',
    },
    {
      key: 'scope',
      label: '工具口径',
      value: result?.totalCrops ? `${result.totalCrops} 种可用作物` : '等待计算',
      meta: buildCalculatorModeSummary(result),
    },
  ]
})

const experienceRecommendationCards = computed<RecommendationCard[]>(() => {
  const result = calculatorResult.value
  const noFert = result?.bestNoFert ?? null
  const fert = result?.bestFert ?? null
  return [
    {
      key: 'exp-no-fert',
      label: '不施肥经验推荐',
      icon: 'i-carbon-growth',
      crop: noFert,
      metricLabel: '每小时经验',
      metricValue: formatMetric(noFert?.expPerHourNoFert),
      details: [
        { label: '每日经验', value: formatInteger(noFert?.expPerDayNoFert) },
        { label: '成熟时间', value: getDurationLabel(noFert, 'noFert') },
        { label: '需求等级', value: `Lv${formatLv(getCropLevel(noFert))}` },
      ],
      note: buildCropNote(noFert, 'noFert'),
    },
    {
      key: 'exp-fert',
      label: '施肥经验推荐',
      icon: 'i-carbon-flash',
      crop: fert,
      metricLabel: '每小时经验',
      metricValue: formatMetric(fert?.expPerHourFert),
      details: [
        { label: '每日经验', value: formatInteger(fert?.expPerDayFert) },
        { label: '肥后成熟', value: getDurationLabel(fert, 'fert') },
        { label: '提升比例', value: formatGainPercent(fert?.gainPercent), tone: 'success' },
      ],
      note: buildCropNote(fert, 'fert'),
    },
  ]
})

const timeRecommendationCards = computed<RecommendationCard[]>(() => {
  const result = calculatorResult.value
  const fastestNoFert = pickFastestCrop(result?.rowsNoFert, 'noFert')
  const fastestFert = pickFastestCrop(result?.rowsFert, 'fert')
  return [
    {
      key: 'time-no-fert',
      label: '不施肥时间推荐',
      icon: 'i-carbon-timer',
      crop: fastestNoFert,
      metricLabel: '最短成熟',
      metricValue: getDurationLabel(fastestNoFert, 'noFert'),
      details: [
        { label: '每小时经验', value: formatMetric(fastestNoFert?.expPerHourNoFert) },
        { label: '单轮周期', value: getCycleLabel(fastestNoFert, 'noFert') },
        { label: '需求等级', value: `Lv${formatLv(getCropLevel(fastestNoFert))}` },
      ],
      note: buildTimeNote(fastestNoFert, 'noFert'),
    },
    {
      key: 'time-fert',
      label: '施肥时间推荐',
      icon: 'i-carbon-time-plot',
      crop: fastestFert,
      metricLabel: '肥后成熟',
      metricValue: getDurationLabel(fastestFert, 'fert'),
      details: [
        { label: '每小时经验', value: formatMetric(fastestFert?.expPerHourFert) },
        { label: '缩短时长', value: getSavedTimeLabel(fastestFert), tone: 'info' },
        { label: '施肥阶段', value: getFertilizerPhaseLabel(fastestFert) },
      ],
      note: buildTimeNote(fastestFert, 'fert'),
    },
  ]
})

const recommendationSeedTags = computed<Record<string, string[]>>(() => {
  const mapping: Record<string, string[]> = {}
  const push = (crop: CalculatorCrop | null, label: string) => {
    const seedId = String(crop?.seedId || '').trim()
    if (!seedId)
      return
    if (!mapping[seedId])
      mapping[seedId] = []
    if (!mapping[seedId].includes(label))
      mapping[seedId].push(label)
  }

  for (const card of experienceRecommendationCards.value)
    push(card.crop, '经验推荐')

  for (const card of timeRecommendationCards.value)
    push(card.crop, '时间推荐')

  return mapping
})

function normalizeLevel(value: unknown) {
  const level = Number(value)
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0
}

function toSafeNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatMetric(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? num.toFixed(2) : '--'
}

function formatInteger(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num).toLocaleString() : '--'
}

function formatGainPercent(value: unknown) {
  const num = Number(value)
  return Number.isFinite(num) ? `${num >= 0 ? '+' : ''}${num.toFixed(2)}%` : '--'
}

function formatLv(level: unknown) {
  if (level === null || level === undefined || level === '')
    return '未知'
  const value = Number(level)
  if (!Number.isFinite(value) || value < 0)
    return '未知'
  return String(value)
}

function formatGrowTime(seconds: unknown) {
  const s = Math.round(Number(seconds))
  if (!Number.isFinite(s) || s <= 0)
    return '--'
  if (s < 60)
    return `${s}秒`
  if (s < 3600) {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分`
  }
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  return mins > 0 ? `${hours}时${mins}分` : `${hours}时`
}

function formatLandDistribution(landDist: CalculatorResult['landDist'], lands?: number) {
  const distribution = (landDist || {}) as Record<string, number>
  const entries = [
    { key: '4', label: '金' },
    { key: '3', label: '黑' },
    { key: '2', label: '红' },
    { key: '1', label: '普' },
  ].map(({ key, label }) => {
    const count = toSafeNumber(distribution[key], 0)
    return count > 0 ? `${label}${count}` : ''
  }).filter(Boolean)

  if (entries.length > 0)
    return entries.join(' / ')
  return lands ? `${lands} 块地` : '等待计算'
}

function getActiveToolPhases(crop: RawToolCrop) {
  return (Array.isArray(crop.phases) ? crop.phases : [])
    .filter(phase => toSafeNumber(phase.seconds, 0) > 0)
}

function getToolGrowTime(crop: RawToolCrop) {
  const activePhases = getActiveToolPhases(crop)
  const firstSeason = activePhases.reduce((sum, phase) => sum + toSafeNumber(phase.seconds, 0), 0)
  if (toSafeNumber(crop.seasons, 1) !== 2 || activePhases.length < 2)
    return firstSeason
  const secondSeason = activePhases.slice(-2).reduce((sum, phase) => sum + toSafeNumber(phase.seconds, 0), 0)
  return firstSeason + secondSeason
}

function getToolFertilizerReduceSec(crop: RawToolCrop) {
  const firstPhase = getActiveToolPhases(crop)[0]
  const baseReduce = toSafeNumber(firstPhase?.seconds, 0)
  return toSafeNumber(crop.seasons, 1) === 2 ? baseReduce * 2 : baseReduce
}

function buildToolCropImage(crop: RawToolCrop) {
  const assetName = String(crop.asset_name || '').trim()
  if (assetName)
    return `/nc_local_version/images/plant_${assetName}_Seed.png`

  const seedId = toSafeNumber(crop.seed_id, 0)
  const derivedAssetNumber = seedId > 20000 ? seedId - 20000 : 0
  return derivedAssetNumber > 0
    ? `/nc_local_version/images/plant_Crop_${derivedAssetNumber}_Seed.png`
    : ''
}

function buildFallbackAtlasItem(crop: RawToolCrop): AnalyticsCrop {
  const seasons = Math.max(1, toSafeNumber(crop.seasons, 1))
  const growTime = Math.max(1, getToolGrowTime(crop))
  const harvestExp = toSafeNumber(crop.exp, 0) * seasons
  const reduceSecApplied = getToolFertilizerReduceSec(crop)
  const fertilizedGrowTime = Math.max(1, growTime - reduceSecApplied)
  const fruitCount = toSafeNumber(crop.fruitCount, 0)
  const fruitSellPrice = toSafeNumber(crop.fruitSellPrice, 0)
  const income = fruitCount * fruitSellPrice * seasons
  const netProfit = income - toSafeNumber(crop.price, 0)

  return {
    seedId: crop.seed_id,
    name: crop.name,
    image: buildToolCropImage(crop),
    level: normalizeLevel(crop.level ?? crop.land_level_need) || null,
    seasons,
    growTime,
    expPerHour: Number.parseFloat(((harvestExp / growTime) * 3600).toFixed(2)),
    profitPerHour: Number.parseFloat(((netProfit / growTime) * 3600).toFixed(2)),
    normalFertilizerExpPerHour: Number.parseFloat(((harvestExp / fertilizedGrowTime) * 3600).toFixed(2)),
    normalFertilizerProfitPerHour: Number.parseFloat(((netProfit / fertilizedGrowTime) * 3600).toFixed(2)),
  }
}

function sortAnalyticsList(items: AnalyticsCrop[]) {
  const metricMap: Record<string, string> = {
    exp: 'expPerHour',
    fert: 'normalFertilizerExpPerHour',
    profit: 'profitPerHour',
    fert_profit: 'normalFertilizerProfitPerHour',
    level: 'level',
  }
  const metric = metricMap[sortKey.value]
  if (!metric)
    return items

  return [...items].sort((a, b) => {
    const av = Number((a as Record<string, unknown>)[metric])
    const bv = Number((b as Record<string, unknown>)[metric])
    if (!Number.isFinite(av) && !Number.isFinite(bv))
      return 0
    if (!Number.isFinite(av))
      return 1
    if (!Number.isFinite(bv))
      return -1
    return bv - av
  })
}

function getCropLevel(crop: CalculatorCrop | null | undefined) {
  if (!crop)
    return null
  return crop.requiredLevel ?? crop.level ?? null
}

function getDurationSeconds(crop: CalculatorCrop | null | undefined, mode: RecommendationMode) {
  if (!crop)
    return Number.POSITIVE_INFINITY
  const raw = mode === 'fert'
    ? (crop.twoSeasonDiff ? crop.fullCycleGrowFertWithS2Sec : crop.growTimeFert)
    : (crop.twoSeasonDiff ? crop.fullCycleGrowSec : crop.growTimeSec)
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : Number.POSITIVE_INFINITY
}

function getDurationLabel(crop: CalculatorCrop | null | undefined, mode: RecommendationMode) {
  if (!crop)
    return '--'
  const text = mode === 'fert'
    ? (crop.twoSeasonDiff ? crop.fullCycleGrowFertWithS2Str : crop.growTimeFertStr)
    : (crop.twoSeasonDiff ? crop.fullCycleGrowStr : crop.growTimeStr)
  return text || formatGrowTime(getDurationSeconds(crop, mode))
}

function getCycleLabel(crop: CalculatorCrop | null | undefined, mode: RecommendationMode) {
  const raw = mode === 'fert' ? crop?.cycleFert : crop?.cycleNoFert
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds > 0 ? formatGrowTime(seconds) : '--'
}

function getSavedTimeLabel(crop: CalculatorCrop | null | undefined) {
  if (!crop)
    return '--'
  const saved = getDurationSeconds(crop, 'noFert') - getDurationSeconds(crop, 'fert')
  return Number.isFinite(saved) && saved > 0 ? formatGrowTime(saved) : '--'
}

function getFertilizerPhaseLabel(crop: CalculatorCrop | null | undefined) {
  const names = crop?.fertBestPhaseNames?.filter(Boolean) || []
  return names.length > 0 ? names.join(' / ') : '第一阶段'
}

function resolveCropImage(crop: CalculatorCrop | null | undefined) {
  const seedId = Number(crop?.seedId)
  if (Number.isFinite(seedId) && atlasImageMap.value.has(seedId))
    return atlasImageMap.value.get(seedId) || ''
  return crop?.thumb || ''
}

function pickFastestCrop(rows: CalculatorCrop[] | undefined, mode: RecommendationMode) {
  if (!Array.isArray(rows) || rows.length === 0)
    return null

  let fastest: CalculatorCrop | null = null
  let bestSeconds = Number.POSITIVE_INFINITY

  for (const row of rows) {
    const seconds = getDurationSeconds(row, mode)
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= bestSeconds)
      continue
    fastest = row
    bestSeconds = seconds
  }

  return fastest
}

function buildCropNote(crop: CalculatorCrop | null | undefined, mode: RecommendationMode) {
  if (!crop)
    return '当前等级下没有可计算作物。'

  const parts = [
    crop.twoSeasonDiff ? `两季总成熟 ${getDurationLabel(crop, mode)}` : `成熟 ${getDurationLabel(crop, mode)}`,
  ]

  if (mode === 'fert')
    parts.push(`默认施肥阶段 ${getFertilizerPhaseLabel(crop)}`)

  if (crop.twoSeasonDiff && mode === 'fert' && crop.secondSeasonFertActive)
    parts.push(`第二季施肥后 ${crop.secondSeasonGrowFertStr || '--'}`)

  return parts.join(' · ')
}

function buildTimeNote(crop: CalculatorCrop | null | undefined, mode: RecommendationMode) {
  if (!crop)
    return '当前等级下没有可计算作物。'

  const parts = [
    `成熟 ${getDurationLabel(crop, mode)}`,
    `单轮周期 ${getCycleLabel(crop, mode)}`,
  ]

  if (mode === 'fert')
    parts.push(`默认施肥阶段 ${getFertilizerPhaseLabel(crop)}`)

  return parts.join(' · ')
}

function buildCalculatorModeSummary(result: CalculatorResult | null) {
  if (!result)
    return '普通施肥 / 含操作耗时 / 自动土地'

  const fertMode = result.smartFert ? '智能施肥' : '普通施肥'
  const idealMode = result.ideal ? '理想模式' : '含操作耗时'
  return `${fertMode} / ${idealMode} / 自动土地`
}

function getStrategyLevelModeButtonClass() {
  return strategyLevelMode.value === 'account'
    ? 'analytics-level-mode-btn analytics-level-mode-btn--active'
    : 'analytics-level-mode-btn analytics-level-mode-btn--idle'
}

function syncStrategyLevelWithAccount(force = false) {
  if (!force && strategyLevelMode.value !== 'account')
    return
  strategyLevel.value = effectiveAccountLevel.value > 0 ? effectiveAccountLevel.value : 0
}

function useAccountLevelRecommendation() {
  strategyLevelMode.value = 'account'
  syncStrategyLevelWithAccount(true)
}

function updateStrategyLevel(event: Event) {
  const target = event.target as HTMLInputElement
  strategyLevelMode.value = 'manual'
  strategyLevel.value = normalizeLevel(target.value)
}

async function refreshAccountLevel() {
  if (!currentAccountId.value) {
    liveAccountLevel.value = null
    syncStrategyLevelWithAccount(true)
    return
  }

  liveAccountLevel.value = null
  syncStrategyLevelWithAccount(true)

  if (realtimeConnected.value)
    return

  try {
    await statusStore.fetchStatus(currentAccountId.value)
    liveAccountLevel.value = normalizeLevel(status.value?.status?.level) || null
  }
  catch (error) {
    console.error('获取作物图鉴账号等级失败:', error)
    liveAccountLevel.value = null
  }
  finally {
    syncStrategyLevelWithAccount(true)
  }
}

async function loadAnalytics() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { sort: sortKey.value }
    const res = await api.get('/api/analytics', {
      params,
      headers: { 'x-account-id': currentAccountId.value },
    })
    const data = res.data?.data
    if (Array.isArray(data) && data.length > 0) {
      list.value = sortAnalyticsList(data as AnalyticsCrop[])
    }
    else {
      const toolRes = await api.get('/api/time_crops')
      const rawCrops = Array.isArray(toolRes.data?.crops) ? toolRes.data.crops as RawToolCrop[] : []
      list.value = sortAnalyticsList(rawCrops.map(buildFallbackAtlasItem))
    }
  }
  catch (error) {
    console.error('加载图鉴主接口失败，回退到工具链数据:', error)
    try {
      const toolRes = await api.get('/api/time_crops')
      const rawCrops = Array.isArray(toolRes.data?.crops) ? toolRes.data.crops as RawToolCrop[] : []
      list.value = sortAnalyticsList(rawCrops.map(buildFallbackAtlasItem))
    }
    catch (fallbackError) {
      console.error('加载工具链作物图鉴失败:', fallbackError)
      list.value = []
    }
  }
  finally {
    loading.value = false
  }
}

async function loadRecommendations() {
  if (recommendationLevel.value <= 0) {
    recommendationLoading.value = false
    calculatorResult.value = null
    recommendationError.value = currentAccountId.value
      ? '当前账号等级未知，暂时无法自动计算推荐。'
      : '未选择账号时可手动输入等级，顶部推荐会按该等级自动计算。'
    return
  }

  recommendationLoading.value = true
  recommendationError.value = ''
  try {
    const res = await api.get('/api/calculator', {
      params: {
        level: recommendationLevel.value,
      },
    })
    if (res.data && typeof res.data === 'object') {
      calculatorResult.value = res.data as CalculatorResult
    }
    else {
      calculatorResult.value = null
      recommendationError.value = '推荐结果格式异常。'
    }
  }
  catch (error) {
    console.error('加载作物图鉴推荐失败:', error)
    calculatorResult.value = null
    recommendationError.value = '推荐结果加载失败，请稍后重试。'
  }
  finally {
    recommendationLoading.value = false
  }
}

function buildAnalyticsViewState() {
  return normalizeAnalyticsViewState({
    sortKey: sortKey.value,
    strategyPanelCollapsed: strategyPanelCollapsed.value,
  }, DEFAULT_ANALYTICS_VIEW_STATE)
}

function applyAnalyticsViewState(state: Partial<typeof DEFAULT_ANALYTICS_VIEW_STATE> | null | undefined) {
  const normalized = normalizeAnalyticsViewState(state, DEFAULT_ANALYTICS_VIEW_STATE)
  analyticsViewHydrating = true
  sortKey.value = normalized.sortKey
  strategyPanelCollapsed.value = normalized.strategyPanelCollapsed
  analyticsViewHydrating = false
}

function clearAnalyticsViewSyncTimer() {
  if (analyticsViewSyncTimer) {
    clearTimeout(analyticsViewSyncTimer)
    analyticsViewSyncTimer = null
  }
}

function scheduleAnalyticsViewSync() {
  clearAnalyticsViewSyncTimer()
  const payload = buildAnalyticsViewState()
  analyticsViewSyncTimer = setTimeout(async () => {
    try {
      await saveViewPreferences({
        analyticsViewState: payload,
      })
    }
    catch (error) {
      console.warn('保存图鉴页视图偏好失败', error)
    }
  }, 240)
}

async function hydrateAnalyticsViewState() {
  const localFallback = buildAnalyticsViewState()
  try {
    const payload = await fetchViewPreferences()
    if (payload?.analyticsViewState) {
      applyAnalyticsViewState(payload.analyticsViewState)
      return
    }
    applyAnalyticsViewState(localFallback)
    if (JSON.stringify(localFallback) !== JSON.stringify(DEFAULT_ANALYTICS_VIEW_STATE)) {
      await saveViewPreferences({
        analyticsViewState: localFallback,
      })
    }
  }
  catch (error) {
    console.warn('读取图鉴页视图偏好失败', error)
    applyAnalyticsViewState(localFallback)
  }
}

onMounted(async () => {
  await hydrateAnalyticsViewState()
  await refreshAccountLevel()
  await loadAnalytics()
  if (recommendationLevel.value <= 0)
    await loadRecommendations()
  analyticsViewSyncEnabled = true
})

watch(() => currentAccountId.value, async () => {
  strategyLevelMode.value = 'account'
  liveAccountLevel.value = null
  await refreshAccountLevel()
  await loadAnalytics()
  if (recommendationLevel.value <= 0)
    await loadRecommendations()
})

watch(() => currentAccountLevel.value, () => {
  syncStrategyLevelWithAccount()
})

watch(() => recommendationLevel.value, () => {
  if (analyticsViewHydrating)
    return
  loadRecommendations()
})

watch(() => sortKey.value, () => {
  if (analyticsViewHydrating)
    return
  loadAnalytics()
})

watch(analyticsViewSignature, () => {
  if (!analyticsViewSyncEnabled || analyticsViewHydrating)
    return
  scheduleAnalyticsViewSync()
})

onBeforeUnmount(() => {
  clearAnalyticsViewSyncTimer()
})
</script>

<template>
  <div class="analytics-page ui-page-shell w-full">
    <div class="analytics-header ui-mobile-sticky-panel mb-4">
      <div class="analytics-header-bar flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 class="flex items-center gap-2 text-2xl font-bold">
          <div class="i-carbon-catalog" />
          作物图鉴
        </h2>

        <div class="analytics-controls ui-bulk-actions">
          <label class="whitespace-nowrap text-sm font-medium">排序方式:</label>
          <BaseSelect
            v-model="sortKey"
            :options="sortOptions"
            class="min-w-[11rem] w-full sm:w-40"
          />
        </div>
      </div>

      <div v-if="list.length" class="analytics-chip-row ui-bulk-actions mt-3">
        <span
          v-for="chip in analyticsSummaryChips"
          :key="chip.key"
          class="analytics-summary-chip"
          :class="chip.tone"
        >
          {{ chip.label }}
        </span>
      </div>
    </div>

    <div class="mb-4 border border-sky-200/70 rounded-xl bg-sky-50/70 px-3 py-2 text-xs text-sky-700 leading-5 dark:border-sky-800/40 dark:bg-sky-900/15 dark:text-sky-200">
      {{ ANALYTICS_BROWSER_PREF_NOTE }}
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="i-svg-spinners-90-ring-with-bg text-4xl text-blue-500" />
    </div>

    <div v-if="!loading" class="glass-panel mb-5 overflow-hidden rounded-2xl shadow-md">
      <div class="analytics-recommendation-head flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0 flex items-center gap-2">
          <div class="analytics-strategy-icon i-carbon-trophy text-lg" />
          <div class="min-w-0">
            <div class="glass-text-main font-bold">
              等级推荐
            </div>
            <div class="glass-text-muted text-xs">
              {{ strategySummaryText }}
            </div>
          </div>
        </div>

        <div class="ui-bulk-actions items-center" @click.stop>
          <span class="border border-primary-500/20 rounded-full bg-primary-500/10 px-2.5 py-1 text-xs text-primary-600 font-semibold dark:text-primary-400">
            当前账号 {{ effectiveAccountLevel > 0 ? `Lv${effectiveAccountLevel}` : '等级未知' }}
          </span>
          <button
            type="button"
            class="border rounded-full px-3 py-1 text-xs font-medium transition"
            :class="getStrategyLevelModeButtonClass()"
            @click="useAccountLevelRecommendation"
          >
            跟随当前等级
          </button>
          <div
            v-if="!strategyPanelCollapsed"
            class="analytics-level-input-shell flex items-center gap-2 border rounded-full px-3 py-1.5"
          >
            <span class="glass-text-muted text-xs">手动等级</span>
            <input
              :value="strategyInputValue"
              type="number"
              min="0"
              placeholder="输入等级"
              class="w-16 bg-transparent text-center text-sm outline-none"
              @input="updateStrategyLevel"
              @click.stop
            >
          </div>
          <button
            type="button"
            class="analytics-panel-toggle glass-panel flex items-center gap-1 border rounded-full px-3 py-1.5 text-sm transition"
            :aria-expanded="!strategyPanelCollapsed"
            @click="strategyPanelCollapsed = !strategyPanelCollapsed"
          >
            <span class="glass-text-muted text-xs">{{ strategyPanelCollapsed ? '展开推荐' : '收起推荐' }}</span>
            <div
              class="i-carbon-chevron-down glass-text-muted text-lg transition-transform"
              :class="{ 'rotate-180': !strategyPanelCollapsed }"
            />
          </button>
        </div>
      </div>

      <div v-show="!strategyPanelCollapsed" class="analytics-recommendation-body border-t p-4">
        <div class="grid grid-cols-1 mb-4 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="card in recommendationOverviewCards"
            :key="card.key"
            class="analytics-overview-card border rounded-xl p-4"
          >
            <div class="glass-text-muted text-xs">
              {{ card.label }}
            </div>
            <div class="glass-text-main mt-2 text-lg font-bold">
              {{ card.value }}
            </div>
            <div class="glass-text-muted mt-1 text-xs">
              {{ card.meta }}
            </div>
          </div>
        </div>

        <div v-if="recommendationLoading" class="flex justify-center py-10">
          <div class="i-svg-spinners-90-ring-with-bg text-3xl text-blue-500" />
        </div>

        <div
          v-else-if="recommendationError"
          class="border border-amber-200/70 rounded-xl bg-amber-50/70 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300"
        >
          {{ recommendationError }}
        </div>

        <div v-else class="grid gap-5">
          <section class="analytics-recommendation-section">
            <div class="analytics-section-heading mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 class="glass-text-main text-lg font-bold">
                  经验推荐
                </h3>
                <p class="glass-text-muted text-xs">
                  直接复用农场工具计算器默认规则，按当前等级自动给出经验最优作物。
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article
                v-for="card in experienceRecommendationCards"
                :key="card.key"
                class="analytics-recommendation-card analytics-recommendation-card--exp border rounded-2xl p-4"
              >
                <div class="mb-3 flex items-center gap-2">
                  <div class="text-base" :class="card.icon" />
                  <span class="glass-text-main text-sm font-semibold">{{ card.label }}</span>
                </div>

                <div v-if="card.crop" class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="analytics-best-plant-shell h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-xl">
                      <img
                        v-if="resolveCropImage(card.crop) && !imageErrors[card.crop.seedId || card.key]"
                        :src="resolveCropImage(card.crop)"
                        class="h-10 w-10 object-contain"
                        loading="lazy"
                        @error="imageErrors[card.crop.seedId || card.key] = true"
                      >
                      <div v-else class="analytics-best-plant-fallback i-carbon-sprout text-2xl" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="glass-text-main truncate text-lg font-bold">
                        {{ card.crop.name }}
                      </div>
                      <div class="glass-text-muted mt-1 text-xs">
                        Lv{{ formatLv(getCropLevel(card.crop)) }} · {{ card.crop.twoSeasonDiff ? '两季作物' : '单季作物' }}
                      </div>
                    </div>
                  </div>

                  <div class="analytics-kpi-panel rounded-xl px-4 py-3">
                    <div class="glass-text-muted text-xs">
                      {{ card.metricLabel }}
                    </div>
                    <div class="analytics-kpi-value mt-1 text-3xl font-black">
                      {{ card.metricValue }}
                    </div>
                  </div>

                  <div class="analytics-detail-grid grid grid-cols-3 gap-3">
                    <div
                      v-for="detail in card.details"
                      :key="detail.label"
                      class="analytics-detail-cell rounded-xl px-3 py-2"
                    >
                      <div class="glass-text-muted text-[11px]">
                        {{ detail.label }}
                      </div>
                      <div
                        class="mt-1 text-sm font-bold"
                        :class="{
                          'analytics-detail-value--success': detail.tone === 'success',
                          'analytics-detail-value--info': detail.tone === 'info',
                        }"
                      >
                        {{ detail.value }}
                      </div>
                    </div>
                  </div>

                  <div class="analytics-recommendation-note text-xs">
                    {{ card.note }}
                  </div>
                </div>

                <div v-else class="glass-text-muted py-8 text-center text-sm">
                  当前等级下暂无推荐结果
                </div>
              </article>
            </div>
          </section>

          <section class="analytics-recommendation-section">
            <div class="analytics-section-heading mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 class="glass-text-main text-lg font-bold">
                  时间推荐
                </h3>
                <p class="glass-text-muted text-xs">
                  从同一套工具链结果中筛出最短成熟周期，默认展示当前等级最快可种作物。
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article
                v-for="card in timeRecommendationCards"
                :key="card.key"
                class="analytics-recommendation-card analytics-recommendation-card--time border rounded-2xl p-4"
              >
                <div class="mb-3 flex items-center gap-2">
                  <div class="text-base" :class="card.icon" />
                  <span class="glass-text-main text-sm font-semibold">{{ card.label }}</span>
                </div>

                <div v-if="card.crop" class="space-y-4">
                  <div class="flex items-center gap-3">
                    <div class="analytics-best-plant-shell h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-xl">
                      <img
                        v-if="resolveCropImage(card.crop) && !imageErrors[card.crop.seedId || card.key]"
                        :src="resolveCropImage(card.crop)"
                        class="h-10 w-10 object-contain"
                        loading="lazy"
                        @error="imageErrors[card.crop.seedId || card.key] = true"
                      >
                      <div v-else class="analytics-best-plant-fallback i-carbon-sprout text-2xl" />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="glass-text-main truncate text-lg font-bold">
                        {{ card.crop.name }}
                      </div>
                      <div class="glass-text-muted mt-1 text-xs">
                        Lv{{ formatLv(getCropLevel(card.crop)) }} · {{ card.crop.twoSeasonDiff ? '两季作物' : '单季作物' }}
                      </div>
                    </div>
                  </div>

                  <div class="analytics-kpi-panel rounded-xl px-4 py-3">
                    <div class="glass-text-muted text-xs">
                      {{ card.metricLabel }}
                    </div>
                    <div class="analytics-kpi-value analytics-kpi-value--time mt-1 text-3xl font-black">
                      {{ card.metricValue }}
                    </div>
                  </div>

                  <div class="analytics-detail-grid grid grid-cols-3 gap-3">
                    <div
                      v-for="detail in card.details"
                      :key="detail.label"
                      class="analytics-detail-cell rounded-xl px-3 py-2"
                    >
                      <div class="glass-text-muted text-[11px]">
                        {{ detail.label }}
                      </div>
                      <div
                        class="mt-1 text-sm font-bold"
                        :class="{
                          'analytics-detail-value--success': detail.tone === 'success',
                          'analytics-detail-value--info': detail.tone === 'info',
                        }"
                      >
                        {{ detail.value }}
                      </div>
                    </div>
                  </div>

                  <div class="analytics-recommendation-note text-xs">
                    {{ card.note }}
                  </div>
                </div>

                <div v-else class="glass-text-muted py-8 text-center text-sm">
                  当前等级下暂无推荐结果
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>

    <div v-if="!loading && list.length === 0" class="glass-panel glass-text-muted rounded-xl p-8 text-center shadow-md">
      暂无数据
    </div>

    <div v-if="!loading && list.length > 0">
      <div class="analytics-atlas-head mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 class="glass-text-main text-lg font-bold">
            全部作物图鉴
          </h3>
          <p class="glass-text-muted text-xs">
            顶部推荐只看当前等级，底部保留全量图鉴，方便直接对比所有作物属性和效率。
          </p>
        </div>
        <span class="analytics-atlas-chip border rounded-full px-3 py-1 text-xs font-semibold">
          当前按 {{ sortOptions.find(option => option.value === sortKey)?.label || '未知方式' }} 排序
        </span>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="(item, idx) in list"
          :key="item.seedId || idx"
          class="analytics-plant-card glass-panel group flex flex-col overflow-hidden rounded-xl shadow transition-all hover:shadow-lg hover:-translate-y-1"
        >
          <div class="flex flex-1 flex-col cursor-pointer gap-4 bg-transparent p-4 transition">
            <div class="flex flex-row items-center gap-3">
              <div class="analytics-plant-image-shell relative h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden border rounded-lg transition-colors group-hover:bg-primary-500/20">
                <img
                  v-if="item.image && !imageErrors[item.seedId || idx]"
                  :src="item.image"
                  class="h-10 w-10 object-contain drop-shadow-sm transition-transform group-hover:scale-110"
                  loading="lazy"
                  @error="imageErrors[item.seedId || idx] = true"
                >
                <div v-else class="analytics-plant-image-fallback i-carbon-sprout text-2xl" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="glass-text-main truncate text-base font-bold transition-colors group-hover:text-primary-500">
                    {{ item.name }}
                  </div>
                  <div class="glass-text-muted text-[10px] font-mono">
                    ID:{{ item.seedId }}
                  </div>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="border border-primary-500/20 rounded bg-primary-500/10 px-1.5 py-0.5 text-[10px] text-primary-600 font-semibold dark:text-primary-400">Lv {{ formatLv(item.level) }}</span>
                  <span class="analytics-season-badge ui-meta-chip--warning border rounded px-1.5 py-0.5 text-[10px] font-semibold">{{ item.seasons }}季</span>
                  <template v-for="label in recommendationSeedTags[String(item.seedId)] || []" :key="label">
                    <span class="analytics-recommend-tag border rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      {{ label }}
                    </span>
                  </template>
                  <span class="glass-text-muted ml-auto flex items-center gap-0.5 text-[10px]">
                    <div class="i-carbon-time" />
                    {{ formatGrowTime(item.growTime) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="analytics-metrics-grid grid grid-cols-2 mt-auto gap-3 border-t pt-2 text-sm">
              <div class="flex flex-col">
                <span class="glass-text-muted mb-0.5 text-[10px] uppercase opacity-80">经验/小时</span>
                <span class="text-purple-600 font-bold leading-none dark:text-purple-400">{{ item.expPerHour ?? '--' }}</span>
              </div>
              <div class="flex flex-col text-right">
                <span class="glass-text-muted mb-0.5 text-[10px] uppercase opacity-80">净利润/小时</span>
                <span class="text-amber-500 font-bold leading-none dark:text-amber-400">{{ item.profitPerHour ?? '--' }}</span>
              </div>
              <div class="flex flex-col">
                <span class="glass-text-muted mb-0.5 text-[10px] uppercase opacity-80">普肥经验/小时</span>
                <span class="text-blue-600 font-bold leading-none dark:text-blue-400">{{ item.normalFertilizerExpPerHour ?? '--' }}</span>
              </div>
              <div class="flex flex-col text-right">
                <span class="glass-text-muted mb-0.5 text-[10px] uppercase opacity-80">普肥净利润/小时</span>
                <span class="text-primary-600 font-bold leading-none dark:text-primary-400">{{ item.normalFertilizerProfitPerHour ?? '--' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-page {
  color: var(--ui-text-1);
}

.analytics-page
  :is(
    .glass-text-muted,
    [class*='text-'][class*='gray-500'],
    [class*='text-'][class*='gray-600'],
    [class*='dark:text-'][class*='gray-300'],
    [class*='dark:text-'][class*='gray-400']
  ) {
  color: var(--ui-text-2) !important;
}

.analytics-header {
  z-index: 12;
  display: grid;
  gap: 0.75rem;
}

.analytics-controls {
  align-items: center;
}

.analytics-chip-row {
  min-width: 0;
}

.analytics-summary-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1;
  font-weight: 600;
}

.analytics-strategy-icon {
  color: var(--ui-status-warning);
}

.analytics-level-mode-btn--active {
  border-color: color-mix(in srgb, var(--ui-brand-500) 25%, transparent);
  background: color-mix(in srgb, var(--ui-brand-500) 12%, transparent);
  color: color-mix(in srgb, var(--ui-brand-600) 72%, var(--ui-text-1) 28%);
}

.analytics-level-mode-btn--idle,
.analytics-level-input-shell,
.analytics-panel-toggle,
.analytics-recommendation-body,
.analytics-overview-card,
.analytics-recommendation-card,
.analytics-plant-image-shell,
.analytics-metrics-grid,
.analytics-kpi-panel,
.analytics-detail-cell,
.analytics-atlas-chip {
  border-color: var(--ui-border-subtle);
}

.analytics-level-mode-btn--idle,
.analytics-level-input-shell,
.analytics-panel-toggle,
.analytics-overview-card,
.analytics-recommendation-card,
.analytics-kpi-panel,
.analytics-detail-cell,
.analytics-atlas-chip {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
  color: var(--ui-text-2);
}

.analytics-level-mode-btn--idle:hover,
.analytics-panel-toggle:hover {
  border-color: color-mix(in srgb, var(--ui-brand-500) 25%, transparent);
  color: var(--ui-brand-600);
}

.analytics-overview-card,
.analytics-recommendation-card {
  background: color-mix(in srgb, var(--ui-bg-surface) 78%, transparent);
}

.analytics-recommendation-card--exp {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--ui-status-success) 78%, transparent);
}

.analytics-recommendation-card--time {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--ui-status-info) 78%, transparent);
}

.analytics-best-plant-shell,
.analytics-plant-image-shell {
  background: color-mix(in srgb, var(--ui-brand-500) 10%, transparent);
}

.analytics-best-plant-fallback,
.analytics-plant-image-fallback {
  color: color-mix(in srgb, var(--ui-brand-500) 50%, var(--ui-text-1) 50%);
}

.analytics-kpi-panel {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-brand-500) 10%, transparent),
    color-mix(in srgb, var(--ui-bg-surface) 90%, transparent)
  );
}

.analytics-kpi-value {
  color: color-mix(in srgb, var(--ui-status-success) 68%, var(--ui-text-1) 32%);
  line-height: 1;
}

.analytics-kpi-value--time {
  color: color-mix(in srgb, var(--ui-status-info) 72%, var(--ui-text-1) 28%);
}

.analytics-detail-cell {
  min-height: 4.4rem;
}

.analytics-detail-value--success {
  color: var(--ui-status-success);
}

.analytics-detail-value--info {
  color: var(--ui-status-info);
}

.analytics-recommendation-note {
  border-top: 1px dashed var(--ui-border-subtle);
  padding-top: 0.75rem;
  color: var(--ui-text-2);
}

.analytics-plant-card:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
}

.analytics-season-badge {
  display: inline-flex;
  align-items: center;
  border-width: 1px;
  border-style: solid;
  line-height: 1;
}

.analytics-recommend-tag {
  border-color: color-mix(in srgb, var(--ui-status-success) 40%, transparent);
  background: color-mix(in srgb, var(--ui-status-success-soft) 65%, transparent);
  color: var(--ui-status-success);
}

@media (max-width: 1023px) {
  .analytics-detail-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .analytics-header-bar {
    border: 1px solid var(--ui-border-subtle);
    border-radius: 1rem;
    padding: 0.9rem;
    background: color-mix(in srgb, var(--ui-bg-surface-raised) 90%, transparent);
  }
}
</style>
