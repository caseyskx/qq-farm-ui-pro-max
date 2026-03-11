<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  label?: string
  iconClass?: string
  labelClass?: string
  bodyClass?: string
}>(), {
  label: '',
  iconClass: '',
  labelClass: '',
  bodyClass: '',
})

const attrs = useAttrs()

const cardAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-record-metric-card', attrs.class],
}))
</script>

<template>
  <div v-bind="cardAttrs">
    <slot name="label">
      <div v-if="label" class="ui-record-metric-card__label" :class="labelClass">
        <div v-if="iconClass" :class="iconClass" />
        <span>{{ label }}</span>
      </div>
    </slot>

    <div class="ui-record-metric-card__body" :class="bodyClass">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ui-record-metric-card {
  min-height: 6.75rem;
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
  padding: 0.875rem;
}

.ui-record-metric-card.accounts-record-field {
  min-height: 0;
  padding: 0.75rem;
}

.ui-record-metric-card__label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ui-text-3) !important;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.ui-record-metric-card__body {
  margin-top: 0.625rem;
  min-width: 0;
}

.ui-record-metric-card.accounts-record-field .ui-record-metric-card__body {
  margin-top: 0.5rem;
}
</style>
