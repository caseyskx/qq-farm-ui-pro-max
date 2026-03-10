<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const barAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-management-bar', 'ui-mobile-action-panel', attrs.class],
}))
</script>

<template>
  <div v-bind="barAttrs">
    <slot name="primary" />
    <slot name="secondary" />
  </div>
</template>
