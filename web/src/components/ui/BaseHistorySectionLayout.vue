<script setup lang="ts">
import type {
  ActionButtonDefinition,
  ChipDefinition,
  HistoryHighlightDefinition,
  HistoryMetaItemDefinition,
  HistoryMetricDefinition,
  HistoryRecentItemDefinition,
} from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseChipList from '@/components/ui/BaseChipList.vue'
import BaseHistoryHighlightCard from '@/components/ui/BaseHistoryHighlightCard.vue'
import BaseHistoryMetricGrid from '@/components/ui/BaseHistoryMetricGrid.vue'
import BaseHistoryRecentItem from '@/components/ui/BaseHistoryRecentItem.vue'
import BaseHistorySummaryPanel from '@/components/ui/BaseHistorySummaryPanel.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  title: string
  description?: string
  actions?: ActionButtonDefinition[]
  titleChips?: ChipDefinition[]
  titleMeta?: HistoryMetaItemDefinition[]
  highlight?: HistoryHighlightDefinition | null
  metrics?: HistoryMetricDefinition[]
  recentItems?: HistoryRecentItemDefinition[]
  emptyText?: string
  filteredEmptyText?: string
  showFilteredEmpty?: boolean
  highlightSectionClass?: string
  highlightHeaderClass?: string
  highlightCardAttrs?: Record<string, any>
  highlightMetaChips?: ChipDefinition[]
  highlightMetaChipsClass?: string
  metricsClass?: string
  emptyClass?: string
  recentGridClass?: string
  recentCopiedClass?: string
  recentTag?: 'button' | 'div'
}>(), {
  description: '',
  actions: () => [],
  titleChips: () => [],
  titleMeta: () => [],
  highlight: null,
  metrics: () => [],
  recentItems: () => [],
  emptyText: '',
  filteredEmptyText: '',
  showFilteredEmpty: false,
  highlightSectionClass: '',
  highlightHeaderClass: '',
  highlightCardAttrs: () => ({}),
  highlightMetaChips: () => [],
  highlightMetaChipsClass: '',
  metricsClass: '',
  emptyClass: '',
  recentGridClass: '',
  recentCopiedClass: '',
  recentTag: 'button',
})

const attrs = useAttrs()

const visibleRecentItems = computed(() => props.recentItems.filter(item => item.show !== false))
const hasHighlightMetaChips = computed(() => props.highlightMetaChips.some(item => item.show !== false))
const hasMetrics = computed(() => props.metrics.some(item => item.show !== false))
const resolvedEmptyText = computed(() =>
  props.showFilteredEmpty && props.filteredEmptyText
    ? props.filteredEmptyText
    : props.emptyText,
)
</script>

<template>
  <BaseHistorySummaryPanel
    v-bind="attrs"
    :title="title"
    :description="description"
    :actions="actions"
    :title-chips="titleChips"
    :title-meta="titleMeta"
  >
    <slot />

    <div v-if="highlight" :class="highlightSectionClass">
      <div v-if="hasHighlightMetaChips" :class="highlightHeaderClass">
        <BaseHistoryHighlightCard
          v-bind="highlightCardAttrs"
          :title="highlight.title"
          :subtitle="highlight.subtitle"
          :description="highlight.description"
          :detail-lines="highlight.detailLines"
          :note="highlight.note"
          :header-meta="highlight.headerMeta"
        />
        <BaseChipList :class="highlightMetaChipsClass" :items="highlightMetaChips" />
      </div>
      <BaseHistoryHighlightCard
        v-else
        v-bind="highlightCardAttrs"
        :title="highlight.title"
        :subtitle="highlight.subtitle"
        :description="highlight.description"
        :detail-lines="highlight.detailLines"
        :note="highlight.note"
        :header-meta="highlight.headerMeta"
      />

      <BaseHistoryMetricGrid
        v-if="hasMetrics"
        :class="metricsClass"
        :items="metrics"
      />
    </div>

    <div v-else-if="resolvedEmptyText" :class="emptyClass">
      {{ resolvedEmptyText }}
    </div>

    <template v-if="visibleRecentItems.length" #recent>
      <div :class="recentGridClass">
        <BaseHistoryRecentItem
          v-for="item in visibleRecentItems"
          :key="item.key"
          :item="item"
          :tag="recentTag"
          :class="item.copied ? recentCopiedClass : ''"
        />
      </div>
    </template>
  </BaseHistorySummaryPanel>
</template>
