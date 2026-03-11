<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const paginationAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-pagination', attrs.class],
}))
</script>

<template>
  <div v-bind="paginationAttrs">
    <div class="ui-pagination__meta">
      <slot name="meta" />
    </div>
    <div class="ui-pagination__controls">
      <slot name="controls" />
    </div>
  </div>
</template>
