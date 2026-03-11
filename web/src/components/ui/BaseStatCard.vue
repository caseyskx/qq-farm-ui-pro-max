<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<{
  label?: string
  value?: string | number
  description?: string
  labelClass?: string
  valueClass?: string
  descriptionClass?: string
}>()

const attrs = useAttrs()

const cardAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['glass-panel', 'ui-stat-card', attrs.class],
}))
</script>

<template>
  <article v-bind="cardAttrs">
    <slot name="label">
      <p v-if="label" class="ui-stat-card__label" :class="labelClass">
        {{ label }}
      </p>
    </slot>

    <slot name="value">
      <p v-if="value !== undefined && value !== null && value !== ''" class="ui-stat-card__value" :class="valueClass">
        {{ value }}
      </p>
    </slot>

    <slot name="description">
      <p v-if="description" class="ui-stat-card__description" :class="descriptionClass">
        {{ description }}
      </p>
    </slot>

    <slot />
  </article>
</template>
