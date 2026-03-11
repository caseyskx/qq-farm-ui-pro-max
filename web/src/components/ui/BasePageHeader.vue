<script setup lang="ts">
import type { ActionButtonDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseActionButtons from '@/components/ui/BaseActionButtons.vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  title?: string
  description?: string
  titleClass?: string
  descriptionClass?: string
  actions?: ActionButtonDefinition[]
}>(), {
  title: '',
  description: '',
  titleClass: '',
  descriptionClass: '',
  actions: () => [],
})

const attrs = useAttrs()

const headerAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-page-header', attrs.class],
}))
</script>

<template>
  <div v-bind="headerAttrs">
    <div class="ui-page-header__main">
      <slot name="main">
        <h1 v-if="title" class="ui-page-title" :class="titleClass">
          {{ title }}
        </h1>
        <p v-if="description" class="ui-page-desc" :class="descriptionClass">
          {{ description }}
        </p>
      </slot>
      <slot name="meta" />
    </div>
    <div v-if="$slots.actions || actions.length" class="ui-page-actions">
      <slot name="actions">
        <BaseActionButtons :actions="actions" />
      </slot>
    </div>
  </div>
</template>
