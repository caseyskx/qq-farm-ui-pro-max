import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/api'
import { currentAccountId } from '@/utils/auth'
import { localizeRuntimeText } from '@/utils/runtime-text'

export interface Account {
  id: string
  name: string
  nick?: string
  uin?: number
  username?: string
  avatar?: string
  platform?: string
  running?: boolean
  connected?: boolean
  wsError?: any
  accountMode?: 'main' | 'alt' | 'safe'
  effectiveMode?: 'main' | 'alt' | 'safe'
  collaborationEnabled?: boolean
  degradeReason?: string
  degradeReasonLabel?: string
  accountZone?: string
  harvestDelay?: {
    min: number
    max: number
  }
  riskPromptEnabled?: boolean
  modeScope?: {
    zoneScope: string
    requiresGameFriend: boolean
    fallbackBehavior: string
  }
  level?: number
  gold?: number
  exp?: number
  coupon?: number
  uptime?: number
  lastLoginAt?: number | null
  createdAt?: number
  updatedAt?: number
  // Add other fields as discovered
}

export interface AccountLog {
  time: string
  action: string
  msg: string
  reason?: string
}

export const useAccountStore = defineStore('account', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const logs = ref<AccountLog[]>([])

  async function syncCurrentAccountSelection(id: string) {
    try {
      await api.post('/api/account-selection', {
        currentAccountId: String(id || '').trim(),
      })
    }
    catch (e) {
      console.warn('同步当前账号选择失败', e)
    }
  }

  async function applyCurrentAccountSelection(id: string, options: { syncServer?: boolean } = {}) {
    const normalizedId = String(id || '').trim()
    currentAccountId.value = normalizedId
    if (options.syncServer !== false) {
      await syncCurrentAccountSelection(normalizedId)
    }
  }

  function normalizeAccountEntry(entry: any): Account {
    const next = (entry && typeof entry === 'object') ? { ...entry } : {}
    return {
      ...next,
      wsError: next.wsError
        ? {
            ...next.wsError,
            message: localizeRuntimeText(next.wsError.message || ''),
          }
        : null,
    }
  }

  function normalizeAccountLogEntry(entry: any): AccountLog {
    const next = (entry && typeof entry === 'object') ? { ...entry } : {}
    return {
      ...next,
      msg: localizeRuntimeText(next.msg || ''),
      reason: localizeRuntimeText(next.reason || ''),
    }
  }

  const currentAccount = computed(() =>
    accounts.value.find(a => String(a.id || '') === String(currentAccountId.value || '')),
  )

  async function fetchAccounts() {
    loading.value = true
    try {
      // credentials sent via HttpOnly cookies
      const res = await api.get(`/api/accounts?_t=${Date.now()}`)
      if (res.data.ok && res.data.data && res.data.data.accounts) {
        accounts.value = res.data.data.accounts.map((item: any) => normalizeAccountEntry(item))

        if (accounts.value.length > 0) {
          const found = accounts.value.find(a => String(a.id || '') === String(currentAccountId.value || ''))
          if (!found && accounts.value[0]) {
            await applyCurrentAccountSelection(String(accounts.value[0].id))
          }
        }
        else if (currentAccountId.value) {
          await applyCurrentAccountSelection('')
        }
      }
    }
    catch (e) {
      console.error('获取账号失败', e)
    }
    finally {
      loading.value = false
    }
  }

  async function selectAccount(id: string) {
    await applyCurrentAccountSelection(id)
  }

  async function setCurrentAccount(acc: Account) {
    await selectAccount(String(acc?.id || ''))
  }

  async function startAccount(id: string) {
    await api.post(`/api/accounts/${String(id || '').trim()}/start`)
    await fetchAccounts()
  }

  async function stopAccount(id: string) {
    await api.post(`/api/accounts/${String(id || '').trim()}/stop`)
    await fetchAccounts()
  }

  async function deleteAccount(id: string) {
    const normalizedId = String(id || '').trim()
    await api.delete(`/api/accounts/${normalizedId}`)
    if (String(currentAccountId.value || '') === normalizedId) {
      await applyCurrentAccountSelection('')
    }
    await fetchAccounts()
  }

  async function fetchLogs() {
    try {
      const res = await api.get('/api/account-logs?limit=100')
      if (Array.isArray(res.data)) {
        logs.value = res.data.map((item: any) => normalizeAccountLogEntry(item))
      }
    }
    catch (e) {
      console.error('获取账号日志失败', e)
    }
  }

  async function addAccount(payload: any) {
    try {
      await api.post('/api/accounts', payload)
      await fetchAccounts()
    }
    catch (e) {
      console.error('添加账号失败', e)
      throw e
    }
  }

  async function updateAccount(id: string, payload: any) {
    try {
      // core uses POST /api/accounts for both add and update (if id is present)
      await api.post('/api/accounts', { ...payload, id: String(id || '').trim() })
      await fetchAccounts()
    }
    catch (e) {
      console.error('更新账号失败', e)
      throw e
    }
  }

  async function updateAccountMode(id: string, mode: string) {
    try {
      await api.post(`/api/accounts/${String(id || '').trim()}/mode`, { mode })
      await fetchAccounts()
    }
    catch (e) {
      console.error('更新账号模式失败', e)
      throw e
    }
  }

  async function applySafeModeBlacklist(id: string) {
    try {
      const res = await api.post(`/api/accounts/${String(id || '').trim()}/safe-mode/apply-blacklist`)
      return res.data
    }
    catch (e) {
      console.error('应用风险规避黑名单失败', e)
      throw e
    }
  }

  return {
    accounts,
    currentAccountId,
    currentAccount,
    loading,
    logs,
    fetchAccounts,
    selectAccount,
    startAccount,
    stopAccount,
    deleteAccount,
    fetchLogs,
    addAccount,
    updateAccount,
    updateAccountMode,
    applySafeModeBlacklist,
    setCurrentAccount,
  }
})
