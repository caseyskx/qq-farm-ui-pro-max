<script setup lang="ts">
import type { ChipDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseFilterChip from '@/components/ui/BaseFilterChip.vue'
import BaseFilterChips from '@/components/ui/BaseFilterChips.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  items?: ChipDefinition[]
}>(), {
  items: () => [],
})

const attrs = useAttrs()

const visibleItems = computed(() => props.items.filter(item => item.show !== false))

const chipListAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
}))
</script>

<template>
  <BaseFilterChips v-bind="chipListAttrs">
    <BaseFilterChip
      v-for="item in visibleItems"
      :key="item.key"
      :active="item.active"
      :class="item.class"
    >
      <component
        :is="item.component"
        v-if="item.component"
        v-bind="item.props"
      />
      <template v-else>
        {{ item.text }}
      </template>
    </BaseFilterChip>
  </BaseFilterChips>
</template>
