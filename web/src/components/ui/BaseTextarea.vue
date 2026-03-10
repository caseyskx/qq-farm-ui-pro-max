<script setup lang="ts">
defineProps<{
  placeholder?: string
  label?: string
  disabled?: boolean
  rows?: number
}>()
const model = defineModel<string>()
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label v-if="label" class="glass-text-muted text-sm font-medium">
      {{ label }}
    </label>
    <textarea
      v-model="model"
      :rows="rows || 3"
      :placeholder="placeholder"
      :disabled="disabled"
      class="base-textarea glass-text-main w-full border rounded-lg px-3 py-2 shadow-sm outline-none backdrop-blur-sm transition-all duration-200"
    />
  </div>
</template>

<style scoped>
.base-textarea {
  min-height: calc(var(--ui-control-height) * 1.7);
  border-color: var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent);
  border-radius: var(--ui-control-radius);
}

.base-textarea:focus {
  border-color: var(--ui-brand-500);
  background: var(--ui-bg-surface-raised);
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.base-textarea:disabled {
  background: color-mix(in srgb, var(--ui-bg-surface) 38%, transparent);
  color: var(--ui-text-3);
}

.base-textarea::placeholder {
  color: var(--ui-text-2);
}
</style>
