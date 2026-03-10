<script setup lang="ts">
import type { CopyInteractionOptions } from '@/composables/use-copy-interaction'
import { computed, markRaw, onMounted, ref, watch } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import BaseActionButtons from '@/components/ui/BaseActionButtons.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseBulkActions from '@/components/ui/BaseBulkActions.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import BaseDataTable from '@/components/ui/BaseDataTable.vue'
import BaseDataTableHead from '@/components/ui/BaseDataTableHead.vue'
import BaseDataTableSelectionCell from '@/components/ui/BaseDataTableSelectionCell.vue'
import BaseDataTableSelectionHeader from '@/components/ui/BaseDataTableSelectionHeader.vue'
import BaseDataTableStateRow from '@/components/ui/BaseDataTableStateRow.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import BaseFilterFields from '@/components/ui/BaseFilterFields.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseManagementPageScaffold from '@/components/ui/BaseManagementPageScaffold.vue'
import BasePaginationBar from '@/components/ui/BasePaginationBar.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSelectionSummary from '@/components/ui/BaseSelectionSummary.vue'
import BaseStatCard from '@/components/ui/BaseStatCard.vue'
import BaseStatCardGrid from '@/components/ui/BaseStatCardGrid.vue'
import BaseTableSectionCard from '@/components/ui/BaseTableSectionCard.vue'
import BaseTableToolbar from '@/components/ui/BaseTableToolbar.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import { useCopyInteraction } from '@/composables/use-copy-interaction'
import { useViewPreferenceSync } from '@/composables/use-view-preference-sync'
import { useToastStore } from '@/stores/toast'
import { createActionButton, createActionButtons, createFilterFields, createInputField, createPageHeaderText, createSelectField, createStatCard, createStatCards } from '@/utils/management-schema'
import { localizeRuntimeText } from '@/utils/runtime-text'
import { DEFAULT_CARDS_VIEW_STATE, normalizeCardsViewState } from '@/utils/view-preferences'

interface BatchOption {
  value: string
  label: string
}

interface CardLogSnapshot {
  code?: string
  batchNo?: string | null
  batchName?: string | null
  type?: string
  days?: number | null
  description?: string
  source?: string
  channel?: string
  note?: string
  createdBy?: string | null
  enabled?: boolean
  usedBy?: string | null
  usedAt?: number | null
  expiresAt?: number | null
  createdAt?: number | null
  updatedAt?: number | null
}

interface CardLog {
  id: number
  action: string
  operator: string | null
  targetUsername: string | null
  remark: string | null
  beforeSnapshot: CardLogSnapshot | null
  afterSnapshot: CardLogSnapshot | null
  createdAt: number | null
}

interface Card {
  id?: number
  code: string
  batchNo: string | null
  batchName: string | null
  description: string
  type: string
  typeChar: string
  days: number | null
  source: string
  channel: string
  note: string
  createdBy: string | null
  enabled: boolean
  usedBy: string | null
  usedAt: number | null
  createdAt: number
  updatedAt: number | null
  expiresAt: number | null
  status: string
  statusLabel: string
  statusTone: string
  isUsed: boolean
  isExpired: boolean
  canDelete: boolean
  canToggleEnabled: boolean
  canEditType: boolean
}

interface CardsSummary {
  total: number
  unused: number
  disabled: number
  used: number
  usedActive: number
  usedExpiring: number
  usedExpired: number
  usedForever: number
  trial: number
  permanent: number
  batches: number
}

interface FilterOptions {
  sources: string[]
  creators: string[]
  batches: BatchOption[]
}

const toast = useToastStore()
const {
  copiedHistoryId: copiedCardCode,
  copiedControlKey,
  copyText: copyWithFeedback,
} = useCopyInteraction()

const CARD_TYPE_OPTIONS = [
  { value: 'D', label: '天卡', defaultDays: 1 },
  { value: 'W', label: '周卡', defaultDays: 7 },
  { value: 'M', label: '月卡', defaultDays: 30 },
  { value: 'F', label: '永久卡', defaultDays: null },
  { value: 'T', label: '体验卡', defaultDays: 1 },
]

const CARD_SOURCE_LABELS: Record<string, string> = {
  manual: '手动生成',
  trial_public: '公开体验卡',
  trial_renew: '体验卡续费',
  admin_grant: '管理员发放',
  campaign: '活动投放',
  compensation: '补偿发放',
  import: '批量导入',
  custom: '自定义来源',
  system: '系统生成',
}

const ACTION_LABELS: Record<string, string> = {
  create: '生成卡密',
  update: '更新卡密',
  delete: '删除卡密',
  register_use: '注册使用',
  renew_use: '续费使用',
}

const statusFilterOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'unused', label: '待使用' },
  { value: 'disabled', label: '已禁用' },
  { value: 'used', label: '已使用' },
  { value: 'used_active', label: '已使用生效中' },
  { value: 'used_expiring', label: '即将到期' },
  { value: 'used_expired', label: '已过期' },
  { value: 'used_forever', label: '永久生效' },
]

const generateSourceOptions = [
  { value: 'manual', label: '手动生成' },
  { value: 'admin_grant', label: '管理员发放' },
  { value: 'campaign', label: '活动投放' },
  { value: 'compensation', label: '补偿发放' },
  { value: 'import', label: '批量导入' },
  { value: 'custom', label: '自定义来源' },
]

const pageSizeOptions = [
  { value: 10, label: '10 条/页' },
  { value: 20, label: '20 条/页' },
  { value: 50, label: '50 条/页' },
  { value: 100, label: '100 条/页' },
]

function createEmptySummary(): CardsSummary {
  return {
    total: 0,
    unused: 0,
    disabled: 0,
    used: 0,
    usedActive: 0,
    usedExpiring: 0,
    usedExpired: 0,
    usedForever: 0,
    trial: 0,
    permanent: 0,
    batches: 0,
  }
}

const cards = ref<Card[]>([])
const summary = ref<CardsSummary>(createEmptySummary())
const filterOptions = ref<FilterOptions>({
  sources: [],
  creators: [],
  batches: [],
})
const loading = ref(false)
const detailLoading = ref(false)
const actionLoading = ref(false)
const batchActionLoading = ref(false)
const actionError = ref('')

const selectedCards = ref<string[]>([])
const page = ref(1)
const pageSize = ref(20)
const CARDS_SESSION_PREF_NOTE = '这里的筛选条件、每页数量和当前页码会跟随当前登录用户同步到服务器；批量勾选状态仍只在当前会话内生效。'

const filters = ref({
  keyword: '',
  type: 'all',
  status: 'all',
  source: 'all',
  batchNo: 'all',
  createdBy: 'all',
})

const showGenerateModal = ref(false)
const showEditModal = ref(false)
const showDetailModal = ref(false)
const showActionConfirmModal = ref(false)
const editingCard = ref<Card | null>(null)
const detailCard = ref<Card | null>(null)
const detailLogs = ref<CardLog[]>([])
const generatedCards = ref<Card[]>([])
const actionConfirmMessage = ref('')
const actionConfirmLoading = ref(false)
const actionConfirmHandler = ref<null | (() => Promise<void>)>(null)

const newCard = ref({
  description: '',
  type: 'M',
  days: 30,
  count: 1,
  batchName: '',
  source: 'manual',
  channel: '',
  note: '',
})

const editCardForm = ref({
  description: '',
  type: 'M',
  days: 30,
  batchNo: '',
  batchName: '',
  source: 'manual',
  channel: '',
  note: '',
  enabled: true,
})

const cardTypeSelectOptions = CARD_TYPE_OPTIONS.map(option => ({
  value: option.value,
  label: option.defaultDays ? `${option.label} (${option.defaultDays}天)` : option.label,
}))

const sourceFilterSelectOptions = computed(() => {
  const values = new Set<string>(generateSourceOptions.map(option => String(option.value)))
  filterOptions.value.sources.forEach(source => values.add(source))
  return [
    { value: 'all', label: '全部来源' },
    ...Array.from(values).sort().map(source => ({
      value: source,
      label: formatCardSource(source),
    })),
  ]
})

const batchFilterSelectOptions = computed(() => {
  return [
    { value: 'all', label: '全部批次' },
    ...filterOptions.value.batches,
  ]
})

const creatorFilterSelectOptions = computed(() => {
  return [
    { value: 'all', label: '全部创建人' },
    ...filterOptions.value.creators.map(name => ({ value: name, label: name })),
  ]
})

const cardsFilterInputComponent = markRaw(BaseInput)
const cardsFilterSelectComponent = markRaw(BaseSelect)

const filterFields = computed(() => createFilterFields([
  createInputField({
    key: 'keyword',
    component: cardsFilterInputComponent,
    modelValue: filters.value.keyword,
    label: '搜索',
    placeholder: '卡密 / 描述 / 用户 / 批次 / 备注',
    clearable: true,
    onUpdate: (value: unknown) => {
      filters.value.keyword = String(value ?? '')
    },
  }),
  createSelectField({
    key: 'type',
    component: cardsFilterSelectComponent,
    modelValue: filters.value.type,
    label: '卡密类型',
    options: [{ value: 'all', label: '全部类型' }, ...cardTypeSelectOptions],
    onUpdate: (value: unknown) => {
      filters.value.type = String(value || 'all')
    },
  }),
  createSelectField({
    key: 'status',
    component: cardsFilterSelectComponent,
    modelValue: filters.value.status,
    label: '状态',
    options: statusFilterOptions,
    onUpdate: (value: unknown) => {
      filters.value.status = String(value || 'all')
    },
  }),
  createSelectField({
    key: 'source',
    component: cardsFilterSelectComponent,
    modelValue: filters.value.source,
    label: '来源',
    options: sourceFilterSelectOptions.value,
    onUpdate: (value: unknown) => {
      filters.value.source = String(value || 'all')
    },
  }),
  createSelectField({
    key: 'batch',
    component: cardsFilterSelectComponent,
    modelValue: filters.value.batchNo,
    label: '批次',
    options: batchFilterSelectOptions.value,
    onUpdate: (value: unknown) => {
      filters.value.batchNo = String(value || 'all')
    },
  }),
  createSelectField({
    key: 'creator',
    component: cardsFilterSelectComponent,
    modelValue: filters.value.createdBy,
    label: '创建人',
    options: creatorFilterSelectOptions.value,
    onUpdate: (value: unknown) => {
      filters.value.createdBy = String(value || 'all')
    },
  }),
]))

const filteredCards = computed(() => {
  const keyword = filters.value.keyword.trim().toLowerCase()

  return cards.value.filter((card) => {
    const keywordMatched = !keyword || [
      card.code,
      card.description,
      card.batchNo || '',
      card.batchName || '',
      card.source || '',
      card.channel || '',
      card.note || '',
      card.createdBy || '',
      card.usedBy || '',
    ].some(value => String(value).toLowerCase().includes(keyword))

    const typeMatched = filters.value.type === 'all' || card.type === filters.value.type
    const statusMatched = matchStatus(card, filters.value.status)
    const sourceMatched = filters.value.source === 'all' || card.source === filters.value.source
    const batchMatched = filters.value.batchNo === 'all' || card.batchNo === filters.value.batchNo
    const creatorMatched = filters.value.createdBy === 'all' || card.createdBy === filters.value.createdBy

    return keywordMatched && typeMatched && statusMatched && sourceMatched && batchMatched && creatorMatched
  })
})

const summaryCards = computed(() => createStatCards([
  createStatCard({
    key: 'total',
    label: '总卡密',
    value: String(summary.value.total),
    description: `当前筛选后 ${filteredCards.value.length} 条`,
  }),
  createStatCard({
    key: 'unused',
    label: '待使用 / 禁用',
    value: String(summary.value.unused),
    description: `禁用 ${summary.value.disabled} 张`,
  }),
  createStatCard({
    key: 'used',
    label: '已使用',
    value: String(summary.value.used),
    description: `生效中 ${summary.value.usedActive} / 即将到期 ${summary.value.usedExpiring}`,
  }),
  createStatCard({
    key: 'expired',
    label: '过期 / 永久',
    value: String(summary.value.usedExpired),
    description: `永久生效 ${summary.value.usedForever} / 永久卡 ${summary.value.permanent}`,
  }),
  createStatCard({
    key: 'batch',
    label: '批次 / 体验卡',
    value: String(summary.value.batches),
    description: `体验卡 ${summary.value.trial} 张`,
  }),
]))

const filterToolbarActions = computed(() => createActionButtons([
  createActionButton({
    key: 'reset-filters',
    label: '重置筛选',
    variant: 'outline',
    size: 'sm',
    onClick: () => {
      resetFilters()
    },
  }),
]))

const selectionActions = computed(() => createActionButtons([
  createActionButton({
    key: 'batch-enable',
    label: '批量启用',
    variant: 'outline',
    size: 'sm',
    disabled: selectedCards.value.length === 0,
    loading: batchActionLoading.value,
    onClick: () => {
      batchSetEnabled(true)
    },
  }),
  createActionButton({
    key: 'batch-disable',
    label: '批量禁用',
    variant: 'outline',
    size: 'sm',
    disabled: selectedCards.value.length === 0,
    loading: batchActionLoading.value,
    onClick: () => {
      batchSetEnabled(false)
    },
  }),
  createActionButton({
    key: 'batch-delete',
    label: '批量删除',
    variant: 'danger',
    size: 'sm',
    disabled: selectedCards.value.length === 0,
    loading: batchActionLoading.value,
    onClick: () => {
      batchDelete()
    },
  }),
]))

const pageHeaderActions = computed(() => createActionButtons([
  createActionButton({
    key: 'refresh-cards',
    label: '刷新列表',
    variant: 'outline',
    size: 'sm',
    loading: loading.value,
    onClick: () => {
      loadCards()
    },
  }),
  createActionButton({
    key: 'generate-cards',
    label: '生成卡密',
    variant: 'primary',
    size: 'sm',
    onClick: () => {
      openGenerateModal()
    },
  }),
]))

const pageHeaderText = createPageHeaderText({
  key: 'cards-page-header',
  title: '卡密管理',
  description: '提供卡密统计、筛选、批量操作、批次管理和使用历史追踪',
  titleClass: 'glass-text-main',
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCards.value.length / Number(pageSize.value || 20))))

const pagedCards = computed(() => {
  const start = (page.value - 1) * Number(pageSize.value || 20)
  return filteredCards.value.slice(start, start + Number(pageSize.value || 20))
})

const visibleCodes = computed(() => pagedCards.value.map(card => card.code))
const allVisibleSelected = computed(() => visibleCodes.value.length > 0 && visibleCodes.value.every(code => selectedCards.value.includes(code)))

watch(() => newCard.value.type, (nextType) => {
  const option = CARD_TYPE_OPTIONS.find(item => item.value === nextType)
  if (option && option.defaultDays !== null) {
    newCard.value.days = option.defaultDays
  }
})

watch(() => editCardForm.value.type, (nextType) => {
  const option = CARD_TYPE_OPTIONS.find(item => item.value === nextType)
  if (option && option.defaultDays !== null && editingCard.value?.canEditType) {
    editCardForm.value.days = option.defaultDays
  }
})

watch(filters, () => {
  page.value = 1
  selectedCards.value = []
}, { deep: true })

watch(pageSize, () => {
  page.value = 1
  selectedCards.value = []
})

watch(totalPages, (nextTotalPages) => {
  if (page.value > nextTotalPages) {
    page.value = nextTotalPages
  }
})

function buildCardsViewState() {
  return normalizeCardsViewState({
    ...filters.value,
    page: page.value,
    pageSize: pageSize.value,
  }, DEFAULT_CARDS_VIEW_STATE)
}

const {
  hydrating: cardsViewHydrating,
  hydrate: hydrateCardsViewState,
  enableSync: enableCardsViewSync,
} = useViewPreferenceSync({
  key: 'cardsViewState',
  label: '卡密页视图偏好',
  buildState: buildCardsViewState,
  applyState: applyCardsViewState,
  defaultState: DEFAULT_CARDS_VIEW_STATE,
})

function applyCardsViewState(state: Partial<typeof DEFAULT_CARDS_VIEW_STATE> | null | undefined) {
  const normalized = normalizeCardsViewState(state, DEFAULT_CARDS_VIEW_STATE)
  cardsViewHydrating.value = true
  filters.value = {
    keyword: normalized.keyword,
    type: normalized.type,
    status: normalized.status,
    source: normalized.source,
    batchNo: normalized.batchNo,
    createdBy: normalized.createdBy,
  }
  page.value = normalized.page
  pageSize.value = normalized.pageSize
  cardsViewHydrating.value = false
}

onMounted(async () => {
  await Promise.all([
    loadCards(),
    hydrateCardsViewState(),
  ])
  enableCardsViewSync()
})

async function loadCards() {
  loading.value = true
  try {
    const res = await api.get('/api/cards')
    cards.value = res.data.cards || []
    summary.value = { ...createEmptySummary(), ...(res.data.summary || {}) }
    filterOptions.value = {
      sources: res.data.filterOptions?.sources || [],
      creators: res.data.filterOptions?.creators || [],
      batches: res.data.filterOptions?.batches || [],
    }
  }
  finally {
    loading.value = false
  }
}

function matchStatus(card: Card, status: string) {
  if (status === 'all')
    return true
  if (status === 'used')
    return card.isUsed
  return card.status === status
}

function resetFilters() {
  filters.value = {
    keyword: '',
    type: 'all',
    status: 'all',
    source: 'all',
    batchNo: 'all',
    createdBy: 'all',
  }
}

function toggleSelectAllVisible() {
  if (allVisibleSelected.value) {
    selectedCards.value = selectedCards.value.filter(code => !visibleCodes.value.includes(code))
    return
  }

  const merged = new Set([...selectedCards.value, ...visibleCodes.value])
  selectedCards.value = Array.from(merged)
}

function openGenerateModal() {
  newCard.value = {
    description: '',
    type: 'M',
    days: 30,
    count: 1,
    batchName: '',
    source: 'manual',
    channel: '',
    note: '',
  }
  generatedCards.value = []
  actionError.value = ''
  showGenerateModal.value = true
}

function openEditModal(card: Card) {
  editingCard.value = card
  editCardForm.value = {
    description: card.description || '',
    type: card.type,
    days: card.days || 30,
    batchNo: card.batchNo || '',
    batchName: card.batchName || '',
    source: card.source || 'manual',
    channel: card.channel || '',
    note: card.note || '',
    enabled: card.enabled,
  }
  actionError.value = ''
  showEditModal.value = true
}

async function openDetailModal(card: Card) {
  showDetailModal.value = true
  detailLoading.value = true
  detailCard.value = card
  detailLogs.value = []

  try {
    const res = await api.get(`/api/cards/${card.code}`)
    detailCard.value = res.data.card || card
    detailLogs.value = res.data.logs || []
  }
  finally {
    detailLoading.value = false
  }
}

async function generateCards() {
  actionLoading.value = true
  actionError.value = ''

  try {
    const res = await api.post('/api/cards', {
      description: newCard.value.description,
      type: newCard.value.type,
      days: newCard.value.type === 'F' ? null : Number(newCard.value.days),
      count: Number(newCard.value.count),
      batchName: newCard.value.batchName,
      source: newCard.value.source,
      channel: newCard.value.channel,
      note: newCard.value.note,
    })

    generatedCards.value = res.data.cards || []
    await loadCards()
    toast.success(`已生成 ${generatedCards.value.length} 张卡密`)
  }
  catch (error: any) {
    actionError.value = localizeRuntimeText(error.response?.data?.error || error.message || '生成失败')
  }
  finally {
    actionLoading.value = false
  }
}

async function saveEdit() {
  if (!editingCard.value)
    return

  actionLoading.value = true
  actionError.value = ''

  try {
    const res = await api.put(`/api/cards/${editingCard.value.code}`, {
      description: editCardForm.value.description,
      type: editCardForm.value.type,
      days: editCardForm.value.type === 'F' ? null : Number(editCardForm.value.days),
      batchNo: editCardForm.value.batchNo,
      batchName: editCardForm.value.batchName,
      source: editCardForm.value.source,
      channel: editCardForm.value.channel,
      note: editCardForm.value.note,
      enabled: editCardForm.value.enabled,
    })

    showEditModal.value = false
    toast.success('卡密更新成功')
    await loadCards()

    if (detailCard.value?.code === editingCard.value.code) {
      const nextDetailCard = res.data.card || detailCard.value
      if (nextDetailCard) {
        detailCard.value = nextDetailCard
        await openDetailModal(nextDetailCard)
      }
    }
  }
  catch (error: any) {
    actionError.value = localizeRuntimeText(error.response?.data?.error || error.message || '保存失败')
  }
  finally {
    actionLoading.value = false
  }
}

async function performDeleteCard(code: string) {
  try {
    await api.delete(`/api/cards/${code}`)
    selectedCards.value = selectedCards.value.filter(item => item !== code)
    toast.success('卡密删除成功')
    await loadCards()
  }
  catch (error) {
    console.error('删除卡密失败:', error)
  }
}

function openActionConfirm(message: string, handler: () => Promise<void>) {
  actionConfirmMessage.value = message
  actionConfirmHandler.value = handler
  showActionConfirmModal.value = true
}

function closeActionConfirm() {
  if (actionConfirmLoading.value)
    return
  showActionConfirmModal.value = false
  actionConfirmHandler.value = null
  actionConfirmMessage.value = ''
}

async function confirmAction() {
  if (!actionConfirmHandler.value)
    return

  actionConfirmLoading.value = true
  try {
    await actionConfirmHandler.value()
    closeActionConfirm()
  }
  finally {
    actionConfirmLoading.value = false
  }
}

function deleteCard(code: string) {
  openActionConfirm('确定要删除这张卡密吗？已使用卡密不可删除。', () => performDeleteCard(code))
}

async function batchSetEnabled(enabled: boolean) {
  if (selectedCards.value.length === 0)
    return

  batchActionLoading.value = true
  try {
    const res = await api.post('/api/cards/batch-update', {
      codes: selectedCards.value,
      updates: { enabled },
    })

    const updatedCount = res.data.updatedCount || 0
    const skipped = res.data.skipped || []
    toast[skipped.length ? 'warning' : 'success'](`${enabled ? '启用' : '禁用'}完成，成功 ${updatedCount} 张${skipped.length ? `，跳过 ${skipped.length} 张` : ''}`)
    selectedCards.value = []
    await loadCards()
  }
  finally {
    batchActionLoading.value = false
  }
}

async function performBatchDelete(codes: string[]) {
  batchActionLoading.value = true
  try {
    const res = await api.post('/api/cards/batch-delete', {
      codes,
    })

    const deletedCount = res.data.deletedCount || 0
    const skipped = res.data.skipped || []
    toast[skipped.length ? 'warning' : 'success'](`批量删除完成，成功 ${deletedCount} 张${skipped.length ? `，跳过 ${skipped.length} 张` : ''}`)
    selectedCards.value = []
    await loadCards()
  }
  finally {
    batchActionLoading.value = false
  }
}

function batchDelete() {
  if (selectedCards.value.length === 0)
    return

  const codes = [...selectedCards.value]
  openActionConfirm(`确定删除选中的 ${codes.length} 张卡密吗？已使用卡密会自动跳过。`, () => performBatchDelete(codes))
}

function changePage(offset: number) {
  const nextPage = Math.min(totalPages.value, Math.max(1, page.value + offset))
  page.value = nextPage
}

type CopyTextOptions = CopyInteractionOptions

async function copyText(text: string, message: string, options: CopyTextOptions = {}) {
  await copyWithFeedback(text, message, options)
}

function copyToText(code: string) {
  void copyText(code, '卡密已复制', {
    detail: '单张卡密已写入系统剪贴板，可直接分发或发送。',
    historyId: code,
  })
}

function copyAllGenerated() {
  if (!generatedCards.value.length) {
    toast.warning('当前没有可复制的生成结果')
    return
  }
  const content = generatedCards.value.map(card => card.code).join('\n')
  void copyText(content, '本次生成卡密已全部复制', {
    controlKey: 'generated-all',
    detail: `共 ${generatedCards.value.length} 张卡密，已写入系统剪贴板。`,
  })
}

function formatCardType(type: string) {
  return CARD_TYPE_OPTIONS.find(option => option.value === type)?.label || type
}

function formatCardSource(source: string) {
  return CARD_SOURCE_LABELS[source] || source || '未设置'
}

function formatDateTime(timestamp: number | null | undefined) {
  if (!timestamp)
    return '-'

  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatExpiry(card: Card | CardLogSnapshot | null) {
  if (!card)
    return '-'
  if (card.type === 'F' || card.expiresAt == null)
    return '永久'
  return formatDateTime(card.expiresAt)
}

function formatLogAction(action: string) {
  return ACTION_LABELS[action] || action
}

function formatSnapshot(snapshot: CardLogSnapshot | null) {
  if (!snapshot)
    return '-'

  const parts = [
    snapshot.type ? `类型 ${formatCardType(snapshot.type)}` : '',
    snapshot.days != null ? `时长 ${snapshot.days}天` : '',
    snapshot.source ? `来源 ${formatCardSource(snapshot.source)}` : '',
    snapshot.enabled !== undefined ? `可兑换 ${snapshot.enabled ? '是' : '否'}` : '',
    snapshot.usedBy ? `用户 ${snapshot.usedBy}` : '',
    snapshot.expiresAt != null ? `到期 ${formatExpiry(snapshot)}` : '',
  ].filter(Boolean)

  return parts.join(' | ') || '-'
}

function toneClass(tone: string) {
  switch (tone) {
    case 'blue':
      return 'cards-tone cards-tone--info'
    case 'green':
      return 'cards-tone cards-tone--success'
    case 'amber':
      return 'cards-tone cards-tone--warning'
    case 'red':
      return 'cards-tone cards-tone--danger'
    case 'purple':
      return 'cards-tone cards-tone--accent'
    default:
      return 'cards-tone cards-tone--neutral'
  }
}
</script>

<template>
  <BaseManagementPageScaffold
    class="cards-page"
    :header-text="pageHeaderText"
    :header-actions="pageHeaderActions"
  >
    <template #summary>
      <BaseStatCardGrid class="md:grid-cols-2 xl:grid-cols-5">
        <BaseStatCard
          v-for="card in summaryCards"
          :key="card.key"
          :label="card.label"
          :value="card.value"
          :description="card.description"
        />
      </BaseStatCardGrid>
    </template>

    <template #filters>
      <div class="glass-panel ui-filter-panel">
        <BaseFilterFields class="md:grid-cols-2 xl:grid-cols-6" :fields="filterFields" />

        <BaseTableToolbar>
          <template #left>
            <BaseBulkActions>
              <BaseActionButtons :actions="filterToolbarActions" />
              <BaseSelect
                v-model="pageSize"
                label="每页数量"
                :options="pageSizeOptions"
              />
            </BaseBulkActions>
          </template>

          <template #right>
            <BaseBulkActions>
              <BaseSelectionSummary :selected-count="selectedCards.length" unit="张" class="text-sm" />
              <BaseActionButtons :actions="selectionActions" />
            </BaseBulkActions>
          </template>
        </BaseTableToolbar>

        <div class="cards-session-note mt-3 rounded-xl px-3 py-2 text-xs leading-5">
          {{ CARDS_SESSION_PREF_NOTE }}
        </div>
      </div>
    </template>

    <template #table>
      <BaseTableSectionCard
        title="卡密列表"
        description="支持查看批次、来源、状态、到期信息和使用轨迹"
        class="cards-table-section shadow-md"
        header-class="px-5 py-4"
        title-class="glass-text-main text-lg font-semibold"
        description-class="glass-text-muted mt-1 text-xs"
        footer-class="border-b-0 px-5 py-4"
      >
        <template #header-meta>
          <span class="glass-text-muted text-sm">
            第 {{ page }} / {{ totalPages }} 页
          </span>
        </template>

        <template #mobile>
          <div v-if="loading" class="glass-text-muted px-5 pb-5 text-sm md:hidden">
            正在加载卡密列表...
          </div>

          <div v-else-if="pagedCards.length" class="ui-mobile-record-list px-4 pb-4 md:hidden">
            <article
              v-for="card in pagedCards"
              :key="`mobile-${card.code}`"
              class="ui-mobile-record-card"
              :class="{ 'ui-mobile-record-card--selected': selectedCards.includes(card.code) }"
            >
              <div class="ui-mobile-record-head">
                <div class="ui-mobile-record-main">
                  <BaseCheckbox
                    class="ui-mobile-record-check"
                    :model-value="selectedCards"
                    :value="card.code"
                    @update:model-value="selectedCards = $event as string[]"
                  />
                  <div class="ui-mobile-record-body">
                    <div class="ui-mobile-record-badges">
                      <BaseBadge :class="toneClass(card.statusTone)">
                        {{ card.statusLabel }}
                      </BaseBadge>
                      <BaseBadge class="cards-type-badge text-xs">
                        {{ formatCardType(card.type) }}
                      </BaseBadge>
                    </div>
                    <h3 class="ui-mobile-record-title text-[0.95rem] font-mono">
                      {{ card.code }}
                    </h3>
                    <p class="ui-mobile-record-subtitle">
                      {{ card.batchName || card.batchNo || '单卡' }}
                    </p>
                  </div>
                </div>
                <BaseButton
                  variant="ghost"
                  size="sm"
                  class="!px-2"
                  :class="{ 'cards-copy-button-active': copiedCardCode === card.code }"
                  @click.stop="copyToText(card.code)"
                >
                  <span :class="copiedCardCode === card.code ? 'i-carbon-checkmark-filled mr-1 text-sm' : 'i-carbon-copy mr-1 text-sm'" />
                  {{ copiedCardCode === card.code ? '已复制' : '复制' }}
                </BaseButton>
              </div>

              <div class="ui-mobile-record-grid">
                <div class="ui-mobile-record-field ui-mobile-record-field--full">
                  <div class="ui-mobile-record-label">
                    描述 / 备注
                  </div>
                  <div class="ui-mobile-record-value">
                    {{ card.description || '-' }}
                  </div>
                  <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                    {{ card.note || '无备注' }}
                  </div>
                </div>
                <div class="ui-mobile-record-field">
                  <div class="ui-mobile-record-label">
                    来源 / 渠道
                  </div>
                  <div class="ui-mobile-record-value">
                    {{ formatCardSource(card.source) }}
                  </div>
                  <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                    {{ card.channel || '未设置渠道' }}
                  </div>
                </div>
                <div class="ui-mobile-record-field">
                  <div class="ui-mobile-record-label">
                    创建信息
                  </div>
                  <div class="ui-mobile-record-value">
                    {{ card.createdBy || '未记录' }}
                  </div>
                  <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                    {{ formatDateTime(card.createdAt) }}
                  </div>
                </div>
                <div class="ui-mobile-record-field ui-mobile-record-field--full">
                  <div class="ui-mobile-record-label">
                    使用情况
                  </div>
                  <div class="ui-mobile-record-value">
                    {{ card.usedBy || '未使用' }}
                  </div>
                  <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                    {{ card.usedBy ? `使用于 ${formatDateTime(card.usedAt)}，到期 ${formatExpiry(card)}` : '可继续分发或兑换' }}
                  </div>
                </div>
              </div>

              <div class="ui-mobile-record-actions">
                <BaseButton variant="outline" size="sm" @click.stop="openDetailModal(card)">
                  详情
                </BaseButton>
                <BaseButton variant="outline" size="sm" @click.stop="openEditModal(card)">
                  编辑
                </BaseButton>
                <BaseButton
                  variant="danger"
                  size="sm"
                  :disabled="!card.canDelete"
                  @click.stop="deleteCard(card.code)"
                >
                  删除
                </BaseButton>
              </div>
            </article>
          </div>

          <BaseEmptyState v-else class="md:hidden" icon="i-carbon-license-draft">
            <template #title>
              <p class="ui-empty-state__title glass-text-main mt-3 text-sm">
                当前筛选条件下没有卡密
              </p>
            </template>
            <template #description>
              <p class="ui-empty-state__desc glass-text-muted mt-2 text-xs">
                可以调整筛选条件，或者直接生成新的卡密批次。
              </p>
            </template>
          </BaseEmptyState>
        </template>

        <BaseDataTable class="hidden overflow-x-auto md:block" table-class="cards-table min-w-full divide-y">
          <BaseDataTableHead class="cards-table-head">
            <tr>
              <BaseDataTableSelectionHeader
                :checked="allVisibleSelected"
                cell-class="px-4 py-3 text-left"
                @change="toggleSelectAllVisible"
              />
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                卡密 / 批次
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                描述 / 备注
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                类型 / 时长
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                来源 / 渠道
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                状态
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                使用情况
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                创建信息
              </th>
              <th class="glass-text-muted px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                操作
              </th>
            </tr>
          </BaseDataTableHead>

          <tbody class="cards-table-body divide-y">
            <BaseDataTableStateRow
              v-if="loading"
              :colspan="9"
              loading
              loading-label="正在加载卡密列表..."
              cell-class="px-0"
            />

            <tr
              v-for="card in pagedCards"
              :key="card.code"
              class="ui-row-hover"
              :class="selectedCards.includes(card.code) ? 'ui-row-selected' : ''"
            >
              <BaseDataTableSelectionCell
                :model-value="selectedCards"
                :value="card.code"
                cell-class="px-4 py-4 align-top"
                @update:model-value="selectedCards = $event as string[]"
              />

              <td class="px-4 py-4 align-top">
                <div class="flex items-start gap-2">
                  <div>
                    <code class="cards-code-chip glass-text-main rounded-lg px-2 py-1 text-xs font-mono">
                      {{ card.code }}
                    </code>
                    <div class="glass-text-muted mt-2 text-xs">
                      <span v-if="card.batchName || card.batchNo">{{ card.batchName || '未命名批次' }}</span>
                      <span v-else>单卡</span>
                    </div>
                    <div v-if="card.batchNo" class="glass-text-muted mt-1 text-[11px] font-mono">
                      {{ card.batchNo }}
                    </div>
                  </div>
                  <button
                    class="cards-copy-action"
                    :class="{ 'cards-copy-action-active': copiedCardCode === card.code }"
                    :title="copiedCardCode === card.code ? '卡密已复制' : '复制卡密'"
                    @click="copyToText(card.code)"
                  >
                    <div :class="copiedCardCode === card.code ? 'i-carbon-checkmark-filled text-lg' : 'i-carbon-copy text-lg'" />
                  </button>
                </div>
              </td>

              <td class="px-4 py-4 align-top">
                <div class="glass-text-main text-sm">
                  {{ card.description || '-' }}
                </div>
                <div class="glass-text-muted mt-2 max-w-[240px] text-xs leading-5">
                  {{ card.note || '无备注' }}
                </div>
              </td>

              <td class="px-4 py-4 align-top">
                <div class="glass-text-main text-sm font-medium">
                  {{ formatCardType(card.type) }}
                </div>
                <div class="glass-text-muted mt-2 text-xs">
                  {{ card.type === 'F' ? '永久有效' : `${card.days} 天` }}
                </div>
              </td>

              <td class="px-4 py-4 align-top">
                <div class="glass-text-main text-sm">
                  {{ formatCardSource(card.source) }}
                </div>
                <div class="glass-text-muted mt-2 text-xs">
                  {{ card.channel || '未设置渠道' }}
                </div>
              </td>

              <td class="px-4 py-4 align-top">
                <BaseBadge :class="toneClass(card.statusTone)">
                  {{ card.statusLabel }}
                </BaseBadge>
                <div class="glass-text-muted mt-2 text-xs">
                  {{ card.canToggleEnabled ? (card.enabled ? '可兑换' : '不可兑换') : '已进入历史记录' }}
                </div>
              </td>

              <td class="px-4 py-4 align-top text-sm">
                <div v-if="card.usedBy" class="space-y-1">
                  <div class="glass-text-main">
                    {{ card.usedBy }}
                  </div>
                  <div class="glass-text-muted text-xs">
                    使用于 {{ formatDateTime(card.usedAt) }}
                  </div>
                  <div class="glass-text-muted text-xs">
                    到期 {{ formatExpiry(card) }}
                  </div>
                </div>
                <div v-else class="glass-text-muted text-xs">
                  未使用
                </div>
              </td>

              <td class="px-4 py-4 align-top text-sm">
                <div class="glass-text-main">
                  {{ card.createdBy || '未记录' }}
                </div>
                <div class="glass-text-muted mt-2 text-xs">
                  创建 {{ formatDateTime(card.createdAt) }}
                </div>
                <div class="glass-text-muted mt-1 text-xs">
                  更新 {{ formatDateTime(card.updatedAt) }}
                </div>
              </td>

              <td class="px-4 py-4 align-top">
                <div class="flex flex-wrap gap-2">
                  <BaseButton variant="text" size="sm" @click="openDetailModal(card)">
                    详情
                  </BaseButton>
                  <BaseButton variant="text" size="sm" @click="openEditModal(card)">
                    编辑
                  </BaseButton>
                  <BaseButton
                    variant="text"
                    size="sm"
                    :disabled="!card.canDelete"
                    @click="deleteCard(card.code)"
                  >
                    删除
                  </BaseButton>
                </div>
              </td>
            </tr>

            <BaseDataTableStateRow
              v-if="!loading && pagedCards.length === 0"
              :colspan="9"
              icon="i-carbon-license-draft"
              cell-class="px-0"
              empty-class="px-4 py-12"
            >
              <template #title>
                <p class="ui-empty-state__title glass-text-main mt-3 text-sm">
                  当前筛选条件下没有卡密
                </p>
              </template>
              <template #description>
                <p class="ui-empty-state__desc glass-text-muted mt-2 text-xs">
                  可以调整筛选条件，或者直接生成新的卡密批次
                </p>
              </template>
            </BaseDataTableStateRow>
          </tbody>
        </BaseDataTable>

        <template #footer>
          <BasePaginationBar>
            <template #meta>
              <div class="glass-text-muted text-sm">
                共 {{ filteredCards.length }} 张卡密，当前显示 {{ pagedCards.length }} 张
              </div>
            </template>

            <template #controls>
              <BaseButton variant="outline" size="sm" :disabled="page <= 1" @click="changePage(-1)">
                上一页
              </BaseButton>
              <span class="glass-text-main min-w-[88px] text-center text-sm">
                {{ page }} / {{ totalPages }}
              </span>
              <BaseButton variant="outline" size="sm" :disabled="page >= totalPages" @click="changePage(1)">
                下一页
              </BaseButton>
            </template>
          </BasePaginationBar>
        </template>
      </BaseTableSectionCard>
    </template>
  </BaseManagementPageScaffold>

  <ConfirmModal
    v-model:show="showActionConfirmModal"
    title="确认操作"
    confirm-text="确认"
    cancel-text="取消"
    :show-cancel="true"
    :loading="actionConfirmLoading"
    @confirm="confirmAction"
    @cancel="closeActionConfirm"
  >
    <div class="text-left text-sm leading-6">
      {{ actionConfirmMessage }}
    </div>
  </ConfirmModal>

  <ConfirmModal
    v-model:show="showGenerateModal"
    title="生成卡密"
    confirm-text="开始生成"
    cancel-text="取消"
    :show-cancel="true"
    :loading="actionLoading"
    @confirm="generateCards"
    @cancel="showGenerateModal = false"
  >
    <div class="text-left space-y-4">
      <BaseInput
        v-model="newCard.description"
        label="描述"
        placeholder="例如：3月活动月卡 / 用户补偿卡"
      />
      <div class="grid gap-4 md:grid-cols-2">
        <BaseSelect v-model="newCard.type" label="卡密类型" :options="cardTypeSelectOptions" />
        <BaseInput v-model="newCard.count" type="number" label="生成数量" />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <BaseInput
          v-if="newCard.type !== 'F'"
          v-model="newCard.days"
          type="number"
          label="生效天数"
        />
        <BaseInput v-model="newCard.batchName" label="批次名称" placeholder="例如：春季活动第一批" />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <BaseSelect v-model="newCard.source" label="来源" :options="generateSourceOptions" />
        <BaseInput v-model="newCard.channel" label="渠道" placeholder="例如：QQ群 / 官网活动页" />
      </div>
      <BaseTextarea v-model="newCard.note" label="备注" placeholder="记录投放说明、适用场景、限制条件" :rows="4" />

      <div v-if="generatedCards.length > 0" class="cards-generated-panel rounded-2xl p-4">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <p class="cards-generated-title text-sm font-semibold">
              已生成 {{ generatedCards.length }} 张卡密
            </p>
            <p class="glass-text-muted mt-1 text-xs">
              这批卡密已自动归入同一批次，便于后续筛选和批量管理
            </p>
          </div>
          <BaseButton
            variant="text"
            size="sm"
            :class="{ 'cards-copy-button-active': copiedControlKey === 'generated-all' }"
            @click="copyAllGenerated"
          >
            <span :class="copiedControlKey === 'generated-all' ? 'i-carbon-checkmark-filled mr-1 text-sm' : 'i-carbon-copy mr-1 text-sm'" />
            {{ copiedControlKey === 'generated-all' ? '已复制全部' : '复制全部' }}
          </BaseButton>
        </div>
        <div class="cards-generated-list max-h-48 overflow-y-auto rounded-xl p-3 space-y-2">
          <div
            v-for="card in generatedCards"
            :key="card.code"
            class="flex items-center justify-between gap-3 rounded-lg px-2 py-1"
          >
            <code class="glass-text-main text-xs font-mono">{{ card.code }}</code>
            <button
              class="cards-copy-action"
              :class="{ 'cards-copy-action-active': copiedCardCode === card.code }"
              :title="copiedCardCode === card.code ? '卡密已复制' : '复制卡密'"
              @click="copyToText(card.code)"
            >
              <div :class="copiedCardCode === card.code ? 'i-carbon-checkmark-filled text-base' : 'i-carbon-copy text-base'" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="actionError" class="text-sm text-red-500">
        {{ actionError }}
      </div>
    </div>
  </ConfirmModal>

  <ConfirmModal
    v-model:show="showEditModal"
    title="编辑卡密"
    confirm-text="保存修改"
    cancel-text="取消"
    :show-cancel="true"
    :loading="actionLoading"
    @confirm="saveEdit"
    @cancel="showEditModal = false"
  >
    <div v-if="editingCard" class="text-left space-y-4">
      <div class="cards-edit-code-panel rounded-xl p-3 text-xs">
        <div class="glass-text-muted">
          卡密编码
        </div>
        <code class="glass-text-main mt-2 block font-mono">{{ editingCard.code }}</code>
      </div>
      <BaseInput v-model="editCardForm.description" label="描述" placeholder="卡密用途说明" />
      <div class="grid gap-4 md:grid-cols-2">
        <BaseSelect
          v-model="editCardForm.type"
          label="卡密类型"
          :options="cardTypeSelectOptions"
          :disabled="!editingCard.canEditType"
        />
        <BaseInput
          v-if="editCardForm.type !== 'F'"
          v-model="editCardForm.days"
          type="number"
          label="生效天数"
          :disabled="!editingCard.canEditType"
        />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <BaseInput v-model="editCardForm.batchNo" label="批次号" placeholder="可手动归并批次" />
        <BaseInput v-model="editCardForm.batchName" label="批次名称" placeholder="例如：首发补偿批次" />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <BaseSelect v-model="editCardForm.source" label="来源" :options="generateSourceOptions" />
        <BaseInput v-model="editCardForm.channel" label="渠道" placeholder="例如：公众号 / 社群" />
      </div>
      <BaseTextarea v-model="editCardForm.note" label="备注" placeholder="记录投放目的、异常说明、人工备注" :rows="4" />
      <label class="flex items-center gap-3 text-sm">
        <input
          v-model="editCardForm.enabled"
          type="checkbox"
          class="cards-checkbox h-4 w-4 rounded text-primary-600"
          :disabled="!editingCard.canToggleEnabled"
        >
        <span class="glass-text-main">允许兑换</span>
      </label>
      <p v-if="!editingCard.canToggleEnabled || !editingCard.canEditType" class="text-xs text-amber-500">
        已使用卡密只允许修改管理信息，不允许改类型、时长或重新启用。
      </p>
      <div v-if="actionError" class="text-sm text-red-500">
        {{ actionError }}
      </div>
    </div>
  </ConfirmModal>

  <Teleport to="body">
    <div v-if="showDetailModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="cards-detail-backdrop absolute inset-0 backdrop-blur-sm" @click="showDetailModal = false" />

      <div class="glass-panel relative max-h-[88vh] max-w-5xl w-full overflow-hidden rounded-3xl shadow-2xl">
        <div class="cards-detail-header flex items-center justify-between px-6 py-4">
          <div>
            <h3 class="glass-text-main text-xl font-semibold">
              卡密详情
            </h3>
            <p class="glass-text-muted mt-1 text-xs">
              查看卡密的批次信息、使用信息和操作历史
            </p>
          </div>
          <button class="cards-detail-close rounded-full p-2" @click="showDetailModal = false">
            <div class="i-carbon-close text-xl" />
          </button>
        </div>

        <div class="max-h-[calc(88vh-72px)] overflow-y-auto px-6 py-6">
          <div v-if="detailLoading" class="glass-text-muted py-12 text-center text-sm">
            正在加载卡密详情...
          </div>

          <div v-else-if="detailCard" class="space-y-6">
            <div class="grid gap-4 lg:grid-cols-3">
              <div class="glass-panel rounded-2xl p-4">
                <p class="glass-text-muted text-xs tracking-[0.2em] uppercase">
                  基础信息
                </p>
                <div class="glass-text-main mt-4 text-sm space-y-3">
                  <div>
                    <span class="glass-text-muted">卡密：</span>
                    <code class="cards-code-chip ml-2 rounded px-2 py-1 font-mono">{{ detailCard.code }}</code>
                  </div>
                  <div>
                    <span class="glass-text-muted">类型：</span>
                    <span class="ml-2">{{ formatCardType(detailCard.type) }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">时长：</span>
                    <span class="ml-2">{{ detailCard.type === 'F' ? '永久有效' : `${detailCard.days} 天` }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">描述：</span>
                    <span class="ml-2">{{ detailCard.description || '-' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">备注：</span>
                    <span class="ml-2">{{ detailCard.note || '-' }}</span>
                  </div>
                </div>
              </div>

              <div class="glass-panel rounded-2xl p-4">
                <p class="glass-text-muted text-xs tracking-[0.2em] uppercase">
                  归属与来源
                </p>
                <div class="glass-text-main mt-4 text-sm space-y-3">
                  <div>
                    <span class="glass-text-muted">状态：</span>
                    <span class="ml-2 rounded-full px-2 py-1 text-xs font-medium" :class="toneClass(detailCard.statusTone)">
                      {{ detailCard.statusLabel }}
                    </span>
                  </div>
                  <div>
                    <span class="glass-text-muted">批次：</span>
                    <span class="ml-2">{{ detailCard.batchName || detailCard.batchNo || '-' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">批次号：</span>
                    <span class="ml-2 font-mono">{{ detailCard.batchNo || '-' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">来源：</span>
                    <span class="ml-2">{{ formatCardSource(detailCard.source) }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">渠道：</span>
                    <span class="ml-2">{{ detailCard.channel || '-' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">创建人：</span>
                    <span class="ml-2">{{ detailCard.createdBy || '-' }}</span>
                  </div>
                </div>
              </div>

              <div class="glass-panel rounded-2xl p-4">
                <p class="glass-text-muted text-xs tracking-[0.2em] uppercase">
                  使用信息
                </p>
                <div class="glass-text-main mt-4 text-sm space-y-3">
                  <div>
                    <span class="glass-text-muted">兑换状态：</span>
                    <span class="ml-2">{{ detailCard.canToggleEnabled ? (detailCard.enabled ? '可兑换' : '不可兑换') : '历史卡密' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">使用用户：</span>
                    <span class="ml-2">{{ detailCard.usedBy || '-' }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">使用时间：</span>
                    <span class="ml-2">{{ formatDateTime(detailCard.usedAt) }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">到期时间：</span>
                    <span class="ml-2">{{ formatExpiry(detailCard) }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">创建时间：</span>
                    <span class="ml-2">{{ formatDateTime(detailCard.createdAt) }}</span>
                  </div>
                  <div>
                    <span class="glass-text-muted">更新时间：</span>
                    <span class="ml-2">{{ formatDateTime(detailCard.updatedAt) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="glass-panel rounded-2xl p-5">
              <div class="flex items-center justify-between">
                <div>
                  <h4 class="glass-text-main text-lg font-semibold">
                    操作历史
                  </h4>
                  <p class="glass-text-muted mt-1 text-xs">
                    记录生成、编辑、删除、注册使用、续费使用等关键动作
                  </p>
                </div>
                <span class="glass-text-muted text-sm">
                  共 {{ detailLogs.length }} 条
                </span>
              </div>

              <div v-if="detailLogs.length === 0" class="glass-text-muted py-10 text-center text-sm">
                暂无操作历史
              </div>

              <div v-else class="mt-4 space-y-3">
                <div
                  v-for="log in detailLogs"
                  :key="log.id"
                  class="cards-log-card rounded-2xl p-4"
                >
                  <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="cards-log-action glass-text-main rounded-full px-2 py-1 text-xs">
                        {{ formatLogAction(log.action) }}
                      </span>
                      <span class="glass-text-main text-sm">{{ log.operator || '系统' }}</span>
                      <span v-if="log.targetUsername" class="glass-text-muted text-xs">
                        目标用户：{{ log.targetUsername }}
                      </span>
                    </div>
                    <span class="glass-text-muted text-xs">
                      {{ formatDateTime(log.createdAt) }}
                    </span>
                  </div>

                  <p v-if="log.remark" class="glass-text-main mt-3 text-sm">
                    {{ log.remark }}
                  </p>

                  <div class="grid mt-3 gap-3 lg:grid-cols-2">
                    <div class="cards-log-snapshot rounded-xl p-3">
                      <p class="glass-text-muted text-xs">
                        变更前
                      </p>
                      <p class="glass-text-main mt-2 text-xs leading-5">
                        {{ formatSnapshot(log.beforeSnapshot) }}
                      </p>
                    </div>
                    <div class="cards-log-snapshot rounded-xl p-3">
                      <p class="glass-text-muted text-xs">
                        变更后
                      </p>
                      <p class="glass-text-main mt-2 text-xs leading-5">
                        {{ formatSnapshot(log.afterSnapshot) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cards-page {
  color: var(--ui-text-1);
}

.cards-tone,
.cards-type-badge,
.cards-session-note,
.cards-code-chip,
.cards-generated-list,
.cards-edit-code-panel,
.cards-detail-header,
.cards-log-card,
.cards-log-action,
.cards-log-snapshot {
  border: 1px solid var(--ui-border-subtle) !important;
}

.cards-tone {
  border-radius: 999px;
}

.cards-tone--info {
  background: color-mix(in srgb, var(--ui-status-info) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-info) 78%, var(--ui-text-1)) !important;
}

.cards-tone--success {
  background: color-mix(in srgb, var(--ui-status-success) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-success) 78%, var(--ui-text-1)) !important;
}

.cards-tone--warning {
  background: color-mix(in srgb, var(--ui-status-warning) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-warning) 80%, var(--ui-text-1)) !important;
}

.cards-tone--danger {
  background: color-mix(in srgb, var(--ui-status-danger) 10%, transparent) !important;
  color: color-mix(in srgb, var(--ui-status-danger) 80%, var(--ui-text-1)) !important;
}

.cards-tone--accent {
  background: var(--ui-brand-soft-12) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 76%, var(--ui-text-1)) !important;
}

.cards-tone--neutral {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
  color: var(--ui-text-2) !important;
}

.cards-session-note {
  background: color-mix(in srgb, var(--ui-status-info) 8%, var(--ui-bg-surface)) !important;
  border-color: color-mix(in srgb, var(--ui-status-info) 20%, var(--ui-border-subtle)) !important;
  color: color-mix(in srgb, var(--ui-status-info) 74%, var(--ui-text-1)) !important;
}

.cards-table-head,
.cards-code-chip,
.cards-generated-list,
.cards-edit-code-panel,
.cards-log-card,
.cards-log-snapshot {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
}

.cards-table-head {
  background: color-mix(in srgb, var(--ui-bg-surface) 76%, transparent) !important;
}

.cards-table-body > :not([hidden]) ~ :not([hidden]) {
  border-color: var(--ui-border-subtle) !important;
}

.cards-type-badge {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent) !important;
  color: var(--ui-text-2) !important;
  border-radius: 999px;
}

.cards-code-chip {
  color: var(--ui-text-1) !important;
}

.cards-generated-panel {
  background: color-mix(in srgb, var(--ui-brand-500) 8%, var(--ui-bg-surface)) !important;
  border: 1px solid color-mix(in srgb, var(--ui-brand-500) 20%, var(--ui-border-subtle)) !important;
}

.cards-generated-title {
  color: color-mix(in srgb, var(--ui-brand-700) 74%, var(--ui-text-1)) !important;
}

.cards-copy-action {
  color: var(--ui-text-2) !important;
  transition:
    color 0.2s ease,
    transform 0.2s ease,
    filter 0.2s ease;
}

.cards-copy-action:hover {
  color: var(--ui-brand-600) !important;
}

.cards-copy-action-active {
  color: var(--ui-success-600) !important;
  filter: drop-shadow(0 8px 18px color-mix(in srgb, var(--ui-success-500) 26%, transparent));
  transform: translateY(-1px) scale(1.04);
}

.cards-copy-button-active {
  color: var(--ui-success-700) !important;
}

.cards-checkbox {
  border-color: var(--ui-border-subtle) !important;
  background: var(--ui-bg-surface-raised) !important;
}

.cards-checkbox:checked {
  border-color: var(--ui-brand-500) !important;
  background: var(--ui-brand-500) !important;
}

.cards-checkbox:focus {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-brand-500) 20%, transparent);
}

.cards-detail-backdrop {
  background: var(--ui-overlay-backdrop) !important;
}

.cards-detail-header {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
  border-bottom: 1px solid var(--ui-border-subtle) !important;
}

.cards-detail-close {
  color: var(--ui-text-2) !important;
}

.cards-detail-close:hover {
  color: var(--ui-text-1) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
}

.cards-log-action {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}
</style>
