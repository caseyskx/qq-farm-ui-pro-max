<script setup lang="ts">
import type { ActionButtonDefinition, ChipDefinition, HistoryMetaItemDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseActionButtons from '@/components/ui/BaseActionButtons.vue'
import BaseHistoryPanelTitle from '@/components/ui/BaseHistoryPanelTitle.vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  title?: string
  description?: string
  actions?: ActionButtonDefinition[]
  titleChips?: ChipDefinition[]
  titleMeta?: HistoryMetaItemDefinition[]
}>(), {
  title: '',
  description: '',
  actions: () => [],
  titleChips: () => [],
  titleMeta: () => [],
})

const attrs = useAttrs()

const panelAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['glass-panel', 'ui-history-panel', attrs.class],
}))
</script>

<template>
  <section v-bind="panelAttrs">
    <div class="ui-history-panel__header">
      <div class="ui-history-panel__intro">
        <div class="ui-history-panel__heading">
          <slot name="title">
            <BaseHistoryPanelTitle
              v-if="title"
              :title="title"
              :chips="titleChips"
              :meta="titleMeta"
            />
          </slot>
          <slot name="meta" />
        </div>
        <slot name="description">
          <p v-if="description" class="ui-history-panel__desc">
            {{ description }}
          </p>
        </slot>
      </div>
      <div v-if="$slots.actions || actions.length" class="ui-history-panel__actions">
        <slot name="actions">
          <BaseActionButtons :actions="actions" />
        </slot>
      </div>
    </div>

    <div v-if="$slots.default" class="ui-history-panel__content">
      <slot />
    </div>

    <div v-if="$slots.recent" class="ui-history-panel__recent">
      <slot name="recent" />
    </div>
  </section>
</template>
