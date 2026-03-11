import api from '@/api'

export interface CropAtlasEntry {
  plantId: number
  seedId: number | string
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

interface RawToolCropPhase {
  seconds?: number
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

interface RawAnalyticsCrop {
  id?: number | string
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

function toSafeNumber(value: unknown, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizeLevel(value: unknown) {
  const level = toSafeNumber(value, 0)
  return level > 0 ? level : null
}

function normalizePlantId(value: unknown, seedId: unknown) {
  const plantId = toSafeNumber(value, 0)
  if (plantId > 0)
    return plantId
  const numericSeedId = toSafeNumber(seedId, 0)
  return numericSeedId > 0 ? numericSeedId + 1000000 : 0
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

function buildFallbackAtlasItem(crop: RawToolCrop): CropAtlasEntry {
  const seedId = toSafeNumber(crop.seed_id, 0)
  const seasons = Math.max(1, toSafeNumber(crop.seasons, 1))
  const growTime = Math.max(1, getToolGrowTime(crop))
  const harvestExp = toSafeNumber(crop.exp, 0) * seasons
  const fertilizedGrowTime = Math.max(1, growTime - getToolFertilizerReduceSec(crop))
  const income = toSafeNumber(crop.fruitCount, 0) * toSafeNumber(crop.fruitSellPrice, 0) * seasons
  const netProfit = income - toSafeNumber(crop.price, 0)

  return {
    plantId: normalizePlantId(0, seedId),
    seedId,
    name: crop.name,
    image: buildToolCropImage(crop),
    level: normalizeLevel(crop.level ?? crop.land_level_need),
    seasons,
    growTime,
    expPerHour: Number.parseFloat(((harvestExp / growTime) * 3600).toFixed(2)),
    profitPerHour: Number.parseFloat(((netProfit / growTime) * 3600).toFixed(2)),
    normalFertilizerExpPerHour: Number.parseFloat(((harvestExp / fertilizedGrowTime) * 3600).toFixed(2)),
    normalFertilizerProfitPerHour: Number.parseFloat(((netProfit / fertilizedGrowTime) * 3600).toFixed(2)),
  }
}

function normalizeAnalyticsEntry(item: RawAnalyticsCrop): CropAtlasEntry | null {
  const seedId = toSafeNumber(item?.seedId, 0)
  const plantId = normalizePlantId(item?.id, seedId)
  if (seedId <= 0 || plantId <= 0)
    return null

  return {
    plantId,
    seedId,
    name: item?.name,
    image: item?.image,
    level: normalizeLevel(item?.level),
    seasons: Math.max(1, toSafeNumber(item?.seasons, 1)),
    growTime: toSafeNumber(item?.growTime, 0),
    expPerHour: Number.isFinite(Number(item?.expPerHour)) ? Number(item?.expPerHour) : undefined,
    profitPerHour: Number.isFinite(Number(item?.profitPerHour)) ? Number(item?.profitPerHour) : undefined,
    normalFertilizerExpPerHour: Number.isFinite(Number(item?.normalFertilizerExpPerHour)) ? Number(item?.normalFertilizerExpPerHour) : undefined,
    normalFertilizerProfitPerHour: Number.isFinite(Number(item?.normalFertilizerProfitPerHour)) ? Number(item?.normalFertilizerProfitPerHour) : undefined,
  }
}

function sortCropAtlasEntries(entries: CropAtlasEntry[]) {
  return [...entries].sort((a, b) => {
    const levelDiff = toSafeNumber(a.level, 0) - toSafeNumber(b.level, 0)
    if (levelDiff !== 0)
      return levelDiff
    const plantIdDiff = toSafeNumber(a.plantId, 0) - toSafeNumber(b.plantId, 0)
    if (plantIdDiff !== 0)
      return plantIdDiff
    return toSafeNumber(a.seedId, 0) - toSafeNumber(b.seedId, 0)
  })
}

export async function loadCropAtlasEntries(options: { accountId?: string, sort?: string } = {}) {
  const accountId = String(options.accountId || '').trim()
  const sort = String(options.sort || 'level').trim() || 'level'

  try {
    const res = await api.get('/api/analytics', {
      headers: accountId ? { 'x-account-id': accountId } : undefined,
      params: { sort },
    })
    const rows = res.data?.ok ? res.data?.data : []
    if (Array.isArray(rows) && rows.length > 0) {
      const entries = rows
        .map((item: RawAnalyticsCrop) => normalizeAnalyticsEntry(item))
        .filter((item): item is CropAtlasEntry => !!item)
      if (entries.length > 0)
        return sortCropAtlasEntries(entries)
    }
  }
  catch {
  }

  const toolRes = await api.get('/api/time_crops')
  const crops = Array.isArray(toolRes.data?.crops) ? toolRes.data.crops as RawToolCrop[] : []
  return sortCropAtlasEntries(crops.map(buildFallbackAtlasItem))
}

export function buildCropAtlasMap(entries: CropAtlasEntry[]) {
  const map: Record<string, CropAtlasEntry> = {}
  for (const item of Array.isArray(entries) ? entries : []) {
    const seedId = Number(item?.seedId || 0)
    if (seedId > 0)
      map[seedId] = item
  }
  return map
}

export function normalizeCropSelectionIds(ids: unknown, entries: CropAtlasEntry[]) {
  const plantIdSet = new Set(entries.map(item => Number(item.plantId || 0)).filter(id => id > 0))
  const seedToPlantMap = new Map(entries.map(item => [Number(item.seedId || 0), Number(item.plantId || 0)]))
  const seen = new Set<number>()

  return (Array.isArray(ids) ? ids : [])
    .map((value) => {
      const numericValue = toSafeNumber(value, 0)
      if (numericValue <= 0)
        return 0
      if (plantIdSet.has(numericValue))
        return numericValue
      return seedToPlantMap.get(numericValue) || numericValue
    })
    .filter((value) => {
      if (value <= 0 || seen.has(value))
        return false
      seen.add(value)
      return true
    })
}
