<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  stopPropagation?: boolean
  block?: boolean
  to?: string
  href?: string
  type?: 'button' | 'submit' | 'reset'
  iconClass?: string
  loadingLabel?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const componentTag = computed(() => {
  if (props.to)
    return RouterLink
  if (props.href)
    return 'a'
  return 'button'
})

const isTextLike = computed(() => props.variant === 'text')
const hasVisualIcon = computed(() => props.loading || !!props.iconClass)
const resolvedLoadingLabel = computed(() => props.loading && props.loadingLabel ? props.loadingLabel : '')

const baseClasses = computed(() => [
  'ui-btn inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
  !isTextLike.value && 'ui-action-button',
])

const variantClasses = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'ui-btn-primary shadow-sm'
    case 'secondary':
      return 'ui-btn-secondary'
    case 'success':
      return 'ui-btn-success shadow-sm'
    case 'danger':
      return 'ui-btn-danger shadow-sm'
    case 'ghost':
      return 'ui-btn-ghost'
    case 'outline':
      return 'ui-btn-outline border'
    case 'text':
      return 'ui-btn-text p-0 bg-transparent shadow-none hover:bg-transparent'
    default:
      return 'ui-btn-primary shadow-sm'
  }
})

const sizeClasses = computed(() => {
  if (props.variant === 'text')
    return ''

  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-sm'
    case 'lg':
      return 'px-6 py-3 text-lg'
    default:
      return 'px-4 py-2 text-sm'
  }
})

const widthClasses = computed(() => props.block ? 'w-full' : '')

function handleClick(event: MouseEvent) {
  if (props.stopPropagation)
    event.stopPropagation()

  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <component
    :is="componentTag"
    :to="to"
    :href="href"
    :type="!to && !href ? (type || 'button') : undefined"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : 'false'"
    :aria-disabled="disabled || loading ? 'true' : 'false'"
    :class="[baseClasses, variantClasses, sizeClasses, widthClasses]"
    v-bind="$attrs"
    @click="handleClick"
  >
    <span
      v-if="hasVisualIcon"
      class="ui-action-button__icon"
      :class="loading ? 'i-svg-spinners-ring-resize' : iconClass"
    />
    <span class="ui-action-button__label">
      <template v-if="resolvedLoadingLabel">
        {{ resolvedLoadingLabel }}
      </template>
      <slot v-else />
    </span>
  </component>
</template>

<style scoped>
.ui-btn {
  border-color: transparent;
}

.ui-btn:focus-visible {
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.ui-btn-primary {
  background: color-mix(in srgb, var(--ui-brand-600) 92%, var(--ui-bg-surface) 8%);
  color: var(--ui-text-on-brand);
}

.ui-btn-primary:hover {
  background: color-mix(in srgb, var(--ui-brand-700) 94%, var(--ui-bg-surface) 6%);
}

.ui-btn-secondary {
  background: var(--ui-bg-surface);
  color: var(--ui-text-1);
  border: 1px solid var(--ui-border-subtle);
}

.ui-btn-secondary:hover {
  background: var(--ui-bg-surface-raised);
}

.ui-btn-success {
  background: var(--ui-status-success);
  color: var(--ui-text-on-brand);
}

.ui-btn-success:hover {
  filter: brightness(0.96);
}

.ui-btn-danger {
  background: var(--ui-status-danger);
  color: var(--ui-text-on-brand);
}

.ui-btn-danger:hover {
  filter: brightness(0.96);
}

.ui-btn-ghost {
  color: var(--ui-text-2);
}

.ui-btn-ghost:hover {
  background: var(--ui-bg-surface);
  color: var(--ui-text-1);
}

.ui-btn-outline {
  border-color: var(--ui-border-strong);
  color: var(--ui-text-1);
  background: transparent;
}

.ui-btn-outline:hover {
  background: var(--ui-bg-surface);
}

.ui-btn-text {
  color: var(--ui-text-1);
}
</style>
