<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const gridAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-summary-grid', attrs.class],
}))
</script>

<template>
  <div v-bind="gridAttrs">
    <slot />
  </div>
</template>
