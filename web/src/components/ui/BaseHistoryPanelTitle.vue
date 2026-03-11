<script setup lang="ts">
import type { ChipDefinition, HistoryMetaItemDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseChipList from '@/components/ui/BaseChipList.vue'
import BaseHistoryMetaList from '@/components/ui/BaseHistoryMetaList.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  title: string
  chips?: ChipDefinition[]
  meta?: HistoryMetaItemDefinition[]
  titleClass?: string
}>(), {
  chips: () => [],
  meta: () => [],
  titleClass: '',
})

const attrs = useAttrs()

const wrapperAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-history-panel-title', attrs.class],
}))

const hasChips = computed(() => props.chips.some(item => item.show !== false))
const hasMeta = computed(() => props.meta.some(item => item.show !== false))
</script>

<template>
  <div v-bind="wrapperAttrs">
    <h2 class="ui-history-panel__title" :class="titleClass">
      {{ title }}
    </h2>
    <BaseChipList
      v-if="hasChips"
      class="ui-history-panel-title__chips text-xs"
      :items="chips"
    />
    <BaseHistoryMetaList
      v-if="hasMeta"
      class="ui-history-panel-title__meta text-xs"
      :items="meta"
    />
  </div>
</template>

<style scoped>
.ui-history-panel-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ui-history-panel-title__chips,
.ui-history-panel-title__meta {
  min-width: 0;
}
</style>
