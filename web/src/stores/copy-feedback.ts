import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface CopyFeedbackPayload {
  title?: string
  message: string
  detail?: string
  duration?: number
}

export const useCopyFeedbackStore = defineStore('copy-feedback', () => {
  const visible = ref(false)
  const sequence = ref(0)
  const title = ref('复制成功')
  const message = ref('')
  const detail = ref('')
  const duration = ref(2200)
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  function clearHideTimer() {
    if (hideTimer !== null) {
      clearTimeout(hideTimer)
      hideTimer = null
    }
  }

  function hide() {
    clearHideTimer()
    visible.value = false
  }

  function show(payload: CopyFeedbackPayload) {
    clearHideTimer()
    title.value = String(payload.title || '复制成功').trim() || '复制成功'
    message.value = String(payload.message || '').trim() || '内容已写入剪贴板'
    detail.value = String(payload.detail || '').trim()
    duration.value = Number(payload.duration) > 0 ? Number(payload.duration) : 2200
    sequence.value += 1
    visible.value = true

    hideTimer = setTimeout(() => {
      visible.value = false
      hideTimer = null
    }, duration.value)
  }

  return {
    visible,
    sequence,
    title,
    message,
    detail,
    duration,
    show,
    hide,
  }
})
