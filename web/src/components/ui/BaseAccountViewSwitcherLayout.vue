<script setup lang="ts">
import type { ActionButtonDefinition } from '@/utils/management-schema'
import { computed, useAttrs, useSlots } from 'vue'
import BaseActionButtons from '@/components/ui/BaseActionButtons.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  actions?: ActionButtonDefinition[]
}>(), {
  actions: () => [],
})

const attrs = useAttrs()
const slots = useSlots()

const layoutAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-account-view-layout', attrs.class],
}))

const hasNoteSection = computed(() => !!slots.meta || !!slots.note)
const hasActionsSection = computed(() => !!slots['actions-meta'] || !!slots.actions || props.actions.length > 0)
</script>

<template>
  <div v-bind="layoutAttrs">
    <div class="ui-account-view-layout__main">
      <slot name="main" />
    </div>
    <div class="ui-account-view-layout__aside">
      <div v-if="$slots.switchers" class="ui-account-view-layout__switchers">
        <slot name="switchers" />
      </div>
      <div v-if="hasNoteSection" class="ui-account-view-layout__note">
        <slot name="meta">
          <slot name="note" />
        </slot>
      </div>
      <div v-if="hasActionsSection" class="ui-account-view-layout__actions">
        <slot name="actions-meta" />
        <slot name="actions">
          <BaseActionButtons :actions="actions" />
        </slot>
      </div>
    </div>
  </div>
</template>
