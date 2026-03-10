<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const toolbarAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-filter-toolbar', 'ui-table-toolbar', 'ui-mobile-sticky-toolbar', attrs.class],
}))
</script>

<template>
  <div v-bind="toolbarAttrs">
    <slot name="left" />
    <slot name="right" />
  </div>
</template>
