<script setup lang="ts">
import { computed, ref, useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  type?: string
  placeholder?: string
  label?: string
  disabled?: boolean
  clearable?: boolean
  autocomplete?: string
  hint?: string
  error?: string
}>()
const emit = defineEmits<{
  (e: 'clear'): void
}>()
const model = defineModel<string | number>()
const showPassword = ref(false)
const attrs = useAttrs()
const wrapperAttrs = computed<Record<string, any>>(() => ({
  class: attrs.class,
  style: attrs.style,
}))
const inputAttrs = computed<Record<string, any>>(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const inputType = computed(() => {
  if (props.type === 'password' && showPassword.value) {
    return 'text'
  }
  return props.type || 'text'
})
const helperText = computed(() => props.error || props.hint || '')
const hasError = computed(() => !!props.error)
</script>

<template>
  <div class="flex flex-col gap-1.5" v-bind="wrapperAttrs">
    <label v-if="label" class="glass-text-muted text-sm font-medium">
      {{ label }}
    </label>
    <div class="relative">
      <input
        v-model="model"
        v-bind="inputAttrs"
        :type="inputType"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autocomplete"
        class="base-input glass-text-main w-full border rounded-lg px-3 py-2 shadow-sm outline-none backdrop-blur-sm transition-all duration-200"
        :class="{ 'pr-10': type === 'password' || (clearable && model), 'base-input-error': hasError }"
      >
      <button
        v-if="type === 'password'"
        type="button"
        class="base-input-icon absolute right-3 top-1/2 -translate-y-1/2"
        @click="showPassword = !showPassword"
      >
        <div v-if="showPassword" class="i-carbon-view-off" />
        <div v-else class="i-carbon-view" />
      </button>

      <button
        v-else-if="clearable && model"
        type="button"
        class="base-input-icon absolute right-3 top-1/2 -translate-y-1/2"
        @click="model = ''; emit('clear')"
      >
        <div class="i-carbon-close" />
      </button>
    </div>
    <p
      v-if="helperText"
      class="text-xs leading-5"
      :class="hasError ? 'base-input-helper-error' : 'glass-text-muted'"
    >
      {{ helperText }}
    </p>
  </div>
</template>

<style scoped>
.base-input::-ms-reveal,
.base-input::-ms-clear {
  display: none;
}

.base-input {
  min-height: var(--ui-control-height);
  border-color: var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent);
  border-radius: var(--ui-control-radius);
}

.base-input:focus {
  border-color: var(--ui-brand-500);
  background: var(--ui-bg-surface-raised);
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.base-input:disabled {
  background: color-mix(in srgb, var(--ui-bg-surface) 38%, transparent);
  color: var(--ui-text-3);
}

.base-input.base-input-error {
  border-color: color-mix(in srgb, var(--ui-status-danger) 72%, var(--ui-border-subtle) 28%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-status-danger) 14%, transparent);
}

.base-input::placeholder {
  color: var(--ui-text-2);
}

.base-input-helper-error {
  color: var(--ui-status-danger);
}

.base-input-icon {
  color: var(--ui-text-3);
}

.base-input-icon:hover {
  color: var(--ui-text-1);
}
</style>
