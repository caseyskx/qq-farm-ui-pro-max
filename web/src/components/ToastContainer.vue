<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useToastStore } from '@/stores/toast'

const toastStore = useToastStore()
const { toasts } = storeToRefs(toastStore)

function getIcon(type: string) {
  switch (type) {
    case 'success': return 'i-carbon-checkmark-filled toast-icon toast-icon-success'
    case 'error': return 'i-carbon-error-filled toast-icon toast-icon-error'
    case 'warning': return 'i-carbon-warning-filled toast-icon toast-icon-warning'
    case 'info': return 'i-carbon-information-filled toast-icon toast-icon-info'
    default: return 'i-carbon-information-filled toast-icon toast-icon-info'
  }
}

function getBgColor(_type: string) {
  return 'glass-panel toast-surface border-l-4 backdrop-blur-md'
}

function getBorderColor(type: string) {
  switch (type) {
    case 'success': return 'toast-success'
    case 'error': return 'toast-error'
    case 'warning': return 'toast-warning'
    case 'info': return 'toast-info'
    default: return 'toast-info'
  }
}
</script>

<template>
  <div class="fixed right-4 top-4 z-[9999] flex flex-col gap-2">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="w-80 flex items-start gap-3 rounded p-4 shadow-lg transition-all duration-300"
        :class="[getBgColor(toast.type), getBorderColor(toast.type)]"
      >
        <div :class="getIcon(toast.type)" class="mt-0.5 shrink-0 text-xl" />
        <div class="glass-text-main flex-1 break-words text-sm">
          {{ toast.message }}
        </div>
        <button class="toast-close shrink-0" @click="toastStore.remove(toast.id)">
          <div class="i-carbon-close text-lg" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.toast-success {
  border-left-color: var(--ui-status-success) !important;
}
.toast-error {
  border-left-color: var(--ui-status-danger) !important;
}
.toast-warning {
  border-left-color: var(--ui-status-warning) !important;
}
.toast-info {
  border-left-color: var(--ui-status-info) !important;
}

.toast-surface {
  border-top: 1px solid color-mix(in srgb, var(--ui-border-subtle) 88%, transparent);
  border-right: 1px solid color-mix(in srgb, var(--ui-border-subtle) 88%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--ui-border-subtle) 88%, transparent);
}

.toast-icon-success {
  color: var(--ui-status-success);
}
.toast-icon-error {
  color: var(--ui-status-danger);
}
.toast-icon-warning {
  color: var(--ui-status-warning);
}
.toast-icon-info {
  color: var(--ui-status-info);
}

.toast-close {
  color: var(--ui-text-3);
}

.toast-close:hover {
  color: var(--ui-text-1);
}
</style>
