<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  label?: string
  options?: { label: string, value: string | number, disabled?: boolean, description?: string }[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'change', value: string | number): void
}>()

const model = defineModel<string | number>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const selectedLabel = computed(() => {
  const selected = props.options?.find(opt => opt.value === model.value)
  return selected ? selected.label : (props.placeholder || '请选择')
})

function toggleDropdown() {
  if (props.disabled)
    return
  isOpen.value = !isOpen.value
}

function selectOption(value: string | number) {
  model.value = value
  isOpen.value = false
  emit('change', value)
}

function closeDropdown(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <div ref="containerRef" class="flex flex-col gap-1.5">
    <label v-if="label" class="glass-text-muted text-sm font-medium">
      {{ label }}
    </label>
    <div class="relative">
      <!-- Trigger -->
      <div
        class="base-select-trigger glass-text-main w-full flex cursor-pointer items-center justify-between border rounded-lg px-3 py-2 shadow-sm outline-none backdrop-blur-sm transition-all duration-200"
        :class="{
          'base-select-disabled cursor-not-allowed': disabled,
          'base-select-open': isOpen,
        }"
        @click="toggleDropdown"
      >
        <span class="truncate">{{ selectedLabel }}</span>
        <div class="i-carbon-chevron-down base-select-arrow text-lg transition-transform duration-200" :class="{ 'rotate-180': isOpen }" />
      </div>

      <!-- Dropdown Menu -->
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          class="glass-panel base-select-menu absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto border rounded-lg py-1 shadow-lg"
        >
          <template v-if="options?.length">
            <div
              v-for="opt in options"
              :key="opt.value"
              class="base-select-option cursor-pointer px-3 py-2 text-sm transition-colors"
              :class="{
                'base-select-option--active': model === opt.value,
                'base-select-option--disabled cursor-not-allowed': opt.disabled,
                'glass-text-main': model !== opt.value && !opt.disabled,
              }"
              @click="!opt.disabled && selectOption(opt.value)"
            >
              <slot name="option" :option="opt" :selected="model === opt.value">
                <div class="flex flex-col">
                  <span>{{ opt.label }}</span>
                  <span v-if="opt.description" class="mt-0.5 text-[10px] leading-tight opacity-60 dark:opacity-50">
                    {{ opt.description }}
                  </span>
                </div>
              </slot>
            </div>
          </template>
          <div v-else class="glass-text-muted px-3 py-2 text-center text-sm">
            暂无选项
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.base-select-trigger {
  min-height: var(--ui-control-height);
  border-color: var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent);
  border-radius: var(--ui-control-radius);
}

.base-select-trigger:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent);
}

.base-select-open {
  border-color: color-mix(in srgb, var(--ui-border-subtle) 48%, var(--ui-brand-500) 52%);
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.base-select-disabled {
  background: color-mix(in srgb, var(--ui-bg-surface) 38%, transparent);
  color: var(--ui-text-3);
}

.base-select-arrow {
  color: var(--ui-text-3);
}

.base-select-menu {
  border-color: var(--ui-border-subtle);
}

.base-select-option:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 72%, transparent);
}

.base-select-option--active {
  background: color-mix(in srgb, var(--ui-brand-500) 12%, transparent);
  color: var(--ui-text-1);
}

.base-select-option--disabled {
  color: var(--ui-text-3);
}

.base-select-option--disabled:hover {
  background: transparent;
}
</style>
