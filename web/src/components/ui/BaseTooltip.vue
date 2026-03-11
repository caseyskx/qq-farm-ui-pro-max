<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<template>
  <span class="hint-trigger relative ml-1 inline-flex items-center align-middle">
    <!-- 触发图标 -->
    <span class="hint-trigger__icon h-3.5 w-3.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold leading-none transition-colors">?</span>
    <!-- 提示气泡，向下弹出居中边界防护 -->
    <span class="hint-bubble glass-panel glass-text-main pointer-events-none absolute left-1/2 top-full z-50 mt-2 max-w-[calc(100vw-2rem)] w-max whitespace-normal rounded-lg px-3 py-2.5 text-wrap text-xs font-normal leading-relaxed normal-case opacity-0 transition-all duration-200 sm:w-64 -translate-x-1/2">
      <slot>{{ text }}</slot>
      <!-- 上方居中小箭头 -->
      <span class="hint-bubble__arrow absolute bottom-full left-1/2 border-4 border-transparent -mb-0.5 -translate-x-1/2" />
    </span>
  </span>
</template>

<style scoped>
.hint-trigger__icon {
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 82%, transparent);
  color: var(--ui-text-2);
}

.hint-trigger__icon:hover {
  background: color-mix(in srgb, var(--ui-brand-500) 14%, var(--ui-bg-surface-raised) 86%);
  color: var(--ui-brand-600);
}

/* 悬浮提示框样式 - 默认隐藏，hover 时显示 */
.hint-bubble {
  pointer-events: none;
  border: 1px solid var(--ui-border-subtle);
  background: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent);
  box-shadow: 0 18px 36px var(--ui-shadow-panel);
}

.hint-bubble__arrow {
  border-bottom-color: color-mix(in srgb, var(--ui-bg-surface-raised) 88%, transparent);
}

.hint-trigger:hover .hint-bubble {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
