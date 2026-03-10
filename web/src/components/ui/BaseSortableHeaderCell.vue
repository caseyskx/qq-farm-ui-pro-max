<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  label?: string
  active?: boolean
  direction?: 'asc' | 'desc'
  sortable?: boolean
  cellClass?: string
}>(), {
  label: '',
  active: false,
  direction: 'asc',
  sortable: true,
  cellClass: 'px-4 py-3 font-medium',
})

const emit = defineEmits<{
  toggle: []
}>()

const attrs = useAttrs()

const buttonAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['sortable-header-button inline-flex items-center gap-1.5 transition-colors', attrs.class],
}))

const iconClass = computed(() => {
  if (!props.active)
    return 'i-carbon-arrows-vertical'
  return props.direction === 'asc' ? 'i-carbon-arrow-up' : 'i-carbon-arrow-down'
})
</script>

<template>
  <th :class="cellClass">
    <button v-if="sortable" v-bind="buttonAttrs" @click="emit('toggle')">
      <slot>{{ label }}</slot>
      <div class="text-xs" :class="iconClass" />
    </button>
    <template v-else>
      <slot>{{ label }}</slot>
    </template>
  </th>
</template>

<style scoped>
.sortable-header-button {
  color: inherit;
}

.sortable-header-button:hover {
  color: var(--ui-text-1);
}

.sortable-header-button:focus-visible {
  outline: none;
  border-radius: 0.5rem;
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}
</style>
