import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFarmToolsStore = defineStore('farmTools', () => {
  const isAvailable = ref(true) // 由于移动到了 public，默认认为可用，不发送 HEAD 由于有可能被代理拦截，只做保底
  const isChecked = ref(true)

  async function checkAvailability() {
    return isAvailable.value
  }

  return { isAvailable, isChecked, checkAvailability }
})
