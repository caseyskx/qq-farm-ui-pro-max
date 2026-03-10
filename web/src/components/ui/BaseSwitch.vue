<script setup lang="ts">
defineProps<{
  label?: string
  size?: 'sm' | 'md' | 'lg'
  hint?: string
  recommend?: 'on' | 'off' | 'conditional'
}>()
const model = defineModel<boolean>()
</script>

<template>
  <div class="inline-flex flex-col gap-1">
    <label class="inline-flex cursor-pointer items-center gap-2">
      <div class="relative inline-flex items-center">
        <input v-model="model" type="checkbox" class="peer sr-only">
        <div
          class="ui-switch-track rounded-full transition-colors after:absolute after:rounded-full after:transition-all peer-checked:after:translate-x-full"
          :class="{
            'h-4 w-7 after:left-[1px] after:top-[1px] after:h-3 after:w-3': size === 'sm',
            'h-6 w-11 after:left-[2px] after:top-[2px] after:h-5 after:w-5': !size || size === 'md',
            'h-7 w-12 after:left-[3px] after:top-[3px] after:h-6 after:w-6': size === 'lg',
          }"
        />
      </div>
      <span v-if="label" class="glass-text-main select-none text-sm font-medium">
        {{ label }}
      </span>
    </label>
    <!-- Hint 文字说明 - 直接显示在开关下方 -->
    <p v-if="hint" class="hint-text glass-text-muted ml-1 text-[10px] leading-tight opacity-70">
      {{ hint }}
      <span v-if="recommend === 'on'" class="recommend-badge recommend-on">推荐开启</span>
      <span v-else-if="recommend === 'off'" class="recommend-badge recommend-off">推荐关闭</span>
      <span v-else-if="recommend === 'conditional'" class="recommend-badge recommend-conditional">视情况而定</span>
    </p>
  </div>
</template>

<style scoped>
/* 下方文字说明中的推荐标签 */
.recommend-badge {
  display: inline-block;
  margin-left: 6px;
  border-radius: 9999px;
  padding: 1px 6px;
  font-size: 9px;
  font-weight: 600;
}

.recommend-badge.recommend-on {
  background-color: var(--ui-status-success-soft);
  color: var(--ui-status-success);
}

.recommend-badge.recommend-off {
  background-color: var(--ui-status-danger-soft);
  color: var(--ui-status-danger);
}

.recommend-badge.recommend-conditional {
  background-color: var(--ui-status-warning-soft);
  color: var(--ui-status-warning);
}

.ui-switch-track {
  background: color-mix(in srgb, var(--ui-bg-surface) 60%, transparent);
}

.ui-switch-track::after {
  content: '';
  border: 1px solid var(--ui-border-subtle);
  background: var(--ui-bg-surface-raised);
}

.peer:focus-visible + .ui-switch-track {
  box-shadow: 0 0 0 2px var(--ui-focus-ring);
}

.peer:checked + .ui-switch-track {
  background: var(--ui-brand-500);
}

.peer:checked + .ui-switch-track::after {
  border-color: color-mix(in srgb, var(--ui-text-on-brand) 85%, transparent);
}
</style>
