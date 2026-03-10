<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  text: string
}>()

const attrs = useAttrs()

const noticeAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-header-notice', attrs.class],
}))
</script>

<template>
  <div v-bind="noticeAttrs">
    {{ text }}
  </div>
</template>
