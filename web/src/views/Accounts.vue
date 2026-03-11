<script setup lang="ts">
import type { CopyInteractionOptions } from '@/composables/use-copy-interaction'
import type { AccountsActionHistoryItem, AccountsActionHistoryStatus } from '@/utils/view-preferences'
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import AccountModal from '@/components/AccountModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseAccountRecordCard from '@/components/ui/BaseAccountRecordCard.vue'
import BaseAccountViewSwitcherLayout from '@/components/ui/BaseAccountViewSwitcherLayout.vue'
import BaseActionButtons from '@/components/ui/BaseActionButtons.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseBulkActions from '@/components/ui/BaseBulkActions.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseChipList from '@/components/ui/BaseChipList.vue'
import BaseDataTable from '@/components/ui/BaseDataTable.vue'
import BaseDataTableHead from '@/components/ui/BaseDataTableHead.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseHeaderNotice from '@/components/ui/BaseHeaderNotice.vue'
import BaseHeaderSummary from '@/components/ui/BaseHeaderSummary.vue'
import BaseHistorySectionLayout from '@/components/ui/BaseHistorySectionLayout.vue'
import BaseIconActions from '@/components/ui/BaseIconActions.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseManagementBar from '@/components/ui/BaseManagementBar.vue'
import BasePageHeaderText from '@/components/ui/BasePageHeaderText.vue'
import BaseRecordMetricCard from '@/components/ui/BaseRecordMetricCard.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSelectionSummary from '@/components/ui/BaseSelectionSummary.vue'
import BaseSortableHeaderCell from '@/components/ui/BaseSortableHeaderCell.vue'
import BaseTableSectionCard from '@/components/ui/BaseTableSectionCard.vue'
import BaseTableToolbar from '@/components/ui/BaseTableToolbar.vue'
import BaseToggleOptionGroup from '@/components/ui/BaseToggleOptionGroup.vue'
import { useCopyInteraction } from '@/composables/use-copy-interaction'
import { useViewPreferenceSync } from '@/composables/use-view-preference-sync'
import { useAccountStore } from '@/stores/account'
import { useToastStore } from '@/stores/toast'
import { adminToken } from '@/utils/auth'
import { useAvatar } from '@/utils/avatar'
import { createActionButton, createActionButtons, createChip, createChips, createHeaderNotice, createHeaderSummary, createHistoryHighlight, createHistoryMetaItem, createHistoryMetaItems, createHistoryMetric, createHistoryMetrics, createHistoryPanel, createHistoryRecentItem, createHistoryRecentItems, createIconAction, createIconActions, createPageHeaderText, createRecordDisplayBadge, createRecordDisplayBadges, createRecordDisplayField, createRecordDisplayFields, createRecordHero, createRecordMetricField, createRecordMetricFields, createRecordState, createToggleOption, createToggleOptions } from '@/utils/management-schema'
import { DEFAULT_ACCOUNTS_VIEW_STATE, fetchViewPreferences, normalizeAccountsActionHistory, normalizeAccountsViewState } from '@/utils/view-preferences'

interface CurrentUser {
  username?: string
  role?: string
}

interface UserItem {
  username: string
  role: string
}

type OwnershipSection = 'mine' | 'other_user' | 'other_admin' | 'unowned'
type OwnershipFilter = OwnershipSection | ''
type PlatformFilter = 'all' | 'qq' | 'wechat'
type StateFilter = 'all' | 'online' | 'starting' | 'offline'
type SortMode = 'smart' | 'recent' | 'name' | 'platform'
type ViewMode = 'standard' | 'compact' | 'table'
type AccountMode = 'main' | 'alt' | 'safe'
type TableSortKey = 'account' | 'owner' | 'platform' | 'activity' | 'mode' | 'state'
type SortDirection = 'asc' | 'desc'
type TableColumnKey = 'owner' | 'platform' | 'activity' | 'mode' | 'state' | 'actions'
type ActionHistoryItem = AccountsActionHistoryItem
type ActionHistoryStatus = AccountsActionHistoryStatus

const VIEW_MODE_STORAGE_KEY = 'accounts_view_mode'
const TABLE_SORT_STORAGE_KEY = 'accounts_table_sort'
const TABLE_COLUMNS_STORAGE_KEY = 'accounts_table_columns'
const ACTION_HISTORY_STORAGE_KEY = 'accounts_action_history'
const ACTION_HISTORY_LIMIT = 8
const UNOWNED_TRANSFER_VALUE = '__unowned__'
const ACCOUNT_VIEW_PREFERENCES_NOTE = '视图模式、表格排序、列显隐和最近操作摘要会跟随当前登录用户同步到服务器；本机缓存只作首屏兜底。'
const ACTION_HISTORY_SYNC_NOTE = '这里展示的是当前登录用户最近的批量操作摘要，会同步到服务器并在新设备恢复；它不是正式审计日志。'
const TABLE_VIEW_SYNC_NOTE = '列设置 / 排序会跟随当前登录用户同步到服务器'
const TABLE_COLUMN_SYNC_NOTE = '当前列设置会同步到服务器；最近操作摘要也会跟随当前登录用户同步。'

const { getAvatarUrl, markFailed } = useAvatar()

const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const toast = useToastStore()
const { accounts, loading } = storeToRefs(accountStore)

const showModal = ref(false)
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const editingAccount = ref<any>(null)
const accountToDelete = ref<any>(null)
const currentUser = ref<CurrentUser | null>(null)
const users = ref<UserItem[]>([])
const searchKeyword = ref('')
const ownershipFilter = ref<OwnershipFilter>('')
const platformFilter = ref<PlatformFilter>('all')
const stateFilter = ref<StateFilter>('all')
const sortMode = ref<SortMode>('smart')
const viewMode = ref<ViewMode>('standard')
const tableSortKey = ref<TableSortKey>('activity')
const tableSortDirection = ref<SortDirection>('desc')
const selectedAccountIds = ref<string[]>([])
const batchLoading = ref(false)
const batchActionType = ref('')
const safeCheckingId = ref('')
const exportLoading = ref(false)
const exportScope = ref<'all' | 'selected' | ''>('')
const transferOwnershipTarget = ref('')
const transferLoading = ref(false)
const showBatchDeleteConfirm = ref(false)
const batchDeleteLoading = ref(false)
const showColumnSettings = ref(false)
const actionHistory = ref<ActionHistoryItem[]>([])
const { copiedHistoryId, copiedControlKey, copyText: copyWithFeedback } = useCopyInteraction()
const tableColumnVisibility = ref<Record<TableColumnKey, boolean>>({
  owner: true,
  platform: true,
  activity: true,
  mode: true,
  state: true,
  actions: true,
})

const platformOptions = [
  { label: '全部平台', value: 'all' },
  { label: 'QQ', value: 'qq' },
  { label: '微信', value: 'wechat' },
]

const stateOptions = [
  { label: '全部状态', value: 'all' },
  { label: '运行中', value: 'online' },
  { label: '启动中', value: 'starting' },
  { label: '已停止', value: 'offline' },
]

const sortOptions = [
  { label: '智能排序', value: 'smart', description: '在线优先，其次最近登录/更新' },
  { label: '最近登录/更新', value: 'recent', description: '优先展示最近变更的账号' },
  { label: '名称排序', value: 'name', description: '按备注名称或昵称排序' },
  { label: '平台排序', value: 'platform', description: '按 QQ / 微信平台分组排序' },
]

const viewOptions = [
  { label: '标准卡片', shortLabel: '标准', value: 'standard' as ViewMode, icon: 'i-carbon-apps' },
  { label: '紧凑卡片', shortLabel: '紧凑', value: 'compact' as ViewMode, icon: 'i-carbon-grid' },
  { label: '表格视图', shortLabel: '表格', value: 'table' as ViewMode, icon: 'i-carbon-data-table' },
]

const accountModeOptions: { mode: AccountMode, label: string, title: string }[] = [
  { mode: 'main', label: '主号', title: '设为主号' },
  { mode: 'alt', label: '小号', title: '设为小号' },
  { mode: 'safe', label: '避险', title: '设为风险规避' },
]

const tableColumnOptions: { key: TableColumnKey, label: string }[] = [
  { key: 'owner', label: '归属' },
  { key: 'platform', label: '平台 / 区服' },
  { key: 'activity', label: '最近登录' },
  { key: 'mode', label: '模式' },
  { key: 'state', label: '状态' },
  { key: 'actions', label: '操作' },
]

function readCurrentUser() {
  try {
    const raw = localStorage.getItem('current_user')
    if (!raw)
      return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  }
  catch {
    return null
  }
}

function refreshCurrentUser() {
  currentUser.value = readCurrentUser()
}

function readViewMode(): ViewMode {
  try {
    const raw = String(localStorage.getItem(VIEW_MODE_STORAGE_KEY) || '').trim()
    if (raw === 'compact' || raw === 'table' || raw === 'standard')
      return raw
  }
  catch {
  }
  return 'standard'
}

function persistViewMode(mode: ViewMode = viewMode.value) {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  }
  catch {
  }
}

function normalizeOwnershipFilter(value: unknown): OwnershipFilter {
  const raw = String(value || '').trim()
  if (raw === 'mine' || raw === 'other_user' || raw === 'other_admin' || raw === 'unowned')
    return raw
  return ''
}

function normalizePlatformFilter(value: unknown): PlatformFilter {
  const raw = String(value || '').trim()
  if (raw === 'qq' || raw === 'wechat')
    return raw
  return 'all'
}

function normalizeStateFilter(value: unknown): StateFilter {
  const raw = String(value || '').trim()
  if (raw === 'online' || raw === 'starting' || raw === 'offline')
    return raw
  return 'all'
}

function normalizeSortMode(value: unknown): SortMode {
  const raw = String(value || '').trim()
  if (raw === 'recent' || raw === 'name' || raw === 'platform')
    return raw
  return 'smart'
}

function normalizeViewMode(value: unknown): ViewMode {
  const raw = String(value || '').trim()
  if (raw === 'compact' || raw === 'table')
    return raw
  return 'standard'
}

function normalizeTableSortKey(value: unknown): TableSortKey {
  const raw = String(value || '').trim()
  if (raw === 'account' || raw === 'owner' || raw === 'platform' || raw === 'activity' || raw === 'mode' || raw === 'state')
    return raw
  return 'activity'
}

function normalizeSortDirection(value: unknown): SortDirection {
  return String(value || '').trim() === 'asc' ? 'asc' : 'desc'
}

function getQueryValue(value: unknown) {
  if (Array.isArray(value))
    return String(value[0] || '').trim()
  return String(value || '').trim()
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  persistViewMode(mode)
}

function readTableSortState() {
  try {
    const raw = JSON.parse(localStorage.getItem(TABLE_SORT_STORAGE_KEY) || '{}')
    return {
      key: normalizeTableSortKey(raw.key),
      direction: normalizeSortDirection(raw.direction),
    }
  }
  catch {
    return {
      key: 'activity' as TableSortKey,
      direction: 'desc' as SortDirection,
    }
  }
}

function persistTableSortState() {
  try {
    localStorage.setItem(TABLE_SORT_STORAGE_KEY, JSON.stringify({
      key: tableSortKey.value,
      direction: tableSortDirection.value,
    }))
  }
  catch {
  }
}

function readTableColumnVisibility() {
  try {
    const raw = JSON.parse(localStorage.getItem(TABLE_COLUMNS_STORAGE_KEY) || '{}')
    if (raw && typeof raw === 'object') {
      return {
        owner: raw.owner !== false,
        platform: raw.platform !== false,
        activity: raw.activity !== false,
        mode: raw.mode !== false,
        state: raw.state !== false,
        actions: raw.actions !== false,
      }
    }
  }
  catch {
  }
  return {
    owner: true,
    platform: true,
    activity: true,
    mode: true,
    state: true,
    actions: true,
  }
}

function persistTableColumnVisibility() {
  try {
    localStorage.setItem(TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(tableColumnVisibility.value))
  }
  catch {
  }
}

function buildLocalAccountsViewState() {
  const tableSortState = readTableSortState()
  return normalizeAccountsViewState({
    viewMode: readViewMode(),
    tableSortKey: tableSortState.key,
    tableSortDirection: tableSortState.direction,
    tableColumnVisibility: readTableColumnVisibility(),
  }, DEFAULT_ACCOUNTS_VIEW_STATE)
}

function buildAccountsViewState() {
  return normalizeAccountsViewState({
    viewMode: viewMode.value,
    tableSortKey: tableSortKey.value,
    tableSortDirection: tableSortDirection.value,
    tableColumnVisibility: tableColumnVisibility.value,
  }, DEFAULT_ACCOUNTS_VIEW_STATE)
}

function persistAccountsViewStateToLocal() {
  persistViewMode(viewMode.value)
  persistTableSortState()
  persistTableColumnVisibility()
}

function applyAccountsViewState(state: Partial<typeof DEFAULT_ACCOUNTS_VIEW_STATE> | null | undefined) {
  const normalized = normalizeAccountsViewState(state, DEFAULT_ACCOUNTS_VIEW_STATE)
  viewMode.value = normalized.viewMode
  tableSortKey.value = normalized.tableSortKey
  tableSortDirection.value = normalized.tableSortDirection
  tableColumnVisibility.value = { ...normalized.tableColumnVisibility }
  persistAccountsViewStateToLocal()
}

function toggleTableColumn(key: TableColumnKey) {
  tableColumnVisibility.value = {
    ...tableColumnVisibility.value,
    [key]: !tableColumnVisibility.value[key],
  }
  persistTableColumnVisibility()
}

function readActionHistoryFromLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(ACTION_HISTORY_STORAGE_KEY) || '[]')
    return normalizeAccountsActionHistory(Array.isArray(raw) ? raw : [], [])
  }
  catch {
    return []
  }
}

function buildAccountsActionHistory() {
  return normalizeAccountsActionHistory(actionHistory.value, [])
}

function persistActionHistory() {
  try {
    localStorage.setItem(ACTION_HISTORY_STORAGE_KEY, JSON.stringify(buildAccountsActionHistory()))
  }
  catch {
  }
}

function applyAccountsActionHistory(history: Partial<ActionHistoryItem>[] | null | undefined) {
  actionHistory.value = normalizeAccountsActionHistory(history, [])
  persistActionHistory()
}

const {
  hydrate: hydrateAccountsViewState,
  enableSync: enableAccountsViewSync,
} = useViewPreferenceSync({
  key: 'accountsViewState',
  label: '账号页视图偏好',
  buildState: buildAccountsViewState,
  applyState: applyAccountsViewState,
  defaultState: DEFAULT_ACCOUNTS_VIEW_STATE,
  readLocalFallback: buildLocalAccountsViewState,
})

const {
  hydrate: hydrateAccountsActionHistory,
  enableSync: enableAccountsActionHistorySync,
} = useViewPreferenceSync({
  key: 'accountsActionHistory',
  label: '账号页最近操作摘要',
  buildState: buildAccountsActionHistory,
  applyState: applyAccountsActionHistory,
  defaultState: [],
  readLocalFallback: readActionHistoryFromLocal,
  shouldSyncFallback: history => history.length > 0,
})

async function hydrateAccountsPagePreferences() {
  let payload = null
  try {
    payload = await fetchViewPreferences()
  }
  catch (error) {
    console.warn('读取账号页偏好失败', error)
  }
  await Promise.all([
    hydrateAccountsViewState(payload),
    hydrateAccountsActionHistory(payload),
  ])
}

function resolveActionHistoryStatus(successCount: number, failedCount: number, skippedCount: number): ActionHistoryStatus {
  if (successCount > 0 && failedCount === 0)
    return 'success'
  if (successCount > 0 || skippedCount > 0)
    return 'warning'
  return 'error'
}

function pushActionHistory(params: {
  actionLabel: string
  totalCount: number
  successCount: number
  failedNames?: string[]
  skippedCount?: number
  affectedNames?: string[]
  targetLabel?: string
}) {
  const failedNames = (params.failedNames || []).filter(Boolean)
  const entry: ActionHistoryItem = {
    id: `${params.actionLabel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actionLabel: params.actionLabel,
    status: resolveActionHistoryStatus(params.successCount, failedNames.length, params.skippedCount || 0),
    timestamp: Date.now(),
    totalCount: params.totalCount,
    successCount: params.successCount,
    failedCount: failedNames.length,
    skippedCount: params.skippedCount || 0,
    affectedNames: (params.affectedNames || []).filter(Boolean).slice(0, 6),
    failedNames: failedNames.slice(0, 6),
    targetLabel: params.targetLabel,
  }

  actionHistory.value = [entry, ...actionHistory.value].slice(0, ACTION_HISTORY_LIMIT)
  persistActionHistory()
}

function clearActionHistory() {
  actionHistory.value = []
  persistActionHistory()
  toast.success('最近操作记录已清空')
}

function applyQueryState() {
  const query = route.query
  if (Object.prototype.hasOwnProperty.call(query, 'q'))
    searchKeyword.value = getQueryValue(query.q)
  if (Object.prototype.hasOwnProperty.call(query, 'owner'))
    ownershipFilter.value = normalizeOwnershipFilter(getQueryValue(query.owner))
  if (Object.prototype.hasOwnProperty.call(query, 'platform'))
    platformFilter.value = normalizePlatformFilter(getQueryValue(query.platform))
  if (Object.prototype.hasOwnProperty.call(query, 'state'))
    stateFilter.value = normalizeStateFilter(getQueryValue(query.state))
  if (Object.prototype.hasOwnProperty.call(query, 'sort'))
    sortMode.value = normalizeSortMode(getQueryValue(query.sort))
  if (Object.prototype.hasOwnProperty.call(query, 'view'))
    viewMode.value = normalizeViewMode(getQueryValue(query.view))
  if (Object.prototype.hasOwnProperty.call(query, 'tableSort'))
    tableSortKey.value = normalizeTableSortKey(getQueryValue(query.tableSort))
  if (Object.prototype.hasOwnProperty.call(query, 'tableDirection'))
    tableSortDirection.value = normalizeSortDirection(getQueryValue(query.tableDirection))
}

function buildShareQuery() {
  const query: Record<string, string> = {}
  const keyword = searchKeyword.value.trim()

  if (keyword)
    query.q = keyword
  if (ownershipFilter.value)
    query.owner = ownershipFilter.value
  if (platformFilter.value !== 'all')
    query.platform = platformFilter.value
  if (stateFilter.value !== 'all')
    query.state = stateFilter.value
  if (sortMode.value !== 'smart')
    query.sort = sortMode.value
  if (viewMode.value !== 'standard')
    query.view = viewMode.value
  if (tableSortKey.value !== 'activity')
    query.tableSort = tableSortKey.value
  if (tableSortDirection.value !== 'desc')
    query.tableDirection = tableSortDirection.value

  return query
}

function getFailedNamesLabel(names: string[]) {
  const visibleNames = names.slice(0, 3)
  if (visibleNames.length === 0)
    return ''
  return `${visibleNames.join('、')}${names.length > visibleNames.length ? ' 等' : ''}`
}

function buildActionResultMessage(actionLabel: string, successCount: number, failedNames: string[] = [], skippedCount = 0) {
  const parts = []

  if (successCount > 0)
    parts.push(`成功 ${successCount} 个账号`)
  if (failedNames.length > 0)
    parts.push(`失败 ${failedNames.length} 个账号${getFailedNamesLabel(failedNames) ? `（${getFailedNamesLabel(failedNames)}）` : ''}`)
  if (skippedCount > 0)
    parts.push(`跳过 ${skippedCount} 个无需处理`)

  return parts.length > 0 ? `${actionLabel}完成，${parts.join('，')}` : `${actionLabel}完成`
}

function notifyBatchActionResult(actionLabel: string, successCount: number, failedNames: string[] = [], skippedCount = 0) {
  const message = buildActionResultMessage(actionLabel, successCount, failedNames, skippedCount)

  if (successCount > 0 && failedNames.length === 0)
    toast.success(message)
  else if (successCount > 0 || skippedCount > 0)
    toast.warning(message)
  else
    toast.error(message || `${actionLabel}失败，请稍后重试`)
}

function buildHistorySummaryText(item: ActionHistoryItem) {
  const lines = [
    `${item.actionLabel} · ${formatDateTime(item.timestamp)}`,
    buildActionResultMessage(item.actionLabel, item.successCount, item.failedNames, item.skippedCount),
  ]

  if (item.targetLabel)
    lines.push(`附加信息：${item.targetLabel}`)
  if (item.affectedNames.length > 0)
    lines.push(`涉及账号：${item.affectedNames.join('、')}${item.totalCount > item.affectedNames.length ? ' 等' : ''}`)

  return lines.join('\n')
}

type CopyTextOptions = CopyInteractionOptions

async function copyLatestActionSummary() {
  const latestHistory = actionHistory.value[0]
  if (!latestHistory) {
    toast.warning('暂无最近操作记录可复制')
    return
  }
  await copyText(buildHistorySummaryText(latestHistory), '最近操作摘要已复制', {
    controlKey: 'latest-summary',
    detail: `${latestHistory.actionLabel} · ${formatDateTime(latestHistory.timestamp)}`,
    historyId: latestHistory.id,
  })
}

async function copyText(text: string, successMessage: string, options: CopyTextOptions = {}) {
  await copyWithFeedback(text, successMessage, options)
}

async function copyCurrentFilterLink() {
  const resolved = router.resolve({
    path: route.path,
    query: buildShareQuery(),
  })
  const absoluteUrl = `${window.location.origin}${resolved.fullPath}`
  await copyText(absoluteUrl, '当前筛选链接已复制', {
    controlKey: 'filter-link',
    detail: '当前筛选条件链接已写入剪贴板，可直接发送给其他设备打开。',
  })
}

async function copyHistorySummaryItem(item: ActionHistoryItem) {
  await copyText(buildHistorySummaryText(item), '操作摘要已复制', {
    detail: `${item.actionLabel} · ${formatDateTime(item.timestamp)}`,
    historyId: item.id,
  })
}

function getHistoryCopyLabel(item: ActionHistoryItem) {
  if (copiedHistoryId.value === item.id)
    return '已复制到剪贴板'
  return item.targetLabel || '点击复制本次摘要'
}

const isAdmin = computed(() => currentUser.value?.role === 'admin')
const currentUsername = computed(() => String(currentUser.value?.username || '').trim())
const isCompactView = computed(() => viewMode.value === 'compact')
const isTableView = computed(() => viewMode.value === 'table')
const cardGridClass = computed(() =>
  isCompactView.value
    ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
    : 'grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3',
)
const roleMap = computed(() => {
  const map = new Map<string, string>()
  for (const user of users.value) {
    map.set(String(user.username || '').trim(), String(user.role || 'user').trim())
  }
  if (currentUsername.value && !map.has(currentUsername.value)) {
    map.set(currentUsername.value, String(currentUser.value?.role || 'user').trim())
  }
  return map
})
const ownershipTransferOptions = computed(() => {
  const options = [
    { label: '设为未归属 / 系统账号', value: UNOWNED_TRANSFER_VALUE, description: '解除绑定，转为公共账号' },
  ]
  for (const user of users.value) {
    const username = String(user.username || '').trim()
    if (!username)
      continue
    options.push({
      label: `${username}${user.role === 'admin' ? ' (管理员)' : ''}`,
      value: username,
      description: user.role === 'admin' ? '转移给管理员账号' : '转移给普通用户账号',
    })
  }
  return options
})
const visibleTableColumns = computed(() => tableColumnVisibility.value)
const latestActionHistory = computed(() => actionHistory.value[0] || null)
const recentActionHistory = computed(() => actionHistory.value.slice(1, 5))
const actionHistoryCount = computed(() => actionHistory.value.length)

function getActionHistoryStatusMeta(status: ActionHistoryStatus) {
  if (status === 'success') {
    return {
      label: '执行成功',
      badge: 'accounts-badge-history-success',
      accent: 'accounts-history-card accounts-history-card-success',
      icon: 'i-carbon-checkmark-filled',
    }
  }
  if (status === 'error') {
    return {
      label: '执行失败',
      badge: 'accounts-badge-history-error',
      accent: 'accounts-history-card accounts-history-card-error',
      icon: 'i-carbon-warning-filled',
    }
  }
  return {
    label: '部分完成',
    badge: 'accounts-badge-history-partial',
    accent: 'accounts-history-card accounts-history-card-partial',
    icon: 'i-carbon-warning-alt-filled',
  }
}

function getActionHistoryMetricClass(kind: 'total' | 'success' | 'error' | 'skipped') {
  if (kind === 'success')
    return 'accounts-history-metric accounts-history-metric-success'
  if (kind === 'error')
    return 'accounts-history-metric accounts-history-metric-error'
  if (kind === 'skipped')
    return 'accounts-history-metric accounts-history-metric-skipped'
  return 'accounts-history-metric accounts-history-metric-total'
}

function resolvePlatformLabel(platform?: string) {
  const raw = String(platform || '').trim().toLowerCase()
  if (raw === 'qq')
    return 'QQ'
  if (raw === 'wx_ipad')
    return 'iPad微信'
  if (raw === 'wx_car')
    return '车机微信'
  if (raw.startsWith('wx'))
    return '微信'
  return '未知平台'
}

function resolveZoneLabel(acc: any) {
  const zone = String(acc?.accountZone || '').trim().toLowerCase()
  if (zone === 'qq_zone')
    return 'QQ区'
  if (zone === 'wechat_zone')
    return '微信区'
  const platformLabel = resolvePlatformLabel(acc?.platform)
  if (platformLabel.includes('QQ'))
    return 'QQ区'
  if (platformLabel.includes('微信'))
    return '微信区'
  return '未识别区服'
}

function resolvePlatformFamily(platform?: string): PlatformFilter {
  const raw = String(platform || '').trim().toLowerCase()
  if (raw === 'qq')
    return 'qq'
  if (raw.startsWith('wx'))
    return 'wechat'
  return 'all'
}

function resolveOwnerMeta(acc: any) {
  const owner = String(acc?.username || '').trim()
  if (!owner) {
    return {
      section: 'unowned' as OwnershipSection,
      label: '未归属 / 系统账号',
      badge: 'accounts-badge-owner-unowned',
      cardGlow: 'accounts-card-glow-unowned',
      shortLabel: '未归属',
      ownerText: '系统公共账号',
    }
  }
  if (owner === currentUsername.value) {
    return {
      section: 'mine' as OwnershipSection,
      label: '我自己登录的账号',
      badge: 'accounts-badge-owner-mine',
      cardGlow: 'accounts-card-glow-mine',
      shortLabel: '我自己',
      ownerText: owner,
    }
  }
  if (roleMap.value.get(owner) === 'admin') {
    return {
      section: 'other_admin' as OwnershipSection,
      label: `其他管理员账号: ${owner}`,
      badge: 'accounts-badge-owner-admin',
      cardGlow: 'accounts-card-glow-admin',
      shortLabel: '其他管理员',
      ownerText: owner,
    }
  }
  return {
    section: 'other_user' as OwnershipSection,
    label: `普通用户账号: ${owner}`,
    badge: 'accounts-badge-owner-user',
    cardGlow: 'accounts-card-glow-user',
    shortLabel: '普通用户',
    ownerText: owner,
  }
}

function resolveRuntimeState(acc: any) {
  if (acc?.connected) {
    return {
      section: 'online' as const,
      label: '运行中',
      dot: 'accounts-runtime-dot-online',
      badge: 'accounts-badge-runtime-online',
    }
  }
  if (acc?.running) {
    return {
      section: 'starting' as const,
      label: '启动中',
      dot: 'accounts-runtime-dot-starting',
      badge: 'accounts-badge-runtime-starting',
    }
  }
  return {
    section: 'offline' as const,
    label: '已停止',
    dot: 'accounts-runtime-dot-offline',
    badge: 'accounts-badge-runtime-offline',
  }
}

function getRuntimeRank(acc: any) {
  const section = resolveRuntimeState(acc).section
  if (section === 'online')
    return 3
  if (section === 'starting')
    return 2
  return 1
}

function resolveModeMeta(mode?: string) {
  if (mode === 'alt') {
    return {
      label: '小号',
      badge: 'accounts-badge-mode-alt',
    }
  }
  if (mode === 'safe') {
    return {
      label: '避险',
      badge: 'accounts-badge-mode-safe',
    }
  }
  return {
    label: '主号',
    badge: 'accounts-badge-mode-main',
  }
}

function resolveAccountMode(acc: any) {
  return String(acc?.accountMode || (acc as any)?.account_mode || 'main')
}

function resolveEffectiveMode(acc: any) {
  const raw = String(acc?.effectiveMode || '').trim()
  if (raw === 'alt' || raw === 'safe')
    return raw
  return 'main'
}

function resolveDegradeReasonLabel(reason?: string) {
  const raw = String(reason || '').trim()
  if (raw === 'missing_mode_peer')
    return '未找到可协同的对端账号'
  if (raw === 'cross_zone_peer_only')
    return '仅存在跨区账号，未命中同区约束'
  if (raw === 'friend_relation_unknown')
    return '好友关系尚未完成预热'
  if (raw === 'not_game_friend')
    return '同 owner 对端账号不是游戏好友'
  return ''
}

function resolveModeExecutionMeta(acc: any) {
  const configuredMode = resolveAccountMode(acc)
  const effectiveMode = resolveEffectiveMode(acc)
  const backendLabel = String(acc?.degradeReasonLabel || '').trim()
  const degradeLabel = backendLabel || resolveDegradeReasonLabel(acc?.degradeReason)

  if (effectiveMode !== configuredMode) {
    return {
      label: `生效:${resolveModeMeta(effectiveMode).label}`,
      badge: resolveModeMeta(effectiveMode).badge,
      note: degradeLabel || '当前已按更保守模式执行',
      noteClass: 'accounts-mode-note-warning',
    }
  }

  if (acc?.collaborationEnabled) {
    return {
      label: '协同命中',
      badge: 'accounts-badge-execution-hit',
      note: '同区/游戏好友约束已命中',
      noteClass: 'accounts-mode-note-info',
    }
  }

  if (degradeLabel) {
    return {
      label: '独立执行',
      badge: 'accounts-badge-execution-independent',
      note: degradeLabel,
      noteClass: 'accounts-mode-note-muted',
    }
  }

  return null
}

function getModeButtonClasses(acc: any, mode: AccountMode) {
  const current = resolveAccountMode(acc)
  if (current !== mode)
    return 'accounts-mode-toggle accounts-mode-toggle-idle'
  return `accounts-mode-toggle accounts-mode-toggle-active accounts-mode-toggle-${mode}`
}

function getModeToggleOptions(acc: any) {
  return createToggleOptions(accountModeOptions.map(({ mode, label, title }) => createToggleOption({
    key: mode,
    label,
    shortLabel: label,
    active: resolveAccountMode(acc) === mode,
    class: getModeButtonClasses(acc, mode),
    title,
    onClick: (event) => {
      event.stopPropagation()
      void handleModeChange(acc, mode)
    },
  })))
}

function getAccountOperationSets(acc: any) {
  const isSafeMode = resolveAccountMode(acc) === 'safe'

  return {
    hero: createActionButtons([
      createActionButton({
        key: 'runtime',
        label: acc.running ? '停止' : '启动',
        iconClass: acc.running ? 'i-carbon-stop-filled' : 'i-carbon-play-filled',
        variant: 'secondary',
        size: 'sm',
        block: true,
        stopPropagation: true,
        class: `accounts-runtime-button col-span-2 rounded-xl transition-all duration-500 ease-in-out active:scale-95 ${getRuntimeActionButtonClasses(acc)}`,
        onClick: () => toggleAccount(acc),
      }),
      createActionButton({
        key: 'settings',
        label: '设置',
        variant: 'outline',
        size: 'sm',
        block: true,
        stopPropagation: true,
        class: 'rounded-xl',
        onClick: () => openSettings(acc),
      }),
      createActionButton({
        key: 'edit',
        label: '编辑',
        variant: 'outline',
        size: 'sm',
        block: true,
        stopPropagation: true,
        class: 'rounded-xl',
        onClick: () => openEditModal(acc),
      }),
      createActionButton({
        key: 'delete',
        label: '删除',
        variant: 'danger',
        size: 'sm',
        block: true,
        stopPropagation: true,
        class: `rounded-xl ${isSafeMode ? '' : 'col-span-2'}`.trim(),
        onClick: () => handleDelete(acc),
      }),
      createActionButton({
        key: 'safe-check',
        label: '防封扫描',
        iconClass: 'i-carbon-security',
        variant: 'ghost',
        size: 'sm',
        block: true,
        stopPropagation: true,
        loading: safeCheckingId.value === acc.id,
        title: '一键分析封禁日志并加入黑名单',
        class: 'accounts-safe-check rounded-xl !px-3 !py-1.5 !text-xs',
        show: isSafeMode,
        onClick: () => handleSafeCheck(acc),
      }),
    ]),
    mobile: createActionButtons([
      createActionButton({
        key: 'runtime',
        label: acc.running ? '停止' : '启动',
        iconClass: acc.running ? 'i-carbon-stop-filled' : 'i-carbon-play-filled',
        variant: 'secondary',
        size: 'sm',
        stopPropagation: true,
        class: `accounts-runtime-button rounded-full transition-all duration-500 ease-in-out active:scale-95 ${getRuntimeActionButtonClasses(acc)}`,
        onClick: () => toggleAccount(acc),
      }),
      createActionButton({
        key: 'settings',
        label: '设置',
        variant: 'outline',
        size: 'sm',
        stopPropagation: true,
        onClick: () => openSettings(acc),
      }),
      createActionButton({
        key: 'edit',
        label: '编辑',
        variant: 'outline',
        size: 'sm',
        stopPropagation: true,
        onClick: () => openEditModal(acc),
      }),
      createActionButton({
        key: 'delete',
        label: '删除',
        variant: 'danger',
        size: 'sm',
        stopPropagation: true,
        onClick: () => handleDelete(acc),
      }),
    ]),
    tablePrimary: createActionButtons([
      createActionButton({
        key: 'runtime',
        label: acc.running ? '停止' : '启动',
        iconClass: acc.running ? 'i-carbon-stop-filled' : 'i-carbon-play-filled',
        variant: 'secondary',
        size: 'sm',
        stopPropagation: true,
        class: `accounts-runtime-button min-w-[84px] rounded-full transition-all duration-500 ease-in-out active:scale-95 ${getRuntimeActionButtonClasses(acc)}`,
        onClick: () => toggleAccount(acc),
      }),
      createActionButton({
        key: 'safe-check',
        label: '防封扫描',
        iconClass: 'i-carbon-security',
        variant: 'ghost',
        size: 'sm',
        stopPropagation: true,
        loading: safeCheckingId.value === acc.id,
        title: '一键分析封禁日志并加入黑名单',
        class: 'accounts-safe-check rounded-full !px-3 !py-1.5 !text-xs',
        show: isSafeMode,
        onClick: () => handleSafeCheck(acc),
      }),
    ]),
    tableIcon: createIconActions([
      createIconAction({
        key: 'settings',
        iconClass: 'i-carbon-settings text-lg',
        title: '设置',
        class: '!p-2.5',
        onClick: (event) => {
          event.stopPropagation()
          openSettings(acc)
        },
      }),
      createIconAction({
        key: 'edit',
        iconClass: 'i-carbon-edit text-lg',
        title: '编辑',
        class: '!p-2.5',
        onClick: (event) => {
          event.stopPropagation()
          openEditModal(acc)
        },
      }),
      createIconAction({
        key: 'delete',
        iconClass: 'i-carbon-trash-can text-lg',
        title: '删除',
        danger: true,
        class: 'accounts-icon-danger !p-2.5',
        onClick: (event) => {
          event.stopPropagation()
          handleDelete(acc)
        },
      }),
    ]),
  }
}

function getAccountRecordHero(acc: any) {
  const ownerMeta = resolveOwnerMeta(acc)
  const runtimeMeta = resolveRuntimeState(acc)

  return createRecordHero({
    key: String(acc.id || ''),
    title: getAccountDisplayName(acc),
    subline: getAccountSubline(acc),
    nickname: acc.nick || '暂无昵称',
    platformLabel: resolvePlatformLabel(acc.platform),
    zoneLabel: resolveZoneLabel(acc),
    avatarUrl: getAvatarUrl(acc) || '',
    hint: isCurrentAccount(acc) ? '当前账号已选中，可直接进入设置继续调整。' : '点击卡片任意空白处可切换为当前账号。',
    badges: createRecordDisplayBadges([
      createRecordDisplayBadge({
        text: ownerMeta.shortLabel,
        class: ownerMeta.badge,
      }),
      createRecordDisplayBadge({
        text: runtimeMeta.label,
        class: runtimeMeta.badge,
      }),
    ]),
    actions: getAccountOperationSets(acc).hero,
  })
}

function getAccountDisplayFields(acc: any) {
  const ownerMeta = resolveOwnerMeta(acc)
  const runtimeMeta = resolveRuntimeState(acc)
  const configuredMode = resolveModeMeta(resolveAccountMode(acc))
  const executionMeta = resolveModeExecutionMeta(acc)

  return {
    owner: createRecordDisplayField({
      key: 'owner',
      label: '归属',
      value: ownerMeta.ownerText,
      badges: createRecordDisplayBadges([
        createRecordDisplayBadge({
          text: ownerMeta.shortLabel,
          class: ownerMeta.badge,
        }),
      ]),
    }),
    platform: createRecordDisplayField({
      key: 'platform',
      label: '平台 / 区服',
      value: resolvePlatformLabel(acc.platform),
      secondaryValue: resolveZoneLabel(acc),
    }),
    activity: createRecordDisplayField({
      key: 'activity',
      label: '最近登录',
      value: getLastLoginLabel(acc),
      secondaryValue: `首次录入 ${formatDateTime(acc.createdAt)}`,
    }),
    state: createRecordDisplayField({
      key: 'state',
      label: '当前状态',
      value: runtimeMeta.label,
      secondaryValue: getAccountStatusDetail(acc),
      noteClass: acc.wsError?.message ? 'accounts-error-banner px-3 py-2' : 'glass-text-muted',
      dotClass: runtimeMeta.dot,
      badges: createRecordDisplayBadges([
        createRecordDisplayBadge({
          text: runtimeMeta.label,
          class: runtimeMeta.badge,
        }),
      ]),
    }),
    mode: createRecordDisplayField({
      key: 'mode',
      label: '模式',
      value: configuredMode.label,
      note: executionMeta?.note || '',
      noteClass: executionMeta?.noteClass || '',
      badges: createRecordDisplayBadges([
        createRecordDisplayBadge({
          text: configuredMode.label,
          class: configuredMode.badge,
        }),
        createRecordDisplayBadge({
          text: executionMeta?.label || '',
          class: executionMeta?.badge || '',
          show: Boolean(executionMeta?.label),
        }),
      ]),
      toggleItems: getModeToggleOptions(acc),
    }),
  }
}

function getAccountMobileFields(acc: any) {
  const fields = getAccountDisplayFields(acc)
  return createRecordDisplayFields([
    fields.owner,
    fields.platform,
    fields.activity,
    fields.state,
  ])
}

function getAccountRecordFields(acc: any) {
  const fields = getAccountDisplayFields(acc)

  return createRecordMetricFields([
    createRecordMetricField({
      key: 'owner',
      label: '归属',
      iconClass: 'i-carbon-user-multiple text-sm',
      class: isCompactView.value ? 'accounts-record-field-owner' : 'accounts-record-field-owner xl:col-span-2',
      props: {
        field: fields.owner,
      },
    }),
    createRecordMetricField({
      key: 'activity',
      label: '最近登录',
      iconClass: 'i-carbon-time text-sm',
      class: isCompactView.value ? '' : 'xl:col-span-4',
      props: {
        field: fields.activity,
      },
    }),
    createRecordMetricField({
      key: 'runtime',
      label: '当前状态',
      iconClass: 'i-carbon-pulse text-sm',
      class: isCompactView.value ? '' : 'xl:col-span-3',
      props: {
        field: fields.state,
      },
    }),
    createRecordMetricField({
      key: 'mode',
      label: '模式设置',
      iconClass: 'i-carbon-model-alt text-sm',
      class: isCompactView.value ? 'sm:col-span-2' : 'xl:col-span-3',
      onClick: event => event.stopPropagation(),
      props: {
        field: fields.mode,
      },
    }),
  ])
}

function getOwnershipTabClasses(section: OwnershipSection, active: boolean) {
  if (!active)
    return `accounts-ownership-tab accounts-ownership-tab-idle accounts-ownership-tab-${section}`
  return `accounts-ownership-tab accounts-tab-active accounts-ownership-tab-active accounts-ownership-tab-${section}`
}

function getOwnershipTabCountClasses(active: boolean) {
  return active
    ? 'accounts-ownership-tab-count accounts-ownership-tab-count-active'
    : 'accounts-ownership-tab-count'
}

function getViewModeButtonClasses(active: boolean) {
  return active
    ? 'accounts-view-switch accounts-mode-active accounts-view-switch-active'
    : 'accounts-view-switch accounts-view-switch-idle'
}

function getSelectionBoxClasses(selected: boolean) {
  return selected
    ? 'accounts-selection-box accounts-selection-box-active'
    : 'accounts-selection-box accounts-selection-box-idle'
}

function getRuntimeActionButtonClasses(acc: any) {
  return acc.running
    ? 'accounts-runtime-button accounts-runtime-button-stop'
    : 'accounts-runtime-button accounts-runtime-button-start'
}

function getColumnVisibilityBadgeClass(visible: boolean) {
  return visible
    ? 'accounts-column-visibility accounts-column-visibility-on'
    : 'accounts-column-visibility accounts-column-visibility-off'
}

function getModeRank(acc: any) {
  const current = resolveAccountMode(acc)
  if (current === 'main')
    return 3
  if (current === 'safe')
    return 2
  return 1
}

function formatDateTime(ts?: number | string | null) {
  const time = Number(ts || 0)
  if (!Number.isFinite(time) || time <= 0)
    return '暂无记录'
  const date = new Date(time)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function formatActionTime(ts?: number | string | null) {
  const time = Number(ts || 0)
  if (!Number.isFinite(time) || time <= 0)
    return '暂无记录'

  const diff = Date.now() - time
  if (diff < 60 * 1000)
    return '刚刚'
  if (diff < 60 * 60 * 1000)
    return `${Math.max(1, Math.floor(diff / (60 * 1000)))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000)
    return `${Math.max(1, Math.floor(diff / (60 * 60 * 1000)))} 小时前`
  return formatDateTime(time)
}

function getActivityTime(acc: any) {
  const time = Number(acc?.lastLoginAt || acc?.updatedAt || 0)
  return Number.isFinite(time) ? time : 0
}

function getLastLoginLabel(acc: any) {
  return formatDateTime(getActivityTime(acc))
}

function getAccountDisplayName(acc: any) {
  return acc?.name || acc?.nick || acc?.id || '未命名账号'
}

function getAccountSubline(acc: any) {
  const zone = resolveZoneLabel(acc)
  const accountRef = acc?.uin || '未绑定'
  return `${zone}: ${accountRef}`
}

function getAccountRecordState(acc: any) {
  const selected = isSelected(acc?.id)
  const current = String(acc?.id || '') === String(accountStore.currentAccountId || '')

  return createRecordState({
    key: String(acc?.id || ''),
    selected,
    current,
    glowClass: resolveOwnerMeta(acc).cardGlow,
    selectionClass: getSelectionBoxClasses(selected),
    selectionIconClass: 'accounts-selection-icon',
    mobileCardClass: selected ? 'ui-mobile-record-card--selected' : '',
    tableRowClass: current ? 'accounts-table-row-current' : '',
  })
}

function isCurrentAccount(acc: any) {
  return getAccountRecordState(acc).current === true
}

function getAccountStatusDetail(acc: any) {
  if (acc?.wsError?.message)
    return `最近错误：${acc.wsError.message}`
  return isCurrentAccount(acc)
    ? '当前选中账号，可直接进入设置继续调整。'
    : '暂无异常记录，可继续执行日常管理。'
}

function compareText(a: any, b: any) {
  return String(a || '').localeCompare(String(b || ''), 'zh-CN')
}

function getOwnerSortValue(acc: any) {
  const ownerMeta = resolveOwnerMeta(acc)
  return `${ownerMeta.shortLabel}-${ownerMeta.ownerText}`
}

function getTableSortValue(acc: any, key: TableSortKey) {
  if (key === 'account')
    return getAccountDisplayName(acc)
  if (key === 'owner')
    return getOwnerSortValue(acc)
  if (key === 'platform')
    return `${resolvePlatformLabel(acc?.platform)}-${resolveZoneLabel(acc)}`
  if (key === 'activity')
    return getActivityTime(acc)
  if (key === 'mode')
    return getModeRank(acc)
  return getRuntimeRank(acc)
}

function toggleTableSort(key: TableSortKey) {
  if (tableSortKey.value === key) {
    tableSortDirection.value = tableSortDirection.value === 'asc' ? 'desc' : 'asc'
    persistTableSortState()
    return
  }
  tableSortKey.value = key
  tableSortDirection.value = key === 'account' || key === 'owner' || key === 'platform' ? 'asc' : 'desc'
  persistTableSortState()
}

function getTableSortLabel(key: TableSortKey) {
  const labels: Record<TableSortKey, string> = {
    account: '账号',
    owner: '归属',
    platform: '平台',
    activity: '最近登录',
    mode: '模式',
    state: '状态',
  }
  return `${labels[key]} ${tableSortDirection.value === 'asc' ? '升序' : '降序'}`
}

function escapeCsvCell(value: any) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  if (/[",]/.test(text))
    return `"${text.replace(/"/g, '""')}"`
  return text
}

function buildSearchText(acc: any) {
  const ownerMeta = resolveOwnerMeta(acc)
  return [
    getAccountDisplayName(acc),
    acc?.nick,
    acc?.uin,
    acc?.id,
    acc?.username,
    ownerMeta.label,
    ownerMeta.ownerText,
    resolvePlatformLabel(acc?.platform),
    resolveZoneLabel(acc),
    resolveRuntimeState(acc).label,
  ].join(' ').toLowerCase()
}

async function loadUsers() {
  if (!isAdmin.value) {
    users.value = []
    return
  }
  try {
    const res = await api.get('/api/users')
    users.value = Array.isArray(res.data?.users) ? res.data.users : []
  }
  catch {
    users.value = []
  }
}

async function initializePage() {
  refreshCurrentUser()
  await Promise.all([
    accountStore.fetchAccounts(),
    loadUsers(),
  ])
}

const ownershipSummary = computed(() => {
  return accounts.value.reduce((acc, item) => {
    const section = resolveOwnerMeta(item).section
    if (section === 'mine')
      acc.mine += 1
    else if (section === 'other_user')
      acc.otherUser += 1
    else if (section === 'other_admin')
      acc.otherAdmin += 1
    else
      acc.unowned += 1
    return acc
  }, { mine: 0, otherUser: 0, otherAdmin: 0, unowned: 0 })
})

const ownershipTabs = computed(() => [
  { section: 'mine' as OwnershipSection, label: '自己登录的账号', count: ownershipSummary.value.mine },
  { section: 'other_user' as OwnershipSection, label: '普通用户账号', count: ownershipSummary.value.otherUser },
  { section: 'other_admin' as OwnershipSection, label: '其他管理员账号', count: ownershipSummary.value.otherAdmin },
  { section: 'unowned' as OwnershipSection, label: '未归属账号', count: ownershipSummary.value.unowned },
])

const pageHeaderText = createPageHeaderText({
  key: 'accounts-page-header',
  title: '账号管理',
  description: '在一个页面里完成归属区分、搜索筛选、批量处理和账号状态查看。',
})

const ownershipTabOptions = computed(() => createToggleOptions(
  ownershipTabs.value.map(tab => createToggleOption({
    key: `ownership-${tab.section}`,
    label: tab.label,
    count: tab.count,
    active: ownershipFilter.value === tab.section,
    class: `inline-flex items-center gap-2 border rounded-full px-4 py-2 text-sm font-semibold backdrop-blur-sm transition-all duration-200 ${getOwnershipTabClasses(tab.section, ownershipFilter.value === tab.section)}`,
    countClass: getOwnershipTabCountClasses(ownershipFilter.value === tab.section),
    onClick: () => {
      toggleOwnershipFilter(tab.section)
    },
  })),
))

const currentOwnershipLabel = computed(() => {
  const active = ownershipTabs.value.find(item => item.section === ownershipFilter.value)
  return active ? active.label : '全部归属'
})

const currentViewLabel = computed(() =>
  viewOptions.find(item => item.value === viewMode.value)?.label || '标准卡片',
)

const pageHeaderNotice = createHeaderNotice({
  key: 'accounts-page-banner',
  text: ACCOUNT_VIEW_PREFERENCES_NOTE,
  class: 'accounts-info-banner',
})

const viewOptionItems = computed(() => createToggleOptions(
  viewOptions.map(option => createToggleOption({
    key: `view-${option.value}`,
    label: option.label,
    shortLabel: option.shortLabel,
    title: option.label,
    iconClass: `text-sm ${option.icon}`,
    active: viewMode.value === option.value,
    class: `inline-flex items-center gap-2 border rounded-full px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${getViewModeButtonClasses(viewMode.value === option.value)}`,
    onClick: () => {
      setViewMode(option.value)
    },
  })),
))

const currentTableSortLabel = computed(() => getTableSortLabel(tableSortKey.value))

const filteredAccounts = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const result = [...accounts.value].filter((acc) => {
    const ownerMeta = resolveOwnerMeta(acc)
    if (ownershipFilter.value && ownerMeta.section !== ownershipFilter.value)
      return false
    if (platformFilter.value !== 'all' && resolvePlatformFamily(acc?.platform) !== platformFilter.value)
      return false
    if (stateFilter.value !== 'all' && resolveRuntimeState(acc).section !== stateFilter.value)
      return false
    if (keyword && !buildSearchText(acc).includes(keyword))
      return false
    return true
  })

  result.sort((a, b) => {
    const timeA = getActivityTime(a)
    const timeB = getActivityTime(b)

    if (sortMode.value === 'recent') {
      if (timeA !== timeB)
        return timeB - timeA
      return String(getAccountDisplayName(a)).localeCompare(String(getAccountDisplayName(b)), 'zh-CN')
    }

    if (sortMode.value === 'name') {
      return String(getAccountDisplayName(a)).localeCompare(String(getAccountDisplayName(b)), 'zh-CN')
    }

    if (sortMode.value === 'platform') {
      const platformCompare = resolvePlatformLabel(a?.platform).localeCompare(resolvePlatformLabel(b?.platform), 'zh-CN')
      if (platformCompare !== 0)
        return platformCompare
      return String(getAccountDisplayName(a)).localeCompare(String(getAccountDisplayName(b)), 'zh-CN')
    }

    const stateDiff = getRuntimeRank(b) - getRuntimeRank(a)
    if (stateDiff !== 0)
      return stateDiff
    if (timeA !== timeB)
      return timeB - timeA
    return String(getAccountDisplayName(a)).localeCompare(String(getAccountDisplayName(b)), 'zh-CN')
  })

  return result
})

const pageHeaderSummary = computed(() => createHeaderSummary({
  key: 'accounts-page-summary',
  prefix: '当前显示',
  value: filteredAccounts.value.length,
  separator: '/',
  secondaryValue: accounts.value.length,
  suffix: '个账号',
  class: 'accounts-page-count',
  valueClass: 'accounts-page-count-value',
}))

const tableAccounts = computed(() => {
  const result = [...filteredAccounts.value]
  result.sort((a, b) => {
    const valueA = getTableSortValue(a, tableSortKey.value)
    const valueB = getTableSortValue(b, tableSortKey.value)

    let compareResult = 0
    if (typeof valueA === 'number' && typeof valueB === 'number')
      compareResult = valueA - valueB
    else
      compareResult = compareText(valueA, valueB)

    if (compareResult === 0)
      compareResult = compareText(getAccountDisplayName(a), getAccountDisplayName(b))

    return tableSortDirection.value === 'asc' ? compareResult : -compareResult
  })
  return result
})

const displayAccounts = computed(() => isTableView.value ? tableAccounts.value : filteredAccounts.value)
const selectedAccounts = computed(() => {
  const selectedSet = new Set(selectedAccountIds.value.map(id => String(id || '')))
  return displayAccounts.value.filter(acc => selectedSet.has(String(acc.id || '')))
})
const startableSelectedAccounts = computed(() => selectedAccounts.value.filter(acc => !acc?.running))
const stoppableSelectedAccounts = computed(() => selectedAccounts.value.filter(acc => !!acc?.running))
const restartableSelectedAccounts = computed(() => selectedAccounts.value.filter(acc => !!acc?.running || !!acc?.connected))
const batchDeleteStats = computed(() => {
  const targets = selectedAccounts.value
  return {
    total: targets.length,
    running: targets.filter(acc => !!acc?.running).length,
    connected: targets.filter(acc => !!acc?.connected).length,
    current: targets.filter(acc => String(acc.id || '') === String(accountStore.currentAccountId || '')).length,
    names: targets.slice(0, 5).map(acc => getAccountDisplayName(acc)),
  }
})
const batchDeleteMessage = computed(() => {
  const stats = batchDeleteStats.value
  if (stats.total === 0)
    return '请先选择要删除的账号。'
  const parts = [
    `将删除 ${stats.total} 个账号。`,
    stats.running > 0 ? `其中 ${stats.running} 个正在运行，删除前会自动停止。` : '',
    stats.connected > 0 ? `其中 ${stats.connected} 个当前已连接。` : '',
    stats.current > 0 ? '包含当前选中的账号，删除后会自动取消当前选择。' : '',
    stats.names.length > 0 ? `示例账号：${stats.names.join('、')}${stats.total > stats.names.length ? ' 等' : ''}` : '',
  ].filter(Boolean)
  return parts.join(' ')
})
const transferTargetLabel = computed(() => {
  const found = ownershipTransferOptions.value.find(item => item.value === transferOwnershipTarget.value)
  return found ? found.label : ''
})
const canBatchTransferOwnership = computed(() =>
  isAdmin.value && selectedAccounts.value.length > 0 && !!transferOwnershipTarget.value,
)
const canBatchDelete = computed(() => selectedAccounts.value.length > 0)

watch(() => filteredAccounts.value.map(acc => String(acc.id || '')), (ids) => {
  const visibleIds = new Set(ids)
  selectedAccountIds.value = selectedAccountIds.value.filter(id => visibleIds.has(id))
})

watch([tableSortKey, tableSortDirection], () => {
  persistTableSortState()
})

const hasActiveFilters = computed(() =>
  !!searchKeyword.value.trim()
  || !!ownershipFilter.value
  || platformFilter.value !== 'all'
  || stateFilter.value !== 'all'
  || sortMode.value !== 'smart',
)

const pageHeaderActions = computed(() => createActionButtons([
  createActionButton({
    key: 'refresh-accounts',
    label: '刷新账号',
    iconClass: loading.value ? '' : 'i-carbon-renew mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: 'accounts-ghost-pill',
    loading: loading.value,
    onClick: () => {
      initializePage()
    },
  }),
  createActionButton({
    key: 'add-account',
    label: '添加账号',
    iconClass: 'i-carbon-add mr-1 text-sm',
    variant: 'primary',
    size: 'sm',
    class: 'accounts-brand-pill',
    onClick: () => {
      openAddModal()
    },
  }),
]))

const filterToolbarActions = computed(() => createActionButtons([
  createActionButton({
    key: 'copy-filter-link',
    label: '复制当前筛选链接',
    active: copiedControlKey.value === 'filter-link',
    activeLabel: '链接已复制',
    iconClass: 'i-carbon-link mr-1 text-sm',
    activeIconClass: 'i-carbon-checkmark-filled mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: `${copiedControlKey.value === 'filter-link' ? 'accounts-copy-button-active ' : ''}accounts-ghost-pill !px-3`.trim(),
    onClick: () => {
      copyCurrentFilterLink()
    },
  }),
  createActionButton({
    key: 'clear-filters',
    label: '清空筛选',
    iconClass: 'i-carbon-clean mr-1',
    variant: 'ghost',
    size: 'sm',
    class: '!px-3',
    show: hasActiveFilters.value,
    onClick: () => {
      clearFilters()
    },
  }),
]))

const filterToolbarChips = computed(() => createChips([
  createChip({
    key: 'ownership',
    text: `归属：${currentOwnershipLabel.value}`,
  }),
  createChip({
    key: 'platform',
    text: `平台：${platformOptions.find(item => item.value === platformFilter.value)?.label || '全部平台'}`,
  }),
  createChip({
    key: 'state',
    text: `状态：${stateOptions.find(item => item.value === stateFilter.value)?.label || '全部状态'}`,
  }),
  createChip({
    key: 'view',
    text: `视图：${currentViewLabel.value}`,
  }),
]))

const selectionPrimaryActions = computed(() => createActionButtons([
  createActionButton({
    key: 'select-all',
    label: '全选',
    iconClass: 'i-carbon-checkmark-outline mr-1.5 text-sm',
    size: 'sm',
    class: 'accounts-batch-button accounts-batch-button-brand !px-4 !py-1.5',
    disabled: filteredAccounts.value.length === 0,
    onClick: () => {
      selectAll()
    },
  }),
  createActionButton({
    key: 'invert-selection',
    label: '反选',
    size: 'sm',
    class: 'accounts-batch-button accounts-batch-button-neutral !px-4 !py-1.5',
    disabled: filteredAccounts.value.length === 0,
    onClick: () => {
      invertSelection()
    },
  }),
  createActionButton({
    key: 'clear-selection',
    label: '清空',
    iconClass: 'i-carbon-close-outline mr-1.5 text-sm',
    size: 'sm',
    class: 'accounts-batch-button accounts-batch-button-danger !px-4 !py-1.5',
    disabled: selectedAccountIds.value.length === 0,
    onClick: () => {
      clearSelection()
    },
  }),
]))

const selectionSecondaryActions = computed(() => createActionButtons([
  createActionButton({
    key: 'transfer-ownership',
    label: '转移归属',
    iconClass: transferLoading.value ? '' : 'i-carbon-user-admin mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: transferLoading.value,
    show: isAdmin.value,
    disabled: !canBatchTransferOwnership.value || transferLoading.value,
    class: `accounts-batch-button accounts-batch-button-admin text-xs transition-opacity ${!canBatchTransferOwnership.value ? 'opacity-50' : 'opacity-100'}`,
    title: transferTargetLabel.value ? `转移到 ${transferTargetLabel.value}` : '请先选择目标归属账号',
    onClick: () => {
      batchTransferOwnership()
    },
  }),
  createActionButton({
    key: 'set-main',
    label: '批量设为主号',
    iconClass: batchActionType.value === 'mode:main' ? '' : 'i-carbon-star-filled mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'mode:main',
    disabled: selectedAccountIds.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-main text-xs transition-opacity ${selectedAccountIds.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      bulkSetMode('main')
    },
  }),
  createActionButton({
    key: 'batch-start',
    label: '批量启动',
    iconClass: batchActionType.value === 'start' ? '' : 'i-carbon-play-filled mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'start',
    disabled: startableSelectedAccounts.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-start text-xs transition-opacity ${startableSelectedAccounts.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      batchToggleAccounts('start')
    },
  }),
  createActionButton({
    key: 'batch-stop',
    label: '批量停止',
    iconClass: batchActionType.value === 'stop' ? '' : 'i-carbon-stop-filled mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'stop',
    disabled: stoppableSelectedAccounts.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-stop text-xs transition-opacity ${stoppableSelectedAccounts.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      batchToggleAccounts('stop')
    },
  }),
  createActionButton({
    key: 'batch-restart',
    label: '批量重启',
    iconClass: batchActionType.value === 'restart' ? '' : 'i-carbon-renew mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'restart',
    disabled: restartableSelectedAccounts.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-restart text-xs transition-opacity ${restartableSelectedAccounts.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      batchRestartAccounts()
    },
  }),
  createActionButton({
    key: 'set-alt',
    label: '批量设为小号',
    iconClass: batchActionType.value === 'mode:alt' ? '' : 'i-carbon-copy mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'mode:alt',
    disabled: selectedAccountIds.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-alt text-xs transition-opacity ${selectedAccountIds.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      bulkSetMode('alt')
    },
  }),
  createActionButton({
    key: 'set-safe',
    label: '批量设为风险规避',
    iconClass: batchActionType.value === 'mode:safe' ? '' : 'i-carbon-security mr-1 text-sm',
    variant: 'secondary',
    size: 'sm',
    loading: batchActionType.value === 'mode:safe',
    disabled: selectedAccountIds.value.length === 0 || batchLoading.value,
    class: `accounts-batch-button accounts-batch-button-safe text-xs transition-opacity ${selectedAccountIds.value.length === 0 ? 'opacity-50' : 'opacity-100'}`,
    onClick: () => {
      bulkSetMode('safe')
    },
  }),
  createActionButton({
    key: 'export-all',
    label: '导出当前结果',
    iconClass: exportLoading.value && exportScope.value === 'all' ? '' : 'i-carbon-document-export mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: 'accounts-ghost-pill',
    disabled: displayAccounts.value.length === 0,
    loading: exportLoading.value && exportScope.value === 'all',
    onClick: () => {
      exportAccounts('all')
    },
  }),
  createActionButton({
    key: 'export-selected',
    label: '导出已选',
    iconClass: exportLoading.value && exportScope.value === 'selected' ? '' : 'i-carbon-export mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: 'accounts-ghost-pill',
    disabled: selectedAccounts.value.length === 0 || exportLoading.value,
    loading: exportLoading.value && exportScope.value === 'selected',
    onClick: () => {
      exportAccounts('selected')
    },
  }),
  createActionButton({
    key: 'batch-delete',
    label: '批量删除',
    iconClass: 'i-carbon-trash-can mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: 'accounts-danger-pill',
    disabled: !canBatchDelete.value || batchDeleteLoading.value,
    onClick: () => {
      openBatchDeleteConfirm()
    },
  }),
]))

const historyHeaderActions = computed(() => createActionButtons([
  createActionButton({
    key: 'copy-latest-summary',
    label: '复制最近摘要',
    active: copiedControlKey.value === 'latest-summary',
    activeLabel: '最近摘要已复制',
    iconClass: 'i-carbon-copy-file mr-1 text-sm',
    activeIconClass: 'i-carbon-checkmark-filled mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: `${copiedControlKey.value === 'latest-summary' ? 'accounts-copy-button-active ' : ''}accounts-ghost-pill`.trim(),
    disabled: !latestActionHistory.value,
    onClick: () => {
      copyLatestActionSummary()
    },
  }),
  createActionButton({
    key: 'clear-history',
    label: '清空记录',
    iconClass: 'i-carbon-clean mr-1 text-sm',
    variant: 'ghost',
    size: 'sm',
    class: 'accounts-danger-pill',
    disabled: actionHistoryCount.value === 0,
    onClick: () => {
      clearActionHistory()
    },
  }),
]))

const historySummaryChips = computed(() => createChips([
  createChip({
    key: 'history-count',
    text: `最近保留 ${actionHistoryCount.value} 条`,
  }),
]))

const latestHistoryMetaChips = computed(() => {
  if (!latestActionHistory.value)
    return createChips([])

  return createChips([
    createChip({
      key: 'history-relative-time',
      text: formatActionTime(latestActionHistory.value.timestamp),
    }),
    createChip({
      key: 'history-absolute-time',
      text: formatDateTime(latestActionHistory.value.timestamp),
    }),
  ])
})

const historyPanel = computed(() => {
  const latest = latestActionHistory.value
  const latestStatus = latest ? getActionHistoryStatusMeta(latest.status) : null

  return createHistoryPanel({
    key: 'accounts-history-panel',
    title: '最近操作结果',
    description: '最近操作会跟随当前登录用户同步到服务器，可直接回看目标、结果和最近几次执行记录。',
    emptyText: '最近操作历史会记录在这里。执行批量启动、重启、导出、转移归属或批量删除后，可以直接回看结果摘要。',
    titleChips: historySummaryChips.value,
    titleMeta: latestStatus
      ? createHistoryMetaItems([
          createHistoryMetaItem({
            key: 'latest-history-status',
            text: latestStatus.label,
            iconClass: latestStatus.icon,
            class: `ui-badge ${latestStatus.badge} gap-1.5 font-semibold`,
          }),
        ])
      : createHistoryMetaItems([]),
  })
})

const latestHistoryHighlight = computed(() => {
  const latest = latestActionHistory.value
  if (!latest)
    return null

  return createHistoryHighlight({
    key: `accounts-history-highlight-${latest.id}`,
    title: latest.actionLabel,
    description: buildActionResultMessage(latest.actionLabel, latest.successCount, latest.failedNames, latest.skippedCount),
    note: ACTION_HISTORY_SYNC_NOTE,
    metaChips: latestHistoryMetaChips.value,
  })
})

const latestHistoryMetrics = computed(() => {
  const latest = latestActionHistory.value
  if (!latest)
    return []

  return createHistoryMetrics([
    createHistoryMetric({
      key: 'total',
      label: '涉及账号',
      value: latest.totalCount,
      description: latest.affectedNames.join('、') || '暂无名称预览',
      class: 'accounts-history-stat',
      labelClass: 'accounts-meta-label',
      valueClass: 'mt-3 text-2xl font-semibold',
      descriptionClass: 'glass-text-muted mt-2 text-xs',
    }),
    createHistoryMetric({
      key: 'result',
      label: '执行结果',
      metrics: [
        { text: `成功 ${latest.successCount}`, class: getActionHistoryMetricClass('success') },
        { text: `失败 ${latest.failedCount}`, class: getActionHistoryMetricClass('error') },
        { text: `跳过 ${latest.skippedCount}`, class: getActionHistoryMetricClass('skipped') },
      ],
      description: latest.failedNames.length > 0 ? `失败账号：${latest.failedNames.join('、')}` : '最近一次执行没有失败账号。',
      class: 'accounts-history-stat',
      labelClass: 'accounts-meta-label',
      metricsClass: 'mt-3 flex flex-wrap gap-2 text-xs',
      descriptionClass: 'glass-text-muted mt-2 text-xs leading-5',
    }),
    createHistoryMetric({
      key: 'target',
      label: '附加信息',
      value: latest.targetLabel || '无附加说明',
      description: '可用于回看最近一次批量处理的目标、范围和结果摘要。',
      class: 'accounts-history-stat',
      labelClass: 'accounts-meta-label',
      valueClass: 'mt-3 text-sm font-semibold leading-6',
      descriptionClass: 'glass-text-muted mt-2 text-xs leading-5',
    }),
  ])
})

const recentHistoryCards = computed(() => createHistoryRecentItems(
  recentActionHistory.value.map(item => createHistoryRecentItem({
    key: item.id,
    title: item.actionLabel,
    subtitle: formatActionTime(item.timestamp),
    description: buildActionResultMessage(item.actionLabel, item.successCount, item.failedNames, item.skippedCount),
    metrics: [
      { text: `总计 ${item.totalCount}`, class: getActionHistoryMetricClass('total') },
      { text: `成功 ${item.successCount}`, class: getActionHistoryMetricClass('success') },
      { text: `失败 ${item.failedCount}`, class: getActionHistoryMetricClass('error') },
    ],
    copied: copiedHistoryId.value === item.id,
    iconClass: getActionHistoryStatusMeta(item.status).icon,
    copiedIconClass: 'i-carbon-checkmark-filled accounts-history-card-copy-icon scale-110',
    class: `accounts-history-card-button min-h-[166px] flex flex-col border rounded-2xl px-4 py-3 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 ${getActionHistoryStatusMeta(item.status).accent}`,
    titleClass: 'line-clamp-1 text-sm font-semibold',
    subtitleClass: 'mt-1 text-xs opacity-80',
    descriptionClass: 'line-clamp-3 mt-3 text-xs leading-5 opacity-90',
    metricsClass: 'mt-3 flex flex-wrap gap-2 text-[11px]',
    footerText: getHistoryCopyLabel(item),
    footerClass: 'mt-auto pt-3 text-[11px] opacity-75',
    footerActiveClass: 'accounts-history-card-copy-text',
    onClick: () => {
      copyHistorySummaryItem(item)
    },
  })),
))

function clearFilters() {
  searchKeyword.value = ''
  ownershipFilter.value = ''
  platformFilter.value = 'all'
  stateFilter.value = 'all'
  sortMode.value = 'smart'
}

function toggleOwnershipFilter(section: OwnershipSection) {
  ownershipFilter.value = ownershipFilter.value === section ? '' : section
}

function isSelected(id: string) {
  return selectedAccountIds.value.includes(String(id || ''))
}

function toggleSelection(id: string) {
  const normalizedId = String(id || '')
  const index = selectedAccountIds.value.indexOf(normalizedId)
  if (index > -1) {
    selectedAccountIds.value.splice(index, 1)
  }
  else {
    selectedAccountIds.value.push(normalizedId)
  }
}

function selectAll() {
  selectedAccountIds.value = displayAccounts.value.map(acc => String(acc.id || ''))
}

function invertSelection() {
  const visibleIds = displayAccounts.value.map(acc => String(acc.id || ''))
  selectedAccountIds.value = visibleIds.filter(id => !selectedAccountIds.value.includes(id))
}

function clearSelection() {
  selectedAccountIds.value = []
}

async function exportAccounts(scope: 'all' | 'selected' = 'all') {
  const targetAccounts = scope === 'selected' ? selectedAccounts.value : displayAccounts.value
  if (targetAccounts.length === 0) {
    toast.warning(scope === 'selected' ? '请先选择要导出的账号' : '当前没有可导出的账号')
    return
  }

  const actionLabel = scope === 'selected' ? '导出已选账号' : '导出当前结果'
  try {
    exportLoading.value = true
    exportScope.value = scope
    const headers = [
      '账号名称',
      '昵称',
      '账号ID',
      'UIN',
      '归属分类',
      '归属账号',
      '平台',
      '区服',
      '最后登录',
      '首次录入',
      '模式',
      '状态',
      '运行中',
      '已连接',
      '最近错误',
    ]

    const rows = targetAccounts.map((acc) => {
      const ownerMeta = resolveOwnerMeta(acc)
      const runtimeState = resolveRuntimeState(acc)
      const modeMeta = resolveModeMeta(resolveAccountMode(acc))
      return [
        getAccountDisplayName(acc),
        acc?.nick || '',
        acc?.id || '',
        acc?.uin || '',
        ownerMeta.shortLabel,
        ownerMeta.ownerText,
        resolvePlatformLabel(acc?.platform),
        resolveZoneLabel(acc),
        getLastLoginLabel(acc),
        formatDateTime(acc?.createdAt),
        modeMeta.label,
        runtimeState.label,
        acc?.running ? '是' : '否',
        acc?.connected ? '是' : '否',
        acc?.wsError?.message || '',
      ].map(escapeCsvCell).join(',')
    })

    const csv = [`\uFEFF${headers.map(escapeCsvCell).join(',')}`, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `accounts-${scope}-${viewMode.value}-${Date.now()}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.URL.revokeObjectURL(url)
    toast.success(`已导出 ${targetAccounts.length} 个账号`)
    pushActionHistory({
      actionLabel,
      totalCount: targetAccounts.length,
      successCount: targetAccounts.length,
      affectedNames: targetAccounts.map(acc => getAccountDisplayName(acc)),
      targetLabel: `视图：${currentViewLabel.value} · 归属：${currentOwnershipLabel.value}`,
    })
  }
  catch (error) {
    console.error('导出失败:', error)
    toast.error('导出失败，请稍后重试')
  }
  finally {
    exportLoading.value = false
    exportScope.value = ''
  }
}

async function batchToggleAccounts(action: 'start' | 'stop') {
  const targetAccounts = action === 'start' ? startableSelectedAccounts.value : stoppableSelectedAccounts.value
  if (targetAccounts.length === 0) {
    toast.warning(action === 'start' ? '所选账号都已在运行，无需批量启动' : '所选账号都已停止，无需批量停止')
    return
  }

  const actionLabel = action === 'start' ? '批量启动' : '批量停止'
  const skippedCount = Math.max(selectedAccounts.value.length - targetAccounts.length, 0)
  let successCount = 0
  const failedNames: string[] = []
  try {
    batchLoading.value = true
    batchActionType.value = action
    for (const acc of targetAccounts) {
      const id = String(acc?.id || '').trim()
      if (!id)
        continue
      try {
        if (action === 'start')
          await api.post(`/api/accounts/${id}/start`)
        else
          await api.post(`/api/accounts/${id}/stop`)
        successCount += 1
      }
      catch (error) {
        console.error(`${actionLabel}失败:`, error)
        failedNames.push(getAccountDisplayName(acc))
      }
    }
    try {
      await accountStore.fetchAccounts()
    }
    catch (error) {
      console.error('刷新账号列表失败:', error)
      toast.warning(`${actionLabel}已执行，但账号列表刷新失败，请手动刷新确认最新状态`)
    }
    pushActionHistory({
      actionLabel,
      totalCount: targetAccounts.length,
      successCount,
      failedNames,
      skippedCount,
      affectedNames: targetAccounts.map(acc => getAccountDisplayName(acc)),
      targetLabel: `当前筛选：${filteredAccounts.value.length} 项`,
    })
    notifyBatchActionResult(actionLabel, successCount, failedNames, skippedCount)
  }
  catch (e: any) {
    console.error(`${actionLabel}失败: ${e.message}`)
    toast.error(`${actionLabel}失败，请稍后重试`)
  }
  finally {
    batchLoading.value = false
    batchActionType.value = ''
  }
}

async function batchRestartAccounts() {
  if (restartableSelectedAccounts.value.length === 0) {
    toast.warning('所选账号都未运行，无需批量重启')
    return
  }

  const skippedCount = Math.max(selectedAccounts.value.length - restartableSelectedAccounts.value.length, 0)
  let successCount = 0
  const failedNames: string[] = []
  try {
    batchLoading.value = true
    batchActionType.value = 'restart'
    for (const acc of restartableSelectedAccounts.value) {
      const id = String(acc?.id || '').trim()
      if (!id)
        continue
      try {
        await api.post(`/api/accounts/${id}/restart`)
        successCount += 1
      }
      catch (error) {
        console.error('批量重启失败:', error)
        failedNames.push(getAccountDisplayName(acc))
      }
    }
    try {
      await accountStore.fetchAccounts()
    }
    catch (error) {
      console.error('刷新账号列表失败:', error)
      toast.warning('批量重启已执行，但账号列表刷新失败，请手动刷新确认最新状态')
    }
    pushActionHistory({
      actionLabel: '批量重启',
      totalCount: restartableSelectedAccounts.value.length,
      successCount,
      failedNames,
      skippedCount,
      affectedNames: restartableSelectedAccounts.value.map(acc => getAccountDisplayName(acc)),
    })
    notifyBatchActionResult('批量重启', successCount, failedNames, skippedCount)
  }
  catch (e: any) {
    console.error(`批量重启失败: ${e.message}`)
    toast.error('批量重启失败，请稍后重试')
  }
  finally {
    batchLoading.value = false
    batchActionType.value = ''
  }
}

async function batchTransferOwnership() {
  if (!canBatchTransferOwnership.value)
    return

  const targetUsername = transferOwnershipTarget.value === UNOWNED_TRANSFER_VALUE ? null : transferOwnershipTarget.value
  const resolvedTransferTargetLabel = transferTargetLabel.value || (targetUsername ? String(targetUsername) : '未归属 / 系统账号')
  const targetAccounts = selectedAccounts.value.filter((acc) => {
    const currentOwner = String(acc?.username || '').trim()
    const nextOwner = String(targetUsername || '').trim()
    return currentOwner !== nextOwner
  })

  if (targetAccounts.length === 0) {
    toast.warning('所选账号已经属于当前目标归属，无需转移')
    return
  }

  const skippedCount = Math.max(selectedAccounts.value.length - targetAccounts.length, 0)
  let successCount = 0
  const failedNames: string[] = []
  try {
    transferLoading.value = true
    for (const acc of targetAccounts) {
      try {
        await api.post('/api/accounts', {
          id: String(acc.id || ''),
          username: targetUsername,
        })
        successCount += 1
      }
      catch (error) {
        console.error('批量转移归属失败:', error)
        failedNames.push(getAccountDisplayName(acc))
      }
    }
    transferOwnershipTarget.value = ''
    clearSelection()
    try {
      await initializePage()
    }
    catch (error) {
      console.error('刷新账号列表失败:', error)
      toast.warning('批量转移归属已执行，但账号列表刷新失败，请手动刷新确认最新状态')
    }
    pushActionHistory({
      actionLabel: '批量转移归属',
      totalCount: targetAccounts.length,
      successCount,
      failedNames,
      skippedCount,
      affectedNames: targetAccounts.map(acc => getAccountDisplayName(acc)),
      targetLabel: resolvedTransferTargetLabel,
    })
    notifyBatchActionResult('批量转移归属', successCount, failedNames, skippedCount)
  }
  catch (e: any) {
    console.error(`批量转移归属失败: ${e.message}`)
    toast.error('批量转移归属失败，请稍后重试')
  }
  finally {
    transferLoading.value = false
  }
}

async function bulkSetMode(mode: string) {
  if (selectedAccountIds.value.length === 0) {
    toast.warning('请先选择要批量设置的账号')
    return
  }
  const targetAccounts = selectedAccounts.value.filter(acc => resolveAccountMode(acc) !== mode)
  if (targetAccounts.length === 0) {
    toast.warning(`所选账号已经全部是${resolveModeMeta(mode).label}`)
    return
  }

  const skippedCount = Math.max(selectedAccounts.value.length - targetAccounts.length, 0)
  let successCount = 0
  const failedNames: string[] = []
  try {
    batchLoading.value = true
    batchActionType.value = `mode:${mode}`
    for (const acc of targetAccounts) {
      try {
        await api.post(`/api/accounts/${String(acc?.id || '').trim()}/mode`, { mode })
        successCount += 1
      }
      catch (error) {
        console.error('批量设置失败:', error)
        failedNames.push(getAccountDisplayName(acc))
      }
    }
    try {
      await accountStore.fetchAccounts()
    }
    catch (error) {
      console.error('刷新账号列表失败:', error)
      toast.warning('批量模式切换已执行，但账号列表刷新失败，请手动刷新确认最新状态')
    }
    pushActionHistory({
      actionLabel: `批量设为${resolveModeMeta(mode).label}`,
      totalCount: targetAccounts.length,
      successCount,
      failedNames,
      skippedCount,
      affectedNames: targetAccounts.map(acc => getAccountDisplayName(acc)),
      targetLabel: `目标模式：${resolveModeMeta(mode).label}`,
    })
    notifyBatchActionResult(`批量设为${resolveModeMeta(mode).label}`, successCount, failedNames, skippedCount)
  }
  catch (e: any) {
    console.error(`批量设置失败: ${e.message}`)
    toast.error('批量设置失败，请稍后重试')
  }
  finally {
    batchLoading.value = false
    batchActionType.value = ''
    clearSelection()
  }
}

function openBatchDeleteConfirm() {
  if (!canBatchDelete.value)
    return
  showBatchDeleteConfirm.value = true
}

async function confirmBatchDelete() {
  if (selectedAccounts.value.length === 0) {
    toast.warning('请先选择要删除的账号')
    return
  }
  const targetAccounts = [...selectedAccounts.value]
  let successCount = 0
  const failedNames: string[] = []
  try {
    batchDeleteLoading.value = true
    const deletingCurrentAccount = targetAccounts.some(acc => String(acc?.id || '') === String(accountStore.currentAccountId || ''))
    if (deletingCurrentAccount) {
      try {
        await accountStore.selectAccount('')
      }
      catch (error) {
        console.warn('批量删除前清空当前选中账号失败:', error)
      }
    }
    for (const acc of targetAccounts) {
      const id = String(acc.id || '').trim()
      if (!id)
        continue
      try {
        await api.delete(`/api/accounts/${id}`)
        successCount += 1
      }
      catch (error) {
        console.error('批量删除失败:', error)
        failedNames.push(getAccountDisplayName(acc))
      }
    }
    showBatchDeleteConfirm.value = false
    clearSelection()
    try {
      await initializePage()
    }
    catch (error) {
      console.error('刷新账号列表失败:', error)
      toast.warning('批量删除已执行，但账号列表刷新失败，请手动刷新确认最新状态')
    }
    pushActionHistory({
      actionLabel: '批量删除',
      totalCount: targetAccounts.length,
      successCount,
      failedNames,
      affectedNames: targetAccounts.map(acc => getAccountDisplayName(acc)),
    })
    notifyBatchActionResult('批量删除', successCount, failedNames)
  }
  catch (e: any) {
    console.error(`批量删除失败: ${e.message}`)
    toast.error('批量删除失败，请稍后重试')
  }
  finally {
    batchDeleteLoading.value = false
  }
}

function openSettings(account: any) {
  accountStore.selectAccount(String(account?.id || ''))
  router.push('/settings')
}

function openAddModal() {
  editingAccount.value = null
  showModal.value = true
}

function openEditModal(account: any) {
  editingAccount.value = { ...account }
  showModal.value = true
}

async function handleDelete(account: any) {
  accountToDelete.value = account
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (accountToDelete.value) {
    try {
      deleteLoading.value = true
      await accountStore.deleteAccount(accountToDelete.value.id)
      accountToDelete.value = null
      showDeleteConfirm.value = false
    }
    finally {
      deleteLoading.value = false
    }
  }
}

async function toggleAccount(account: any) {
  if (account.running) {
    await accountStore.stopAccount(String(account.id || ''))
  }
  else {
    await accountStore.startAccount(String(account.id || ''))
  }
}

async function handleSaved() {
  await initializePage()
}

async function handleModeChange(acc: any, mode: AccountMode) {
  try {
    await accountStore.updateAccountMode(acc.id, mode)
  }
  catch (e: any) {
    console.error(`切换模式失败: ${e.message}`)
  }
}

async function handleSafeCheck(acc: any) {
  // eslint-disable-next-line no-alert
  if (confirm(`是否分析 ${acc.name || acc.id} 的历史封禁日志并自动补充黑名单？`)) {
    try {
      safeCheckingId.value = acc.id
      await accountStore.applySafeModeBlacklist(acc.id)
    }
    catch (e: any) {
      console.error(`生成失败: ${e.message}`)
    }
    finally {
      safeCheckingId.value = ''
    }
  }
}

onMounted(async () => {
  await hydrateAccountsPagePreferences()
  applyQueryState()
  await initializePage()
  enableAccountsViewSync()
  enableAccountsActionHistorySync()
})

watch(adminToken, (val) => {
  if (val) {
    initializePage()
  }
})

useIntervalFn(() => {
  accountStore.fetchAccounts()
}, 3000)
</script>

<template>
  <div class="accounts-page ui-page-shell ui-page-stack ui-page-density-compact w-full">
    <div class="ui-page-header">
      <BaseAccountViewSwitcherLayout class="w-full" :actions="pageHeaderActions">
        <template #main>
          <div class="ui-page-header__main min-w-0 space-y-3">
            <BasePageHeaderText
              :title="pageHeaderText.title"
              :description="pageHeaderText.description"
            />

            <BaseToggleOptionGroup :items="ownershipTabOptions" />
          </div>
        </template>

        <template #switchers>
          <BaseToggleOptionGroup :items="viewOptionItems" />
        </template>

        <template #meta>
          <BaseHeaderNotice
            v-if="pageHeaderNotice.show !== false"
            :text="pageHeaderNotice.text"
            :class="pageHeaderNotice.class"
          />
        </template>

        <template #actions-meta>
          <BaseHeaderSummary
            v-if="pageHeaderSummary.show !== false"
            :prefix="pageHeaderSummary.prefix"
            :value="pageHeaderSummary.value"
            :separator="pageHeaderSummary.separator"
            :secondary-value="pageHeaderSummary.secondaryValue"
            :suffix="pageHeaderSummary.suffix"
            :value-class="pageHeaderSummary.valueClass"
            :secondary-value-class="pageHeaderSummary.secondaryValueClass"
            :class="pageHeaderSummary.class"
          />
        </template>
      </BaseAccountViewSwitcherLayout>
    </div>

    <div class="glass-panel ui-filter-panel accounts-filter-panel">
      <div class="ui-filter-grid lg:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,0.9fr))]">
        <BaseInput
          v-model="searchKeyword"
          label="搜索账号"
          placeholder="搜索备注、UIN、归属用户名、平台"
          clearable
        />
        <BaseSelect
          v-model="platformFilter"
          label="平台筛选"
          :options="platformOptions"
        />
        <BaseSelect
          v-model="stateFilter"
          label="状态筛选"
          :options="stateOptions"
        />
        <BaseSelect
          v-model="sortMode"
          label="排序方式"
          :options="sortOptions"
        />
      </div>

      <BaseTableToolbar>
        <template #left>
          <BaseChipList class="text-xs" :items="filterToolbarChips" />
        </template>
        <template #right>
          <BaseBulkActions class="self-start lg:self-auto">
            <BaseActionButtons :actions="filterToolbarActions" />
          </BaseBulkActions>
        </template>
      </BaseTableToolbar>
    </div>

    <BaseManagementBar v-if="accounts.length > 0" class="glass-panel accounts-management-bar mb-4">
      <template #primary>
        <BaseBulkActions>
          <BaseActionButtons :actions="selectionPrimaryActions" />
          <BaseSelectionSummary
            :selected-count="selectedAccountIds.length"
            :filtered-count="filteredAccounts.length"
            class="ml-1"
          />
        </BaseBulkActions>
      </template>

      <template #secondary>
        <BaseBulkActions>
          <div v-if="isAdmin" class="min-w-[220px]">
            <BaseSelect
              v-model="transferOwnershipTarget"
              label="批量转移归属"
              :options="ownershipTransferOptions"
              placeholder="选择目标归属账号"
            />
          </div>
          <BaseActionButtons :actions="selectionSecondaryActions" />
        </BaseBulkActions>
      </template>
    </BaseManagementBar>

    <BaseHistorySectionLayout
      v-if="accounts.length > 0"
      class="mb-4 rounded-[24px]"
      :title="historyPanel.title"
      :description="historyPanel.description"
      :actions="historyHeaderActions"
      :title-chips="historyPanel.titleChips"
      :title-meta="historyPanel.titleMeta"
      :highlight="latestHistoryHighlight"
      :metrics="latestHistoryMetrics"
      :recent-items="recentHistoryCards"
      :empty-text="historyPanel.emptyText"
      :highlight-meta-chips="latestHistoryHighlight?.metaChips || []"
      highlight-section-class="space-y-3"
      highlight-header-class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"
      :highlight-card-attrs="{
        class: 'min-w-0 flex-1',
        titleClass: 'line-clamp-1 text-lg font-semibold',
        descriptionClass: 'glass-text-muted mt-1 text-sm',
        noteClass: 'accounts-history-note mt-2 text-xs leading-5',
      }"
      highlight-meta-chips-class="accounts-filter-chip-wrap text-xs"
      metrics-class="grid grid-cols-1 gap-3 md:grid-cols-3"
      empty-class="accounts-history-empty"
      recent-grid-class="grid grid-cols-1 gap-3 2xl:grid-cols-4 lg:grid-cols-2"
      recent-copied-class="accounts-history-card-copied"
    />

    <div v-if="loading && accounts.length === 0" class="glass-panel min-h-[300px] flex flex-col items-center justify-center rounded-lg py-12 text-center shadow">
      <div class="relative mb-6">
        <div class="i-svg-spinners-ring-resize text-5xl text-primary-500" />
        <div class="absolute inset-0 animate-ping rounded-full bg-primary-400/20 blur-xl" />
      </div>
      <h3 class="text-lg font-semibold tracking-tight">
        正在同步云端账号...
      </h3>
      <p class="glass-text-muted mt-2 text-sm">
        正在为您的容器分配安全资源，请稍候
      </p>
    </div>

    <BaseEmptyState v-else-if="accounts.length === 0" class="glass-panel rounded-lg shadow" icon="i-carbon-user-avatar">
      <template #title>
        <p class="ui-empty-state__title glass-text-muted mb-4">
          暂无账号
        </p>
      </template>
      <BaseButton
        variant="text"
        @click="openAddModal"
      >
        立即添加
      </BaseButton>
    </BaseEmptyState>

    <BaseEmptyState v-else-if="filteredAccounts.length === 0" class="glass-panel rounded-2xl shadow" icon="i-carbon-search-locate">
      <template #title>
        <p class="ui-empty-state__title text-base font-semibold">
          没有符合当前筛选条件的账号
        </p>
      </template>
      <template #description>
        <p class="ui-empty-state__desc glass-text-muted mt-2 text-sm">
          可以调整归属胶囊、搜索关键词或状态筛选，再继续查看。
        </p>
      </template>
      <BaseButton
        variant="ghost"
        class="mt-4"
        @click="clearFilters"
      >
        清空筛选
      </BaseButton>
    </BaseEmptyState>

    <BaseTableSectionCard
      v-else-if="isTableView"
      title="表格视图"
      description="适合批量盘点账号归属、平台、最近登录时间和操作状态。"
      class="rounded-[26px]"
      header-class="px-4 py-4"
      title-class="text-base font-semibold"
      description-class="glass-text-muted mt-1 text-sm"
    >
      <template #header-meta>
        <div class="ui-section-meta">
          <div class="accounts-meta-pill">
            当前排序：{{ currentTableSortLabel }}
          </div>
          <BaseSelectionSummary
            :selected-count="selectedAccountIds.length"
            :filtered-count="filteredAccounts.length"
            variant="pill"
          />
          <div class="accounts-info-pill">
            {{ TABLE_VIEW_SYNC_NOTE }}
          </div>
          <div class="relative hidden md:block" @click.stop>
            <BaseButton
              variant="ghost"
              size="sm"
              class="accounts-ghost-pill"
              @click="showColumnSettings = !showColumnSettings"
            >
              <div class="i-carbon-column mr-1 text-sm" />
              列设置
            </BaseButton>
            <div
              v-if="showColumnSettings"
              class="accounts-column-popover glass-panel absolute right-0 top-[calc(100%+8px)] z-20 min-w-[220px] p-3 shadow-2xl"
            >
              <div class="accounts-meta-label mb-2">
                表格列显隐
              </div>
              <div class="accounts-column-note mb-2">
                {{ TABLE_COLUMN_SYNC_NOTE }}
              </div>
              <button
                v-for="column in tableColumnOptions"
                :key="column.key"
                class="accounts-column-row w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors"
                @click="toggleTableColumn(column.key)"
              >
                <span>{{ column.label }}</span>
                <span
                  :class="getColumnVisibilityBadgeClass(visibleTableColumns[column.key])"
                >
                  <div :class="visibleTableColumns[column.key] ? 'i-carbon-checkmark' : 'i-carbon-subtract'" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #mobile>
        <div class="ui-mobile-record-list px-4 pb-4 md:hidden">
          <article
            v-for="acc in tableAccounts"
            :key="`mobile-${acc.id}`"
            class="ui-mobile-record-card"
            :class="getAccountRecordState(acc).mobileCardClass"
            @click="accountStore.selectAccount(String(acc.id || ''))"
          >
            <div class="ui-mobile-record-head">
              <div class="ui-mobile-record-main">
                <div
                  class="h-5 w-5 flex cursor-pointer items-center justify-center rounded transition-colors"
                  :class="getAccountRecordState(acc).selectionClass"
                  @click.stop="toggleSelection(acc.id)"
                >
                  <div
                    v-if="getAccountRecordState(acc).selected"
                    class="i-carbon-checkmark"
                    :class="getAccountRecordState(acc).selectionIconClass"
                  />
                </div>
                <div class="ui-mobile-record-body">
                  <div class="ui-mobile-record-badges">
                    <BaseBadge :class="getAccountRecordHero(acc).badges?.[0]?.class">
                      {{ getAccountRecordHero(acc).badges?.[0]?.text }}
                    </BaseBadge>
                    <BaseBadge :class="getAccountRecordHero(acc).badges?.[1]?.class">
                      {{ getAccountRecordHero(acc).badges?.[1]?.text }}
                    </BaseBadge>
                    <BaseBadge :class="getAccountDisplayFields(acc).mode.badges?.[0]?.class">
                      {{ getAccountDisplayFields(acc).mode.badges?.[0]?.text }}
                    </BaseBadge>
                  </div>
                  <h3 class="ui-mobile-record-title">
                    {{ getAccountRecordHero(acc).title }}
                  </h3>
                  <p class="ui-mobile-record-subtitle">
                    {{ getAccountRecordHero(acc).subline }}
                  </p>
                </div>
              </div>
            </div>

            <div class="ui-mobile-record-grid">
              <div
                v-for="mobileField in getAccountMobileFields(acc)"
                :key="mobileField.key"
                class="ui-mobile-record-field"
              >
                <div class="ui-mobile-record-label">
                  {{ mobileField.label }}
                </div>
                <div class="ui-mobile-record-value">
                  {{ mobileField.value }}
                </div>
                <div v-if="mobileField.secondaryValue" class="ui-mobile-record-value ui-mobile-record-value--muted">
                  {{ mobileField.secondaryValue }}
                </div>
              </div>
            </div>

            <div class="ui-mobile-record-actions" @click.stop>
              <BaseActionButtons :actions="getAccountOperationSets(acc).mobile" />
            </div>

            <div class="accounts-mode-toggle-wrap accounts-mode-toggle-wrap-mobile" @click.stop>
              <BaseToggleOptionGroup
                class="ui-bulk-actions accounts-mode-toggle-group accounts-mode-toggle-group-mobile"
                item-class="accounts-mode-toggle-button accounts-mode-toggle-button-mobile"
                :items="getModeToggleOptions(acc)"
              />
            </div>
          </article>
        </div>
      </template>

      <BaseDataTable class="hidden overflow-x-auto overflow-y-visible md:block" table-class="min-w-[1260px] w-full text-sm">
        <BaseDataTableHead class="accounts-table-head accounts-meta-label sticky top-0 z-10 text-left backdrop-blur-md">
          <tr>
            <th class="px-4 py-3 font-medium">
              选择
            </th>
            <BaseSortableHeaderCell
              label="账号"
              :active="tableSortKey === 'account'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('account')"
            />
            <BaseSortableHeaderCell
              v-if="visibleTableColumns.owner"
              label="归属"
              :active="tableSortKey === 'owner'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('owner')"
            />
            <BaseSortableHeaderCell
              v-if="visibleTableColumns.platform"
              label="平台 / 区服"
              :active="tableSortKey === 'platform'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('platform')"
            />
            <BaseSortableHeaderCell
              v-if="visibleTableColumns.activity"
              label="最近登录"
              :active="tableSortKey === 'activity'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('activity')"
            />
            <BaseSortableHeaderCell
              v-if="visibleTableColumns.mode"
              label="模式"
              :active="tableSortKey === 'mode'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('mode')"
            />
            <BaseSortableHeaderCell
              v-if="visibleTableColumns.state"
              label="状态"
              :active="tableSortKey === 'state'"
              :direction="tableSortDirection"
              @toggle="toggleTableSort('state')"
            />
            <th v-if="visibleTableColumns.actions" class="px-4 py-3 font-medium">
              操作
            </th>
          </tr>
        </BaseDataTableHead>
        <tbody>
          <tr
            v-for="acc in tableAccounts"
            :key="acc.id"
            class="accounts-table-row cursor-pointer border-t align-top transition-colors"
            :class="getAccountRecordState(acc).tableRowClass"
            @click="accountStore.selectAccount(String(acc.id || ''))"
          >
            <td class="px-4 py-4 align-top">
              <div
                class="h-5 w-5 flex cursor-pointer items-center justify-center rounded transition-colors"
                :class="getAccountRecordState(acc).selectionClass"
                @click.stop="toggleSelection(acc.id)"
              >
                <div
                  v-if="getAccountRecordState(acc).selected"
                  class="i-carbon-checkmark"
                  :class="getAccountRecordState(acc).selectionIconClass"
                />
              </div>
            </td>
            <td class="px-4 py-4 align-top">
              <div class="min-w-[220px] flex items-start gap-3">
                <div class="accounts-avatar-shell h-11 w-11 flex shrink-0 items-center justify-center overflow-hidden rounded-xl">
                  <img v-if="getAccountRecordHero(acc).avatarUrl" :src="getAccountRecordHero(acc).avatarUrl" class="h-full w-full object-cover" @error="(e) => markFailed((e.target as HTMLImageElement).src)" />
                  <div v-else class="i-carbon-user glass-text-muted text-2xl" />
                </div>
                <div class="min-w-0">
                  <div class="line-clamp-1 text-base font-semibold">
                    {{ getAccountRecordHero(acc).title }}
                  </div>
                  <div class="glass-text-muted line-clamp-1 mt-1 text-xs">
                    {{ getAccountRecordHero(acc).subline }}
                  </div>
                  <div class="glass-text-muted line-clamp-1 mt-1 text-xs">
                    昵称：{{ getAccountRecordHero(acc).nickname }}
                  </div>
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.owner" class="px-4 py-4 align-top">
              <div class="min-w-[180px]">
                <BaseBadge :class="getAccountDisplayFields(acc).owner.badges?.[0]?.class">
                  {{ getAccountDisplayFields(acc).owner.badges?.[0]?.text }}
                </BaseBadge>
                <div class="line-clamp-2 mt-2 text-sm font-semibold leading-6">
                  {{ getAccountDisplayFields(acc).owner.value }}
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.platform" class="px-4 py-4 align-top">
              <div class="min-w-[140px]">
                <div class="text-sm font-semibold">
                  {{ getAccountDisplayFields(acc).platform.value }}
                </div>
                <div class="glass-text-muted mt-2 text-xs">
                  {{ getAccountDisplayFields(acc).platform.secondaryValue }}
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.activity" class="px-4 py-4 align-top">
              <div class="min-w-[168px]">
                <div class="text-sm font-semibold leading-6">
                  {{ getAccountDisplayFields(acc).activity.value }}
                </div>
                <div class="glass-text-muted mt-2 text-xs leading-5">
                  {{ getAccountDisplayFields(acc).activity.secondaryValue }}
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.mode" class="px-4 py-4 align-top">
              <div class="min-w-[188px]">
                <BaseBadge :class="getAccountDisplayFields(acc).mode.badges?.[0]?.class">
                  {{ getAccountDisplayFields(acc).mode.badges?.[0]?.text }}
                </BaseBadge>
                <div v-if="getAccountDisplayFields(acc).mode.badges?.[1]?.text" class="mt-2 flex flex-wrap items-center gap-2">
                  <BaseBadge :class="getAccountDisplayFields(acc).mode.badges?.[1]?.class">
                    {{ getAccountDisplayFields(acc).mode.badges?.[1]?.text }}
                  </BaseBadge>
                </div>
                <div v-if="getAccountDisplayFields(acc).mode.note" class="mt-2 text-xs leading-5" :class="getAccountDisplayFields(acc).mode.noteClass">
                  {{ getAccountDisplayFields(acc).mode.note }}
                </div>
                <div class="accounts-mode-toggle-wrap accounts-mode-toggle-wrap-table" @click.stop>
                  <BaseToggleOptionGroup
                    class="accounts-mode-toggle-group accounts-mode-toggle-group-table"
                    item-class="accounts-mode-toggle-button"
                    :items="getAccountDisplayFields(acc).mode.toggleItems || []"
                  />
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.state" class="px-4 py-4 align-top">
              <div class="min-w-[170px]">
                <BaseBadge :class="getAccountDisplayFields(acc).state.badges?.[0]?.class">
                  {{ getAccountDisplayFields(acc).state.badges?.[0]?.text }}
                </BaseBadge>
                <div class="mt-2 text-xs leading-5" :class="getAccountDisplayFields(acc).state.noteClass">
                  {{ getAccountDisplayFields(acc).state.secondaryValue }}
                </div>
              </div>
            </td>
            <td v-if="visibleTableColumns.actions" class="px-4 py-4 align-top">
              <div class="min-w-[218px] space-y-3" @click.stop>
                <div class="flex flex-wrap items-center gap-2">
                  <BaseActionButtons :actions="getAccountOperationSets(acc).tablePrimary" />
                </div>

                <div class="flex items-center gap-2">
                  <BaseIconActions :actions="getAccountOperationSets(acc).tableIcon" />
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </BaseDataTable>
    </BaseTableSectionCard>

    <div v-else :class="cardGridClass">
      <BaseAccountRecordCard
        v-for="acc in filteredAccounts"
        :key="acc.id"
        :compact="isCompactView"
        :current="getAccountRecordState(acc).current"
        :glow-class="getAccountRecordState(acc).glowClass"
        :title="getAccountRecordHero(acc).title"
        :subline="getAccountRecordHero(acc).subline"
        :nickname="getAccountRecordHero(acc).nickname"
        :platform-label="getAccountRecordHero(acc).platformLabel"
        :zone-label="getAccountRecordHero(acc).zoneLabel"
        :avatar-url="getAccountRecordHero(acc).avatarUrl"
        :hint="getAccountRecordHero(acc).hint"
        @select="accountStore.selectAccount(String(acc.id || ''))"
        @avatar-error="(e) => markFailed((e.target as HTMLImageElement).src)"
      >
        <template #selection>
          <div
            class="h-5 w-5 flex cursor-pointer items-center justify-center rounded transition-colors"
            :class="getAccountRecordState(acc).selectionClass"
            @click.stop="toggleSelection(acc.id)"
          >
            <div
              v-if="getAccountRecordState(acc).selected"
              class="i-carbon-checkmark"
              :class="getAccountRecordState(acc).selectionIconClass"
            />
          </div>
        </template>

        <template #badges>
          <BaseBadge :class="getAccountRecordHero(acc).badges?.[0]?.class">
            {{ getAccountRecordHero(acc).badges?.[0]?.text }}
          </BaseBadge>
          <BaseBadge :class="getAccountRecordHero(acc).badges?.[1]?.class">
            {{ getAccountRecordHero(acc).badges?.[1]?.text }}
          </BaseBadge>
        </template>

        <template #hero-actions>
          <BaseActionButtons :actions="getAccountRecordHero(acc).actions" />
        </template>

        <template #fields>
          <BaseRecordMetricCard
            v-for="field in getAccountRecordFields(acc)"
            :key="field.key"
            :label="field.label"
            :icon-class="field.iconClass"
            class="accounts-record-field"
            :class="field.class"
            :label-class="field.labelClass"
            :body-class="field.bodyClass"
            @click="field.onClick?.($event)"
          >
            <template v-if="field.key === 'owner'">
              <div class="accounts-owner-field">
                <div class="accounts-owner-field__badge">
                  <BaseBadge :class="field.props?.field?.badges?.[0]?.class">
                    {{ field.props?.field?.badges?.[0]?.text }}
                  </BaseBadge>
                </div>
                <div class="accounts-owner-field__value">
                  {{ field.props?.field?.value }}
                </div>
              </div>
            </template>

            <template v-else-if="field.key === 'activity'">
              <div class="mt-2.5 text-base font-semibold leading-6">
                {{ field.props?.field?.value }}
              </div>
              <div class="glass-text-muted mt-2 text-xs leading-5">
                {{ field.props?.field?.secondaryValue }}
              </div>
            </template>

            <template v-else-if="field.key === 'runtime'">
              <div class="mt-2.5 flex items-center gap-2 text-sm font-semibold">
                <div class="h-2 w-2 rounded-full" :class="field.props?.field?.dotClass" />
                {{ field.props?.field?.value }}
              </div>
              <div class="mt-2.5 text-xs leading-5" :class="field.props?.field?.noteClass">
                {{ field.props?.field?.secondaryValue }}
              </div>
            </template>

            <template v-else-if="field.key === 'mode'">
              <div class="mt-2.5 flex flex-wrap items-center gap-2">
                <BaseBadge :class="field.props?.field?.badges?.[0]?.class">
                  配置：{{ field.props?.field?.badges?.[0]?.text }}
                </BaseBadge>
                <BaseBadge v-if="field.props?.field?.badges?.[1]?.text" :class="field.props?.field?.badges?.[1]?.class">
                  {{ field.props?.field?.badges?.[1]?.text }}
                </BaseBadge>
              </div>
              <p v-if="field.props?.field?.note" class="mt-2 text-xs leading-5" :class="field.props?.field?.noteClass">
                {{ field.props?.field?.note }}
              </p>
              <div class="accounts-mode-toggle-wrap">
                <BaseToggleOptionGroup
                  class="accounts-mode-toggle-group accounts-mode-toggle-group-card"
                  item-class="accounts-mode-toggle-button"
                  :items="field.props?.field?.toggleItems || []"
                />
              </div>
            </template>
          </BaseRecordMetricCard>
        </template>
      </BaseAccountRecordCard>
    </div>

    <AccountModal
      :show="showModal"
      :edit-data="editingAccount"
      @close="showModal = false"
      @saved="handleSaved"
    />

    <ConfirmModal
      :show="showDeleteConfirm"
      :loading="deleteLoading"
      title="删除账号"
      :message="accountToDelete ? `确定要删除账号 ${accountToDelete.name || accountToDelete.id} 吗?` : ''"
      confirm-text="删除"
      type="danger"
      @close="!deleteLoading && (showDeleteConfirm = false)"
      @cancel="!deleteLoading && (showDeleteConfirm = false)"
      @confirm="confirmDelete"
    />

    <ConfirmModal
      :show="showBatchDeleteConfirm"
      :loading="batchDeleteLoading"
      title="批量删除账号"
      :message="batchDeleteMessage"
      confirm-text="确认批量删除"
      type="danger"
      @cancel="!batchDeleteLoading && (showBatchDeleteConfirm = false)"
      @confirm="confirmBatchDelete"
    />
  </div>
</template>

<style scoped>
.accounts-page {
  color: var(--ui-text-1);
}

.accounts-page
  :is(
    [class*='text-'][class*='gray-300'],
    [class*='text-'][class*='gray-400'],
    [class*='text-'][class*='gray-500'],
    .glass-text-muted
  ) {
  color: var(--ui-text-2) !important;
}

.accounts-page
  :is(
    [class*='text-'][class*='gray-200'],
    [class*='text-'][class*='gray-100'],
    [class*='text-'][class*='slate-300'],
    [class*='text-'][class*='slate-200']
  ) {
  color: var(--ui-text-1) !important;
}

.accounts-page
  :is(
    [class*='text-'][class*='white/95'],
    [class*='text-'][class*='white/90'],
    [class*='text-'][class*='white/85'],
    [class*='text-'][class*='white/80']
  ) {
  color: color-mix(in srgb, var(--ui-text-1) 92%, var(--ui-text-on-brand) 8%) !important;
}

.accounts-page .accounts-tab-active {
  box-shadow: 0 8px 24px var(--ui-shadow-panel) !important;
}

.accounts-page .accounts-mode-active {
  box-shadow: 0 10px 26px var(--ui-shadow-panel) !important;
}

.accounts-page-count {
  color: var(--ui-text-2);
  font-size: 0.9375rem;
}

.accounts-page-count-value {
  color: var(--ui-text-1);
  font-weight: 700;
}

.accounts-info-banner {
  border: 1px solid color-mix(in srgb, var(--ui-status-info) 20%, var(--ui-border-subtle)) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-status-info) 7%, var(--ui-bg-surface-raised) 93%) !important;
  color: color-mix(in srgb, var(--ui-status-info) 72%, var(--ui-text-1)) !important;
  padding: 0.5rem 0.75rem;
  line-height: 1.5;
}

.accounts-ownership-tab {
  border-color: var(--ui-border-subtle) !important;
  color: var(--ui-text-2) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
}

.accounts-ownership-tab-idle:hover {
  color: var(--ui-text-1) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
}

.accounts-ownership-tab-active {
  color: var(--ui-text-on-brand) !important;
}

.accounts-ownership-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  border: 1px solid var(--ui-border-subtle);
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent);
  color: var(--ui-text-2);
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1.1;
}

.accounts-ownership-tab-count-active {
  border-color: transparent;
  background: color-mix(in srgb, var(--ui-text-on-brand) 18%, transparent);
  color: var(--ui-text-on-brand);
}

.accounts-ownership-tab-mine.accounts-ownership-tab-active {
  border-color: color-mix(in srgb, var(--ui-brand-500) 48%, transparent) !important;
  background: color-mix(in srgb, var(--ui-brand-500) 24%, var(--ui-bg-surface-raised) 76%) !important;
}

.accounts-ownership-tab-mine.accounts-ownership-tab-idle:hover {
  background: color-mix(in srgb, var(--ui-brand-500) 10%, var(--ui-bg-surface-raised) 90%) !important;
}

.accounts-ownership-tab-other_user.accounts-ownership-tab-active {
  border-color: color-mix(in srgb, var(--ui-status-warning) 40%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-warning) 22%, var(--ui-bg-surface-raised) 78%) !important;
}

.accounts-ownership-tab-other_user.accounts-ownership-tab-idle:hover {
  background: color-mix(in srgb, var(--ui-status-warning) 10%, var(--ui-bg-surface-raised) 90%) !important;
}

.accounts-ownership-tab-other_admin.accounts-ownership-tab-active {
  border-color: color-mix(in srgb, var(--ui-status-info) 40%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-info) 22%, var(--ui-bg-surface-raised) 78%) !important;
}

.accounts-ownership-tab-other_admin.accounts-ownership-tab-idle:hover {
  background: color-mix(in srgb, var(--ui-status-info) 10%, var(--ui-bg-surface-raised) 90%) !important;
}

.accounts-ownership-tab-unowned.accounts-ownership-tab-active {
  border-color: color-mix(in srgb, var(--ui-text-2) 26%, transparent) !important;
  background: color-mix(in srgb, var(--ui-text-2) 14%, var(--ui-bg-surface-raised) 86%) !important;
}

.accounts-ownership-tab-unowned.accounts-ownership-tab-idle:hover {
  background: color-mix(in srgb, var(--ui-text-2) 8%, var(--ui-bg-surface-raised) 92%) !important;
}

.accounts-view-switch {
  border-color: var(--ui-border-subtle) !important;
}

.accounts-view-switch-active {
  background: color-mix(in srgb, var(--ui-brand-500) 22%, var(--ui-bg-surface-raised) 78%) !important;
  border-color: color-mix(in srgb, var(--ui-brand-500) 42%, transparent) !important;
  color: var(--ui-text-on-brand) !important;
}

.accounts-view-switch-idle {
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
  color: var(--ui-text-2) !important;
}

.accounts-view-switch-idle:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.accounts-ghost-pill {
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 999px !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.accounts-ghost-pill:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent) !important;
}

.accounts-danger-pill {
  border: 1px solid color-mix(in srgb, var(--ui-status-danger) 24%, transparent) !important;
  border-radius: 999px !important;
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent) !important;
  color: var(--ui-status-danger) !important;
}

.accounts-danger-pill:hover {
  background: color-mix(in srgb, var(--ui-status-danger) 16%, transparent) !important;
}

.accounts-batch-button {
  border: 1px solid transparent !important;
  border-radius: 999px !important;
  font-weight: 700 !important;
  box-shadow: 0 10px 24px var(--ui-shadow-panel) !important;
}

.accounts-batch-button-brand {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-brand-500) 94%, white 6%),
    var(--ui-brand-600)
  ) !important;
  color: var(--ui-text-on-brand) !important;
}

.accounts-batch-button-danger {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-status-danger) 90%, white 10%),
    color-mix(in srgb, var(--ui-status-danger) 78%, black 22%)
  ) !important;
  color: var(--ui-text-on-brand) !important;
}

.accounts-batch-button-neutral {
  border-color: var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.accounts-batch-button-neutral:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 96%, transparent) !important;
}

.accounts-batch-button-admin {
  border-color: color-mix(in srgb, var(--ui-status-info) 22%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-info) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-info) 75%, var(--ui-text-1)) !important;
}

.accounts-batch-button-main {
  border-color: color-mix(in srgb, var(--ui-brand-500) 24%, transparent) !important;
  background: var(--ui-brand-soft-12) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 78%, var(--ui-text-1)) !important;
}

.accounts-batch-button-alt {
  border-color: color-mix(in srgb, var(--ui-status-warning) 24%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-warning) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 78%, var(--ui-text-1)) !important;
}

.accounts-batch-button-safe {
  border-color: color-mix(in srgb, var(--ui-status-success) 24%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 78%, var(--ui-text-1)) !important;
}

.accounts-batch-button-start {
  border-color: color-mix(in srgb, var(--ui-status-success) 24%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 78%, var(--ui-text-1)) !important;
}

.accounts-batch-button-stop {
  border-color: color-mix(in srgb, var(--ui-status-warning) 24%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-warning) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 78%, var(--ui-text-1)) !important;
}

.accounts-batch-button-restart {
  border-color: color-mix(in srgb, var(--ui-status-info) 24%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-info) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-info) 78%, var(--ui-text-1)) !important;
}

.accounts-filter-chip-wrap {
  color: var(--ui-text-1);
}

.accounts-copy-button-active {
  border-color: color-mix(in srgb, var(--ui-status-success) 24%, transparent) !important;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-status-success) 9%, var(--ui-bg-surface-raised) 91%),
    color-mix(in srgb, var(--ui-brand-soft-12) 44%, var(--ui-bg-surface) 56%)
  ) !important;
  color: color-mix(in srgb, var(--ui-status-success) 80%, var(--ui-text-1)) !important;
  box-shadow:
    0 14px 30px color-mix(in srgb, var(--ui-status-success) 16%, transparent),
    0 0 0 1px color-mix(in srgb, var(--ui-status-success) 12%, transparent) !important;
}

.accounts-history-note {
  color: color-mix(in srgb, var(--ui-status-info) 72%, var(--ui-text-1)) !important;
}

.accounts-filter-panel {
  position: relative;
  z-index: 6;
  overflow: visible;
}

.accounts-filter-panel :deep(.base-select-menu) {
  z-index: 70;
}

.accounts-management-bar {
  position: relative;
  z-index: 1;
}

.accounts-history-stat,
.accounts-meta-card,
.accounts-column-popover {
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
}

.accounts-history-stat,
.accounts-meta-card {
  padding: 0.8125rem;
}

.accounts-record-hero {
  padding: 0.875rem;
}

.accounts-record-hero-grid {
  align-items: stretch;
  gap: 0.75rem;
}

.accounts-record-inline-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0 !important;
  border: 0 !important;
  background: transparent !important;
}

.accounts-record-hero-actions {
  border-top: 1px solid var(--ui-border-subtle);
  padding-top: 0.75rem;
}

.accounts-record-action-grid {
  align-content: start;
}

.accounts-record-action-grid > * {
  min-height: 2.5rem;
}

.accounts-record-field {
  min-height: 6.5rem;
}

.accounts-owner-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
  width: 100%;
}

.accounts-owner-field__badge {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
}

.accounts-owner-field__value {
  width: 100%;
  text-align: left;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.5rem;
  color: var(--ui-text-1);
  word-break: break-word;
}

@media (min-width: 1024px) {
  .accounts-record-inline-meta {
    align-items: flex-end;
    text-align: right;
  }
}

.accounts-page .accounts-card-shell {
  min-height: 0 !important;
}

.accounts-card-meta-grid {
  border-top: 1px solid var(--ui-border-subtle) !important;
  border-bottom: 1px solid var(--ui-border-subtle) !important;
}

.accounts-meta-label {
  color: var(--ui-text-3) !important;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.accounts-history-empty {
  border: 1px dashed var(--ui-border-subtle) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface) 56%, transparent) !important;
  color: var(--ui-text-1) !important;
  padding: 1.25rem 1rem;
}

.accounts-history-card {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
}

.accounts-history-card-button::before,
.accounts-history-card-button::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.accounts-history-card-button::before {
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(
    circle at top right,
    color-mix(in srgb, var(--ui-text-on-brand) 12%, transparent),
    transparent 48%
  );
  opacity: 0;
  transition: opacity 0.28s ease;
}

.accounts-history-card-button::after {
  top: -30%;
  bottom: -30%;
  left: -42%;
  width: 36%;
  transform: rotate(18deg) translateX(-180%);
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--ui-text-on-brand) 30%, transparent),
    transparent
  );
  opacity: 0;
}

.accounts-history-card-button:hover::before {
  opacity: 1;
}

.accounts-history-card-button:hover::after {
  opacity: 0.4;
  transform: rotate(18deg) translateX(265%);
  transition:
    transform 0.82s ease,
    opacity 0.24s ease;
}

.accounts-history-card-success {
  border-color: color-mix(in srgb, var(--ui-status-success) 24%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 76%, var(--ui-text-1)) !important;
}

.accounts-history-card-error {
  border-color: color-mix(in srgb, var(--ui-status-danger) 24%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 76%, var(--ui-text-1)) !important;
}

.accounts-history-card-partial {
  border-color: color-mix(in srgb, var(--ui-status-warning) 24%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 76%, var(--ui-text-1)) !important;
}

.accounts-history-card-copied {
  border-color: color-mix(in srgb, var(--ui-status-success) 28%, transparent) !important;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-status-success) 8%, var(--ui-bg-surface-raised) 92%),
    color-mix(in srgb, var(--ui-brand-soft-12) 36%, var(--ui-bg-surface) 64%)
  ) !important;
  box-shadow:
    0 20px 40px color-mix(in srgb, var(--ui-status-success) 16%, transparent),
    0 0 0 1px color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  animation: accounts-history-card-copied 0.82s cubic-bezier(0.22, 1, 0.36, 1);
}

.accounts-history-card-copied::before {
  opacity: 1;
}

.accounts-history-card-copy-icon,
.accounts-history-card-copy-text {
  color: color-mix(in srgb, var(--ui-status-success) 80%, var(--ui-text-1)) !important;
}

.accounts-history-card-copy-text {
  font-weight: 700;
  letter-spacing: 0.01em;
}

.accounts-history-metric {
  border-radius: 999px;
  padding: 0.25rem 0.625rem;
}

.accounts-history-metric-total {
  background: color-mix(in srgb, var(--ui-bg-surface) 64%, transparent);
  color: var(--ui-text-1);
}

.accounts-history-metric-success {
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent);
  color: color-mix(in srgb, var(--ui-status-success) 76%, var(--ui-text-1));
}

.accounts-history-metric-error {
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent);
  color: color-mix(in srgb, var(--ui-status-danger) 78%, var(--ui-text-1));
}

.accounts-history-metric-skipped {
  background: color-mix(in srgb, var(--ui-status-warning) 10%, transparent);
  color: color-mix(in srgb, var(--ui-status-warning) 78%, var(--ui-text-1));
}

@keyframes accounts-history-card-copied {
  0% {
    transform: translateY(0) scale(1);
  }
  38% {
    transform: translateY(-4px) scale(1.015);
  }
  100% {
    transform: translateY(0) scale(1);
  }
}

.accounts-meta-pill,
.accounts-info-pill {
  border-radius: 999px;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.accounts-meta-pill {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.accounts-info-pill,
.accounts-column-note {
  border: 1px solid color-mix(in srgb, var(--ui-status-info) 20%, transparent) !important;
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--ui-status-info) 7%, var(--ui-bg-surface-raised) 93%) !important;
  color: color-mix(in srgb, var(--ui-status-info) 72%, var(--ui-text-1)) !important;
  line-height: 1.5;
}

.accounts-column-note {
  padding: 0.5rem 0.75rem;
  font-size: 0.6875rem;
}

.accounts-column-row {
  color: var(--ui-text-1);
}

.accounts-column-row:hover {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.accounts-column-visibility {
  display: inline-flex;
  height: 1.25rem;
  width: 1.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-size: 0.75rem;
}

.accounts-column-visibility-on {
  background: var(--ui-brand-soft-15);
  color: color-mix(in srgb, var(--ui-brand-700) 72%, var(--ui-text-1));
}

.accounts-column-visibility-off {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);
  color: var(--ui-text-3);
}

.accounts-selection-box {
  border: 1px solid var(--ui-border-subtle);
}

.accounts-selection-box-active {
  border-color: var(--ui-brand-500) !important;
  background: var(--ui-brand-500) !important;
}

.accounts-selection-box-idle {
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent) !important;
}

.accounts-selection-icon {
  color: var(--ui-text-on-brand) !important;
}

.accounts-avatar-shell {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
}

.accounts-mode-toggle-wrap {
  margin-top: 0.875rem;
  padding-top: 0.875rem;
  border-top: 1px solid color-mix(in srgb, var(--ui-border-subtle) 82%, transparent);
}

.accounts-mode-toggle-wrap-mobile {
  margin-top: 1rem;
}

.accounts-mode-toggle-wrap-table {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
}

.accounts-mode-toggle-group {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: stretch;
  gap: 0.45rem !important;
  width: 100%;
  padding: 0.375rem;
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent),
    0 12px 28px color-mix(in srgb, var(--ui-shadow-panel) 22%, transparent);
}

.accounts-mode-toggle-group-mobile {
  padding: 0.3125rem;
}

:deep(.accounts-mode-toggle-button) {
  width: 100%;
  min-height: 2.5rem;
  justify-content: center;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.875rem;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: 0.01em;
  transition:
    transform 0.18s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

:deep(.accounts-mode-toggle-button:hover) {
  transform: translateY(-1px);
}

:deep(.accounts-mode-toggle-button-mobile) {
  min-height: 2.75rem;
  font-size: 0.875rem;
}

:deep(.accounts-mode-toggle) {
  color: var(--ui-text-2) !important;
}

:deep(.accounts-mode-toggle-idle) {
  border-color: color-mix(in srgb, var(--ui-border-subtle) 88%, transparent);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 68%, transparent) !important;
}

:deep(.accounts-mode-toggle-idle:hover) {
  border-color: color-mix(in srgb, var(--ui-border-strong) 68%, transparent);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 92%, transparent) !important;
  color: var(--ui-text-1) !important;
}

:deep(.accounts-mode-toggle-active) {
  box-shadow:
    0 10px 20px color-mix(in srgb, var(--ui-shadow-panel) 42%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-text-1) 12%, transparent) !important;
}

:deep(.accounts-mode-toggle-main) {
  border-color: color-mix(in srgb, var(--ui-brand-500) 28%, transparent);
  background: color-mix(in srgb, var(--ui-brand-500) 14%, transparent) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 76%, var(--ui-text-1)) !important;
}

:deep(.accounts-mode-toggle-alt) {
  border-color: color-mix(in srgb, var(--ui-status-warning) 26%, transparent);
  background: color-mix(in srgb, var(--ui-status-warning) 12%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 76%, var(--ui-text-1)) !important;
}

:deep(.accounts-mode-toggle-safe) {
  border-color: color-mix(in srgb, var(--ui-status-success) 26%, transparent);
  background: color-mix(in srgb, var(--ui-status-success) 12%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 76%, var(--ui-text-1)) !important;
}

.accounts-runtime-dot-online {
  background: var(--ui-status-success) !important;
}

.accounts-runtime-dot-starting {
  background: var(--ui-status-warning) !important;
}

.accounts-runtime-dot-offline {
  background: color-mix(in srgb, var(--ui-text-2) 40%, transparent) !important;
}

.accounts-runtime-button {
  border: 1px solid transparent !important;
  box-shadow: 0 10px 18px color-mix(in srgb, var(--ui-shadow-panel) 65%, transparent) !important;
}

.accounts-runtime-button-start {
  border-color: color-mix(in srgb, var(--ui-status-success) 22%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 80%, var(--ui-text-1)) !important;
}

.accounts-runtime-button-stop {
  border-color: color-mix(in srgb, var(--ui-status-danger) 22%, transparent) !important;
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 80%, var(--ui-text-1)) !important;
}

.accounts-safe-check {
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 78%, var(--ui-text-1)) !important;
}

.accounts-safe-check:hover {
  background: color-mix(in srgb, var(--ui-status-success) 16%, transparent) !important;
}

.accounts-icon-danger {
  color: var(--ui-status-danger) !important;
}

.accounts-icon-danger:hover {
  color: color-mix(in srgb, var(--ui-status-danger) 82%, white 18%) !important;
}

.accounts-table-row {
  border-color: var(--ui-border-subtle) !important;
}

.accounts-table-row:hover {
  background: color-mix(in srgb, var(--ui-bg-surface) 54%, transparent) !important;
}

.accounts-table-row-current {
  background: var(--ui-brand-soft-05) !important;
}

.accounts-error-banner,
.accounts-error-pill {
  border: 1px solid color-mix(in srgb, var(--ui-status-danger) 18%, transparent) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-status-danger) 8%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 82%, var(--ui-text-1)) !important;
}

.accounts-error-pill {
  border-radius: 999px;
}

.accounts-card-current {
  border-color: color-mix(in srgb, var(--ui-brand-500) 42%, transparent) !important;
  background: var(--ui-brand-soft-05) !important;
}

.accounts-card-glow-mine:hover {
  border-color: color-mix(in srgb, var(--ui-brand-500) 30%, transparent) !important;
}

.accounts-card-glow-user:hover {
  border-color: color-mix(in srgb, var(--ui-status-warning) 28%, transparent) !important;
}

.accounts-card-glow-admin:hover {
  border-color: color-mix(in srgb, var(--ui-status-info) 28%, transparent) !important;
}

.accounts-card-glow-unowned:hover {
  border-color: color-mix(in srgb, var(--ui-text-2) 22%, transparent) !important;
}

.accounts-badge-owner-mine,
.accounts-badge-mode-main {
  background: var(--ui-brand-soft-12) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 78%, var(--ui-text-1)) !important;
}

.accounts-badge-owner-user,
.accounts-badge-mode-alt,
.accounts-badge-history-partial,
.accounts-badge-runtime-starting {
  background: color-mix(in srgb, var(--ui-status-warning) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 80%, var(--ui-text-1)) !important;
}

.accounts-badge-owner-admin,
.accounts-badge-execution-hit {
  background: color-mix(in srgb, var(--ui-status-info) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-info) 80%, var(--ui-text-1)) !important;
}

.accounts-badge-owner-unowned,
.accounts-badge-runtime-offline,
.accounts-badge-execution-independent {
  background: color-mix(in srgb, var(--ui-text-2) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-text-2) 82%, var(--ui-text-1)) !important;
}

.accounts-badge-current {
  background: color-mix(in srgb, var(--ui-brand-500) 12%, transparent) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 82%, var(--ui-text-1)) !important;
}

.accounts-badge-mode-safe,
.accounts-badge-history-success,
.accounts-badge-runtime-online {
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 80%, var(--ui-text-1)) !important;
}

.accounts-badge-history-error {
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 80%, var(--ui-text-1)) !important;
}

.accounts-mode-note-warning {
  color: color-mix(in srgb, var(--ui-status-warning) 78%, var(--ui-text-1)) !important;
}

.accounts-mode-note-info {
  color: color-mix(in srgb, var(--ui-status-info) 74%, var(--ui-text-1)) !important;
}

.accounts-mode-note-muted {
  color: var(--ui-text-2) !important;
}

.accounts-page [class*='border-'][class*='white/8'],
.accounts-page [class*='border-'][class*='white/10'],
.accounts-page [class*='border-'][class*='gray-200/50'],
.accounts-page [class*='border-'][class*='gray-700/50'] {
  border-color: var(--ui-border-subtle) !important;
}

.accounts-page [class*='bg-'][class*='black/10'],
.accounts-page [class*='bg-'][class*='black/8'],
.accounts-page [class*='bg-'][class*='black/[0.04]'],
.accounts-page [class*='bg-'][class*='white/12'],
.accounts-page [class*='bg-'][class*='white/10'] {
  background: color-mix(in srgb, var(--ui-bg-surface) 58%, transparent) !important;
}

.accounts-page [class*='hover:bg-'][class*='white/8']:hover,
.accounts-page [class*='hover:bg-'][class*='black/10']:hover,
.accounts-page [class*='hover:bg-'][class*='black/5']:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent) !important;
}

.accounts-page [class*='shadow-']:not([class*='shadow-inner']) {
  box-shadow: 0 10px 26px var(--ui-shadow-panel) !important;
}

.accounts-page [class*='bg-primary-50/50'],
.accounts-page [class*='bg-primary-500/[0.05]'] {
  background: color-mix(in srgb, var(--ui-brand-500) 12%, transparent) !important;
}

.accounts-page .accounts-table-head {
  background: color-mix(in srgb, var(--ui-bg-canvas) 90%, transparent) !important;
}

.accounts-page .accounts-card-shell {
  box-shadow: 0 20px 52px var(--ui-shadow-panel) !important;
}

.accounts-page .accounts-card-current {
  box-shadow: 0 0 24px color-mix(in srgb, var(--ui-brand-500) 20%, transparent) !important;
}

.accounts-page .accounts-card-idle {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent),
    color-mix(in srgb, var(--ui-bg-surface) 82%, transparent)
  ) !important;
}

.accounts-page .accounts-card-overlay {
  background: radial-gradient(
    circle at top left,
    color-mix(in srgb, var(--ui-text-on-brand) 16%, transparent),
    transparent 62%
  ) !important;
}

.accounts-page [class*='text-red-300'] {
  color: var(--ui-status-danger) !important;
}

.accounts-page [class*='bg-red-500/8'],
.accounts-page [class*='bg-red-500/10'],
.accounts-page [class*='bg-red-500/14'] {
  background: var(--ui-status-danger-soft) !important;
}

.accounts-page .sticky.top-0 {
  background: color-mix(in srgb, var(--ui-bg-canvas) 88%, transparent) !important;
  color: var(--ui-text-1) !important;
}
</style>
