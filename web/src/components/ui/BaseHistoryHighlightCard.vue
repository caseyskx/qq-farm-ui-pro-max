<script setup lang="ts">
import type { HistoryMetaItemDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseHistoryMetaList from '@/components/ui/BaseHistoryMetaList.vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  title: string
  subtitle?: string
  description?: string
  detailLines?: string[]
  note?: string
  headerMeta?: HistoryMetaItemDefinition[]
  titleClass?: string
  subtitleClass?: string
  descriptionClass?: string
  noteClass?: string
  detailsClass?: string
  detailLineClass?: string
}>(), {
  subtitle: '',
  description: '',
  detailLines: () => [],
  note: '',
  headerMeta: () => [],
  titleClass: '',
  subtitleClass: '',
  descriptionClass: '',
  noteClass: '',
  detailsClass: '',
  detailLineClass: '',
})

const attrs = useAttrs()

const cardAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-history-highlight-card', attrs.class],
}))
</script>

<template>
  <div v-bind="cardAttrs">
    <slot name="header">
      <BaseHistoryMetaList v-if="headerMeta.length" :items="headerMeta" />
    </slot>
    <div v-if="title" :class="titleClass">
      {{ title }}
    </div>
    <div v-if="subtitle" :class="subtitleClass">
      {{ subtitle }}
    </div>
    <div v-if="description" :class="descriptionClass">
      {{ description }}
    </div>
    <div v-if="note" :class="noteClass">
      {{ note }}
    </div>
    <div v-if="detailLines.length" :class="detailsClass">
      <div
        v-for="line in detailLines"
        :key="line"
        :class="detailLineClass"
      >
        {{ line }}
      </div>
    </div>
    <slot />
  </div>
</template>
