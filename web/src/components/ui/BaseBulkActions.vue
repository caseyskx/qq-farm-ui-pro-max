<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const actionAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-page-actions', 'ui-bulk-actions', attrs.class],
}))
</script>

<template>
  <div v-bind="actionAttrs">
    <slot />
  </div>
</template>
