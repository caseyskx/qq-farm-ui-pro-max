<script setup lang="ts">
import type { ActionButtonDefinition, PageHeaderTextDefinition } from '@/utils/management-schema'
import { computed, useAttrs, useSlots } from 'vue'
import BaseManagementTableLayout from '@/components/ui/BaseManagementTableLayout.vue'
import BasePageHeader from '@/components/ui/BasePageHeader.vue'
import BasePageHeaderText from '@/components/ui/BasePageHeaderText.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  headerText?: PageHeaderTextDefinition | null
  headerActions?: ActionButtonDefinition[]
}>(), {
  headerText: null,
  headerActions: () => [],
})

const attrs = useAttrs()
const slots = useSlots()

const pageAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-page-shell', 'ui-page-stack', 'ui-page-density-compact', attrs.class],
}))

const hasHeader = computed(() =>
  !!props.headerText
  || props.headerActions.length > 0
  || !!slots['header-main']
  || !!slots['header-meta']
  || !!slots['header-actions'],
)
</script>

<template>
  <div v-bind="pageAttrs">
    <BasePageHeader
      v-if="hasHeader"
      :actions="headerActions"
    >
      <template #main>
        <slot name="header-main">
          <BasePageHeaderText
            v-if="headerText"
            :title="headerText.title"
            :description="headerText.description"
            :title-class="headerText.titleClass"
            :description-class="headerText.descriptionClass"
          />
        </slot>
      </template>

      <template v-if="$slots['header-meta']" #meta>
        <slot name="header-meta" />
      </template>

      <template v-if="$slots['header-actions']" #actions>
        <slot name="header-actions" />
      </template>
    </BasePageHeader>

    <BaseManagementTableLayout>
      <template v-if="$slots.summary" #summary>
        <slot name="summary" />
      </template>
      <template v-if="$slots.filters" #filters>
        <slot name="filters" />
      </template>
      <template v-if="$slots.supporting" #supporting>
        <slot name="supporting" />
      </template>
      <template v-if="$slots.table" #table>
        <slot name="table" />
      </template>
    </BaseManagementTableLayout>
  </div>
</template>
