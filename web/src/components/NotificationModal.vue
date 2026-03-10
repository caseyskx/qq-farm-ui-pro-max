<script setup lang="ts">
import { computed } from 'vue'
import NotificationPanel from '@/components/NotificationPanel.vue'
import { useAppStore } from '@/stores/app'

defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const appStore = useAppStore()
const supportQqGroup = computed(() => appStore.supportQqGroup)
const copyrightText = computed(() => appStore.copyrightText)
const UPDATE_MODAL_SYNC_NOTE = '当前版本的已读状态会跟随当前登录账号同步到服务器；离线时仍会先用本机缓存兜底。'
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- 玻璃态遮罩 -->
      <div
        class="notification-modal-backdrop absolute inset-0 backdrop-blur-md transition-opacity"
        @click="emit('close')"
      />

      <div
        class="notification-modal-panel glass-panel relative max-h-[85vh] max-w-md w-full flex flex-col transform overflow-hidden rounded-2xl shadow-2xl transition-all"
        @click.stop
      >
        <!-- 头部 -->
        <div class="notification-modal-header flex shrink-0 items-center justify-between px-6 py-5">
          <div class="flex items-center gap-2.5">
            <div class="notification-modal-icon-shell h-8 w-8 flex items-center justify-center rounded-full">
              <div class="notification-modal-icon i-carbon-notification-new text-lg" />
            </div>
            <h3 class="glass-text-main text-xl font-bold tracking-wide">
              更新公告
            </h3>
          </div>
          <button
            class="notification-modal-close rounded-full p-2 transition-colors"
            @click="emit('close')"
          >
            <div class="i-carbon-close text-xl" />
          </button>
        </div>

        <!-- 内容区（可滚动） -->
        <div class="custom-scrollbar flex-1 overflow-y-auto bg-transparent p-5">
          <NotificationPanel mode="sidebar" :limit="5" />
        </div>

        <!-- 底部动作条 -->
        <div class="notification-modal-footer glass-panel shrink-0 px-6 py-4">
          <p class="notification-modal-sync-note mb-3 text-xs leading-5">
            {{ UPDATE_MODAL_SYNC_NOTE }}
          </p>
          <!-- 作者信息流水 -->
          <div class="glass-text-muted pointer-events-none mb-4 flex select-none items-center justify-between px-1 text-[10px] font-mono">
            <div class="flex items-center gap-1.5">
              <div class="i-carbon-user-avatar" />
              <span>{{ copyrightText }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <div class="i-carbon-user-multiple" />
              <span>QQ群: {{ supportQqGroup }}</span>
            </div>
          </div>
          <button
            class="notification-modal-confirm relative w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold transition-all active:scale-[0.98] focus:outline-none"
            @click="emit('close')"
          >
            <div class="i-carbon-checkmark text-xl" />
            <span>我知道了，立即体验</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-modal-backdrop {
  background: var(--ui-overlay-backdrop) !important;
}

.notification-modal-panel,
.notification-modal-header,
.notification-modal-footer {
  border: 1px solid var(--ui-border-subtle) !important;
}

.notification-modal-header,
.notification-modal-footer {
  border-left: none !important;
  border-right: none !important;
}

.notification-modal-header {
  border-top: none !important;
}

.notification-modal-footer {
  border-bottom: none !important;
}

.notification-modal-close {
  color: var(--ui-text-2) !important;
}

.notification-modal-close:hover {
  color: var(--ui-text-1) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent) !important;
}

.notification-modal-confirm {
  background: linear-gradient(to right, var(--ui-brand-500), var(--ui-brand-600)) !important;
  color: var(--ui-text-on-brand) !important;
  box-shadow: 0 16px 28px color-mix(in srgb, var(--ui-brand-500) 24%, transparent) !important;
}

.notification-modal-confirm:hover {
  filter: brightness(0.98);
}

.notification-modal-icon-shell {
  background: color-mix(in srgb, var(--ui-brand-500) 14%, transparent);
}

.notification-modal-icon {
  color: var(--ui-brand-500) !important;
}

.notification-modal-sync-note {
  color: color-mix(in srgb, var(--ui-brand-600) 72%, var(--ui-text-2) 28%) !important;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
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
