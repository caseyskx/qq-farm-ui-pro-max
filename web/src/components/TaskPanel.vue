<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import DailyOverview from '@/components/DailyOverview.vue'
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'
import { useAccountStore } from '@/stores/account'
import { useStatusStore } from '@/stores/status'

const statusStore = useStatusStore()
const accountStore = useAccountStore()
const { status, dailyGifts, realtimeConnected } = storeToRefs(statusStore)
const { currentAccountId, currentAccount } = storeToRefs(accountStore)

const growth = computed(() => dailyGifts.value?.growth || null)
const growthTasks = computed(() => Array.isArray(growth.value?.tasks) ? growth.value.tasks : [])
const pendingTaskCount = computed(() => growthTasks.value.filter(task => formatTaskProgress(task) !== '已完成').length)
const taskAutoEnabled = computed(() => {
  const gifts = Array.isArray(dailyGifts.value?.gifts) ? dailyGifts.value.gifts : []
  return gifts.some((gift: any) => gift?.key === 'task_claim' && gift?.enabled)
})
const taskSummaryChips = computed(() => [
  {
    key: 'total',
    label: '总任务',
    value: growth.value?.totalCount || growthTasks.value.length || 0,
    tone: 'ui-meta-chip--info',
  },
  {
    key: 'done',
    label: '今日完成',
    value: growth.value?.completedCount || 0,
    tone: 'ui-meta-chip--success',
  },
  {
    key: 'pending',
    label: '待推进',
    value: pendingTaskCount.value,
    tone: 'ui-meta-chip--warning',
  },
  {
    key: 'auto',
    label: '自动领奖',
    value: taskAutoEnabled.value ? '已开' : '未开',
    tone: taskAutoEnabled.value ? 'ui-meta-chip--success' : 'ui-meta-chip--neutral',
  },
])

async function refresh() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    if (!realtimeConnected.value) {
      await statusStore.fetchStatus(currentAccountId.value)
    }
    if (acc.running && status.value?.connection?.connected) {
      statusStore.fetchDailyGifts(currentAccountId.value)
    }
  }
}

onMounted(() => {
  refresh()
})

watch(currentAccountId, () => {
  refresh()
})

function formatTaskProgress(task: any) {
  if (!task)
    return '未开始'
  const rawCurrent = task.progress ?? task.current
  const rawTarget = task.totalProgress ?? task.target

  const current = Number.isFinite(rawCurrent)
    ? rawCurrent
    : (rawCurrent ? Number(rawCurrent) || 0 : 0)

  const target = Number.isFinite(rawTarget)
    ? rawTarget
    : (rawTarget ? Number(rawTarget) || 0 : 0)

  if (!current && !target)
    return '未开始'

  if (target && current >= target)
    return '已完成'

  return `进度：${current}/${target}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Daily Overview (Daily Gifts & Tasks) -->
    <DailyOverview :daily-gifts="dailyGifts" />

    <!-- Growth Task -->
    <div class="task-panel-shell glass-panel flex flex-col rounded-lg p-4 shadow-sm">
      <div class="task-panel-toolbar ui-mobile-sticky-panel">
        <div class="task-panel-toolbar__head">
          <div>
            <h3 class="glass-text-main flex items-center gap-2 font-medium">
              <div class="i-carbon-growth text-primary-500" />
              <span>成长任务</span>
            </h3>
            <p class="task-panel-toolbar__desc">
              任务进度会随着种植、收菜、好友互动和日常领取实时推进。
            </p>
          </div>
          <span
            v-if="growth"
            class="task-panel-badge ui-meta-chip rounded px-2 py-0.5 text-xs font-bold"
            :class="growth.doneToday
              ? 'ui-meta-chip--brand'
              : 'ui-meta-chip--info'"
          >
            {{ growth.doneToday ? '今日已完成' : `${growth.completedCount}/${growth.totalCount}` }}
          </span>
        </div>

        <div class="task-panel-summary ui-bulk-actions">
          <span
            v-for="item in taskSummaryChips"
            :key="item.key"
            class="task-summary-chip"
            :class="item.tone"
          >
            {{ item.label }} {{ item.value }}
          </span>
        </div>
      </div>

      <div class="task-panel-note mb-4 rounded-lg px-3 py-2 text-xs leading-5">
        成长任务会随着种植、收菜、好友互动、分享等奖励链路自然推进；
        <span class="font-medium">{{ taskAutoEnabled ? '当前已开启自动任务领奖' : '当前未开启自动任务领奖' }}</span>，
        可在设置页的“每日收益领取”中开启。
      </div>

      <BaseEmptyState
        v-if="!currentAccountId"
        compact
        class="task-panel-empty glass-text-muted rounded-lg py-8 text-center"
        icon="i-carbon-user-avatar"
        title="未选择账号"
        description="请选择账号后查看成长任务与领奖进度。"
      />
      <BaseEmptyState
        v-else-if="!status?.connection?.connected"
        compact
        class="task-panel-empty rounded-lg py-8 text-center"
        icon="i-carbon-connection-signal-off"
        title="账号未登录"
        description="请先运行账号或检查网络连接"
      />
      <div
        v-else-if="growthTasks.length"
        class="task-panel-list"
      >
        <div
          v-for="(task, idx) in growthTasks"
          :key="idx"
          class="task-panel-item"
        >
          <div class="task-panel-item__title">
            {{ task.desc || task.name }}
          </div>
          <div class="task-panel-item__progress">
            {{ formatTaskProgress(task) }}
          </div>
        </div>
      </div>
      <BaseEmptyState
        v-else
        compact
        dashed
        class="task-panel-empty glass-text-muted rounded-lg py-8 text-center"
        icon="i-carbon-growth"
        title="暂无任务详情"
        description="当前账号还没有同步到成长任务明细，可以稍后刷新再看。"
      />
    </div>
  </div>
</template>

<style scoped>
.task-panel-shell,
.task-panel-empty {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent);
}

.task-panel-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin-bottom: 1rem;
}

.task-panel-toolbar__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.875rem;
}

.task-panel-toolbar__desc {
  margin-top: 0.45rem;
  color: var(--ui-text-2);
  font-size: 0.84rem;
  line-height: 1.55;
}

.task-panel-summary {
  display: flex;
  gap: 0.5rem;
}

.task-summary-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  padding: 0.25rem 0.7rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.task-panel-badge {
  min-height: 1.55rem;
}

.task-panel-note {
  border: 1px solid color-mix(in srgb, var(--ui-status-success) 24%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-success-soft) 72%, var(--ui-bg-surface-raised));
  color: var(--ui-status-success);
}

.task-panel-offline-icon {
  color: var(--ui-text-2);
}

.task-panel-list {
  display: grid;
  gap: 0.75rem;
}

.task-panel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--ui-border-subtle);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface) 76%, transparent);
}

.task-panel-item__title {
  color: var(--ui-text-1);
  font-size: 0.9rem;
  line-height: 1.55;
  font-weight: 600;
}

.task-panel-item__progress {
  flex: 0 0 auto;
  color: var(--ui-text-2);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}

@media (max-width: 767px) {
  .task-panel-toolbar {
    z-index: 11;
    padding-bottom: 0.1rem;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) 0%,
      color-mix(in srgb, var(--ui-bg-surface) 70%, transparent) 100%
    );
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }

  .task-panel-toolbar__head,
  .task-panel-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
