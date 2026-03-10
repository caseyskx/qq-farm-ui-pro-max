<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  selectedCount?: number | null
  filteredCount?: number | null
  unit?: string
  variant?: 'text' | 'pill'
  selectedLabel?: string
  filteredLabel?: string
}>(), {
  selectedCount: null,
  filteredCount: null,
  unit: '项',
  variant: 'text',
  selectedLabel: '已选',
  filteredLabel: '当前筛选',
})

const attrs = useAttrs()

const summaryAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: [
    props.variant === 'pill'
      ? 'selection-summary-pill rounded-full px-3 py-1 text-xs'
      : 'glass-text-muted text-xs font-medium',
    attrs.class,
  ],
}))

const segments = computed(() => {
  const parts: string[] = []

  if (typeof props.selectedCount === 'number')
    parts.push(`${props.selectedLabel} ${props.selectedCount} ${props.unit}`)

  if (typeof props.filteredCount === 'number')
    parts.push(`${props.filteredLabel} ${props.filteredCount} ${props.unit}`)

  return parts
})
</script>

<template>
  <div v-if="segments.length" v-bind="summaryAttrs">
    <slot>{{ segments.join('，') }}</slot>
  </div>
</template>

<style scoped>
.selection-summary-pill {
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 52%, transparent);
  color: var(--ui-text-2);
}
</style>
