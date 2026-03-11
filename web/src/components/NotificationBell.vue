<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatusStore } from '@/stores/status'

const statusStore = useStatusStore()
const showPanel = ref(false)
const lastReadTime = ref(Date.now())

const alertLogs = computed(() => {
  return statusStore.logs
    .filter(l => l.tag === '系统' || l.tag === '错误' || l.isWarn)
    .slice(-15)
    .reverse()
})

const unreadCount = computed(() => {
  return alertLogs.value.filter(l => new Date(l.time).getTime() > lastReadTime.value).length
})

function togglePanel() {
  showPanel.value = !showPanel.value
  if (showPanel.value) {
    lastReadTime.value = Date.now()
  }
}

function getLogTagClass(log: { tag?: string, isWarn?: boolean }) {
  return log.tag === '错误' || log.isWarn
    ? 'notification-bell-tag notification-bell-tag--danger'
    : 'notification-bell-tag notification-bell-tag--info'
}
</script>

<template>
  <div class="relative">
    <button
      class="notification-bell-trigger glass-panel glass-text-main h-10 w-10 flex items-center justify-center border rounded-full shadow-md transition-all duration-300 hover:rotate-12 hover:text-primary focus:outline-none"
      title="系统通知"
      @click="togglePanel"
    >
      <div class="i-carbon-notification text-xl" />
      <span v-if="unreadCount > 0" class="absolute right-0 top-0 h-3 w-3 flex">
        <span class="notification-bell-dot-ping absolute h-full w-full inline-flex animate-ping rounded-full opacity-75" />
        <span class="notification-bell-dot-core relative h-3 w-3 inline-flex rounded-full" />
      </span>
    </button>

    <!-- Dropdown Panel -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-1 scale-95"
    >
      <!-- Ensure z-50 for overlapping everything -->
      <div v-if="showPanel" class="notification-bell-panel glass-panel absolute right-0 top-12 z-50 mt-2 w-80 overflow-hidden border rounded-xl shadow-2xl">
        <div class="notification-bell-header flex items-center justify-between px-4 py-3">
          <h3 class="glass-text-main flex items-center gap-2 text-sm font-bold">
            <div class="i-carbon-notification text-base text-primary" /> 系统消息公告
          </h3>
          <button class="notification-bell-close glass-text-muted hover:glass-text-main" @click="showPanel = false">
            <div class="i-carbon-close" />
          </button>
        </div>
        <div class="custom-scrollbar max-h-96 overflow-y-auto px-2 py-3 space-y-2">
          <div v-if="alertLogs.length === 0" class="glass-text-muted p-6 text-center text-sm">
            📭 暂无活动记录或系统通知
          </div>
          <template v-else>
            <div v-for="(log, idx) in alertLogs" :key="idx" class="notification-bell-item flex flex-col gap-1 rounded-lg p-3 text-xs shadow-sm transition-colors lg:text-[13px]">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1 font-bold" :class="getLogTagClass(log)">
                  <div :class="log.tag === '错误' || log.isWarn ? 'i-carbon-warning-alt' : 'i-carbon-information'" />
                  [{{ log.tag }}]
                </span>
                <span class="glass-text-muted text-[11px]">{{ log.time }}</span>
              </div>
              <div class="glass-text-main mt-1 break-words">
                {{ log.msg }}
              </div>
              <div v-if="log.accountName" class="glass-text-muted mt-1 text-[11px] font-mono">
                👤 {{ log.accountName }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-bell-trigger,
.notification-bell-panel,
.notification-bell-item {
  border-color: var(--ui-border-subtle);
}

.notification-bell-trigger:focus-visible,
.notification-bell-close:focus-visible {
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.notification-bell-panel {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent);
}

.notification-bell-header {
  border-bottom: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface) 66%, transparent);
}

.notification-bell-close {
  border-radius: 999px;
  padding: 0.25rem;
}

.notification-bell-item {
  background: color-mix(in srgb, var(--ui-bg-surface) 62%, transparent);
}

.notification-bell-item:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent);
}

.notification-bell-dot-ping {
  background: color-mix(in srgb, var(--ui-status-danger) 72%, transparent);
}

.notification-bell-dot-core {
  background: var(--ui-status-danger);
}

.notification-bell-tag--danger {
  color: var(--ui-status-danger);
}

.notification-bell-tag--info {
  color: var(--ui-status-info);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--ui-scrollbar-thumb) 70%, transparent);
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--ui-scrollbar-thumb-hover) 82%, transparent);
}
</style>
