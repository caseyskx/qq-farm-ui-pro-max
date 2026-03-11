<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import BaseSectionHeader from '@/components/ui/BaseSectionHeader.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  title?: string
  description?: string
  titleClass?: string
  descriptionClass?: string
  headerClass?: string
  mobileClass?: string
  bodyClass?: string
  footerClass?: string
}>(), {
  title: '',
  description: '',
  titleClass: '',
  descriptionClass: '',
  headerClass: '',
  mobileClass: '',
  bodyClass: '',
  footerClass: '',
})

const attrs = useAttrs()
const slots = useSlots()

const cardAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['glass-panel', 'ui-table-card', attrs.class],
}))

const showHeader = computed(() =>
  !!props.title
  || !!props.description
  || !!slots.title
  || !!slots.description
  || !!slots['header-meta'],
)
</script>

<template>
  <section v-bind="cardAttrs">
    <BaseSectionHeader
      v-if="showHeader"
      :class="headerClass"
    >
      <template v-if="$slots.title" #title>
        <slot name="title" />
      </template>
      <template v-else-if="title" #title>
        <h2 class="ui-section-head__title" :class="titleClass">
          {{ title }}
        </h2>
      </template>

      <template v-if="$slots.description" #description>
        <slot name="description" />
      </template>
      <template v-else-if="description" #description>
        <p class="ui-section-head__desc" :class="descriptionClass">
          {{ description }}
        </p>
      </template>

      <slot name="header-meta" />
    </BaseSectionHeader>

    <div v-if="$slots.mobile" class="ui-table-section-card__mobile" :class="mobileClass">
      <slot name="mobile" />
    </div>

    <div v-if="$slots.default" class="ui-table-section-card__body" :class="bodyClass">
      <slot />
    </div>

    <div v-if="$slots.footer" class="ui-table-section-card__footer" :class="footerClass">
      <slot name="footer" />
    </div>
  </section>
</template>

<style scoped>
.ui-table-section-card__mobile,
.ui-table-section-card__body,
.ui-table-section-card__footer {
  min-width: 0;
}

.ui-table-section-card__footer {
  border-top: 1px solid var(--ui-border-subtle);
}
</style>
