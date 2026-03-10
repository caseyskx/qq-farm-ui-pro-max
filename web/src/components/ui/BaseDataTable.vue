<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  tableClass?: string
}>(), {
  tableClass: 'min-w-full',
})

const attrs = useAttrs()

const wrapperAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-data-table', attrs.class],
}))
</script>

<template>
  <div v-bind="wrapperAttrs">
    <table class="ui-data-table__table" :class="tableClass">
      <slot />
    </table>
  </div>
</template>
