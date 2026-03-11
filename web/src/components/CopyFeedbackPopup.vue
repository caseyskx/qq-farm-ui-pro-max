<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useCopyFeedbackStore } from '@/stores/copy-feedback'

const copyFeedbackStore = useCopyFeedbackStore()
const { detail, duration, message, sequence, title, visible } = storeToRefs(copyFeedbackStore)

const progressStyle = computed(() => ({
  '--copy-feedback-duration': `${duration.value}ms`,
}))
</script>

<template>
  <Teleport to="body">
    <div class="copy-feedback-host" aria-live="polite" aria-atomic="true">
      <Transition name="copy-feedback" mode="out-in">
        <div
          v-if="visible"
          :key="sequence"
          class="copy-feedback-panel"
          :style="progressStyle"
          role="status"
        >
          <div class="copy-feedback-panel__glow copy-feedback-panel__glow-brand" />
          <div class="copy-feedback-panel__glow copy-feedback-panel__glow-success" />

          <div class="copy-feedback-chip ui-meta-chip--success">
            <div class="i-carbon-checkmark-outline text-sm" />
            已写入剪贴板
          </div>

          <div class="copy-feedback-main">
            <div class="copy-feedback-icon-shell">
              <div class="copy-feedback-icon-ring" />
              <div class="i-carbon-checkmark-filled copy-feedback-icon" />
            </div>

            <div class="copy-feedback-copy">
              <p class="copy-feedback-title">
                {{ title }}
              </p>
              <p class="copy-feedback-message">
                {{ message }}
              </p>
              <p v-if="detail" class="copy-feedback-detail">
                {{ detail }}
              </p>
            </div>
          </div>

          <div class="copy-feedback-progress" />
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.copy-feedback-host {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem 1rem;
}

.copy-feedback-panel {
  position: relative;
  width: min(100%, 26rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--ui-status-success) 18%, var(--ui-border-subtle) 82%);
  border-radius: 1.5rem;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--ui-bg-surface-raised) 94%, transparent),
    color-mix(in srgb, var(--ui-brand-soft-12) 48%, var(--ui-bg-surface) 52%)
  );
  box-shadow:
    0 24px 60px color-mix(in srgb, var(--ui-shadow-panel-strong) 68%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-text-on-brand) 14%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.copy-feedback-panel__glow {
  position: absolute;
  inset: auto;
  border-radius: 999px;
  filter: blur(18px);
  opacity: 0.7;
}

.copy-feedback-panel__glow-brand {
  top: -2.5rem;
  right: -1rem;
  height: 7rem;
  width: 7rem;
  background: color-mix(in srgb, var(--ui-brand-500) 22%, transparent);
}

.copy-feedback-panel__glow-success {
  left: -2.5rem;
  bottom: -2rem;
  height: 6rem;
  width: 6rem;
  background: color-mix(in srgb, var(--ui-status-success) 18%, transparent);
}

.copy-feedback-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 1rem 1rem 0;
  padding: 0.42rem 0.72rem;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  font-size: clamp(0.7rem, 0.67rem + 0.12vw, 0.78rem);
  font-weight: 700;
  letter-spacing: 0.04em;
}

.copy-feedback-main {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1rem 1.1rem;
}

.copy-feedback-icon-shell {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 1.15rem;
  background:
    radial-gradient(circle at 30% 28%, color-mix(in srgb, var(--ui-text-on-brand) 30%, transparent), transparent 42%),
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--ui-status-success) 86%, white 14%),
      color-mix(in srgb, var(--ui-brand-500) 82%, black 18%)
    );
  box-shadow:
    0 16px 32px color-mix(in srgb, var(--ui-status-success) 24%, transparent),
    inset 0 1px 0 color-mix(in srgb, var(--ui-text-on-brand) 28%, transparent);
}

.copy-feedback-icon-ring {
  position: absolute;
  inset: -0.45rem;
  border: 1px solid color-mix(in srgb, var(--ui-status-success) 42%, transparent);
  border-radius: 1.45rem;
  animation: copy-feedback-ring 1.6s ease-out;
}

.copy-feedback-icon {
  position: relative;
  color: var(--ui-text-on-brand);
  font-size: 1.45rem;
  filter: drop-shadow(0 4px 10px color-mix(in srgb, var(--ui-shadow-panel) 58%, transparent));
}

.copy-feedback-copy {
  min-width: 0;
  flex: 1;
}

.copy-feedback-title,
.copy-feedback-message,
.copy-feedback-detail {
  margin: 0;
}

.copy-feedback-title {
  color: color-mix(in srgb, var(--ui-brand-700) 72%, var(--ui-text-1));
  font-size: clamp(0.74rem, 0.72rem + 0.12vw, 0.82rem);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.copy-feedback-message {
  margin-top: 0.28rem;
  color: var(--ui-text-1);
  font-size: clamp(0.98rem, 0.92rem + 0.22vw, 1.08rem);
  font-weight: 700;
  line-height: 1.35;
}

.copy-feedback-detail {
  margin-top: 0.38rem;
  color: var(--ui-text-2);
  font-size: clamp(0.78rem, 0.75rem + 0.14vw, 0.88rem);
  line-height: 1.55;
}

.copy-feedback-progress {
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  transform-origin: left center;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--ui-status-success) 82%, white 18%),
    color-mix(in srgb, var(--ui-brand-500) 80%, transparent)
  );
  animation: copy-feedback-progress var(--copy-feedback-duration, 2200ms) linear forwards;
}

.copy-feedback-enter-active,
.copy-feedback-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.38s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.3s ease;
}

.copy-feedback-enter-from,
.copy-feedback-leave-to {
  opacity: 0;
  transform: translateY(-1rem) scale(0.94);
  filter: blur(10px);
}

.copy-feedback-enter-to,
.copy-feedback-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  filter: blur(0);
}

@keyframes copy-feedback-progress {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

@keyframes copy-feedback-ring {
  0% {
    opacity: 0;
    transform: scale(0.72);
  }
  35% {
    opacity: 0.7;
  }
  100% {
    opacity: 0;
    transform: scale(1.1);
  }
}

@media (max-width: 640px) {
  .copy-feedback-host {
    align-items: flex-start;
    padding-inline: 0.75rem;
  }

  .copy-feedback-panel {
    width: 100%;
    border-radius: 1.25rem;
  }

  .copy-feedback-main {
    gap: 0.85rem;
    padding: 0.8rem 0.9rem 1rem;
  }

  .copy-feedback-icon-shell {
    width: 3rem;
    height: 3rem;
    border-radius: 1rem;
  }

  .copy-feedback-icon-ring {
    inset: -0.35rem;
    border-radius: 1.2rem;
  }

  .copy-feedback-icon {
    font-size: 1.2rem;
  }
}
</style>
