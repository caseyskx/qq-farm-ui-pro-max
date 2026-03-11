<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const chipsAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-filter-chips', attrs.class],
}))
</script>

<template>
  <div v-bind="chipsAttrs">
    <slot />
  </div>
</template>
