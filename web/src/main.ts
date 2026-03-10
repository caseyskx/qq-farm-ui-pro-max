import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToastStore } from '@/stores/toast'
import { localizeRuntimeText } from '@/utils/runtime-text'
import App from './App.vue'
import router from './router'
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// Global Error Handling
const toast = useToastStore()

app.config.errorHandler = (err: any, _instance, info) => {
  console.error('全局 Vue 错误:', err, info)
  const message = localizeRuntimeText(err.message || String(err))
  if (message.includes('ResizeObserver loop'))
    return
  toast.error(`应用错误: ${message}`)
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (reason && typeof reason === 'object' && 'isAxiosError' in reason)
    return

  console.error('未处理的异步异常:', reason)
  const message = localizeRuntimeText(reason?.message || String(reason))
  if (message.includes('动态模块加载失败') || message.includes('模块脚本加载失败')) {
    toast.error('检测到应用版本更新或网络异常，正在尝试刷新页面...')
    setTimeout(() => {
      window.location.reload()
    }, 1500)
    return
  }
  toast.error(`异步错误: ${message}`)
})

window.onerror = (message, _source, _lineno, _colno, error) => {
  console.error('全局脚本错误:', message, error)
  if (String(message).includes('Script error'))
    return
  toast.error(`系统错误: ${localizeRuntimeText(message)}`)
}

// Apply config from server if possible
const appStore = useAppStore()
appStore.fetchUIConfig()

app.mount('#app')
