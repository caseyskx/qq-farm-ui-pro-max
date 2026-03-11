<script setup lang="ts">
import type { ActionButtonDefinition } from '@/utils/management-schema'
import { computed } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'

const props = withDefaults(defineProps<{
  actions?: ActionButtonDefinition[]
}>(), {
  actions: () => [],
})

const visibleActions = computed(() => props.actions.filter(action => action.show !== false))

function getResolvedLabel(action: ActionButtonDefinition) {
  if (action.active && action.activeLabel)
    return action.activeLabel
  return action.label
}

function getIconClass(action: ActionButtonDefinition) {
  if (action.active && action.activeIconClass)
    return action.activeIconClass
  return action.iconClass
}

function getLoadingLabel(action: ActionButtonDefinition) {
  if (action.loadingLabel)
    return action.loadingLabel
  if (action.active && action.activeLabel)
    return action.activeLabel
  return action.label
}
</script>

<template>
  <BaseButton
    v-for="action in visibleActions"
    :key="action.key"
    :variant="action.variant || 'outline'"
    :size="action.size || 'sm'"
    :disabled="action.disabled"
    :loading="action.loading"
    :loading-label="getLoadingLabel(action)"
    :icon-class="getIconClass(action)"
    :block="action.block"
    :stop-propagation="action.stopPropagation"
    :title="action.title"
    :class="action.class"
    @click="action.onClick?.($event)"
  >
    {{ getResolvedLabel(action) }}
  </BaseButton>
</template>
