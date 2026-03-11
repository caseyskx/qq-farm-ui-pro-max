<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { useViewPreferenceSync } from '@/composables/use-view-preference-sync'
import { localizeRuntimeText } from '@/utils/runtime-text'
import { DEFAULT_SYSTEM_LOGS_VIEW_STATE, normalizeSystemLogsViewState } from '@/utils/view-preferences'

const loading = ref(false)
const dataSource = ref<any[]>([])
const total = ref(0)
const detailModalData = ref<any>(null)
const isDetailModalOpen = ref(false)

const pagination = reactive({
  current: 1,
  pageSize: 20,
})

const queryParams = reactive({
  level: '',
  accountId: '',
  keyword: '',
})
const SYSTEM_LOGS_SESSION_PREF_NOTE = '这里的筛选条件和分页页码会跟随当前登录用户同步到服务器；日志内容本身仍来自后端 MySQL 审计表。'
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pagination.pageSize)))
const hasNextPage = computed(() => pagination.current < totalPages.value)

function formatDate(dateStr: string) {
  if (!dateStr)
    return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatLevel(level: string) {
  const value = String(level || '').trim().toLowerCase()
  if (value === 'info')
    return '信息'
  if (value === 'warn')
    return '警告'
  if (value === 'error')
    return '错误'
  return '未知'
}

function getLevelBadgeClass(level: string) {
  const value = String(level || '').trim().toLowerCase()
  if (value === 'error')
    return 'system-logs-level-badge system-logs-level-badge-danger'
  if (value === 'warn')
    return 'system-logs-level-badge system-logs-level-badge-warning'
  if (value === 'info')
    return 'system-logs-level-badge system-logs-level-badge-info'
  return 'system-logs-level-badge system-logs-level-badge-neutral'
}

async function fetchData(page = pagination.current, limit = pagination.pageSize) {
  loading.value = true
  try {
    const res = await api.get('/api/system-logs', {
      params: {
        page,
        limit,
        level: queryParams.level || undefined,
        accountId: queryParams.accountId || undefined,
        keyword: queryParams.keyword || undefined,
      },
    })

    if (res.data && res.data.ok) {
      dataSource.value = res.data.data.items
      total.value = res.data.data.total
      pagination.current = page
      pagination.pageSize = limit
    }
  }
  catch (err: any) {
    console.error('获取日志失败:', err.message)
  }
  finally {
    loading.value = false
  }
}

function buildSystemLogsViewState() {
  return normalizeSystemLogsViewState({
    level: queryParams.level,
    accountId: queryParams.accountId,
    keyword: queryParams.keyword,
    page: pagination.current,
    pageSize: pagination.pageSize,
  }, DEFAULT_SYSTEM_LOGS_VIEW_STATE)
}

const {
  hydrating: systemLogsViewHydrating,
  hydrate: hydrateSystemLogsViewState,
  enableSync: enableSystemLogsViewSync,
} = useViewPreferenceSync({
  key: 'systemLogsViewState',
  label: '系统日志页视图偏好',
  buildState: buildSystemLogsViewState,
  applyState: applySystemLogsViewState,
  defaultState: DEFAULT_SYSTEM_LOGS_VIEW_STATE,
})

function applySystemLogsViewState(state: Partial<typeof DEFAULT_SYSTEM_LOGS_VIEW_STATE> | null | undefined) {
  const normalized = normalizeSystemLogsViewState(state, DEFAULT_SYSTEM_LOGS_VIEW_STATE)
  systemLogsViewHydrating.value = true
  queryParams.level = normalized.level
  queryParams.accountId = normalized.accountId
  queryParams.keyword = normalized.keyword
  pagination.current = normalized.page
  pagination.pageSize = normalized.pageSize
  systemLogsViewHydrating.value = false
}

function prevPage() {
  if (pagination.current > 1) {
    fetchData(pagination.current - 1)
  }
}

function nextPage() {
  if (hasNextPage.value) {
    fetchData(pagination.current + 1)
  }
}

function onSearch() {
  pagination.current = 1
  fetchData()
}

function onReset() {
  queryParams.level = ''
  queryParams.accountId = ''
  queryParams.keyword = ''
  onSearch()
}

function showDetail(record: any) {
  let metaJson = '{}'
  try {
    if (record.meta_data) {
      metaJson = typeof record.meta_data === 'string' ? record.meta_data : JSON.stringify(record.meta_data, null, 2)
    }
  }
  catch {
    // quiet catch
  }

  detailModalData.value = {
    text: localizeRuntimeText(record.text),
    meta: metaJson,
  }
  isDetailModalOpen.value = true
}

onMounted(async () => {
  await hydrateSystemLogsViewState()
  await fetchData(pagination.current, pagination.pageSize)
  enableSystemLogsViewSync()
})
</script>

<template>
  <div class="fade-in ui-page-shell ui-page-stack ui-page-density-compact w-full">
    <div class="ui-page-header">
      <div class="ui-page-header__main">
        <h1 class="ui-page-title flex items-center gap-2">
          <div class="i-carbon-catalog text-primary-400" />
          系统安全日志审计 (冷热归档)
        </h1>
        <p class="ui-page-desc">
          此面板用于检索由后端抛出的 MySQL 固化日志，方便排查农场底层状态及账号降级历史。
        </p>
      </div>
      <div class="ui-page-actions">
        <BaseButton variant="primary" ghost @click="fetchData(pagination.current, pagination.pageSize)">
          <div class="i-carbon-renew mr-2" />
          刷新数据
        </BaseButton>
      </div>
    </div>

    <div class="glass-panel ui-filter-panel ui-mobile-sticky-panel">
      <div class="ui-filter-grid lg:grid-cols-[140px_180px_minmax(0,1fr)_auto]">
        <div class="w-32 flex flex-col gap-1">
          <label class="glass-text-muted text-xs">日志级别</label>
          <select v-model="queryParams.level" class="form-input">
            <option value="">
              全部
            </option>
            <option value="info">
              信息
            </option>
            <option value="warn">
              警告
            </option>
            <option value="error">
              错误
            </option>
          </select>
        </div>
        <div class="w-48 flex flex-col gap-1">
          <label class="glass-text-muted text-xs">账号 ID</label>
          <input v-model="queryParams.accountId" placeholder="精准匹配" class="form-input" @keyup.enter="onSearch">
        </div>
        <div class="min-w-48 flex flex-1 flex-col gap-1">
          <label class="glass-text-muted text-xs">关键词检索</label>
          <input v-model="queryParams.keyword" placeholder="日志内容模糊搜索" class="form-input" @keyup.enter="onSearch">
        </div>
        <div class="flex items-end gap-2">
          <BaseButton variant="primary" @click="onSearch">
            <div class="i-carbon-search mr-1" />查询
          </BaseButton>
          <BaseButton variant="secondary" @click="onReset">
            重置
          </BaseButton>
        </div>
      </div>

      <div class="system-logs-info-banner mt-3 rounded-xl px-3 py-2 text-xs leading-5">
        {{ SYSTEM_LOGS_SESSION_PREF_NOTE }}
      </div>
    </div>

    <div class="glass-panel ui-table-card">
      <div v-if="loading && dataSource.length === 0" class="glass-text-muted px-5 pb-5 text-sm md:hidden">
        <div class="i-svg-spinners-ring-resize mb-2 text-2xl text-primary-500" />
        正在加载日志...
      </div>

      <BaseEmptyState
        v-else-if="dataSource.length === 0"
        class="mx-4 my-6 md:hidden"
        icon="i-carbon-catalog"
        title="暂无匹配日志"
        description="可以调整日志级别、账号 ID 或关键词后再试。"
      />

      <div v-else class="ui-mobile-record-list px-4 pb-4 md:hidden">
        <article
          v-for="record in dataSource"
          :key="`mobile-${record.id}`"
          class="ui-mobile-record-card"
        >
          <div class="ui-mobile-record-head">
            <div class="ui-mobile-record-body">
              <div class="ui-mobile-record-badges">
                <span :class="getLevelBadgeClass(record.level)" class="rounded-full px-2.5 py-1 text-xs font-semibold">
                  {{ formatLevel(record.level) }}
                </span>
                <span class="system-logs-category-tag rounded-full px-2.5 py-1 text-xs font-semibold">
                  {{ record.category || '未分类' }}
                </span>
              </div>
              <h3 class="ui-mobile-record-title line-clamp-3">
                {{ localizeRuntimeText(record.text) }}
              </h3>
              <p class="ui-mobile-record-subtitle">
                {{ formatDate(record.created_at) }}
              </p>
            </div>
          </div>

          <div class="ui-mobile-record-grid">
            <div class="ui-mobile-record-field">
              <div class="ui-mobile-record-label">
                账号 ID
              </div>
              <div class="ui-mobile-record-value font-mono">
                {{ record.account_id || '-' }}
              </div>
            </div>
            <div class="ui-mobile-record-field">
              <div class="ui-mobile-record-label">
                时间
              </div>
              <div class="ui-mobile-record-value">
                {{ formatDate(record.created_at) }}
              </div>
            </div>
            <div class="ui-mobile-record-field ui-mobile-record-field--full">
              <div class="ui-mobile-record-label">
                详情摘要
              </div>
              <div class="ui-mobile-record-value ui-mobile-record-value--muted">
                {{ record.meta_data ? '包含元数据，可展开详情查看 JSON。' : '无附加元数据。' }}
              </div>
            </div>
          </div>

          <div class="ui-mobile-record-actions">
            <BaseButton variant="outline" size="sm" @click="showDetail(record)">
              查看详情
            </BaseButton>
          </div>
        </article>
      </div>

      <div class="hidden overflow-x-auto md:block">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="system-logs-head-row">
              <th class="p-3 font-medium">
                时间
              </th>
              <th class="p-3 font-medium">
                级别
              </th>
              <th class="p-3 font-medium">
                分类
              </th>
              <th class="p-3 font-medium">
                账号 ID
              </th>
              <th class="min-w-64 p-3 font-medium">
                日志内容
              </th>
              <th class="p-3 text-right font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && dataSource.length === 0">
              <td colspan="6" class="glass-text-muted p-8 text-center">
                <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl text-primary-500" />
                正在加载日志...
              </td>
            </tr>
            <tr v-else-if="dataSource.length === 0">
              <td colspan="6" class="glass-text-muted p-8 text-center">
                暂无匹配的系统日志历史
              </td>
            </tr>
            <tr
              v-for="record in dataSource"
              :key="record.id"
              class="system-logs-row transition-colors last:border-0"
            >
              <td class="whitespace-nowrap p-3">
                {{ formatDate(record.created_at) }}
              </td>
              <td class="p-3">
                <span :class="getLevelBadgeClass(record.level)" class="rounded px-2 py-0.5 text-xs font-semibold">
                  {{ formatLevel(record.level) }}
                </span>
              </td>
              <td class="whitespace-nowrap p-3">
                {{ record.category || '-' }}
              </td>
              <td class="whitespace-nowrap p-3 text-xs font-mono">
                {{ record.account_id || '-' }}
              </td>
              <td class="max-w-xs truncate p-3" :title="localizeRuntimeText(record.text)">
                {{ localizeRuntimeText(record.text) }}
              </td>
              <td class="whitespace-nowrap p-3 text-right">
                <button class="text-xs text-primary-500 font-medium underline hover:text-primary-400" @click="showDetail(record)">
                  详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页栏 -->
      <div v-if="total > 0" class="system-logs-footer flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="glass-text-muted text-xs">
          共 {{ total }} 条记录，当前第 {{ pagination.current }} / {{ totalPages }} 页
        </div>
        <div class="flex items-center gap-2">
          <BaseButton variant="secondary" size="sm" :disabled="pagination.current === 1" @click="prevPage">
            上一页
          </BaseButton>
          <span class="px-2 text-sm font-medium">{{ pagination.current }}</span>
          <BaseButton variant="secondary" size="sm" :disabled="!hasNextPage" @click="nextPage">
            下一页
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <div v-if="isDetailModalOpen" class="system-logs-modal-overlay fixed inset-0 z-50 flex items-center justify-center" @click.self="isDetailModalOpen = false">
      <div class="glass-panel max-w-2xl w-full rounded-xl p-6 shadow-2xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold">
            系统日志分析明细
          </h3>
          <button class="system-logs-close i-carbon-close text-xl" @click="isDetailModalOpen = false" />
        </div>
        <div class="space-y-4">
          <div>
            <h4 class="glass-text-muted mb-1 text-sm font-semibold">
              执行记录
            </h4>
            <div class="system-logs-detail-block rounded-lg p-3 text-sm font-mono">
              {{ detailModalData?.text }}
            </div>
          </div>
          <div>
            <h4 class="glass-text-muted mb-1 text-sm font-semibold">
              元数据包 (JSON)
            </h4>
            <pre class="system-logs-detail-block max-h-64 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-xs font-mono">{{ detailModalData?.meta }}</pre>
          </div>
        </div>
        <div class="mt-6 flex justify-end">
          <BaseButton variant="secondary" @click="isDetailModalOpen = false">
            关闭
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-input {
  width: 100%;
  min-height: var(--ui-control-height);
  border-radius: 0.375rem;
  border: 1px solid var(--ui-border-subtle);
  background-color: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  color: inherit;
  outline: none;
  transition: all 0.2s;
}
.dark .form-input {
  background-color: color-mix(in srgb, var(--ui-bg-surface-raised) 68%, transparent);
  border-color: var(--ui-border-subtle);
}
.form-input:focus {
  border-color: color-mix(in srgb, var(--ui-brand-500) 50%, transparent);
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.system-logs-info-banner {
  border: 1px solid color-mix(in srgb, var(--ui-status-info) 24%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-info-soft) 72%, var(--ui-bg-surface-raised));
  color: var(--ui-status-info);
}

.system-logs-head-row,
.system-logs-footer {
  border-color: var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent);
}

.system-logs-row {
  border-bottom: 1px solid var(--ui-border-subtle);
}

.system-logs-row:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 78%, transparent);
}

.system-logs-level-badge {
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--ui-bg-surface) 82%, transparent);
}

.system-logs-level-badge-danger {
  background: color-mix(in srgb, var(--ui-status-danger) 10%, var(--ui-bg-surface-raised));
  color: var(--ui-status-danger);
}

.system-logs-level-badge-warning {
  background: color-mix(in srgb, var(--ui-status-warning) 10%, var(--ui-bg-surface-raised));
  color: var(--ui-status-warning);
}

.system-logs-level-badge-info {
  background: color-mix(in srgb, var(--ui-status-info) 10%, var(--ui-bg-surface-raised));
  color: var(--ui-status-info);
}

.system-logs-level-badge-neutral {
  color: var(--ui-text-2);
}

.system-logs-category-tag {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 76%, transparent);
  color: var(--ui-text-2);
}

.system-logs-modal-overlay {
  background: color-mix(in srgb, var(--ui-overlay-backdrop) 84%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.system-logs-close {
  color: var(--ui-text-2);
  transition: color 160ms ease;
}

.system-logs-close:hover {
  color: var(--ui-text-1);
}

.system-logs-detail-block {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 76%, transparent);
}
</style>
