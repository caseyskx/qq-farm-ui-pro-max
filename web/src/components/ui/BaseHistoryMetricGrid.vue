<script setup lang="ts">
import type { HistoryMetricDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  items?: HistoryMetricDefinition[]
}>(), {
  items: () => [],
})

const attrs = useAttrs()

const gridAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-history-metric-grid', attrs.class],
}))

const visibleItems = computed(() => props.items.filter(item => item.show !== false))
</script>

<template>
  <div v-bind="gridAttrs">
    <div
      v-for="item in visibleItems"
      :key="item.key"
      class="ui-history-metric-grid__item"
      :class="item.class"
    >
      <div class="ui-history-metric-grid__label" :class="item.labelClass">
        {{ item.label }}
      </div>
      <div v-if="item.value !== undefined && item.value !== ''" class="ui-history-metric-grid__value" :class="item.valueClass">
        {{ item.value }}
      </div>
      <div v-if="item.metrics && item.metrics.length" class="ui-history-metric-grid__metrics" :class="item.metricsClass">
        <span
          v-for="metric in item.metrics"
          :key="`${item.key}-${metric.text}`"
          :class="metric.class"
        >
          {{ metric.text }}
        </span>
      </div>
      <div
        v-if="item.description"
        class="ui-history-metric-grid__description"
        :class="item.descriptionClass"
      >
        {{ item.description }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-history-metric-grid {
  display: grid;
  gap: 0.75rem;
}

.ui-history-metric-grid__item {
  min-width: 0;
}

.ui-history-metric-grid__metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
