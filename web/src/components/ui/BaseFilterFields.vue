<script setup lang="ts">
import type { FilterFieldDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  fields: FilterFieldDefinition[]
}>()

const attrs = useAttrs()

const gridAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-filter-grid', attrs.class],
}))

function resolveFieldProps(field: FilterFieldDefinition) {
  const next = { ...(field.props || {}) }
  if (field.onUpdate)
    next.modelValue = field.modelValue
  return next
}

function handleUpdate(field: FilterFieldDefinition, value: unknown) {
  field.onUpdate?.(value)
}

function handleClick(field: FilterFieldDefinition, event: MouseEvent) {
  field.onClick?.(event)
}

function handleChange(field: FilterFieldDefinition, value: unknown) {
  field.onChange?.(value)
}

function handleClear(field: FilterFieldDefinition) {
  field.onClear?.()
}
</script>

<template>
  <div v-bind="gridAttrs">
    <div
      v-for="field in fields"
      :key="field.key"
      :class="field.wrapperClass"
    >
      <component
        :is="field.component"
        v-bind="resolveFieldProps(field)"
        @update:model-value="handleUpdate(field, $event)"
        @change="handleChange(field, $event)"
        @clear="handleClear(field)"
        @click="handleClick(field, $event)"
      >
        {{ field.text }}
      </component>
    </div>
  </div>
</template>
