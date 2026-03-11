<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  surface?: 'badge' | 'meta' | 'glass' | 'glass-soft' | 'glass-dark'
  tone?: 'brand' | 'owner' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | ''
}>(), {
  as: 'span',
  surface: 'badge',
  tone: '',
})

const attrs = useAttrs()

const surfaceClass = computed(() => {
  if (props.surface === 'meta')
    return ['ui-meta-chip']
  if (props.surface === 'glass')
    return ['ui-glass-chip']
  if (props.surface === 'glass-soft')
    return ['ui-glass-chip', 'ui-glass-chip--soft']
  if (props.surface === 'glass-dark')
    return ['ui-glass-chip', 'ui-glass-chip--dark']
  return ['ui-badge']
})

const toneClass = computed(() => (props.tone ? `ui-meta-chip--${props.tone}` : ''))

const badgeAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: [surfaceClass.value, toneClass.value, attrs.class],
}))
</script>

<template>
  <component :is="as" v-bind="badgeAttrs">
    <slot />
  </component>
</template>
