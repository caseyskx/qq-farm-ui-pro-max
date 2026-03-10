<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  danger?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  danger: false,
  disabled: false,
  type: 'button',
})

const attrs = useAttrs()
const buttonAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-icon-action', props.danger ? 'ui-icon-action--danger' : '', attrs.class],
}))
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    v-bind="buttonAttrs"
  >
    <slot />
  </button>
</template>
