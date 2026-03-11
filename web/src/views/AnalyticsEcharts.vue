<script setup lang="ts">
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'

const VChart = defineAsyncComponent(() => import('vue-echarts'))

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
])

const loading = ref(false)
const analyticsSnapshot = ref({
  dates: [] as string[],
  exp: [] as number[],
  gold: [] as number[],
  steal: [] as number[],
})

// 经验金币走势
const trendOption = ref<any>({})

// 近期偷菜排行榜
const stealOption = ref<any>({})

function readThemeVars() {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  return {
    bgTooltip: v('--ui-bg-surface-raised', 'var(--ui-bg-surface-raised)'),
    border: v('--ui-border-subtle', 'var(--ui-border-subtle)'),
    textMain: v('--ui-text-1', 'var(--ui-text-1)'),
    textMuted: v('--ui-text-2', 'var(--ui-text-2)'),
    splitLine: v('--ui-border-subtle', 'var(--ui-border-subtle)'),
    brand: v('--ui-brand-500', 'var(--ui-brand-500)'),
    success: v('--ui-status-success', 'var(--ui-status-success)'),
    warning: v('--ui-status-warning', 'var(--ui-status-warning)'),
    info: v('--ui-status-info', 'var(--ui-status-info)'),
  }
}

async function fetchAnalytics() {
  loading.value = true
  try {
    const res = await api.get('/api/stats/trend')
    if (res.data && res.data.ok) {
      const { dates, series } = res.data.data
      analyticsSnapshot.value = {
        dates,
        exp: series.exp ?? [],
        gold: series.gold ?? [],
        steal: series.steal ?? [],
      }
      const theme = readThemeVars()

      trendOption.value = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: theme.bgTooltip, borderColor: theme.border, textStyle: { color: theme.textMain } },
        legend: { data: ['经验增长', '金币增长'], textStyle: { color: theme.textMuted }, top: 0 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: dates, axisLine: { lineStyle: { color: theme.border } }, axisLabel: { color: theme.textMuted } },
        yAxis: [
          { type: 'value', name: '经验', axisLine: { show: false }, splitLine: { lineStyle: { color: theme.splitLine } }, axisLabel: { color: theme.textMuted } },
          { type: 'value', name: '金币', axisLine: { show: false }, splitLine: { show: false }, axisLabel: { color: theme.textMuted } },
        ],
        series: [
          {
            name: '经验增长',
            type: 'line',
            smooth: true,
            itemStyle: { color: theme.success },
            areaStyle: { color: theme.success, opacity: 0.14 },
            data: series.exp,
          },
          {
            name: '金币增长',
            type: 'bar',
            yAxisIndex: 1,
            itemStyle: { color: theme.warning, borderRadius: [4, 4, 0, 0] },
            data: series.gold,
          },
        ],
      }

      stealOption.value = {
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis', backgroundColor: theme.bgTooltip, borderColor: theme.border, textStyle: { color: theme.textMain } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: theme.border } }, axisLabel: { color: theme.textMuted } },
        yAxis: { type: 'value', name: '偷取次数', axisLine: { show: false }, splitLine: { lineStyle: { color: theme.splitLine } }, axisLabel: { color: theme.textMuted } },
        series: [
          {
            name: '偷菜次数',
            type: 'line',
            step: 'start',
            itemStyle: { color: theme.brand },
            areaStyle: { color: theme.brand, opacity: 0.12 },
            data: series.steal,
          },
        ],
      }
    }
  }
  catch (e: any) {
    console.error('获取统计图表失败', e)
  }
  finally {
    loading.value = false
  }
}

function sumSeries(values: number[]) {
  return values.reduce((total, value) => total + Number(value || 0), 0)
}

const analyticsSummaryCards = computed(() => {
  const dates = analyticsSnapshot.value.dates
  const exp = analyticsSnapshot.value.exp
  const gold = analyticsSnapshot.value.gold
  const steal = analyticsSnapshot.value.steal
  const dateRange = dates.length > 1
    ? `${dates[0]} - ${dates[dates.length - 1]}`
    : (dates[0] || '暂无日期')

  return [
    {
      key: 'range',
      label: '时间范围',
      value: dateRange,
      tone: 'analytics-summary-card--brand',
    },
    {
      key: 'exp',
      label: '累计经验增长',
      value: `${sumSeries(exp).toLocaleString()} EXP`,
      tone: 'analytics-summary-card--success',
    },
    {
      key: 'gold',
      label: '累计金币增长',
      value: `${sumSeries(gold).toLocaleString()} 金币`,
      tone: 'analytics-summary-card--warning',
    },
    {
      key: 'steal',
      label: '累计偷菜次数',
      value: `${sumSeries(steal).toLocaleString()} 次`,
      tone: 'analytics-summary-card--info',
    },
  ]
})

const analyticsTrendMeta = computed(() => {
  const exp = analyticsSnapshot.value.exp
  const gold = analyticsSnapshot.value.gold
  return [
    `经验峰值 ${Math.max(0, ...exp).toLocaleString()}`,
    `金币峰值 ${Math.max(0, ...gold).toLocaleString()}`,
  ]
})

const analyticsStealMeta = computed(() => {
  const steal = analyticsSnapshot.value.steal
  return [
    `最高单日 ${Math.max(0, ...steal).toLocaleString()} 次`,
    `统计天数 ${analyticsSnapshot.value.dates.length || 0} 天`,
  ]
})

onMounted(() => {
  fetchAnalytics()
})
</script>

<template>
  <div class="fade-in ui-page-shell ui-page-stack ui-page-density-relaxed w-full">
    <div class="analytics-echarts-header ui-mobile-sticky-panel">
      <div class="ui-page-header__main">
        <h1 class="ui-page-title flex items-center gap-2">
          <div class="i-carbon-chart-multitype text-primary-400" />
          全盘数据作战大屏
        </h1>
        <p class="ui-page-desc">
          此面板基于各节点过去 7 天的业务执行数据渲染全景产出报表。
        </p>
      </div>
      <div class="analytics-echarts-actions ui-bulk-actions">
        <BaseButton
          variant="primary"
          size="sm"
          :loading="loading"
          @click="fetchAnalytics"
        >
          刷新数据
        </BaseButton>
      </div>
    </div>

    <div v-if="loading" class="glass-panel min-h-[300px] flex flex-col items-center justify-center rounded-lg shadow-sm">
      <div class="i-svg-spinners-90-ring-with-bg mb-4 text-4xl text-primary-500" />
      <span class="glass-text-muted text-sm">正在聚合历史数据流...</span>
    </div>

    <div v-else class="grid grid-cols-1 gap-6">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in analyticsSummaryCards"
          :key="card.key"
          class="analytics-summary-card glass-panel rounded-2xl p-4 shadow-sm"
          :class="card.tone"
        >
          <div class="analytics-summary-card__label">
            {{ card.label }}
          </div>
          <div class="analytics-summary-card__value">
            {{ card.value }}
          </div>
        </div>
      </div>

      <div class="glass-panel ui-section-card">
        <div class="analytics-echarts-section-head">
          <h3 class="analytics-echarts-title glass-text-muted text-lg font-bold">
            经验与金币成长曲线
          </h3>
          <div class="analytics-echarts-meta ui-bulk-actions">
            <span
              v-for="item in analyticsTrendMeta"
              :key="item"
              class="analytics-echarts-chip ui-meta-chip--neutral"
            >
              {{ item }}
            </span>
          </div>
        </div>
        <div class="h-[350px] w-full">
          <VChart :option="trendOption" autoresize />
        </div>
      </div>

      <div class="glass-panel ui-section-card">
        <div class="analytics-echarts-section-head">
          <h3 class="analytics-echarts-title glass-text-muted text-lg font-bold">
            偷菜风云榜 (单日偷取频次)
          </h3>
          <div class="analytics-echarts-meta ui-bulk-actions">
            <span
              v-for="item in analyticsStealMeta"
              :key="item"
              class="analytics-echarts-chip ui-meta-chip--neutral"
            >
              {{ item }}
            </span>
          </div>
        </div>
        <div class="h-[300px] w-full">
          <VChart :option="stealOption" autoresize />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-echarts-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.analytics-echarts-actions {
  align-items: center;
}

.analytics-summary-card {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
}

.analytics-summary-card__label {
  color: var(--ui-text-3);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.analytics-summary-card__value {
  margin-top: 0.75rem;
  color: var(--ui-text-1);
  font-size: 1.05rem;
  line-height: 1.4;
  font-weight: 700;
}

.analytics-summary-card--brand {
  border-color: color-mix(in srgb, var(--ui-brand-500) 22%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-brand-500) 8%, var(--ui-bg-surface-raised));
}

.analytics-summary-card--success {
  border-color: color-mix(in srgb, var(--ui-status-success) 22%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-success) 8%, var(--ui-bg-surface-raised));
}

.analytics-summary-card--warning {
  border-color: color-mix(in srgb, var(--ui-status-warning) 22%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-warning) 8%, var(--ui-bg-surface-raised));
}

.analytics-summary-card--info {
  border-color: color-mix(in srgb, var(--ui-status-info) 22%, var(--ui-border-subtle));
  background: color-mix(in srgb, var(--ui-status-info) 8%, var(--ui-bg-surface-raised));
}

.analytics-echarts-section-head {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  margin-bottom: 1rem;
}

.analytics-echarts-title {
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--ui-border-subtle) !important;
}

.analytics-echarts-meta {
  align-items: center;
}

.analytics-echarts-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  padding: 0.25rem 0.625rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
}

@media (max-width: 767px) {
  .analytics-echarts-header {
    padding: 0.875rem;
    border: 1px solid var(--ui-border-subtle);
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
    box-shadow:
      0 12px 24px -24px var(--ui-shadow-panel),
      inset 0 1px 0 var(--ui-shadow-inner);
  }
}
</style>

<style scoped>
.fade-in {
  animation: fadeIn 0.5s ease-in-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
