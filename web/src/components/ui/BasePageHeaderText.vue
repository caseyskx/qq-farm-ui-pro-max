<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  title: string
  description?: string
  titleClass?: string
  descriptionClass?: string
}>(), {
  description: '',
  titleClass: '',
  descriptionClass: '',
})

const attrs = useAttrs()

const introAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-page-header-text', attrs.class],
}))
</script>

<template>
  <div v-bind="introAttrs">
    <h1 class="ui-page-title" :class="titleClass">
      {{ title }}
    </h1>
    <p v-if="description" class="ui-page-desc" :class="descriptionClass">
      {{ description }}
    </p>
  </div>
</template>
