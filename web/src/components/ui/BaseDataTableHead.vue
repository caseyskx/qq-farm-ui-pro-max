<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const headAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-data-table-head', 'ui-data-table__head', attrs.class],
}))
</script>

<template>
  <thead v-bind="headAttrs">
    <slot />
  </thead>
</template>
