<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  compact?: boolean
  dashed?: boolean
  danger?: boolean
}>(), {
  icon: '',
  title: '',
  description: '',
  compact: false,
  dashed: false,
  danger: false,
})

const attrs = useAttrs()

const emptyStateAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: [
    'ui-empty-state',
    'ui-state-panel',
    props.compact && 'ui-state-panel--compact',
    props.dashed && 'ui-state-panel--dashed',
    props.danger && 'ui-state-panel--danger',
    attrs.class,
  ],
}))
</script>

<template>
  <div v-bind="emptyStateAttrs">
    <div v-if="icon" class="ui-empty-state__icon ui-state-icon" :class="[icon]" />
    <slot name="icon" />
    <div v-if="title || $slots.title" class="ui-empty-state__title ui-state-title">
      <slot name="title">
        {{ title }}
      </slot>
    </div>
    <div v-if="description || $slots.description" class="ui-empty-state__desc ui-state-desc">
      <slot name="description">
        {{ description }}
      </slot>
    </div>
    <slot />
  </div>
</template>
