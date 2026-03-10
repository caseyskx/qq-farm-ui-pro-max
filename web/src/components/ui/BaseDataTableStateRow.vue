<script setup lang="ts">
import BaseEmptyState from '@/components/ui/BaseEmptyState.vue'

withDefaults(defineProps<{
  colspan: number | string
  loading?: boolean
  loadingLabel?: string
  icon?: string
  cellClass?: string
  emptyClass?: string
}>(), {
  loading: false,
  loadingLabel: '正在加载数据...',
  icon: '',
  cellClass: 'px-4 py-12',
  emptyClass: '',
})
</script>

<template>
  <tr>
    <td class="ui-data-table-state-cell" :colspan="colspan" :class="cellClass">
      <div
        v-if="loading"
        class="glass-text-muted flex items-center justify-center px-4 py-10 text-sm"
      >
        {{ loadingLabel }}
      </div>
      <BaseEmptyState v-else :icon="icon" :class="emptyClass">
        <template v-if="$slots.title" #title>
          <slot name="title" />
        </template>
        <template v-if="$slots.description" #description>
          <slot name="description" />
        </template>
        <slot />
      </BaseEmptyState>
    </td>
  </tr>
</template>
