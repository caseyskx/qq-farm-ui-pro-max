<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isHovering = ref(false)

function navigateToHelp() {
  router.push('/help')
}
</script>

<template>
  <button
    class="help-button"
    :class="{ 'is-hovering': isHovering }"
    @mouseenter="isHovering = true"
    @mouseleave="isHovering = false"
    @click="navigateToHelp"
  >
    <div class="button-content">
      <div class="i-carbon-help button-icon" />
      <transition name="fade">
        <span v-if="isHovering" class="button-label">帮助中心</span>
      </transition>
    </div>
  </button>
</template>

<style scoped>
.help-button {
  @apply fixed bottom-6 right-6 z-50;
  @apply flex items-center gap-2 px-4 py-3;
  @apply rounded-full shadow-lg;
  @apply transition-all duration-300 ease-out;
  @apply hover:shadow-xl hover:scale-110;
  @apply focus:outline-none;
  background-image: linear-gradient(to right, var(--ui-brand-600), var(--ui-brand-500));
  color: var(--ui-text-on-brand);
  box-shadow:
    0 4px 20px color-mix(in srgb, var(--ui-brand-600) 30%, transparent),
    0 0 0 0 transparent;
  animation: pulse 4s infinite ease-in-out;
}

.help-button.is-hovering {
  animation-play-state: paused;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 4px 20px color-mix(in srgb, var(--ui-brand-600) 30%, transparent);
  }
  50% {
    box-shadow: 0 4px 28px color-mix(in srgb, var(--ui-brand-600) 45%, transparent);
  }
}

.button-content {
  @apply flex items-center gap-2;
}

.button-icon {
  @apply text-2xl;
}

.button-label {
  @apply text-sm font-medium whitespace-nowrap;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .help-button {
    background-image: linear-gradient(to right, var(--ui-brand-500), var(--ui-brand-400));
  }
}

.help-button:focus-visible {
  box-shadow:
    0 4px 20px color-mix(in srgb, var(--ui-brand-600) 30%, transparent),
    0 0 0 4px color-mix(in srgb, var(--ui-focus-ring) 48%, transparent);
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  @apply transition-opacity duration-200;
}

.fade-enter-from {
  @apply opacity-0;
}

.fade-leave-to {
  @apply opacity-0;
}
</style>
