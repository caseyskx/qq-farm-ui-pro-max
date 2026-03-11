<script setup lang="ts">
import type { ToggleOptionDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  items?: ToggleOptionDefinition[]
  itemClass?: string
}>(), {
  items: () => [],
  itemClass: '',
})

const attrs = useAttrs()

const groupAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-toggle-option-group', attrs.class],
}))

const visibleItems = computed(() => props.items.filter(item => item.show !== false))

function getItemLabel(item: ToggleOptionDefinition) {
  return item.shortLabel || item.label
}
</script>

<template>
  <div v-bind="groupAttrs">
    <button
      v-for="item in visibleItems"
      :key="item.key"
      type="button"
      class="ui-toggle-option-group__item"
      :class="[props.itemClass, item.active ? 'ui-toggle-option-group__item--active' : '', item.class]"
      :title="item.title || item.label"
      :aria-pressed="item.active ? 'true' : 'false'"
      @click="item.onClick?.($event)"
    >
      <span v-if="item.iconClass" :class="item.iconClass" />
      <span>{{ getItemLabel(item) }}</span>
      <span
        v-if="item.count !== undefined && item.count !== null"
        class="ui-toggle-option-group__count"
        :class="[item.active ? 'ui-toggle-option-group__count--active' : '', item.countClass]"
      >
        {{ item.count }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.ui-toggle-option-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ui-toggle-option-group__item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.ui-toggle-option-group__item--active {
  color: var(--ui-text-1);
}

.ui-toggle-option-group__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
}

.ui-toggle-option-group__count--active {
  color: inherit;
}
</style>
