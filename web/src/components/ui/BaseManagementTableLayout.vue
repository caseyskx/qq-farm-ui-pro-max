<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const layoutAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-management-layout', attrs.class],
}))
</script>

<template>
  <div v-bind="layoutAttrs">
    <div v-if="$slots.summary" class="ui-management-layout__summary">
      <slot name="summary" />
    </div>
    <div v-if="$slots.filters" class="ui-management-layout__filters">
      <slot name="filters" />
    </div>
    <div v-if="$slots.supporting" class="ui-management-layout__supporting">
      <slot name="supporting" />
    </div>
    <div v-if="$slots.table" class="ui-management-layout__table">
      <slot name="table" />
    </div>
  </div>
</template>
