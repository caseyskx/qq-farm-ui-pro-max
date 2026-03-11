<script setup lang="ts">
import type { IconActionDefinition } from '@/utils/management-schema'
import { computed } from 'vue'
import BaseIconAction from '@/components/ui/BaseIconAction.vue'

const props = withDefaults(defineProps<{
  actions?: IconActionDefinition[]
}>(), {
  actions: () => [],
})

const visibleActions = computed(() => props.actions.filter(action => action.show !== false))
</script>

<template>
  <BaseIconAction
    v-for="action in visibleActions"
    :key="action.key"
    :danger="action.danger"
    :disabled="action.disabled"
    :title="action.title"
    :class="action.class"
    @click="action.onClick?.($event)"
  >
    <div :class="action.iconClass" />
  </BaseIconAction>
</template>
