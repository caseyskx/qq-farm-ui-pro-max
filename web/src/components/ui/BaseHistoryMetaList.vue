<script setup lang="ts">
import type { HistoryMetaItemDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  items?: HistoryMetaItemDefinition[]
}>(), {
  items: () => [],
})

const attrs = useAttrs()

const listAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-history-meta-list', attrs.class],
}))

const visibleItems = computed(() => props.items.filter(item => item.show !== false))
</script>

<template>
  <div v-if="visibleItems.length" v-bind="listAttrs">
    <span
      v-for="item in visibleItems"
      :key="item.key"
      class="ui-history-meta-list__item"
      :class="item.class"
    >
      <span
        v-if="item.iconClass"
        class="ui-history-meta-list__icon"
        :class="item.iconClass"
      />
      <span class="min-w-0">
        {{ item.text }}
      </span>
    </span>
  </div>
</template>

<style scoped>
.ui-history-meta-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ui-history-meta-list__item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
  color: var(--ui-text-2);
}

.ui-history-meta-list__icon {
  flex: none;
}
</style>
