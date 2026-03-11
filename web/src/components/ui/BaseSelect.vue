<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

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
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuPlacement = ref<'top' | 'bottom'>('bottom')
const menuStyle = ref<Record<string, string>>({})
const MENU_GAP = 8
const MENU_MARGIN = 12
const MENU_MAX_HEIGHT = 240

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

function updateDropdownPosition() {
  if (!isOpen.value || !triggerRef.value)
    return

  const rect = triggerRef.value.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight
  const menuWidth = Math.min(Math.max(rect.width, 160), Math.max(160, viewportWidth - MENU_MARGIN * 2))
  const left = Math.min(
    Math.max(rect.left, MENU_MARGIN),
    Math.max(MENU_MARGIN, viewportWidth - menuWidth - MENU_MARGIN),
  )
  const spaceBelow = Math.max(0, viewportHeight - rect.bottom - MENU_MARGIN - MENU_GAP)
  const spaceAbove = Math.max(0, rect.top - MENU_MARGIN - MENU_GAP)
  const placeTop = spaceBelow < 180 && spaceAbove > spaceBelow
  const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, placeTop ? spaceAbove : spaceBelow))

  menuPlacement.value = placeTop ? 'top' : 'bottom'
  menuStyle.value = {
    left: `${left}px`,
    width: `${menuWidth}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '80',
    transformOrigin: placeTop ? 'bottom center' : 'top center',
    ...(placeTop
      ? { bottom: `${Math.max(MENU_MARGIN, viewportHeight - rect.top + MENU_GAP)}px` }
      : { top: `${Math.min(viewportHeight - MENU_MARGIN, rect.bottom + MENU_GAP)}px` }),
  }
}

function closeDropdown(e: MouseEvent) {
  const target = e.target as Node | null
  if (!target)
    return
  if (containerRef.value?.contains(target) || menuRef.value?.contains(target))
    return
  isOpen.value = false
}

function handleViewportChange() {
  if (isOpen.value)
    updateDropdownPosition()
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    isOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', closeDropdown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
  document.removeEventListener('keydown', handleKeydown)
})

watch(isOpen, async (open) => {
  if (!open)
    return
  await nextTick()
  updateDropdownPosition()
})

watch(() => [props.options?.length || 0, model.value], async () => {
  if (!isOpen.value)
    return
  await nextTick()
  updateDropdownPosition()
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
        ref="triggerRef"
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
      <Teleport to="body">
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
            ref="menuRef"
            class="glass-panel base-select-menu base-select-menu--floating fixed max-h-60 overflow-auto border rounded-lg py-1 shadow-lg"
            :class="menuPlacement === 'top' ? 'base-select-menu--top' : 'base-select-menu--bottom'"
            :style="menuStyle"
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
      </Teleport>
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

.base-select-menu--floating {
  margin-top: 0 !important;
  overscroll-behavior: contain;
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
