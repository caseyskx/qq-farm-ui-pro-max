import { onScopeDispose, ref } from 'vue'
import { useCopyFeedbackStore } from '@/stores/copy-feedback'
import { useToastStore } from '@/stores/toast'

export interface UseCopyInteractionOptions {
  feedbackDuration?: number
  highlightDuration?: number
  successTitle?: string
  failureMessage?: string
}

export interface CopyInteractionOptions {
  controlKey?: string
  detail?: string
  failureMessage?: string
  historyId?: string
  title?: string
}

export function useCopyInteraction(options: UseCopyInteractionOptions = {}) {
  const copyFeedback = useCopyFeedbackStore()
  const toast = useToastStore()
  const copiedHistoryId = ref('')
  const copiedControlKey = ref('')
  const feedbackDuration = options.feedbackDuration ?? 2200
  const highlightDuration = options.highlightDuration ?? 1600
  let copiedHistoryTimer: ReturnType<typeof setTimeout> | null = null
  let copiedControlTimer: ReturnType<typeof setTimeout> | null = null

  function clearCopiedHistoryTimer() {
    if (copiedHistoryTimer !== null) {
      clearTimeout(copiedHistoryTimer)
      copiedHistoryTimer = null
    }
  }

  function clearCopiedControlTimer() {
    if (copiedControlTimer !== null) {
      clearTimeout(copiedControlTimer)
      copiedControlTimer = null
    }
  }

  function highlightCopiedHistory(historyId: string) {
    clearCopiedHistoryTimer()
    copiedHistoryId.value = historyId
    copiedHistoryTimer = setTimeout(() => {
      copiedHistoryId.value = ''
      copiedHistoryTimer = null
    }, highlightDuration)
  }

  function highlightCopiedControl(controlKey: string) {
    clearCopiedControlTimer()
    copiedControlKey.value = controlKey
    copiedControlTimer = setTimeout(() => {
      copiedControlKey.value = ''
      copiedControlTimer = null
    }, highlightDuration)
  }

  function buildCopyFeedbackDetail(text: string, detail?: string) {
    if (detail)
      return detail

    const charCount = Array.from(text.trim()).length
    const lineCount = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .length

    if (lineCount > 1)
      return `共 ${lineCount} 行内容，已写入系统剪贴板，可直接粘贴发送。`
    return `共 ${charCount} 个字符，已写入系统剪贴板。`
  }

  async function writeClipboardText(text: string) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.left = '-999999px'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()

    if (!copied)
      throw new Error('document.execCommand(copy) returned false')
  }

  async function copyText(text: string, successMessage: string, copyOptions: CopyInteractionOptions = {}) {
    try {
      await writeClipboardText(text)

      if (copyOptions.historyId)
        highlightCopiedHistory(copyOptions.historyId)
      if (copyOptions.controlKey)
        highlightCopiedControl(copyOptions.controlKey)

      copyFeedback.show({
        title: copyOptions.title || options.successTitle || '复制成功',
        message: successMessage,
        detail: buildCopyFeedbackDetail(text, copyOptions.detail),
        duration: feedbackDuration,
      })
      return true
    }
    catch (error) {
      console.error('复制失败:', error)
      toast.error(copyOptions.failureMessage || options.failureMessage || '复制失败，请手动复制')
      return false
    }
  }

  onScopeDispose(() => {
    clearCopiedHistoryTimer()
    clearCopiedControlTimer()
  })

  return {
    copiedHistoryId,
    copiedControlKey,
    clearCopiedHistoryTimer,
    clearCopiedControlTimer,
    copyText,
    highlightCopiedControl,
    highlightCopiedHistory,
  }
}
