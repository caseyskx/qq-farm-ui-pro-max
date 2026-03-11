<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  title?: string
  description?: string
}>()

const attrs = useAttrs()

const headerAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-section-head', attrs.class],
}))
</script>

<template>
  <div v-bind="headerAttrs">
    <div>
      <slot name="title">
        <h2 v-if="title" class="ui-section-head__title">
          {{ title }}
        </h2>
      </slot>
      <slot name="description">
        <p v-if="description" class="ui-section-head__desc">
          {{ description }}
        </p>
      </slot>
    </div>
    <slot />
  </div>
</template>
