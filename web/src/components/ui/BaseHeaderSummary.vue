<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

withDefaults(defineProps<{
  prefix?: string
  value?: string | number
  separator?: string
  secondaryValue?: string | number
  suffix?: string
  valueClass?: string
  secondaryValueClass?: string
}>(), {
  prefix: '',
  value: '',
  separator: '',
  secondaryValue: '',
  suffix: '',
  valueClass: '',
  secondaryValueClass: '',
})

const attrs = useAttrs()

const summaryAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-header-summary', attrs.class],
}))
</script>

<template>
  <div v-bind="summaryAttrs">
    <span v-if="prefix">{{ prefix }} </span>
    <span v-if="value !== ''" :class="valueClass">{{ value }}</span>
    <span v-if="separator"> {{ separator }} </span>
    <span v-if="secondaryValue !== ''" :class="secondaryValueClass">{{ secondaryValue }}</span>
    <span v-if="suffix"> {{ suffix }}</span>
  </div>
</template>
