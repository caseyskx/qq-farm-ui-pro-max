<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import BaseBadge from '@/components/ui/BaseBadge.vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  compact?: boolean
  current?: boolean
  glowClass?: string
  title: string
  subline?: string
  nickname?: string
  platformLabel?: string
  zoneLabel?: string
  avatarUrl?: string
  hint?: string
}>(), {
  compact: false,
  current: false,
  glowClass: '',
  subline: '',
  nickname: '',
  platformLabel: '',
  zoneLabel: '',
  avatarUrl: '',
  hint: '',
})

const emit = defineEmits<{
  select: []
  avatarError: [event: Event]
}>()

const attrs = useAttrs()

const cardAttrs = computed<Record<string, any>>(() => ({
  ...attrs,
  class: [
    'accounts-card-shell',
    'glass-panel',
    'group',
    'relative',
    'h-full',
    'flex',
    'flex-col',
    'cursor-pointer',
    'overflow-hidden',
    'border',
    'transition-all',
    'duration-300',
    props.compact ? 'rounded-[22px] p-4' : 'rounded-[26px] p-4.5',
    props.current ? 'accounts-card-current' : 'accounts-card-idle',
    props.glowClass,
    attrs.class,
  ],
}))

const heroSpanClass = computed(() => props.compact ? 'sm:col-span-2' : 'md:col-span-2 xl:col-span-6')
const fieldsGridClass = computed(() => props.compact ? 'grid-cols-1 sm:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-6')
</script>

<template>
  <div
    v-bind="cardAttrs"
    @click="emit('select')"
  >
    <div class="accounts-record-toolbar flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <slot name="selection" />
        <slot name="badges" />
        <BaseBadge v-if="current" class="accounts-badge-current">
          当前选中
        </BaseBadge>
      </div>
      <div v-if="subline" class="glass-text-muted text-xs leading-5">
        {{ subline }}
      </div>
    </div>

    <div class="accounts-record-grid grid mt-3 gap-3" :class="fieldsGridClass">
      <div class="accounts-meta-card accounts-record-hero" :class="heroSpanClass">
        <div class="accounts-record-hero-grid grid gap-3">
          <div class="min-w-0">
            <div class="accounts-meta-label flex items-center gap-2">
              <div class="i-carbon-user-avatar text-sm" />
              账号信息
            </div>
            <div class="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0 flex flex-1 items-start gap-3">
                <div class="accounts-avatar-shell h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-inner">
                  <img
                    v-if="avatarUrl"
                    :src="avatarUrl"
                    class="h-full w-full object-cover"
                    @error="emit('avatarError', $event)"
                  >
                  <div v-else class="i-carbon-user glass-text-muted text-2xl" />
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="line-clamp-1 text-lg font-semibold leading-tight" :title="title">
                    {{ title }}
                  </h3>
                  <p v-if="subline" class="glass-text-muted mt-1.5 text-sm leading-5">
                    {{ subline }}
                  </p>
                  <p class="glass-text-muted mt-1 text-sm leading-5">
                    昵称：{{ nickname || '暂无昵称' }}
                  </p>
                </div>
              </div>
              <div class="accounts-record-inline-meta min-w-0 lg:w-[160px] lg:shrink-0">
                <div class="accounts-meta-label flex items-center gap-2">
                  <div class="i-carbon-mobile text-sm" />
                  平台 / 区服
                </div>
                <div class="mt-2 text-sm font-semibold leading-6">
                  {{ platformLabel }}
                </div>
                <div class="glass-text-muted mt-1 text-xs leading-5">
                  {{ zoneLabel }}
                </div>
              </div>
            </div>
          </div>

          <div class="accounts-record-hero-actions min-w-0" @click.stop>
            <div class="accounts-meta-label flex items-center gap-2">
              <div class="i-carbon-flash text-sm" />
              快捷操作
            </div>
            <div class="accounts-record-action-grid grid grid-cols-2 mt-3 gap-2">
              <slot name="hero-actions" />
            </div>
            <p v-if="hint" class="glass-text-muted mt-2 text-xs leading-5">
              {{ hint }}
            </p>
          </div>
        </div>
      </div>

      <slot name="fields" />
    </div>
  </div>
</template>

<style scoped>
.accounts-meta-card {
  border: 1px solid var(--ui-border-subtle) !important;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
  padding: 0.8125rem;
}

.accounts-record-hero {
  padding: 0.875rem;
}

.accounts-record-hero-grid {
  align-items: stretch;
  gap: 0.75rem;
}

.accounts-record-inline-meta {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0;
  border: 0 !important;
  background: transparent !important;
}

.accounts-record-hero-actions {
  border-top: 1px solid var(--ui-border-subtle);
  padding-top: 0.75rem;
}

.accounts-record-action-grid {
  align-content: start;
}

.accounts-record-action-grid > * {
  min-height: 2.5rem;
}

.accounts-meta-label {
  color: var(--ui-text-3) !important;
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.accounts-avatar-shell {
  border: 1px solid var(--ui-border-subtle) !important;
  background: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent) !important;
}

.accounts-badge-current {
  background: color-mix(in srgb, var(--ui-brand-500) 12%, transparent) !important;
  color: color-mix(in srgb, var(--ui-brand-700) 82%, var(--ui-text-1)) !important;
}

@media (min-width: 1024px) {
  .accounts-record-inline-meta {
    align-items: flex-end;
    text-align: right;
  }
}
</style>
