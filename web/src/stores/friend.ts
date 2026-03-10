import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/api'
import { localizeRuntimeText } from '@/utils/runtime-text'

export const useFriendStore = defineStore('friend', () => {
  const friends = ref<any[]>([])
  const cachedFriends = ref<any[]>([])
  const loading = ref(false)
  const friendLands = ref<Record<string, any[]>>({})
  const friendLandsLoading = ref<Record<string, boolean>>({})
  const blacklist = ref<number[]>([])
  const interactRecords = ref<any[]>([])
  const interactLoading = ref(false)
  const interactError = ref('')
  let interactRequestSeq = 0

  function normalizeInteractError(input: any, errorCode?: string) {
    const raw = String(input || '').trim()
    const lower = raw.toLowerCase()
    const code = String(errorCode || '').trim().toUpperCase()
    if (!raw)
      return '加载访客记录失败'
    if (code === 'INTERACT_PROTO_MISSING' || raw.includes('INTERACT_PROTO_MISSING') || raw.includes('协议未加载'))
      return '访客协议未加载，当前版本暂不支持专用访客接口'
    if (code === 'INTERACT_TIMEOUT' || raw.includes('INTERACT_TIMEOUT') || lower.includes('timeout') || raw.includes('超时'))
      return '访客接口请求超时，已自动回退到日志视图'
    if (code === 'INTERACT_AUTH' || raw.includes('INTERACT_AUTH') || lower.includes('unauthorized') || lower.includes('forbidden') || raw.includes('权限'))
      return '访客接口权限校验失败，请检查账号登录状态'
    if (code === 'INTERACT_RPC_UNAVAILABLE' || raw.includes('INTERACT_RPC_UNAVAILABLE') || raw.includes('接口不可用') || raw.includes('版本不支持'))
      return '访客接口不可用（可能是协议版本不支持），已自动回退到日志视图'
    return localizeRuntimeText(raw)
  }

  /**
   * T5: 从土地详情构建植物摘要 (来源: PR 版 friend.ts)
   * 统计可偷/缺水/杂草/虫害的数量
   */
  function buildPlantSummaryFromDetail(lands: any[], summary: any) {
    const stealNumFromSummary = Array.isArray(summary?.stealable) ? summary.stealable.length : null
    const dryNumFromSummary = Array.isArray(summary?.needWater) ? summary.needWater.length : null
    const weedNumFromSummary = Array.isArray(summary?.needWeed) ? summary.needWeed.length : null
    const insectNumFromSummary = Array.isArray(summary?.needBug) ? summary.needBug.length : null

    let stealNum = stealNumFromSummary
    let dryNum = dryNumFromSummary
    let weedNum = weedNumFromSummary
    let insectNum = insectNumFromSummary

    if (stealNum === null || dryNum === null || weedNum === null || insectNum === null) {
      stealNum = 0
      dryNum = 0
      weedNum = 0
      insectNum = 0
      for (const land of (Array.isArray(lands) ? lands : [])) {
        if (!land || !land.unlocked)
          continue
        if (land.status === 'stealable')
          stealNum++
        if (land.needWater)
          dryNum++
        if (land.needWeed)
          weedNum++
        if (land.needBug)
          insectNum++
      }
    }

    return {
      stealNum: Number(stealNum) || 0,
      dryNum: Number(dryNum) || 0,
      weedNum: Number(weedNum) || 0,
      insectNum: Number(insectNum) || 0,
    }
  }

  /**
   * T5: 同步植物摘要到好友列表 (来源: PR 版 friend.ts)
   * 展开好友详情后自动同步概览数据
   */
  function syncFriendPlantSummary(friendId: string, lands: any[], summary: any) {
    const key = String(friendId)
    const idx = friends.value.findIndex(f => String(f?.gid || '') === key)
    if (idx < 0)
      return
    const nextPlant = buildPlantSummaryFromDetail(lands, summary)
    friends.value[idx] = { ...friends.value[idx], plant: nextPlant }
  }

  async function fetchFriends(accountId: string): Promise<{ ok: boolean, fromCache?: boolean }> {
    if (!accountId)
      return { ok: false }
    loading.value = true
    try {
      const res = await api.get('/api/friends', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        friends.value = res.data.data || []
        return { ok: true, fromCache: false }
      }
      return { ok: false }
    }
    catch {
      try {
        await fetchCachedFriends(accountId)
        if (cachedFriends.value.length > 0) {
          friends.value = [...cachedFriends.value]
          return { ok: true, fromCache: true }
        }
      }
      catch { /* ignore */ }
      return { ok: false }
    }
    finally {
      loading.value = false
    }
  }

  async function fetchBlacklist(accountId: string) {
    if (!accountId)
      return
    try {
      const res = await api.get('/api/friend-blacklist', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        blacklist.value = res.data.data || []
      }
    }
    catch { /* ignore */ }
  }

  async function toggleBlacklist(accountId: string, gid: number) {
    if (!accountId || !gid)
      return
    const res = await api.post('/api/friend-blacklist/toggle', { gid }, {
      headers: { 'x-account-id': accountId },
    })
    if (res.data.ok) {
      blacklist.value = res.data.data || []
    }
  }

  async function fetchFriendLands(accountId: string, friendId: string) {
    if (!accountId || !friendId)
      return
    friendLandsLoading.value[friendId] = true
    try {
      const res = await api.get(`/api/friend/${friendId}/lands`, {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        const lands = res.data.data.lands || []
        const summary = res.data.data.summary || null
        friendLands.value[friendId] = lands
        // T5: 同步植物摘要到好友列表
        syncFriendPlantSummary(friendId, lands, summary)
      }
    }
    finally {
      friendLandsLoading.value[friendId] = false
    }
  }

  async function operate(accountId: string, friendId: string, opType: string) {
    if (!accountId || !friendId)
      return
    await api.post(`/api/friend/${friendId}/op`, { opType }, {
      headers: { 'x-account-id': accountId },
    })
    await fetchFriends(accountId)
    if (friendLands.value[friendId]) {
      await fetchFriendLands(accountId, friendId)
    }
  }

  async function batchOperate(accountId: string, friendIds: Array<string | number>, opType: string, options: Record<string, any> = {}) {
    if (!accountId || !friendIds.length)
      return null
    const res = await api.post('/api/friends/batch-op', {
      gids: friendIds.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0),
      opType,
      options,
    }, {
      headers: { 'x-account-id': accountId },
    })
    await fetchFriends(accountId)
    return res.data?.data || null
  }

  async function fetchCachedFriends(accountId: string) {
    if (!accountId)
      return
    loading.value = true
    try {
      const res = await api.get('/api/friends/cache', {
        headers: { 'x-account-id': accountId },
      })
      if (res.data.ok) {
        cachedFriends.value = res.data.data || []
      }
    }
    finally {
      loading.value = false
    }
  }

  async function fetchInteractRecords(accountId: string, limit = 50): Promise<boolean> {
    const normalizedAccountId = String(accountId || '').trim()
    if (!normalizedAccountId) {
      interactRequestSeq++
      interactRecords.value = []
      interactError.value = ''
      interactLoading.value = false
      return false
    }

    const reqSeq = ++interactRequestSeq
    interactLoading.value = true
    interactError.value = ''
    try {
      const res = await api.get('/api/interact-records', {
        headers: { 'x-account-id': normalizedAccountId },
        params: { limit: Math.max(1, Math.min(200, Number(limit) || 50)) },
      })
      // 仅允许最后一次请求写入状态，避免快速切号导致旧响应覆盖
      if (reqSeq !== interactRequestSeq)
        return false
      if (res.data?.ok) {
        interactRecords.value = Array.isArray(res.data.data) ? res.data.data : []
        return true
      }
      else {
        interactError.value = normalizeInteractError(res.data?.error || '加载访客记录失败', res.data?.errorCode)
        return true
      }
    }
    catch (error: any) {
      if (reqSeq !== interactRequestSeq)
        return false
      interactError.value = normalizeInteractError(
        error?.response?.data?.error || error?.message || '加载访客记录失败',
        error?.response?.data?.errorCode,
      )
      return true
    }
    finally {
      if (reqSeq === interactRequestSeq)
        interactLoading.value = false
    }
  }

  function clearInteractState() {
    interactRequestSeq++
    interactRecords.value = []
    interactError.value = ''
    interactLoading.value = false
  }

  return {
    friends,
    cachedFriends,
    loading,
    friendLands,
    friendLandsLoading,
    blacklist,
    interactRecords,
    interactLoading,
    interactError,
    clearInteractState,
    fetchFriends,
    fetchCachedFriends,
    fetchBlacklist,
    toggleBlacklist,
    fetchFriendLands,
    fetchInteractRecords,
    operate,
    batchOperate,
  }
})
