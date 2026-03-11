<script setup lang="ts">
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'

withDefaults(defineProps<{
  checked?: boolean
  cellClass?: string
}>(), {
  checked: false,
  cellClass: 'px-4 py-3 text-left',
})

const emit = defineEmits<{
  change: [event: Event]
}>()
</script>

<template>
  <th class="ui-data-table-selection-head" :class="cellClass">
    <BaseCheckbox :checked="checked" @change="emit('change', $event)" />
  </th>
</template>
