<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()
const badgeAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-badge', attrs.class],
}))
</script>

<template>
  <span v-bind="badgeAttrs">
    <slot />
  </span>
</template>
