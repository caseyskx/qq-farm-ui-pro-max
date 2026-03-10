<script setup lang="ts">
import { computed, ref } from 'vue'
import BagPanel from '@/components/BagPanel.vue'
import FarmPanel from '@/components/FarmPanel.vue'
import TaskPanel from '@/components/TaskPanel.vue'
import VisitorPanel from '@/components/VisitorPanel.vue'

type PersonalTab = 'farm' | 'bag' | 'task' | 'visitor'

const personalTabs = [
  { id: 'farm', label: '我的农场', shortLabel: '农场', icon: 'i-carbon-sprout', description: '查看地块、成熟状态和当前经营现场。' },
  { id: 'bag', label: '我的背包', shortLabel: '背包', icon: 'i-carbon-box', description: '集中查看种子、化肥和其它库存道具。' },
  { id: 'task', label: '我的任务', shortLabel: '任务', icon: 'i-carbon-task', description: '追踪日常任务、奖励和待完成事项。' },
  { id: 'visitor', label: '访客面板', shortLabel: '访客', icon: 'i-carbon-user-multiple', description: '快速查看近期访客和互动动态。' },
] as const satisfies ReadonlyArray<{
  id: PersonalTab
  label: string
  shortLabel: string
  icon: string
  description: string
}>

const currentTab = ref<'farm' | 'bag' | 'task' | 'visitor'>('farm')
const currentTabMeta = computed(() => personalTabs.find(tab => tab.id === currentTab.value) ?? personalTabs[0]!)

function getPersonalTabClass(tab: PersonalTab) {
  return currentTab.value === tab
    ? 'personal-tab personal-tab--active'
    : 'personal-tab personal-tab--idle'
}
</script>

<template>
  <div class="personal-page ui-page-shell ui-page-density-relaxed h-full min-h-0 w-full flex flex-col">
    <div class="personal-toolbar ui-mobile-sticky-panel mb-4">
      <div class="personal-toolbar-head">
        <div class="personal-toolbar-copy">
          <div class="personal-toolbar-eyebrow">
            个人面板
          </div>
          <div class="personal-toolbar-title">
            <div class="shrink-0 text-lg" :class="currentTabMeta.icon" />
            <span>{{ currentTabMeta.label }}</span>
          </div>
          <p class="personal-toolbar-desc">
            {{ currentTabMeta.description }}
          </p>
        </div>
      </div>

      <div class="personal-tab-bar ui-bulk-actions">
        <button
          v-for="tab in personalTabs"
          :key="tab.id"
          class="rounded-lg px-4 py-2 font-medium transition-colors"
          :class="getPersonalTabClass(tab.id)"
          @click="currentTab = tab.id"
        >
          <div class="flex items-center space-x-2">
            <div class="text-lg" :class="tab.icon" />
            <span class="hidden sm:inline">{{ tab.label }}</span>
            <span class="sm:hidden">{{ tab.shortLabel }}</span>
          </div>
        </button>
      </div>
    </div>

    <div class="personal-tab-bar-desktop mb-4 hidden flex-wrap gap-2 md:flex">
      <button
        v-for="tab in personalTabs"
        :key="`desktop-${tab.id}`"
        class="rounded-lg px-4 py-2 font-medium transition-colors"
        :class="getPersonalTabClass(tab.id)"
        @click="currentTab = tab.id"
      >
        <div class="flex items-center space-x-2">
          <div class="text-lg" :class="tab.icon" />
          <span>{{ tab.label }}</span>
        </div>
      </button>
    </div>

    <div class="personal-content flex-1 overflow-hidden overflow-y-auto">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <component :is="currentTab === 'farm' ? FarmPanel : (currentTab === 'bag' ? BagPanel : (currentTab === 'task' ? TaskPanel : VisitorPanel))" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.personal-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.personal-toolbar-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.875rem;
}

.personal-toolbar-copy {
  min-width: 0;
}

.personal-toolbar-eyebrow {
  color: var(--ui-text-3);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.personal-toolbar-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.35rem;
  color: var(--ui-text-1);
  font-size: 1.1rem;
  line-height: 1.35;
  font-weight: 700;
}

.personal-toolbar-desc {
  margin-top: 0.5rem;
  color: var(--ui-text-2);
  font-size: 0.875rem;
  line-height: 1.6;
}

.personal-tab-bar {
  display: flex;
  gap: 0.5rem;
}

.personal-content {
  min-height: 0;
}

.personal-tab {
  border: 1px solid var(--ui-border-subtle);
}

.personal-tab--active {
  background: linear-gradient(to right, var(--ui-brand-500), var(--ui-brand-600)) !important;
  color: var(--ui-text-on-brand) !important;
  box-shadow: 0 12px 24px color-mix(in srgb, var(--ui-brand-500) 20%, transparent) !important;
}

.personal-tab--idle {
  background: color-mix(in srgb, var(--ui-bg-surface) 70%, transparent) !important;
  color: var(--ui-text-2) !important;
}

.personal-tab--idle:hover {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 84%, transparent) !important;
  color: var(--ui-text-1) !important;
}

@media (max-width: 767px) {
  .personal-toolbar {
    padding: 0.875rem;
    border: 1px solid var(--ui-border-subtle);
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--ui-bg-surface-raised) 86%, transparent);
    box-shadow:
      0 12px 24px -24px var(--ui-shadow-panel),
      inset 0 1px 0 var(--ui-shadow-inner);
  }

  .personal-tab-bar-desktop {
    display: none !important;
  }
}

@media (min-width: 768px) {
  .personal-toolbar {
    display: none;
  }
}
</style>
