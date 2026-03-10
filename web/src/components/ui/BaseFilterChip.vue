<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  active?: boolean
  as?: string
}>(), {
  active: false,
  as: 'span',
})

const attrs = useAttrs()

const chipAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: [
    'ui-filter-chip',
    props.active ? 'ui-filter-chip--active' : '',
    attrs.class,
  ],
}))
</script>

<template>
  <component :is="as" v-bind="chipAttrs">
    <slot />
  </component>
</template>
