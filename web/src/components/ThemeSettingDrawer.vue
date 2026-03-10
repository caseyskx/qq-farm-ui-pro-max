/* eslint-disable no-alert, unused-imports/no-unused-vars */

<script setup lang="ts">
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { getThemeAppearanceConfig, THEME_OPTIONS } from '@/constants/ui-appearance'
import { useAppStore } from '@/stores/app'

defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const appStore = useAppStore()
function changeTheme(themeKey: string) {
  appStore.setUIConfig({ colorTheme: themeKey })
}

function applyThemeBackground(themeKey: string) {
  appStore.setUIConfig(getThemeAppearanceConfig(
    themeKey,
    appStore.backgroundScope === 'global' ? 'global' : 'login_and_app',
  ))
}

function getThemeCardClass(themeKey: string) {
  return appStore.colorTheme === themeKey
    ? 'theme-drawer-theme-card theme-drawer-theme-card--active'
    : 'theme-drawer-theme-card theme-drawer-theme-card--idle'
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-hidden" @click="emit('close')">
    <!-- 遮罩层 -->
    <div
      class="theme-drawer-backdrop absolute inset-0 backdrop-blur-sm transition-opacity"
    />

    <!-- 右侧抽屉主体 -->
    <div
      class="theme-drawer-panel glass-panel absolute bottom-0 right-0 top-0 w-[300px] flex flex-col transform shadow-2xl transition-transform duration-300"
      @click.stop
    >
      <!-- 头部 -->
      <div class="theme-drawer-header flex items-center justify-between px-5 py-4">
        <h2 class="glass-text-main flex items-center gap-2 text-base font-medium">
          <div class="i-carbon-settings text-lg text-primary" />项目配置
        </h2>
        <button
          class="theme-drawer-close rounded-md p-1.5 transition-colors"
          @click="emit('close')"
        >
          <div class="i-carbon-close text-lg" />
        </button>
      </div>

      <!-- 本体滚动区域 -->
      <div class="custom-scrollbar flex-1 overflow-y-auto px-6 py-6 space-y-8">
        <!-- 头部配置区：版权信息 & 深色模式 -->
        <div class="theme-drawer-meta-card group relative flex items-center justify-between overflow-hidden rounded-xl p-4 shadow-sm backdrop-blur-sm">
          <!-- 装饰性光晕 -->
          <div class="pointer-events-none absolute h-20 w-20 rounded-full bg-primary/10 blur-xl transition-colors -right-4 -top-4 group-hover:bg-primary/20" />

          <div class="glass-text-muted relative z-10 text-xs font-medium tracking-tight font-mono space-y-2">
            <div class="flex items-center gap-2">
              <div class="i-carbon-code text-sm text-primary" /><span>Maker: smdk000</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="i-carbon-chat text-sm text-primary" /><span>Q群: 227916149</span>
            </div>
          </div>

          <!-- 环境模式切换 -->
          <div class="theme-drawer-mode-side relative z-10 flex flex-col items-end gap-2 pl-4">
            <span class="glass-text-main text-[11px] font-bold tracking-wider transition-colors duration-300">
              {{ appStore.themeMode === 'auto' ? '自动跟随' : (appStore.isDark ? '深色模式' : '浅色模式') }}
            </span>
            <div
              class="theme-drawer-mode-switch relative h-6 w-16 inline-flex items-center rounded-full p-1 shadow-inner transition-colors duration-300 ease-in-out"
            >
              <div class="relative z-10 h-full w-full flex items-center justify-between">
                <div title="浅色模式" class="h-full flex flex-1 cursor-pointer items-center justify-center text-[10px] transition-opacity" :class="appStore.themeMode === 'light' ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale hover:opacity-80'" @click="appStore.setUIConfig({ theme: 'light' })">
                  ☀️
                </div>
                <div title="自动跟随" class="h-full flex flex-1 cursor-pointer items-center justify-center text-[10px] transition-opacity" :class="appStore.themeMode === 'auto' ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale hover:opacity-80'" @click="appStore.setUIConfig({ theme: 'auto' })">
                  A
                </div>
                <div title="深色模式" class="h-full flex flex-1 cursor-pointer items-center justify-center text-[10px] transition-opacity" :class="appStore.themeMode === 'dark' ? 'opacity-100 grayscale-0' : 'opacity-40 grayscale hover:opacity-80'" @click="appStore.setUIConfig({ theme: 'dark' })">
                  🌙
                </div>
              </div>
              <!-- 滑块 -->
              <div
                class="theme-drawer-mode-thumb pointer-events-none absolute top-1 h-4 w-4 rounded-full shadow-md transition-all duration-300 ease-in-out"
                :class="{
                  'left-1': appStore.themeMode === 'light',
                  'left-[calc(50%-8px)]': appStore.themeMode === 'auto',
                  'left-[calc(100%-20px)]': appStore.themeMode === 'dark',
                }"
              />
            </div>
          </div>
        </div>

        <!-- 性能降级模式 -->
        <div class="theme-drawer-performance-card group flex items-center justify-between rounded-xl p-4 shadow-sm backdrop-blur-sm transition-all duration-300">
          <div class="flex flex-col gap-1 pr-4">
            <div class="glass-text-main flex items-center gap-2 text-[13px] font-bold">
              <div class="i-carbon-flash text-base text-primary" />极简性能模式
            </div>
            <div class="glass-text-muted text-[11px] leading-tight">
              关闭全站毛玻璃特效，解决低配电脑核显渲染缓慢与滑动卡顿问题。
            </div>
          </div>
          <BaseSwitch :model-value="appStore.performanceMode ?? false" @update:model-value="appStore.setUIConfig({ performanceMode: $event ?? false })" />
        </div>

        <!-- 系统主题大卡片变体 -->
        <div>
          <h3 class="glass-text-muted relative z-10 mx-auto mb-4 w-max rounded-lg bg-transparent px-2 text-center text-[13px] font-medium backdrop-blur-md -mt-5">
            系统主题 (预设变体)
          </h3>
          <p class="glass-text-muted mb-4 text-center text-[11px] leading-5">
            {{ appStore.themeBackgroundLinked ? '已开启主题锁定背景，直接切主题也会自动同步背景。' : '可单独切主题，也可点右下角按钮一并套用同主题背景。' }}
          </p>
          <div class="grid grid-cols-1 gap-4">
            <template v-for="t in THEME_OPTIONS" :key="t.key">
              <div
                class="group relative cursor-pointer overflow-hidden rounded-xl p-4 shadow-sm backdrop-blur-sm transition-all duration-300"
                :class="getThemeCardClass(t.key)"
                :style="appStore.colorTheme === t.key ? `border-color: ${t.color}; box-shadow: 0 0 0 1px ${t.color}20, 0 4px 12px -2px ${t.color}20;` : ''"
                @click="changeTheme(t.key)"
              >
                <!-- 仅选中的拥有微弱背景光晕 -->
                <div v-show="appStore.colorTheme === t.key" class="pointer-events-none absolute inset-0 opacity-5" :style="`background-color: ${t.color}`" />
                <!-- 鼠标悬停半透明渐变特效 -->
                <div class="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-10" :style="`background: linear-gradient(to bottom right, ${t.color}, transparent);`" />

                <div class="relative z-10 mb-3 flex items-center justify-between">
                  <div class="glass-text-main flex items-center gap-2 text-[15px] font-bold">
                    <span class="h-3.5 w-3.5 rounded-full" :class="[t.bg, t.shadow]" />
                    {{ t.name }}
                  </div>
                  <!-- 选中标识 -->
                  <div v-if="appStore.colorTheme === t.key" class="theme-drawer-selected-badge flex items-center justify-center rounded px-1.5 py-0.5 text-xs shadow-sm" :style="`background-color: ${t.color}`">
                    <div class="i-carbon-checkmark" />
                  </div>
                </div>
                <!-- 描述 -->
                <div class="glass-text-muted mb-4 pr-2 text-xs leading-relaxed">
                  {{ t.desc }}
                </div>
                <!-- 底层颜色示例方块 -->
                <div class="relative z-10 flex gap-2">
                  <div class="h-6 w-6 rounded" :class="t.bg" />
                  <div class="h-6 w-6 rounded" :class="t.bgDark" />
                  <div class="glass-panel h-6 w-6 border rounded" />
                </div>
                <div class="relative z-10 mt-4 flex items-center justify-between gap-3">
                  <span class="glass-text-muted text-[10px]">
                    可一键同步同主题背景预设
                  </span>
                  <button
                    class="theme-drawer-apply rounded-full px-3 py-1 text-[10px] font-bold transition-colors"
                    @click.stop="applyThemeBackground(t.key)"
                  >
                    套用主题背景
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-drawer-backdrop {
  background: var(--ui-overlay-backdrop) !important;
}

.theme-drawer-panel {
  border-left: 1px solid var(--ui-border-subtle) !important;
}

.theme-drawer-header,
.theme-drawer-meta-card,
.theme-drawer-mode-side,
.theme-drawer-mode-switch,
.theme-drawer-performance-card,
.theme-drawer-theme-card,
.theme-drawer-close,
.theme-drawer-apply {
  border: 1px solid var(--ui-border-subtle) !important;
}

.theme-drawer-header,
.theme-drawer-meta-card,
.theme-drawer-performance-card,
.theme-drawer-theme-card--idle {
  background: color-mix(in srgb, var(--ui-bg-surface) 72%, transparent) !important;
}

.theme-drawer-header {
  border-left: none !important;
  border-right: none !important;
  border-top: none !important;
}

.theme-drawer-close {
  color: var(--ui-text-2) !important;
}

.theme-drawer-close:hover {
  color: var(--ui-text-1) !important;
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent) !important;
}

.theme-drawer-meta-card,
.theme-drawer-performance-card,
.theme-drawer-theme-card {
  border-radius: 0.75rem;
}

.theme-drawer-mode-side {
  border-top: none !important;
  border-right: none !important;
  border-bottom: none !important;
}

.theme-drawer-mode-switch {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
}

.theme-drawer-mode-thumb {
  background: var(--ui-bg-surface) !important;
}

.theme-drawer-performance-card:hover,
.theme-drawer-theme-card--idle:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent) !important;
}

.theme-drawer-theme-card--active {
  background: color-mix(in srgb, var(--ui-brand-500) 9%, var(--ui-bg-surface)) !important;
}

.theme-drawer-selected-badge {
  color: var(--ui-text-on-brand) !important;
}

.theme-drawer-apply {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent) !important;
  color: var(--ui-text-1) !important;
}

.theme-drawer-apply:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 96%, transparent) !important;
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
