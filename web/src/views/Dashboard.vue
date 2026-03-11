/* eslint-disable no-alert, unused-imports/no-unused-vars */

<script setup lang="ts">
import type { MetaBadgeTone } from '@/utils/ui-badge'
import type { DashboardViewState } from '@/utils/view-preferences'
import { useIntervalFn, useStorage } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import UserInfoCard from '@/components/UserInfoCard.vue'
import { useAccountStore } from '@/stores/account'
import { useBagStore } from '@/stores/bag'
import { useSettingStore } from '@/stores/setting'
import { useStatusStore } from '@/stores/status'
import { localizeRuntimeText } from '@/utils/runtime-text'
import { DEFAULT_DASHBOARD_VIEW_STATE, fetchViewPreferences, normalizeDashboardViewState, saveViewPreferences } from '@/utils/view-preferences'

const statusStore = useStatusStore()
const accountStore = useAccountStore()
const bagStore = useBagStore()
const {
  status,
  logs: statusLogs,
  realtimeConnected,
} = storeToRefs(statusStore)
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { dashboardItems } = storeToRefs(bagStore)
const logContainer = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const lastBagFetchAt = ref(0)

// ========== 任务队列预览 ==========
const schedulerPreview = ref<any>(null)
const lastSchedulerFetchAt = ref(0)
const showAllTasks = ref(false) // 是否显示全部任务（含基础设施任务）

// ========== 农场操作预览（仅供今日统计使用） ==========
const landsPreview = ref<any>(null)
const lastLandsFetchAt = ref(0)
const localMatureCountdowns = ref<Record<number, number>>({})

const allLogs = computed(() => {
  // 后端已有序并且是在队尾 append，这里只需返回原始数组不须做高频的深拷贝及 sort，极大压低性能消耗解决卡顿
  return statusLogs.value || []
})

const filter = useStorage<DashboardViewState>('dashboard_log_filter', {
  ...DEFAULT_DASHBOARD_VIEW_STATE,
})
const DASHBOARD_BROWSER_PREF_NOTE = '日志筛选条件会跟随当前登录用户同步到服务器；本机缓存只作首屏兜底。日志内容本身仍然实时来自当前账号。'
let dashboardViewSyncTimer: ReturnType<typeof setTimeout> | null = null
let dashboardViewHydrating = false
let dashboardViewSyncEnabled = false

const hasActiveLogFilter = computed(() =>
  !!(filter.value.module || filter.value.event || filter.value.keyword || filter.value.isWarn),
)
const dashboardViewSignature = computed(() => JSON.stringify(buildDashboardViewState()))

const modules = [
  { label: '所有模块', value: '' },
  { label: '农场', value: 'farm' },
  { label: '好友', value: 'friend' },
  { label: '仓库', value: 'warehouse' },
  { label: '任务', value: 'task' },
  { label: '系统', value: 'system' },
]

const events = [
  { label: '所有事件', value: '' },
  { label: '农场巡查', value: 'farm_cycle' },
  { label: '收获作物', value: 'harvest_crop' },
  { label: '清理枯株', value: 'remove_plant' },
  { label: '种植种子', value: 'plant_seed' },
  { label: '施加化肥', value: 'fertilize' },
  { label: '土地推送', value: 'lands_notify' },
  { label: '选择种子', value: 'seed_pick' },
  { label: '库存消耗', value: 'seed_inventory_use' },
  { label: '预算优化', value: 'seed_budget_optimize' },
  { label: '预算压缩', value: 'seed_budget_limit' },
  { label: '购买种子', value: 'seed_buy' },
  { label: '购买化肥', value: 'fertilizer_buy' },
  { label: '开启礼包', value: 'fertilizer_gift_open' },
  { label: '获取任务', value: 'task_scan' },
  { label: '完成任务', value: 'task_claim' },
  { label: '免费礼包', value: 'mall_free_gifts' },
  { label: '分享奖励', value: 'daily_share' },
  { label: '会员礼包', value: 'vip_daily_gift' },
  { label: '月卡礼包', value: 'month_card_gift' },
  { label: '开服红包', value: 'open_server_gift' },
  { label: '图鉴奖励', value: 'illustrated_rewards' },
  { label: '邮箱领取', value: 'email_rewards' },
  { label: '出售成功', value: 'sell_success' },
  { label: '土地升级', value: 'upgrade_land' },
  { label: '土地解锁', value: 'unlock_land' },
  { label: '好友巡查', value: 'friend_cycle' },
  { label: '访问好友', value: 'visit_friend' },
  { label: '访客行为', value: 'visitor' },
  { label: '多季补肥', value: 'fertilize_smart_phase' },
]

const eventLabelMap: Record<string, string> = Object.fromEntries(
  events.filter(e => e.value).map(e => [e.value, e.label]),
)

function getEventLabel(event: string) {
  return eventLabelMap[event] || event
}

type LogDetailTone = 'blue' | 'emerald' | 'amber' | 'violet' | 'slate'

interface LogDetailChip {
  key: string
  label: string
  value: string
  tone: LogDetailTone
}

const inventoryModeLabelMap: Record<string, string> = {
  disabled: '商店购买',
  prefer_inventory: '优先库存',
  inventory_only: '仅用库存',
}

function getInventoryModeLabel(mode: unknown) {
  const raw = String(mode || '').trim()
  return inventoryModeLabelMap[raw] || (raw || '未设置')
}

function getLogDetailChipClass(tone: LogDetailTone) {
  if (tone === 'blue')
    return 'ui-meta-chip--info'
  if (tone === 'emerald')
    return 'ui-meta-chip--success'
  if (tone === 'amber')
    return 'ui-meta-chip--warning'
  if (tone === 'violet')
    return 'ui-meta-chip--brand'
  return 'ui-meta-chip--neutral'
}

function toSafeLogCount(value: unknown) {
  const num = Number(value)
  if (!Number.isFinite(num))
    return 0
  return Math.max(0, Math.trunc(num))
}

function buildLogDetailChip(key: string, label: string, value: string, tone: LogDetailTone): LogDetailChip {
  return { key, label, value, tone }
}

function getPlantingLogDetailChips(log: any): LogDetailChip[] {
  const meta = log?.meta && typeof log.meta === 'object' ? log.meta : {}
  const event = String(meta.event || '')
  if (!['seed_pick', 'seed_inventory_use', 'seed_budget_limit', 'seed_budget_optimize'].includes(event))
    return []

  const inventoryMode = String(meta.inventoryMode || '').trim()
  const hasInventoryTotalCount = meta.inventoryTotalCount !== undefined && meta.inventoryTotalCount !== null && meta.inventoryTotalCount !== ''
  const hasInventoryReservedCount = meta.inventoryReservedCount !== undefined && meta.inventoryReservedCount !== null && meta.inventoryReservedCount !== ''
  const hasInventoryUsableCount = meta.inventoryUsableCount !== undefined && meta.inventoryUsableCount !== null && meta.inventoryUsableCount !== ''
  const hasInventoryUseCount = meta.inventoryUseCount !== undefined && meta.inventoryUseCount !== null && meta.inventoryUseCount !== ''
  const hasBuyCount = meta.buyCount !== undefined && meta.buyCount !== null && meta.buyCount !== ''
  const hasLimitedCount = meta.count !== undefined && meta.count !== null && meta.count !== ''
  const hasPlannedCount = meta.plannedCount !== undefined && meta.plannedCount !== null && meta.plannedCount !== ''
  const hasBasePlantedCount = (meta.basePlantedCount !== undefined && meta.basePlantedCount !== null && meta.basePlantedCount !== '')
    || (meta.budgetBasePlantedCount !== undefined && meta.budgetBasePlantedCount !== null && meta.budgetBasePlantedCount !== '')

  const inventoryTotalCount = toSafeLogCount(meta.inventoryTotalCount)
  const inventoryReservedCount = toSafeLogCount(meta.inventoryReservedCount)
  const inventoryUsableCount = toSafeLogCount(meta.inventoryUsableCount)
  const inventoryUseCount = toSafeLogCount(meta.inventoryUseCount)
  const buyCount = toSafeLogCount(meta.buyCount)
  const limitedCount = toSafeLogCount(meta.count)
  const plannedCount = toSafeLogCount(meta.plannedCount)
  const basePlantedCount = toSafeLogCount(meta.basePlantedCount || meta.budgetBasePlantedCount)
  const chips: LogDetailChip[] = []

  if (inventoryMode) {
    chips.push(buildLogDetailChip('mode', '模式', getInventoryModeLabel(inventoryMode), 'blue'))
  }

  if (event === 'seed_pick' || event === 'seed_inventory_use') {
    if (inventoryMode !== 'disabled' || hasInventoryTotalCount || hasInventoryReservedCount || hasInventoryUsableCount) {
      if (hasInventoryTotalCount)
        chips.push(buildLogDetailChip('inventory-total', '库存', String(inventoryTotalCount), 'emerald'))
      if (hasInventoryReservedCount)
        chips.push(buildLogDetailChip('inventory-reserved', '保留', String(inventoryReservedCount), 'amber'))
      if (hasInventoryUsableCount)
        chips.push(buildLogDetailChip('inventory-usable', '可用', String(inventoryUsableCount), 'slate'))
    }

    if (hasInventoryUseCount && (inventoryUseCount > 0 || event === 'seed_inventory_use')) {
      chips.push(buildLogDetailChip('inventory-use', '实耗', String(inventoryUseCount), 'emerald'))
    }

    if (event === 'seed_pick') {
      if (hasPlannedCount && plannedCount > 0) {
        chips.push(buildLogDetailChip('planned', '计划', String(plannedCount), 'slate'))
      }
      if (hasBuyCount && (buyCount > 0 || inventoryMode === 'disabled')) {
        chips.push(buildLogDetailChip('buy', '补买', String(buyCount), 'violet'))
      }
      if (meta.budgetOptimized) {
        chips.push(buildLogDetailChip('budget-optimized', '预算', '已优化', 'amber'))
      }
    }
  }

  if (event === 'seed_budget_limit' && hasLimitedCount && limitedCount > 0) {
    chips.push(buildLogDetailChip('budget-limit', '本轮', String(limitedCount), 'amber'))
  }

  if (event === 'seed_budget_optimize') {
    if (hasBasePlantedCount && basePlantedCount > 0) {
      chips.push(buildLogDetailChip('budget-base', '原方案', String(basePlantedCount), 'slate'))
    }
    if (hasPlannedCount && plannedCount > 0) {
      chips.push(buildLogDetailChip('budget-planned', '优化后', String(plannedCount), 'amber'))
    }
  }

  return chips
}

const logs = [
  { label: '所有等级', value: '' },
  { label: '普通', value: 'info' },
  { label: '警告', value: 'warn' },
]

const displayName = computed(() => {
  // Try to use nickname from status (game server)
  const gameName = status.value?.status?.name
  if (gameName)
    return gameName

  // Check login status
  if (!status.value?.connection?.connected) {
    const account = accountStore.currentAccount
    return account?.name || account?.nick || '未登录'
  }

  // Fallback to account name (usually ID) or '未命名'
  const account = accountStore.currentAccount
  return account?.name || account?.nick || '未命名'
})

// Exp Rate & Time to Level
const expRate = computed(() => {
  const gain = status.value?.sessionExpGained || 0
  const uptime = status.value?.uptime || 0
  if (!uptime)
    return '0/时'
  const hours = uptime / 3600
  const rate = hours > 0 ? (gain / hours) : 0
  return `${Math.floor(rate)}/时`
})

const timeToLevel = computed(() => {
  const gain = status.value?.sessionExpGained || 0
  const uptime = status.value?.uptime || 0
  const current = status.value?.levelProgress?.current || 0
  const needed = status.value?.levelProgress?.needed || 0

  if (!needed || !uptime || gain <= 0)
    return ''

  const hours = uptime / 3600
  const ratePerHour = hours > 0 ? (gain / hours) : 0
  if (ratePerHour <= 0)
    return ''

  const expNeeded = needed - current
  const minsToLevel = expNeeded / (ratePerHour / 60)

  if (minsToLevel < 60)
    return `约 ${Math.ceil(minsToLevel)} 分钟后升级`
  return `约 ${(minsToLevel / 60).toFixed(1)} 小时后升级`
})

// Fertilizer & Collection
const fertilizerNormal = computed(() => dashboardItems.value.find((i: any) => Number(i.id) === 1011))
const fertilizerOrganic = computed(() => dashboardItems.value.find((i: any) => Number(i.id) === 1012))
const collectionNormal = computed(() => dashboardItems.value.find((i: any) => Number(i.id) === 3001))
const collectionRare = computed(() => dashboardItems.value.find((i: any) => Number(i.id) === 3002))

function formatBucketTime(item: any) {
  if (!item)
    return '0.0h'
  if (item.hoursText)
    return item.hoursText.replace('小时', 'h')
  const count = Number(item.count || 0)
  return `${(count / 3600).toFixed(1)}h`
}

// Next Check Countdown
const nextFarmCheck = ref('--')
const nextFriendCheck = ref('--')
const localUptime = ref(0)
let localNextFarmRemainSec = 0
let localNextFriendRemainSec = 0

function updateCountdowns() {
  // Update uptime
  if (status.value?.connection?.connected) {
    localUptime.value++
  }

  // 只有在账号已连接时才显示巡查状态
  const isConnected = status.value?.connection?.connected

  if (localNextFarmRemainSec > 0) {
    localNextFarmRemainSec--
    nextFarmCheck.value = formatDuration(localNextFarmRemainSec)
  }
  else {
    nextFarmCheck.value = isConnected ? '巡查中...' : '--'
  }

  if (localNextFriendRemainSec > 0) {
    localNextFriendRemainSec--
    nextFriendCheck.value = formatDuration(localNextFriendRemainSec)
  }
  else {
    nextFriendCheck.value = isConnected ? '巡查中...' : '--'
  }

  // 土地成熟倒计时递减
  const cd = localMatureCountdowns.value
  for (const key of Object.keys(cd)) {
    const k = Number(key)
    const v = cd[k] ?? 0
    if (v > 0)
      cd[k] = v - 1
  }

  // 集成体验卡倒计时
  updateTrialCountdown()
}

watch(status, (newVal) => {
  if (newVal?.nextChecks) {
    // Only update local counters if they are significantly different or 0
    // Actually, we should sync from server periodically.
    // Here we just take server value when it comes.
    localNextFarmRemainSec = newVal.nextChecks.farmRemainSec || 0
    localNextFriendRemainSec = newVal.nextChecks.friendRemainSec || 0
    updateCountdowns() // Update immediately
  }
  if (newVal?.uptime !== undefined) {
    localUptime.value = newVal.uptime
  }
}, { deep: true })

function formatDuration(seconds: number) {
  if (seconds <= 0)
    return '00:00:00'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (d > 0)
    return `${d}天 ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function getLogTagClass(tag: string) {
  if (tag === '错误')
    return 'dashboard-log-tag ui-meta-chip--danger'
  if (tag === '系统')
    return 'dashboard-log-tag ui-meta-chip--info'
  if (tag === '警告')
    return 'dashboard-log-tag ui-meta-chip--warning'
  return 'dashboard-log-tag ui-meta-chip--brand'
}

function getLogMsgClass(tag: string) {
  if (tag === '错误')
    return 'dashboard-log-message dashboard-log-message--danger'
  return 'dashboard-log-message'
}

function formatLogTime(timeStr: string) {
  // 2024/5/20 12:34:56 -> 12:34:56
  if (!timeStr)
    return ''
  const parts = timeStr.split(' ')
  return parts.length > 1 ? parts[1] : timeStr
}

const OP_META: Record<string, { label: string, icon: string, color: string }> = {
  harvest: { label: '收获', icon: 'i-carbon-crop-growth', color: 'dashboard-op-tone dashboard-op-tone--brand' },
  water: { label: '浇水', icon: 'i-carbon-rain-drop', color: 'dashboard-op-tone dashboard-op-tone--info' },
  weed: { label: '除草', icon: 'i-carbon-cut-out', color: 'dashboard-op-tone dashboard-op-tone--warning' },
  bug: { label: '除虫', icon: 'i-carbon-warning-alt', color: 'dashboard-op-tone dashboard-op-tone--danger' },
  fertilize: { label: '施肥', icon: 'i-carbon-chemistry', color: 'dashboard-op-tone dashboard-op-tone--success' },
  plant: { label: '种植', icon: 'i-carbon-tree', color: 'dashboard-op-tone dashboard-op-tone--success-soft' },
  upgrade: { label: '土地升级', icon: 'i-carbon-upgrade', color: 'dashboard-op-tone dashboard-op-tone--violet' },
  levelUp: { label: '账号升级', icon: 'i-carbon-user-certification', color: 'dashboard-op-tone dashboard-op-tone--violet' },
  steal: { label: '偷菜', icon: 'i-carbon-run', color: 'dashboard-op-tone dashboard-op-tone--warning' },
  helpWater: { label: '帮浇水', icon: 'i-carbon-rain-drop', color: 'dashboard-op-tone dashboard-op-tone--info-soft' },
  helpWeed: { label: '帮除草', icon: 'i-carbon-cut-out', color: 'dashboard-op-tone dashboard-op-tone--warning-soft' },
  helpBug: { label: '帮除虫', icon: 'i-carbon-warning-alt', color: 'dashboard-op-tone dashboard-op-tone--danger-soft' },
  taskClaim: { label: '任务', icon: 'i-carbon-task-complete', color: 'dashboard-op-tone dashboard-op-tone--violet' },
  sell: { label: '出售', icon: 'i-carbon-shopping-cart', color: 'dashboard-op-tone dashboard-op-tone--brand-soft' },
}

const DEFAULT_OP_ICON = 'i-carbon-circle-dash'

function getOpName(key: string | number) {
  return OP_META[String(key)]?.label || String(key)
}

function getOpIcon(key: string | number) {
  return OP_META[String(key)]?.icon || DEFAULT_OP_ICON
}

function getOpColor(key: string | number) {
  return OP_META[String(key)]?.color || 'dashboard-op-tone dashboard-op-tone--neutral'
}

function getExpPercent(p: any) {
  if (!p || !p.needed)
    return 0
  return Math.min(100, Math.max(0, (p.current / p.needed) * 100))
}

async function refreshBag(force = false) {
  if (!currentAccountId.value)
    return
  if (!currentAccount.value?.running)
    return
  if (!status.value?.connection?.connected)
    return

  const now = Date.now()
  if (!force && now - lastBagFetchAt.value < 2500)
    return
  lastBagFetchAt.value = now
  await bagStore.fetchBag(currentAccountId.value)
}

// 获取任务队列预览数据
async function fetchSchedulerPreview(force = false) {
  if (!currentAccountId.value)
    return
  if (!currentAccount.value?.running)
    return
  if (!status.value?.connection?.connected)
    return

  const now = Date.now()
  if (!force && now - lastSchedulerFetchAt.value < 5000)
    return
  lastSchedulerFetchAt.value = now

  try {
    const res = await api.get('/api/scheduler', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (res.data?.ok) {
      schedulerPreview.value = res.data.data
    }
  }
  catch {
    // 静默失败
  }
}

// 获取土地预览数据
async function fetchLandsPreview(force = false) {
  if (!currentAccountId.value)
    return
  if (!currentAccount.value?.running)
    return
  if (!status.value?.connection?.connected)
    return

  const now = Date.now()
  if (!force && now - lastLandsFetchAt.value < 5000)
    return
  lastLandsFetchAt.value = now

  try {
    const res = await api.get('/api/lands', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (res.data?.ok) {
      landsPreview.value = res.data.data
      // 同步倒计时到本地
      const cd: Record<number, number> = {}
      for (const land of (res.data.data?.lands || [])) {
        if (land.matureInSec > 0) {
          cd[land.id] = land.matureInSec
        }
      }
      localMatureCountdowns.value = cd
    }
  }
  catch {
    // 静默失败，不影响主流程
  }
}

// 格式化任务下次执行倒计时
function formatNextRunCountdown(nextRunAt: number) {
  if (!nextRunAt)
    return '--'
  const diffSec = Math.max(0, Math.floor((nextRunAt - Date.now()) / 1000))
  if (diffSec <= 0)
    return '即将执行'
  const h = Math.floor(diffSec / 3600)
  const m = Math.floor((diffSec % 3600) / 60)
  const s = diffSec % 60
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// 默认隐藏的纯基础设施任务（频率极高、信息量低）
const INFRA_TASKS = new Set(['status_sync', 'heartbeat_interval'])

// 任务分组映射
const TASK_GROUP: Record<string, string> = {
  'farm_check_loop': '🌾 农场',
  'farm_push_check': '🌾 农场',
  'farm_cycle': '🌾 农场',
  'friend_check_loop': '👥 好友',
  'friend_cycle': '👥 好友',
  'friend_check_bootstrap_applications': '👥 好友',
  'daily_routine_interval': '📅 每日',
  'daily_share': '📅 每日',
  'vip_daily_gift': '📅 每日',
  'month_card_gift': '📅 每日',
  'open_server_gift': '📅 每日',
  'illustrated_rewards': '📅 每日',
  'email_rewards': '📅 每日',
  'mall_free_gifts': '📅 每日',
  'scan-account-reports': '📊 汇报',
  'task_scan': '📅 每日',
  'task_claim_debounce': '📅 每日',
  'task_init_bootstrap': '📅 每日',
  'unified_next_tick': '⏱ 系统',
  'daily_routine_immediate': '📅 每日',
  'ws_error_cleanup': '⏱ 系统',
  'kickout_stop': '⏱ 系统',
  'auto_reconnect': '⏱ 系统',
  'login_error_exit': '⏱ 系统',
  'status_sync': '⏱ 系统',
  'heartbeat_interval': '⏱ 系统',
  'daily-stats-job': '⏱ 系统',
  'log-cleanup-job': '⏱ 系统',
}

function getTaskGroup(name: string): string {
  if (TASK_GROUP[name])
    return TASK_GROUP[name]
  // 动态匹配
  if (name.startsWith('daily_routine_'))
    return '📅 每日'
  if (name.startsWith('anti_steal_land_'))
    return '🛡 防偷'
  if (name.startsWith('stakeout_steal_') || name.startsWith('stake_'))
    return '🔍 蹲守'
  if (name.startsWith('restart_broadcast_retry_'))
    return '📊 汇报'
  if (name.startsWith('force_kill_') || name.startsWith('restart_fallback_'))
    return '⏱ 系统'
  if (name.startsWith('api_timeout_') || name.startsWith('request_timeout_'))
    return '🌐 网络监控'

  // 模糊匹配 key
  for (const [key, group] of Object.entries(TASK_GROUP)) {
    if (name.includes(key))
      return group
  }
  return '⚙ 其他'
}

// 获取任务队列显示用的所有任务（合并 runtime + worker 双层数据）
const mergedSchedulerTasks = computed(() => {
  const data = schedulerPreview.value
  if (!data)
    return []

  // 合并 runtime 层（主进程全局任务）和 worker 层（子进程业务任务）
  const runtimeSchedulers = data.runtime?.schedulers || data.schedulers || []
  const workerSchedulers = data.worker?.schedulers || []
  const allSchedulers = [...runtimeSchedulers, ...workerSchedulers]

  if (!allSchedulers.length)
    return []

  const tasks: any[] = []
  for (const s of allSchedulers) {
    for (const t of (s.tasks || [])) {
      const taskName = t.name || ''
      tasks.push({
        ...t,
        namespace: s.namespace,
        group: getTaskGroup(taskName),
      })
    }
  }

  return tasks
})

const schedulerTasks = computed(() => {
  const tasks = mergedSchedulerTasks.value
    .filter(task => showAllTasks.value || !INFRA_TASKS.has(task.name || ''))

  // 智能排序：运行中排最前 → 即将执行 → 按 nextRunAt 升序
  return [...tasks].sort((a, b) => {
    if (a.running && !b.running)
      return -1
    if (!a.running && b.running)
      return 1
    return (a.nextRunAt || Infinity) - (b.nextRunAt || Infinity)
  })
})

const allSchedulerTaskCount = computed(() => mergedSchedulerTasks.value.length)
const hiddenInfrastructureTaskCount = computed(() =>
  mergedSchedulerTasks.value.filter(task => INFRA_TASKS.has(task.name || '')).length,
)
const runningSchedulerTaskCount = computed(() => schedulerTasks.value.filter((task: any) => task.running).length)
const dashboardLogFilterSummary = computed(() => [
  `模块 ${modules.find(option => option.value === filter.value.module)?.label || '所有模块'}`,
  `事件 ${events.find(option => option.value === filter.value.event)?.label || '所有事件'}`,
  filter.value.isWarn === 'warn' ? '仅告警' : filter.value.isWarn === 'info' ? '仅普通' : '全部日志',
  filter.value.keyword ? `关键词 ${filter.value.keyword}` : '无关键词过滤',
])

// 任务元数据：中文名 + 操作步骤
interface TaskMeta {
  label: string
  steps: string[]
}

const TASK_META: Record<string, TaskMeta> = {
  'farm_cycle': {
    label: '🌾 农场巡查',
    steps: [
      '检查所有土地状态',
      '收获成熟作物',
      '清理枯死植株',
      '补种空闲地块',
      '施加化肥加速生长',
      '检测并触发土地升级',
    ],
  },
  'farm_check_loop': {
    label: '🌾 农场巡查',
    steps: [
      '检查所有土地状态',
      '收获成熟作物',
      '清理枯死植株',
      '补种空闲地块',
      '施加化肥加速生长',
      '检测并触发土地升级',
    ],
  },
  'farm_push_check': {
    label: '📢 收获推送',
    steps: [
      '检测成熟作物推送通知',
      '自动触发收获流程',
    ],
  },
  'friend_cycle': {
    label: '👥 好友巡查',
    steps: [
      '获取好友列表',
      '逐个访问好友农场',
      '采摘好友成熟果实',
      '帮好友浇水/除草/除虫',
      '执行捣乱操作（如已开启）',
    ],
  },
  'friend_check_loop': {
    label: '👥 好友巡查',
    steps: [
      '获取好友列表',
      '逐个访问好友农场',
      '采摘好友成熟果实',
      '帮好友浇水/除草/除虫',
      '执行捣乱操作（如已开启）',
    ],
  },
  'friend_check_bootstrap_applications': {
    label: '📨 好友申请处理',
    steps: [
      '检查待处理好友申请',
      '自动接受符合条件的申请',
    ],
  },
  'daily_share': {
    label: '📤 每日分享',
    steps: [
      '检查当日分享状态',
      '执行分享操作',
      '领取分享奖励',
    ],
  },
  'vip_daily_gift': {
    label: '👑 会员礼包',
    steps: [
      '检查会员状态',
      '判断是否有可领礼包',
      '领取会员每日礼包',
    ],
  },
  'month_card_gift': {
    label: '💳 月卡礼包',
    steps: [
      '检查月卡激活状态',
      '判断今日是否已领取',
      '领取月卡每日奖励',
    ],
  },
  'open_server_gift': {
    label: '🧧 开服红包',
    steps: [
      '检查红包活动状态',
      '判断是否有可领红包',
      '领取开服红包奖励',
    ],
  },
  'illustrated_rewards': {
    label: '📖 图鉴奖励',
    steps: [
      '检查图鉴完成进度',
      '领取已达成的图鉴奖励',
    ],
  },
  'email_rewards': {
    label: '📧 邮件领取',
    steps: [
      '检查游戏邮箱',
      '逐条领取未读邮件奖励',
    ],
  },
  'mall_free_gifts': {
    label: '🎁 免费礼包',
    steps: [
      '检查商城免费区',
      '领取所有可用免费礼包',
    ],
  },
  'task_scan': {
    label: '✅ 任务扫描',
    steps: [
      '扫描每日任务和成长任务',
      '识别已达成的领奖条件',
      '领取任务奖励',
    ],
  },
  'task_claim_debounce': {
    label: '✅ 任务领取',
    steps: [
      '防抖等待合并请求',
      '批量领取已完成任务奖励',
    ],
  },
  'task_init_bootstrap': {
    label: '🔄 任务初始化',
    steps: [
      '初始化任务系统',
      '加载任务列表',
    ],
  },
  'unified_next_tick': {
    label: '⏱ 统一调度',
    steps: [
      '检查农场巡查是否到期',
      '检查好友巡查是否到期',
      '按优先级执行到期任务',
      '计算下次调度时间',
    ],
  },
  'daily_routine_immediate': {
    label: '📅 日常任务(快速)',
    steps: [
      '快速触发跨日礼包检查',
      '立即补跑日常奖励领取链路',
    ],
  },
  'auto_reconnect': {
    label: '🔄 自动重连',
    steps: [
      '等待重连窗口到达',
      '尝试重新建立连接',
      '恢复后续调度链路',
    ],
  },
  'login_error_exit': {
    label: '⛔ 登录失败退出',
    steps: [
      '等待登录失败缓冲期',
      '安全停止当前账号进程',
    ],
  },
  'ws_error_cleanup': {
    label: '🔧 连接错误清理',
    steps: [
      '记录最近一次连接异常',
      '清理异常状态并释放残留资源',
    ],
  },
  'kickout_stop': {
    label: '🔌 被踢下线处理',
    steps: [
      '记录被踢下线状态',
      '停止当前账号任务链路',
    ],
  },
  'daily_routine_interval': {
    label: '📅 跨日礼包检测',
    steps: [
      '等待下一次跨日',
      '跨日后触发邮箱奖励领取',
      '跨日后触发分享奖励领取',
      '跨日后触发月卡/会员/开服礼包领取',
      '跨日后触发免费礼包领取',
    ],
  },
  'status_sync': {
    label: '📡 状态同步',
    steps: [
      '采集当前账号状态',
      '同步金币/经验/点券数据',
      '推送至管理面板',
    ],
  },
  'daily-stats-job': {
    label: '📊 数据统计归档',
    steps: [
      '归档当日收益数据',
      '清理过期统计记录',
    ],
  },
  'log-cleanup-job': {
    label: '🧹 日志自动清理',
    steps: [
      '扫描过期日志文件',
      '清理超期日志记录',
    ],
  },
  'scan-account-reports': {
    label: '📊 经营汇报扫描',
    steps: [
      '扫描已启用经营汇报的账号',
      '检查小时汇报是否到点',
      '检查日报是否到点',
      '触发到期汇报发送',
      '清理过期汇报历史',
    ],
  },
  'heartbeat_interval': {
    label: '💓 心跳保活',
    steps: [
      '发送心跳包到服务器',
      '检测连接存活状态',
    ],
  },
}

function getTaskDisplayName(name: string) {
  // 精确匹配 TASK_META
  if (TASK_META[name])
    return TASK_META[name].label
  // 动态任务名匹配：防偷抢收 (anti_steal_land_3 → 🛡 防偷抢收 #3)
  const antiStealMatch = name.match(/^anti_steal_land_(\d+)$/)
  if (antiStealMatch)
    return `🛡 防偷抢收 #${antiStealMatch[1]}`
  // 动态任务名匹配：蹲守偷菜 (stakeout_steal_friend_123 → 🔍 蹲守偷菜)
  if (name.startsWith('stakeout_steal_') || name.startsWith('stake_'))
    return '🔍 蹲守偷菜'
  // 日常防抖立即执行
  if (name === 'daily_routine_immediate')
    return '📅 日常任务(快速)'
  // ws 错误清理
  if (name === 'ws_error_cleanup')
    return '🔧 连接错误清理'
  // 踢下线停止
  if (name === 'kickout_stop')
    return '🔌 被踢下线处理'
  if (name === 'auto_reconnect')
    return '🔄 自动重连'
  if (name === 'login_error_exit')
    return '⛔ 登录失败退出'
  if (name.startsWith('restart_broadcast_retry_'))
    return '📣 重启提醒重试'
  if (name.startsWith('force_kill_'))
    return '🛑 强制结束进程'
  if (name.startsWith('restart_fallback_'))
    return '♻️ 重启兜底'

  // 频繁接口访问超时保护控制
  const apiTimeoutMatch = name.match(/^api_timeout_(.*)$/)
  if (apiTimeoutMatch)
    return `🔌 API频率保护`
  const reqTimeoutMatch = name.match(/^request_timeout_(.*)$/)
  if (reqTimeoutMatch)
    return `📡 接口速率限制`

  // 模糊匹配
  for (const [key, meta] of Object.entries(TASK_META)) {
    if (name.includes(key))
      return meta.label
  }
  return localizeRuntimeText(name)
}

function getTaskCardTitle(task: any) {
  return getTaskDisplayName(task?.name || '')
    || task?.namespace
    || task?.group
    || '未命名任务'
}

function getTaskSteps(name: string): string[] {
  if (name.startsWith('restart_broadcast_retry_')) {
    return [
      '等待下一次重试时间',
      '重新发送服务器重启提醒',
      '记录本次发送结果',
    ]
  }
  if (name.startsWith('force_kill_')) {
    return [
      '等待优雅停止超时',
      '强制终止异常账号进程',
    ]
  }
  if (name.startsWith('restart_fallback_')) {
    return [
      '等待重启兜底窗口',
      '确认账号是否需要再次拉起',
    ]
  }
  if (name.startsWith('api_timeout_')) {
    return [
      '等待子进程接口调用超时',
      '回收未完成请求并返回超时结果',
    ]
  }
  if (name.startsWith('request_timeout_')) {
    return [
      '等待网络请求超时阈值',
      '终止当前请求并释放占用回调',
    ]
  }
  if (name.startsWith('stake_') || name.startsWith('stakeout_steal_')) {
    return [
      '等待目标好友作物接近成熟',
      '准时进入好友农场执行偷取',
      '记录本次蹲守结果',
    ]
  }
  if (TASK_META[name])
    return TASK_META[name].steps
  for (const [key, meta] of Object.entries(TASK_META)) {
    if (name.includes(key))
      return meta.steps
  }
  return []
}

function getTaskStepPreview(name: string, limit = 2) {
  return getTaskSteps(name).slice(0, limit).join(' -> ')
}

function getTaskInlineSummary(task: any, limit = 3) {
  const parts = [
    task.namespace,
    getTaskStepPreview(task.name, limit),
  ].filter(Boolean)
  return parts.join(' · ')
}

function getTaskKindLabel(kind: string) {
  if (kind === 'interval')
    return '循环'
  if (kind === 'timeout')
    return '单次'
  return kind
}

function getTaskKindTone(kind: string): MetaBadgeTone {
  if (kind === 'interval')
    return 'info'
  return 'neutral'
}

function getTaskStateTone(running: boolean): MetaBadgeTone {
  return running ? 'success' : 'neutral'
}

function getShowAllTasksButtonClass() {
  return showAllTasks.value
    ? 'dashboard-toggle-btn dashboard-toggle-btn--active'
    : 'dashboard-toggle-btn dashboard-toggle-btn--idle'
}

// ========== 任务详情弹窗 ==========
const showTaskDetailModal = ref(false)
const selectedTask = ref<any>(null)

function openTaskDetail(task: any) {
  selectedTask.value = task
  showTaskDetailModal.value = true
}

// ========== 任务倒计时实时刷新 ==========
const taskCountdowns = ref<Record<string, string>>({})

function updateTaskCountdowns() {
  const tasks = schedulerTasks.value
  if (!tasks.length)
    return
  const now = Date.now()
  const result: Record<string, string> = {}
  for (const t of tasks) {
    const key = `${t.namespace}-${t.name}`
    if (!t.nextRunAt) {
      result[key] = '--'
    }
    else {
      const diffSec = Math.max(0, Math.floor((t.nextRunAt - now) / 1000))
      if (diffSec <= 0) {
        result[key] = '即将执行'
      }
      else {
        const h = Math.floor(diffSec / 3600)
        const m = Math.floor((diffSec % 3600) / 60)
        const s = diffSec % 60
        if (h > 0)
          result[key] = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        else
          result[key] = `${m}:${String(s).padStart(2, '0')}`
      }
    }
  }
  taskCountdowns.value = result
}

function getTaskCountdown(task: any) {
  const key = `${task.namespace}-${task.name}`
  return taskCountdowns.value[key] || formatNextRunCountdown(task.nextRunAt)
}

async function refresh() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    // 首次加载、断线兜底时走 HTTP；连接正常时优先走 WS 实时推送
    if (!realtimeConnected.value) {
      await statusStore.fetchStatus(currentAccountId.value)
      await statusStore.fetchAccountLogs()
    }

    if (hasActiveLogFilter.value || !realtimeConnected.value) {
      await statusStore.fetchLogs(currentAccountId.value, {
        module: filter.value.module || undefined,
        event: filter.value.event || undefined,
        keyword: filter.value.keyword || undefined,
        isWarn: filter.value.isWarn === 'warn' ? true : filter.value.isWarn === 'info' ? false : undefined,
      })
    }

    // 仅在账号已运行且连接就绪后拉背包，避免启动阶段触发500
    await refreshBag()
    // 拉取土地预览
    await fetchLandsPreview()
    // 拉取任务队列预览
    await fetchSchedulerPreview()
  }
}

function clearFilter() {
  filter.value.module = ''
  filter.value.event = ''
  filter.value.keyword = ''
  filter.value.isWarn = ''
  refresh()
}

function buildDashboardViewState() {
  return normalizeDashboardViewState(filter.value, DEFAULT_DASHBOARD_VIEW_STATE)
}

function applyDashboardViewState(state: Partial<typeof DEFAULT_DASHBOARD_VIEW_STATE> | null | undefined) {
  dashboardViewHydrating = true
  filter.value = { ...buildDashboardViewState(), ...normalizeDashboardViewState(state, DEFAULT_DASHBOARD_VIEW_STATE) }
  dashboardViewHydrating = false
}

function clearDashboardViewSyncTimer() {
  if (dashboardViewSyncTimer) {
    clearTimeout(dashboardViewSyncTimer)
    dashboardViewSyncTimer = null
  }
}

function scheduleDashboardViewSync() {
  clearDashboardViewSyncTimer()
  const payload = buildDashboardViewState()
  dashboardViewSyncTimer = setTimeout(async () => {
    try {
      await saveViewPreferences({
        dashboardViewState: payload,
      })
    }
    catch (error) {
      console.warn('保存仪表盘视图偏好失败', error)
    }
  }, 240)
}

async function hydrateDashboardViewState() {
  const localFallback = buildDashboardViewState()
  try {
    const payload = await fetchViewPreferences()
    if (payload?.dashboardViewState) {
      applyDashboardViewState(payload.dashboardViewState)
      return
    }
    applyDashboardViewState(localFallback)
    if (JSON.stringify(localFallback) !== JSON.stringify(DEFAULT_DASHBOARD_VIEW_STATE)) {
      await saveViewPreferences({
        dashboardViewState: localFallback,
      })
    }
  }
  catch (error) {
    console.warn('读取仪表盘视图偏好失败', error)
    applyDashboardViewState(localFallback)
  }
}

// 【修复闪烁】监听 accountId 字符串值而非 currentAccount 对象引用
watch(() => currentAccountId.value, () => {
  statusStore.clearLogs() // 【修复串日志】重置时清空上个账号挂载在DOM内存中的遗留日志
  refresh()
})

watch(() => status.value?.connection?.connected, (connected) => {
  if (connected) {
    refreshBag(true)
    fetchLandsPreview(true)
    fetchSchedulerPreview(true)
  }
})

watch(() => JSON.stringify(status.value?.operations || {}), (next, prev) => {
  if (!realtimeConnected.value || next === prev)
    return
  refreshBag()
  fetchLandsPreview()
  fetchSchedulerPreview()
})

watch(hasActiveLogFilter, (enabled) => {
  if (dashboardViewHydrating)
    return
  statusStore.setRealtimeLogsEnabled(!enabled)
  refresh()
})

watch(dashboardViewSignature, () => {
  if (!dashboardViewSyncEnabled || dashboardViewHydrating)
    return
  scheduleDashboardViewSync()
})

function onLogScroll(e: Event) {
  const el = e.target as HTMLElement
  if (!el)
    return
  // 增大判断容差并优化触发体验
  const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  autoScroll.value = isNearBottom
}

// Auto scroll logs
watch(allLogs, () => {
  nextTick(() => {
    if (logContainer.value && autoScroll.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}, { deep: true })

const settingStore = useSettingStore()

onMounted(async () => {
  await hydrateDashboardViewState()
  statusStore.setRealtimeLogsEnabled(!hasActiveLogFilter.value)
  await refresh()
  settingStore.fetchTrialCardConfig()
  dashboardViewSyncEnabled = true
})

onBeforeUnmount(() => {
  clearDashboardViewSyncTimer()
})

// Auto refresh fallback every 10s (WS 断开或筛选条件启用时会回退 HTTP)
useIntervalFn(refresh, 10000)
// Countdown timer (every 1s)
useIntervalFn(updateCountdowns, 1000)
// 任务队列倒计时 (every 1s)
useIntervalFn(updateTaskCountdowns, 1000)

// ============ 体验卡续费横幅 ============
const dashboardTrialRenewing = ref(false)
const trialCountdownText = ref('')

const dashboardCurrentUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('current_user') || 'null')
  }
  catch { return null }
})

const showDashboardTrialBanner = computed(() => {
  const user = dashboardCurrentUser.value
  if (!user?.card || user.card.type !== 'T')
    return false
  if (!settingStore.settings.trialConfig.userRenewEnabled)
    return false
  const expires = user.card.expiresAt
  if (!expires)
    return false
  return expires - Date.now() <= 24 * 60 * 60 * 1000
})

const dashboardTrialIsExpired = computed(() => {
  const user = dashboardCurrentUser.value
  if (!user?.card?.expiresAt)
    return false
  return user.card.expiresAt < Date.now()
})

function updateTrialCountdown() {
  const user = dashboardCurrentUser.value
  if (!user?.card?.expiresAt || dashboardTrialIsExpired.value) {
    trialCountdownText.value = ''
    return
  }
  const diff = user.card.expiresAt - Date.now()
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((diff % (60 * 1000)) / 1000)
  trialCountdownText.value = `还需要在 ${hours}小时 ${minutes}分 ${seconds}秒 内续费`
}

// 移除本地重复的 updateCountdowns 定义

async function handleDashboardTrialRenew() {
  dashboardTrialRenewing.value = true
  try {
    const res = await api.post('/api/auth/trial-renew')
    if (res.data.ok) {
      const user = { ...dashboardCurrentUser.value, card: res.data.data.card }
      localStorage.setItem('current_user', JSON.stringify(user))
    }
    else {
      console.warn(localizeRuntimeText(res.data.error || '续费失败'))
    }
  }
  catch (e: any) {
    console.warn(localizeRuntimeText(e.response?.data?.error || e.message || '续费异常'))
  }
  finally {
    dashboardTrialRenewing.value = false
  }
}
</script>

<template>
  <div class="dashboard-page ui-page-shell flex flex-col gap-6 pt-6 md:h-full">
    <!-- 用户信息卡片 -->
    <UserInfoCard />

    <!-- 体验卡续费横幅 -->
    <div
      v-if="showDashboardTrialBanner"
      class="trial-pulse-banner dashboard-trial-banner flex flex-col items-start justify-between gap-4 rounded-lg px-4 py-3 text-sm shadow sm:flex-row sm:items-center"
    >
      <div class="dashboard-trial-copy flex items-center gap-2">
        <span class="text-lg">⏰</span>
        <span class="font-medium">
          你的体验卡{{ dashboardTrialIsExpired ? '已过期' : '即将过期' }}。{{ trialCountdownText }} 点击一键续费继续使用
        </span>
      </div>
      <button
        :disabled="dashboardTrialRenewing"
        class="dashboard-trial-action shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        @click="handleDashboardTrialRenew"
      >
        {{ dashboardTrialRenewing ? '续费中...' : '🔄 一键续费' }}
      </button>
    </div>

    <!-- Status Cards -->
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2 sm:grid-cols-2 xl:grid-cols-4">
      <!-- Account & Exp -->
      <div class="glass-panel flex flex-col rounded-lg p-3 shadow">
        <div class="mb-1 flex items-start justify-between">
          <div class="glass-text-muted flex items-center gap-1.5 text-sm">
            <div class="i-fas-user-circle" />
            账号
          </div>
          <div class="dashboard-level-badge ui-meta-chip--info rounded px-2 py-0.5 text-xs">
            Lv.{{ status?.status?.level || 0 }}
          </div>
        </div>
        <div class="glass-text-main mb-1 truncate text-xl font-bold" :title="displayName">
          {{ displayName }}
        </div>

        <!-- Level Progress -->
        <div class="mt-auto">
          <div class="glass-text-muted mb-1 flex justify-between text-xs">
            <div class="flex items-center gap-1">
              <div class="dashboard-exp-icon i-fas-bolt" />
              <span>EXP</span>
            </div>
            <span>{{ status?.levelProgress?.current || 0 }} / {{ status?.levelProgress?.needed || '?' }}</span>
          </div>
          <div class="dashboard-exp-track h-1.5 w-full overflow-hidden rounded-full">
            <div
              class="dashboard-exp-fill h-full rounded-full transition-all duration-500"
              :style="{ width: `${getExpPercent(status?.levelProgress)}%` }"
            />
          </div>
          <div class="glass-text-muted mt-2 flex justify-between text-xs">
            <span>效率: {{ expRate }}</span>
            <span>{{ timeToLevel }}</span>
          </div>
        </div>
      </div>

      <!-- Assets & Status -->
      <div class="glass-panel flex flex-col justify-between rounded-lg p-3 shadow">
        <div class="flex justify-between">
          <div>
            <div class="glass-text-muted flex items-center gap-1.5 text-xs">
              <div class="i-fas-coins text-yellow-500" />
              金币
            </div>
            <div class="text-2xl text-yellow-600 font-bold dark:text-yellow-500">
              {{ status?.status?.gold || 0 }}
            </div>
            <div
              v-if="(status?.sessionGoldGained || 0) !== 0"
              class="text-[10px]"
              :class="(status?.sessionGoldGained || 0) > 0 ? 'text-green-500' : 'text-red-500'"
            >
              {{ (status?.sessionGoldGained || 0) > 0 ? '+' : '' }}{{ status?.sessionGoldGained || 0 }}
            </div>
          </div>
          <div class="text-right">
            <div class="glass-text-muted flex items-center justify-end gap-1.5 text-xs">
              <div class="i-fas-ticket-alt text-emerald-400" />
              点券
            </div>
            <div class="text-2xl text-emerald-500 font-bold dark:text-emerald-400">
              {{ status?.status?.coupon || 0 }}
            </div>
            <div
              v-if="(status?.sessionCouponGained || 0) !== 0"
              class="text-[10px]"
              :class="(status?.sessionCouponGained || 0) > 0 ? 'text-green-500' : 'text-red-500'"
            >
              {{ (status?.sessionCouponGained || 0) > 0 ? '+' : '' }}{{ status?.sessionCouponGained || 0 }}
            </div>
          </div>
        </div>
        <div class="mt-3 border-t border-gray-100/50 pt-2 dark:border-gray-700/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="h-2.5 w-2.5 rounded-full" :class="status?.connection?.connected ? 'bg-green-500' : 'bg-red-500'" />
              <span class="glass-text-main text-xs font-bold">{{ status?.connection?.connected ? '在线' : '离线' }}</span>
            </div>
            <div class="glass-text-muted flex items-center gap-1.5 text-xs">
              <div class="i-fas-clock text-purple-400" />
              {{ formatDuration(localUptime) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Items (Fertilizer & Collection) -->
      <div class="glass-panel flex flex-col justify-between rounded-lg p-3 shadow">
        <div class="glass-text-muted mb-1 flex items-center gap-1.5 text-sm">
          <div class="i-fas-flask text-emerald-400" />
          化肥容器
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="glass-text-muted flex items-center gap-1 text-xs">
              <div class="i-fas-flask text-emerald-400" />
              普通
            </div>
            <div class="glass-text-main font-bold">
              {{ formatBucketTime(fertilizerNormal) }}
            </div>
          </div>
          <div>
            <div class="glass-text-muted flex items-center gap-1 text-xs">
              <div class="i-fas-vial text-emerald-400" />
              有机
            </div>
            <div class="glass-text-main font-bold">
              {{ formatBucketTime(fertilizerOrganic) }}
            </div>
          </div>
        </div>
        <div class="my-2 border-t border-gray-100/50 dark:border-gray-700/50" />
        <div class="glass-text-muted mb-1 flex items-center gap-1.5 text-sm">
          <div class="i-fas-star text-emerald-400" />
          收藏点
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <div class="glass-text-muted flex items-center gap-1 text-xs">
              <div class="i-fas-bookmark text-emerald-400" />
              普通
            </div>
            <div class="glass-text-main font-bold">
              {{ collectionNormal?.count || 0 }}
            </div>
          </div>
          <div>
            <div class="glass-text-muted flex items-center gap-1 text-xs">
              <div class="i-fas-gem text-emerald-400" />
              典藏
            </div>
            <div class="glass-text-main font-bold">
              {{ collectionRare?.count || 0 }}
            </div>
          </div>
        </div>
      </div>

      <!-- Next Checks -->
      <div class="glass-panel flex flex-col justify-between rounded-lg p-3 shadow">
        <h3 class="glass-text-muted mb-1 flex items-center gap-1.5 text-sm">
          <div class="i-carbon-hourglass" />
          <span>下次巡查倒计时</span>
        </h3>
        <div class="mt-1 flex flex-1 flex-col justify-center gap-2">
          <div class="flex items-center justify-between">
            <div class="glass-text-muted flex items-center gap-1.5 text-xs tracking-wider">
              <div class="i-carbon-sprout text-primary-500" />
              <span>农场</span>
            </div>
            <div class="glass-text-main text-base font-bold font-mono">
              {{ nextFarmCheck }}
            </div>
          </div>
          <div class="flex items-center justify-between">
            <div class="glass-text-muted flex items-center gap-1.5 text-xs tracking-wider">
              <div class="i-carbon-user-multiple text-blue-500" />
              <span>好友</span>
            </div>
            <div class="glass-text-main text-base font-bold font-mono">
              {{ nextFriendCheck }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Flex: 日志 40% + 右侧 60%（纵向分割：农场预览 + 今日统计） -->
    <div class="flex flex-1 flex-col items-stretch gap-4 md:flex-row md:overflow-hidden">
      <!-- 运行日志（左侧 40%） -->
      <div class="flex flex-1 flex-col gap-4 md:min-w-0 md:w-[40%] md:overflow-hidden">
        <div class="glass-panel flex flex-1 flex-col rounded-lg p-4 shadow md:overflow-hidden">
          <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 class="glass-text-main flex items-center gap-2 text-base font-medium">
              <div class="i-carbon-document" />
              <span>运行日志</span>
            </h3>

            <div class="dashboard-log-toolbar ui-mobile-sticky-panel ui-mobile-action-panel">
              <div class="dashboard-log-toolbar-fields ui-bulk-actions text-sm">
                <BaseSelect
                  v-model="filter.module"
                  :options="modules"
                  class="min-w-[8rem] w-full sm:w-28"
                  @change="refresh"
                />

                <BaseSelect
                  v-model="filter.event"
                  :options="events"
                  class="min-w-[8rem] w-full sm:w-28"
                  @change="refresh"
                />

                <BaseSelect
                  v-model="filter.isWarn"
                  :options="logs"
                  class="min-w-[7rem] w-full sm:w-24"
                  @change="refresh"
                />

                <BaseInput
                  v-model="filter.keyword"
                  placeholder="关键词..."
                  class="min-w-[10rem] w-full sm:w-28"
                  clearable
                  @keyup.enter="refresh"
                  @clear="refresh"
                />

                <BaseButton
                  variant="primary"
                  size="sm"
                  title="搜索"
                  @click="refresh"
                >
                  <div class="i-carbon-search text-lg" />
                </BaseButton>
                <BaseButton
                  v-if="hasActiveLogFilter"
                  variant="danger"
                  size="sm"
                  class="!px-2"
                  title="恢复默认 / 清空过滤"
                  @click="clearFilter"
                >
                  <div class="i-carbon-close text-lg" />
                </BaseButton>
              </div>

              <div class="dashboard-log-chip-row ui-bulk-actions">
                <span
                  v-for="chip in dashboardLogFilterSummary"
                  :key="chip"
                  class="dashboard-log-chip ui-meta-chip--neutral"
                >
                  {{ chip }}
                </span>
              </div>
            </div>
          </div>

          <div class="dashboard-log-note mb-3 rounded-xl px-3 py-2 text-xs leading-5">
            {{ DASHBOARD_BROWSER_PREF_NOTE }}
          </div>

          <div ref="logContainer" class="max-h-[50vh] min-h-0 flex-1 overflow-y-auto border border-gray-200/20 rounded bg-transparent p-3 text-xs leading-relaxed font-mono md:max-h-none dark:border-gray-700/20" @scroll="onLogScroll">
            <div v-if="!allLogs.length" class="glass-text-muted py-8 text-center">
              暂无日志
            </div>
            <div v-for="log in allLogs" :key="log.ts + log.msg" class="mb-2 break-all">
              <div>
                <span class="mr-1.5 select-none opacity-60">[{{ formatLogTime(log.time) }}]</span>
                <span class="mr-1.5 rounded px-1 py-0.5 text-xs font-bold" :class="getLogTagClass(log.tag)">{{ log.tag }}</span>
                <span v-if="log.meta?.event" class="dashboard-log-event ui-meta-chip--info mr-1.5 rounded px-1 py-0.5 text-xs">{{ getEventLabel(log.meta.event) }}</span>
                <span :class="getLogMsgClass(log.tag)" class="glass-text-main opacity-90">{{ log.msg }}</span>
              </div>
              <div v-if="getPlantingLogDetailChips(log).length" class="mt-1.5 flex flex-wrap gap-1.5 pl-14">
                <span
                  v-for="chip in getPlantingLogDetailChips(log)"
                  :key="`${log.ts}-${chip.key}`"
                  class="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[11px] leading-5"
                  :class="getLogDetailChipClass(chip.tone)"
                >
                  <span class="opacity-70">{{ chip.label }}</span>
                  <span class="font-semibold">{{ chip.value }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧面板（60%）：纵向分割 —— 任务队列预览 + 今日统计 -->
      <div class="flex flex-col gap-4 md:min-w-0 md:w-[60%] md:overflow-hidden">
        <!-- 任务队列预览 -->
        <div class="glass-panel dashboard-task-panel flex min-h-0 shrink-0 flex-col overflow-hidden rounded-lg px-4 py-3 shadow">
          <div class="dashboard-task-panel__header mb-1.5 shrink-0">
            <div class="dashboard-task-panel__heading min-w-0">
              <h3 class="dashboard-task-panel__title glass-text-main flex items-center gap-2 text-base font-medium">
                <div class="i-carbon-task text-indigo-500" />
                <span>任务队列预览</span>
              </h3>
              <p class="dashboard-task-panel__desc hidden md:block">
                紧凑展示当前账号的调度队列，优先把运行中和即将触发的任务排在前面。
              </p>
            </div>
            <div v-if="allSchedulerTaskCount" class="dashboard-task-meta ui-bulk-actions text-xs font-normal">
              <span class="dashboard-task-pill dashboard-task-pill--count">总任务 {{ allSchedulerTaskCount }}</span>
              <span class="dashboard-task-pill dashboard-task-pill--running">运行中 {{ runningSchedulerTaskCount }}</span>
              <button
                v-if="hiddenInfrastructureTaskCount"
                class="dashboard-toggle-btn rounded-full px-2 py-0.5 text-[10px] transition-colors"
                :class="getShowAllTasksButtonClass()"
                @click="showAllTasks = !showAllTasks"
              >
                {{ showAllTasks ? `收起内部 ${hiddenInfrastructureTaskCount}` : `已收起 ${hiddenInfrastructureTaskCount}` }}
              </button>
            </div>
          </div>

          <div v-if="!schedulerPreview" class="glass-text-muted flex flex-1 items-center justify-center py-6 text-center text-sm">
            <div v-if="!status?.connection?.connected">
              账号未连接，无法获取任务队列
            </div>
            <div v-else>
              正在加载任务队列...
            </div>
          </div>
          <div v-else-if="!allSchedulerTaskCount" class="glass-text-muted flex flex-1 items-center justify-center py-6 text-center text-sm">
            当前暂无待展示任务
          </div>
          <div v-else-if="!schedulerTasks.length" class="glass-text-muted flex flex-1 items-center justify-center py-6 text-center text-sm">
            当前仅隐藏了内部基础任务，可点击“显示全部”查看完整队列
          </div>

          <template v-else>
            <div class="dashboard-task-list custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
              <article
                v-for="task in schedulerTasks"
                :key="`${task.namespace}-${task.name}`"
                class="dashboard-task-card"
                :class="{ 'dashboard-task-card--running': task.running }"
              >
                <div class="dashboard-task-card__main">
                  <div class="dashboard-task-card__badges">
                    <BaseBadge surface="meta" tone="neutral" class="dashboard-group-badge rounded px-2 py-0.5 text-[11px]">
                      {{ task.group }}
                    </BaseBadge>
                    <BaseBadge surface="meta" :tone="getTaskKindTone(task.kind)" class="dashboard-task-kind rounded px-2 py-0.5 text-[11px] font-medium">
                      {{ getTaskKindLabel(task.kind) }}
                    </BaseBadge>
                    <BaseBadge surface="meta" :tone="getTaskStateTone(task.running)" class="dashboard-task-state rounded px-2 py-0.5 text-[11px] font-medium">
                      {{ task.running ? '执行中' : '等待中' }}
                    </BaseBadge>
                  </div>

                  <div class="dashboard-task-card__title-row">
                    <h4 class="dashboard-task-card__title" :title="getTaskCardTitle(task)">
                      {{ getTaskCardTitle(task) }}
                    </h4>
                    <p
                      v-if="getTaskInlineSummary(task)"
                      class="dashboard-task-card__summary"
                      :title="getTaskInlineSummary(task, 5)"
                    >
                      {{ getTaskInlineSummary(task, 3) }}
                    </p>
                  </div>
                </div>

                <div class="dashboard-task-card__side">
                  <div class="dashboard-task-metric">
                    <span class="dashboard-task-metric__label">倒计时</span>
                    <span class="dashboard-task-metric__value font-mono">
                      {{ getTaskCountdown(task) }}
                    </span>
                  </div>
                  <div class="dashboard-task-metric">
                    <span class="dashboard-task-metric__label">已执行</span>
                    <span class="dashboard-task-metric__value">
                      {{ task.runCount || 0 }} 次
                    </span>
                  </div>
                  <div class="dashboard-task-card__action">
                    <button
                      v-if="getTaskSteps(task.name).length"
                      class="dashboard-task-view rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                      @click="openTaskDetail(task)"
                    >
                      查看详情
                    </button>
                    <span v-else class="glass-text-muted">-</span>
                  </div>
                </div>
              </article>
            </div>
          </template>
        </div>

        <!-- 今日统计（保持 2 列，压缩间距） -->
        <div class="glass-panel flex min-h-0 flex-1 flex-col rounded-lg p-4 shadow">
          <h3 class="glass-text-main mb-3 flex shrink-0 items-center gap-2 text-base font-medium">
            <div class="i-carbon-chart-column" />
            <span>今日统计</span>
          </h3>
          <div class="grid grid-cols-2 content-start gap-1.5 lg:grid-cols-3 xl:grid-cols-4">
            <div
              v-for="(val, key) in (status?.operations || {})"
              :key="key"
              class="dashboard-stat-card flex items-center justify-between rounded-xl px-3 py-2 transition-colors"
            >
              <div class="flex items-center gap-2">
                <div class="text-sm" :class="[getOpIcon(key), getOpColor(key)]" />
                <div class="glass-text-muted text-xs">
                  {{ getOpName(key) }}
                </div>
              </div>
              <div class="text-sm font-bold">
                {{ val }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 任务详情弹窗 -->
    <ConfirmModal
      :show="showTaskDetailModal"
      :title="selectedTask ? getTaskDisplayName(selectedTask.name) : '任务详情'"
      confirm-text="关闭"
      :show-cancel="false"
      @update:show="showTaskDetailModal = $event"
      @confirm="showTaskDetailModal = false"
    >
      <div v-if="selectedTask" class="space-y-4">
        <!-- 任务基本信息 -->
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <BaseBadge surface="meta" :tone="getTaskKindTone(selectedTask.kind)" class="dashboard-task-kind rounded px-2 py-0.5 text-xs font-medium">
            {{ getTaskKindLabel(selectedTask.kind) }}
          </BaseBadge>
          <BaseBadge v-if="selectedTask.running" surface="meta" tone="success" class="dashboard-task-state inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium">
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            执行中
          </BaseBadge>
          <BaseBadge v-else surface="meta" tone="neutral" class="dashboard-task-state rounded px-2 py-0.5 text-xs">
            等待中
          </BaseBadge>
          <BaseBadge surface="meta" tone="info" class="dashboard-task-run-count rounded px-2 py-0.5 text-xs font-medium">
            已执行 {{ selectedTask.runCount || 0 }} 次
          </BaseBadge>
        </div>

        <!-- 倒计时 -->
        <div class="dashboard-task-countdown flex items-center gap-2 rounded-lg px-3 py-2">
          <div class="i-carbon-timer text-indigo-500" />
          <span class="glass-text-muted text-sm">距下次执行：</span>
          <span class="text-sm font-bold font-mono">
            {{ getTaskCountdown(selectedTask) }}
          </span>
        </div>

        <!-- 操作步骤流程 -->
        <div v-if="getTaskSteps(selectedTask.name).length">
          <h4 class="glass-text-main mb-2 text-sm font-medium">
            📋 操作步骤
          </h4>
          <ol class="ml-1 space-y-1.5">
            <li
              v-for="(step, idx) in getTaskSteps(selectedTask.name)"
              :key="idx"
              class="flex items-start gap-2 text-sm"
            >
              <span class="dashboard-step-index mt-0.5 h-5 w-5 flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                {{ idx + 1 }}
              </span>
              <span class="glass-text-main">{{ step }}</span>
            </li>
          </ol>
        </div>
      </div>
    </ConfirmModal>
  </div>
</template>

<style scoped>
.dashboard-page {
  color: var(--ui-text-1);
}

.dashboard-page
  :is(
    [class*='text-'][class*='gray-500'],
    [class*='text-'][class*='gray-400'],
    [class*='text-'][class*='gray-300'],
    .glass-text-muted
  ) {
  color: var(--ui-text-2) !important;
}

.dashboard-page [class*='border-'][class*='gray-100/'],
.dashboard-page [class*='border-'][class*='gray-700/'],
.dashboard-page [class*='border-'][class*='white/10'] {
  border-color: var(--ui-border-subtle) !important;
}

.dashboard-page [class*='bg-'][class*='gray-100/50'],
.dashboard-page [class*='bg-'][class*='gray-700/30'],
.dashboard-page [class*='bg-'][class*='black/5'],
.dashboard-page [class*='dark:bg-'][class*='white/5'] {
  background-color: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
}

.trial-pulse-banner {
  border: 1px solid color-mix(in srgb, var(--ui-status-warning) 30%, transparent);
  animation: trial-pulse 2.5s infinite ease-in-out;
}

@keyframes trial-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--ui-status-warning) 20%, transparent);
    border-color: color-mix(in srgb, var(--ui-status-warning) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 15px 2px color-mix(in srgb, var(--ui-status-warning) 15%, transparent);
    border-color: color-mix(in srgb, var(--ui-status-warning) 60%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--ui-status-warning) 20%, transparent);
    border-color: color-mix(in srgb, var(--ui-status-warning) 30%, transparent);
  }
}

.dark .trial-pulse-banner {
  border-color: color-mix(in srgb, var(--ui-status-warning) 20%, transparent);
}

.dashboard-log-toolbar {
  z-index: 12;
  display: grid;
  gap: 0.75rem;
}

.dashboard-task-panel {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent);
}

.dashboard-task-panel__header {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
}

.dashboard-task-panel__heading {
  min-width: 0;
}

.dashboard-task-panel__title {
  min-width: 0;
  line-height: 1.15;
}

.dashboard-task-panel__desc {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.28;
  color: var(--ui-text-2);
}

.dashboard-task-pill {
  display: inline-flex;
  align-items: center;
  min-height: 1.42rem;
  padding: 0.14rem 0.56rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 0.69rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.dashboard-task-pill--count {
  background: color-mix(in srgb, var(--ui-brand-500) 10%, transparent);
  color: color-mix(in srgb, var(--ui-brand-500) 74%, var(--ui-text-1) 26%);
}

.dashboard-task-pill--running {
  background: color-mix(in srgb, var(--ui-status-success) 12%, transparent);
  color: color-mix(in srgb, var(--ui-status-success) 72%, var(--ui-text-1) 28%);
}

.dashboard-log-chip-row,
.dashboard-task-meta {
  min-width: 0;
}

.dashboard-task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  align-items: center;
}

.dashboard-log-chip {
  display: inline-flex;
  align-items: center;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1;
  font-weight: 600;
}

.dashboard-trial-banner {
  background: color-mix(in srgb, var(--ui-status-warning) 12%, var(--ui-bg-surface));
}

.dashboard-trial-copy {
  color: color-mix(in srgb, var(--ui-status-warning) 72%, var(--ui-text-1) 28%);
}

.dashboard-trial-action {
  background: var(--ui-status-warning);
  color: var(--ui-text-on-brand);
}

.dashboard-trial-action:hover {
  background: color-mix(in srgb, var(--ui-status-warning) 88%, black 12%);
}

.dashboard-level-badge,
.dashboard-log-event,
.dashboard-log-tag {
  display: inline-flex;
  align-items: center;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-weight: 700;
  line-height: 1;
}

.dashboard-step-index {
  background: color-mix(in srgb, var(--ui-status-info) 12%, transparent);
  color: color-mix(in srgb, var(--ui-status-info) 72%, var(--ui-text-1) 28%);
}

.dashboard-exp-icon {
  color: var(--ui-status-info);
}

.dashboard-exp-track,
.dashboard-task-countdown {
  background: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent);
}

.dashboard-exp-fill {
  background: var(--ui-status-info);
}

.dashboard-log-note {
  border: 1px solid color-mix(in srgb, var(--ui-status-info) 26%, transparent);
  background: color-mix(in srgb, var(--ui-status-info) 10%, var(--ui-bg-surface));
  color: color-mix(in srgb, var(--ui-status-info) 68%, var(--ui-text-1) 32%);
}

.dashboard-log-message--danger {
  color: var(--ui-status-danger);
}

.dashboard-log-message {
  color: var(--ui-text-1);
}

.dashboard-toggle-btn--active {
  background: color-mix(in srgb, var(--ui-status-warning) 12%, transparent);
  color: color-mix(in srgb, var(--ui-status-warning) 72%, var(--ui-text-1) 28%);
}

.dashboard-toggle-btn--idle,
.dashboard-group-badge {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
  color: var(--ui-text-2);
}

.dashboard-task-list {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0.55rem;
}

.dashboard-task-card {
  display: grid;
  min-width: 0;
  gap: 0.58rem;
  border: 1px solid color-mix(in srgb, var(--ui-border-subtle) 68%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent);
  padding: 0.68rem 0.88rem;
  transition: background-color var(--ui-motion-base), border-color var(--ui-motion-base), transform var(--ui-motion-base);
}

.dashboard-task-card:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
}

.dashboard-task-card--running {
  border-color: color-mix(in srgb, var(--ui-status-success) 22%, transparent);
  background: color-mix(in srgb, var(--ui-status-success) 7%, var(--ui-bg-surface) 93%);
}

.dashboard-task-card--running:hover {
  background: color-mix(in srgb, var(--ui-status-success) 10%, var(--ui-bg-surface-raised) 90%);
}

.dashboard-task-card__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.28rem;
}

.dashboard-task-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.dashboard-task-card__title-row {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.18rem;
}

.dashboard-task-card__title {
  min-width: 0;
  flex: 0 0 auto;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ui-text-1);
}

.dashboard-task-card__summary {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.74rem;
  line-height: 1.3;
  color: var(--ui-text-3);
}

.dashboard-task-card__side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.65rem;
  min-width: 0;
  align-items: end;
}

.dashboard-task-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.12rem;
}

.dashboard-task-metric__label {
  font-size: 0.68rem;
  color: var(--ui-text-2);
}

.dashboard-task-metric__value {
  min-width: 0;
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.15;
  color: var(--ui-text-1);
}

.dashboard-task-card__action {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.dashboard-task-table {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
}

.dashboard-table-head,
.dashboard-task-row {
  border-color: var(--ui-border-subtle);
}

.dashboard-task-row td {
  vertical-align: middle;
}

.dashboard-task-row:hover,
.dashboard-stat-card:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
}

.dashboard-task-row--running {
  background: color-mix(in srgb, var(--ui-status-success) 6%, transparent);
}

.dashboard-task-row--running:hover {
  background: color-mix(in srgb, var(--ui-status-success) 10%, var(--ui-bg-surface-raised) 84%);
}

.dashboard-task-name-cell {
  min-width: 0;
}

.dashboard-task-name-wrap {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.28rem;
}

.dashboard-task-name-top,
.dashboard-task-name-meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-task-name-title,
.dashboard-task-name-preview {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-task-name-meta {
  font-size: 0.72rem;
  color: var(--ui-text-2);
}

.dashboard-task-name-namespace {
  flex: 0 0 auto;
  opacity: 0.8;
}

.dashboard-task-name-preview {
  color: var(--ui-text-3);
}

.dashboard-task-view {
  color: color-mix(in srgb, var(--ui-brand-600) 72%, var(--ui-text-1) 28%);
}

.dashboard-task-view:hover {
  background: color-mix(in srgb, var(--ui-brand-500) 10%, transparent);
}

.dashboard-stat-card {
  background: color-mix(in srgb, var(--ui-bg-surface) 68%, transparent);
}

.dashboard-op-tone--brand {
  color: var(--ui-brand-500);
}

.dashboard-op-tone--brand-soft {
  color: color-mix(in srgb, var(--ui-brand-500) 58%, var(--ui-status-danger) 42%);
}

.dashboard-op-tone--info,
.dashboard-op-tone--info-soft {
  color: var(--ui-status-info);
}

.dashboard-op-tone--warning,
.dashboard-op-tone--warning-soft {
  color: var(--ui-status-warning);
}

.dashboard-op-tone--danger,
.dashboard-op-tone--danger-soft {
  color: var(--ui-status-danger);
}

.dashboard-op-tone--success,
.dashboard-op-tone--success-soft {
  color: var(--ui-status-success);
}

.dashboard-op-tone--violet {
  color: color-mix(in srgb, var(--ui-brand-600) 72%, var(--ui-status-info) 28%);
}

.dashboard-op-tone--neutral {
  color: var(--ui-text-3);
}

@media (min-width: 768px) {
  .dashboard-task-panel {
    height: clamp(15.5rem, 30vh, 19rem);
  }

  .dashboard-task-panel__header {
    align-items: flex-start;
    justify-content: space-between;
    flex-direction: row;
  }

  .dashboard-task-panel__heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    min-width: 0;
    flex: 1 1 auto;
    align-items: start;
    gap: 0.5rem;
  }

  .dashboard-task-panel__desc {
    min-width: 0;
    display: -webkit-box;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .dashboard-task-card {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .dashboard-task-card__title-row {
    flex-direction: row;
    align-items: baseline;
    gap: 0.55rem;
  }

  .dashboard-task-card__summary {
    flex: 1 1 auto;
  }

  .dashboard-task-card__side {
    grid-template-columns: repeat(3, minmax(4.5rem, auto));
    align-items: center;
  }

  .dashboard-task-metric {
    flex-direction: row;
    align-items: baseline;
    gap: 0.38rem;
  }

  .dashboard-task-card__action {
    grid-column: auto;
    justify-content: flex-end;
  }
}
</style>
