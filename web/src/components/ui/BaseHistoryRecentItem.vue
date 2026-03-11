<script setup lang="ts">
import type { HistoryRecentItemDefinition } from '@/utils/management-schema'
import { computed, useAttrs } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  item: HistoryRecentItemDefinition
  tag?: 'button' | 'div'
}>(), {
  tag: 'button',
})

const attrs = useAttrs()

const itemAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: ['ui-history-recent-item', props.item.class, attrs.class],
}))

const visibleDetailLines = computed(() => {
  const lines = props.item.detailLines || []
  const limit = props.item.detailLimit ?? lines.length
  return lines.slice(0, limit)
})

const resolvedIconClass = computed(() => {
  if (props.item.copied && props.item.copiedIconClass)
    return props.item.copiedIconClass
  return props.item.iconClass || ''
})
</script>

<template>
  <component
    :is="tag"
    :type="tag === 'button' ? 'button' : undefined"
    v-bind="itemAttrs"
    @click="item.onClick?.($event)"
  >
    <div :class="item.headerClass || 'flex items-start justify-between gap-3'">
      <div class="min-w-0">
        <div :class="item.titleClass">
          {{ item.title }}
        </div>
        <div v-if="item.subtitle" :class="item.subtitleClass">
          {{ item.subtitle }}
        </div>
      </div>
      <div
        v-if="(item.badges && item.badges.length) || resolvedIconClass"
        :class="item.badgeGroupClass || 'flex items-center gap-2'"
      >
        <template v-for="badge in item.badges || []" :key="`${item.key}-${badge.text}`">
          <BaseBadge
            v-if="badge.surface || badge.tone"
            :surface="badge.surface || 'badge'"
            :tone="badge.tone || ''"
            :class="badge.class"
          >
            {{ badge.text }}
          </BaseBadge>
          <span
            v-else
            :class="badge.class"
          >
            {{ badge.text }}
          </span>
        </template>
        <div
          v-if="resolvedIconClass"
          class="text-base transition-transform duration-300"
          :class="resolvedIconClass"
        />
      </div>
    </div>

    <p v-if="item.description" :class="item.descriptionClass">
      {{ item.description }}
    </p>

    <div v-if="item.metrics && item.metrics.length" :class="item.metricsClass">
      <span
        v-for="metric in item.metrics"
        :key="`${item.key}-${metric.text}`"
        :class="metric.class"
      >
        {{ metric.text }}
      </span>
    </div>

    <div v-if="visibleDetailLines.length" :class="item.detailsClass">
      <div
        v-for="line in visibleDetailLines"
        :key="`${item.key}-${line}`"
        :class="item.detailLineClass"
      >
        {{ line }}
      </div>
    </div>

    <div
      v-if="item.footerText"
      :class="[item.footerClass, item.copied && item.footerActiveClass]"
    >
      {{ item.footerText }}
    </div>
  </component>
</template>

<style scoped>
.ui-history-recent-item {
  min-width: 0;
}
</style>
