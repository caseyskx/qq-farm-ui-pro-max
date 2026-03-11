<script setup lang="ts">
import type { MetaBadgeTone } from '@/utils/ui-badge'
import { useIntervalFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import LandCard from '@/components/LandCard.vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { useAccountStore } from '@/stores/account'
import { useFarmStore } from '@/stores/farm'
import { useStatusStore } from '@/stores/status'

const farmStore = useFarmStore()
const accountStore = useAccountStore()
const statusStore = useStatusStore()
const { lands, summary, loading } = storeToRefs(farmStore)
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { status, loading: statusLoading, realtimeConnected } = storeToRefs(statusStore)

const operating = ref(false)
const currentOperatingType = ref('')
const confirmVisible = ref(false)
const confirmConfig = ref({
  title: '',
  message: '',
  opType: '',
})

async function executeOperate() {
  if (!currentAccountId.value || !confirmConfig.value.opType)
    return
  confirmVisible.value = false
  operating.value = true
  currentOperatingType.value = confirmConfig.value.opType
  try {
    await farmStore.operate(currentAccountId.value, confirmConfig.value.opType)
  }
  finally {
    operating.value = false
    currentOperatingType.value = ''
  }
}

function handleOperate(opType: string) {
  if (!currentAccountId.value)
    return

  const confirmMap: Record<string, string> = {
    harvest: '确定要收获所有成熟作物吗？',
    clear: '确定要一键除草/除虫吗？',
    plant: '确定要一键种植吗？(根据策略配置)',
    upgrade: '确定要升级所有可升级的土地吗？(消耗金币)',
    all: '确定要一键全收吗？(包含收获、除草、种植等)',
  }

  confirmConfig.value = {
    title: '确认操作',
    message: confirmMap[opType] || '确定执行此操作吗？',
    opType,
  }
  confirmVisible.value = true
}

const operations = [
  { type: 'harvest', label: '收获', icon: 'i-carbon-wheat', color: 'farm-op-harvest' },
  { type: 'clear', label: '除草/虫', icon: 'i-carbon-clean', color: 'farm-op-clear' },
  { type: 'plant', label: '种植', icon: 'i-carbon-sprout', color: 'farm-op-plant' },
  { type: 'upgrade', label: '升级土地', icon: 'i-carbon-upgrade', color: 'farm-op-upgrade' },
  { type: 'all', label: '一键全收', icon: 'i-carbon-flash', color: 'farm-op-all' },
]

const farmConnectionState = computed(() => {
  if (!currentAccountId.value) {
    return {
      label: '未选择账号',
      badgeTone: 'neutral' as MetaBadgeTone,
      note: '先选择账号，再查看土地和一键操作。',
    }
  }

  if (loading.value || statusLoading.value) {
    return {
      label: '同步中',
      badgeTone: 'info' as MetaBadgeTone,
      note: '正在刷新连接状态和土地数据。',
    }
  }

  if (!status.value?.connection?.connected) {
    return {
      label: '账号离线',
      badgeTone: 'warning' as MetaBadgeTone,
      note: '请先运行账号或检查网络连接。',
    }
  }

  return {
    label: realtimeConnected.value ? '实时在线' : '在线快照',
    badgeTone: 'success' as MetaBadgeTone,
    note: `当前已载入 ${lands.value?.length || 0} 块土地，可直接查看成熟与空闲分布。`,
  }
})

const farmSummaryCards = computed(() => [
  { key: 'harvestable', icon: 'i-carbon-clean', label: '可收', value: summary.value?.harvestable || 0, tone: 'warning' as MetaBadgeTone },
  { key: 'growing', icon: 'i-carbon-sprout', label: '生长', value: summary.value?.growing || 0, tone: 'brand' as MetaBadgeTone },
  { key: 'empty', icon: 'i-carbon-checkbox', label: '空闲', value: summary.value?.empty || 0, tone: 'neutral' as MetaBadgeTone },
  { key: 'dead', icon: 'i-carbon-warning', label: '枯萎', value: summary.value?.dead || 0, tone: 'danger' as MetaBadgeTone },
])

const activeOperationMeta = computed(() => operations.find(op => op.type === currentOperatingType.value) ?? null)

async function refresh() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    if (!realtimeConnected.value) {
      await statusStore.fetchStatus(currentAccountId.value)
    }

    if (acc.running && status.value?.connection?.connected) {
      farmStore.fetchLands(currentAccountId.value)
    }
  }
}

watch(currentAccountId, () => {
  refresh()
})

const { pause, resume } = useIntervalFn(() => {
  if (lands.value) {
    lands.value = lands.value.map((l: any) =>
      l.matureInSec > 0 ? { ...l, matureInSec: l.matureInSec - 1 } : l,
    )
  }
}, 1000)

const { pause: pauseRefresh, resume: resumeRefresh } = useIntervalFn(refresh, 60000)

onMounted(() => {
  refresh()
  resume()
  resumeRefresh()
})

onUnmounted(() => {
  pause()
  pauseRefresh()
})
</script>

<template>
  <div class="farm-panel space-y-4">
    <div class="farm-panel-shell glass-panel rounded-lg shadow-sm">
      <div class="farm-panel-toolbar ui-mobile-sticky-panel">
        <div class="farm-panel-toolbar__head">
          <div class="farm-panel-toolbar__copy">
            <h3 class="glass-text-main flex items-center gap-2 text-lg font-bold">
              <div class="i-carbon-grid text-xl" />
              土地详情
            </h3>
            <p class="farm-panel-toolbar__desc">
              {{ farmConnectionState.note }}
            </p>
          </div>
          <BaseBadge surface="meta" :tone="farmConnectionState.badgeTone" class="farm-panel-state-badge">
            {{ farmConnectionState.label }}
          </BaseBadge>
        </div>

        <div class="farm-panel-summary ui-bulk-actions">
          <BaseBadge
            v-for="item in farmSummaryCards"
            :key="item.key"
            as="div"
            surface="meta"
            :tone="item.tone"
            class="farm-summary-pill"
          >
            <div :class="item.icon" />
            <span class="font-medium">{{ item.label }}: {{ item.value }}</span>
          </BaseBadge>
        </div>

        <div class="farm-panel-actions ui-bulk-actions">
          <BaseButton
            v-for="op in operations"
            :key="op.type"
            variant="primary"
            class="farm-panel-op-button"
            :class="op.color"
            :disabled="operating"
            :loading="operating && currentOperatingType === op.type"
            :loading-label="`${op.label}中`"
            :icon-class="op.icon"
            @click="handleOperate(op.type)"
          >
            {{ op.label }}
          </BaseButton>
        </div>

        <div v-if="operating && activeOperationMeta" class="farm-panel-operating-note">
          正在执行 {{ activeOperationMeta.label }}，请稍候...
        </div>
      </div>

      <!-- Grid -->
      <div class="p-4">
        <div v-if="loading || statusLoading" class="flex justify-center py-12">
          <div class="farm-panel-loading ui-state-spinner i-svg-spinners-90-ring-with-bg text-4xl" />
        </div>

        <BaseEmptyState
          v-else-if="!status?.connection?.connected"
          class="farm-panel-empty-state glass-text-muted rounded-lg p-12 text-center shadow-sm"
          icon="i-carbon-connection-signal-off"
          title="账号未登录"
          description="请先运行账号或检查网络连接"
        />

        <BaseEmptyState
          v-else-if="!lands || lands.length === 0"
          compact
          class="farm-panel-empty-state glass-text-muted rounded-lg px-6 py-10 text-center"
          icon="i-carbon-grid"
          title="暂无土地数据"
          description="请稍后刷新，或先确认当前账号已经进入农场首页。"
        />

        <div v-else class="grid grid-cols-2 gap-4 lg:grid-cols-6 md:grid-cols-4 sm:grid-cols-3">
          <LandCard
            v-for="land in lands"
            :key="land.id"
            :land="land"
          />
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="confirmVisible"
      :title="confirmConfig.title"
      :message="confirmConfig.message"
      @confirm="executeOperate"
      @cancel="confirmVisible = false"
    />
  </div>
</template>

<style scoped>
.farm-panel {
  color: var(--ui-text-1);
}

.farm-panel-shell,
.farm-panel-toolbar,
.farm-panel-summary,
.farm-panel-empty-state {
  border: 1px solid var(--ui-border-subtle) !important;
}

.farm-panel-shell,
.farm-panel-summary,
.farm-panel-empty-state {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.farm-panel-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
  border-top: none !important;
  border-left: none !important;
  border-right: none !important;
}

.farm-panel-toolbar__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.875rem;
}

.farm-panel-toolbar__copy {
  min-width: 0;
}

.farm-panel-toolbar__desc {
  margin-top: 0.45rem;
  color: var(--ui-text-2);
  font-size: 0.84rem;
  line-height: 1.55;
}

.farm-panel-state-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.85rem;
  padding: 0.25rem 0.7rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.farm-panel-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0;
  border: none !important;
}

.farm-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 1.85rem;
  padding: 0.25rem 0.75rem;
}

.farm-panel-actions {
  display: flex;
  gap: 0.5rem;
}

.ui-btn.farm-panel-op-button {
  color: var(--ui-text-on-brand) !important;
  box-shadow:
    0 10px 22px -18px color-mix(in srgb, var(--ui-shadow-panel) 86%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-text-on-brand) 22%, transparent);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    filter 180ms ease,
    background-color 180ms ease;
}

.ui-btn.farm-panel-op-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    0 16px 26px -18px color-mix(in srgb, var(--ui-shadow-panel) 92%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-text-on-brand) 26%, transparent);
}

.ui-btn.farm-panel-op-button:active:not(:disabled) {
  transform: translateY(0) scale(0.985);
}

.ui-btn.farm-panel-op-button:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--ui-focus-ring),
    0 12px 22px -18px color-mix(in srgb, var(--ui-shadow-panel) 86%, transparent);
}

.farm-op-harvest {
  background: var(--ui-status-info);
}

.farm-op-harvest:hover {
  background: color-mix(in srgb, var(--ui-status-info) 88%, black 12%);
}

.farm-op-clear {
  background: color-mix(in srgb, var(--ui-status-success) 76%, var(--ui-status-info) 24%);
}

.farm-op-clear:hover {
  background: color-mix(in srgb, var(--ui-status-success) 82%, black 18%);
}

.farm-op-plant {
  background: var(--ui-brand-600);
}

.farm-op-plant:hover {
  background: var(--ui-brand-700);
}

.farm-op-upgrade {
  background: color-mix(in srgb, var(--ui-status-info) 42%, var(--ui-brand-600) 58%);
}

.farm-op-upgrade:hover {
  background: color-mix(in srgb, var(--ui-status-info) 40%, var(--ui-brand-700) 60%);
}

.farm-op-all {
  background: var(--ui-status-warning);
}

.farm-op-all:hover {
  background: color-mix(in srgb, var(--ui-status-warning) 88%, black 12%);
}

.farm-panel-empty-state {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent) !important;
}

.farm-panel-empty-icon,
.farm-panel-empty-copy {
  color: var(--ui-text-2) !important;
}

.farm-panel-loading {
  color: var(--ui-status-info) !important;
}

.farm-panel-operating-note {
  color: var(--ui-text-2);
  font-size: 0.8rem;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .farm-panel-toolbar {
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--ui-bg-surface-raised) 90%, transparent) 0%,
      color-mix(in srgb, var(--ui-bg-surface) 82%, transparent) 100%
    ) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: 11;
  }

  .farm-panel-toolbar__head {
    flex-direction: column;
  }

  .farm-panel-actions {
    margin-inline: -0.1rem;
    padding-inline: 0.1rem;
  }
}
</style>
