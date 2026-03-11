/**
 * 多平台头像 URL 与降级逻辑
 * - 支持 QQ、微信(wx/wx_ipad/wx_car) 等平台
 * - 微信头像 URL 可能失效，需降级到平台默认或图标
 * - 失效 URL 会缓存到 sessionStorage，避免重复请求
 */

import type { Ref } from 'vue'
import { ref } from 'vue'

const AVATAR_CACHE_KEY = 'avatar_failed_urls'
const CACHE_MAX = 200

export interface AccountLike {
  id?: string
  uin?: string | number
  avatar?: string
  platform?: string
}

/** 已确认失效的 URL（持久化到 sessionStorage） */
const failedUrls = new Set<string>()

function loadFailedCache() {
  try {
    const raw = sessionStorage.getItem(AVATAR_CACHE_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as string[]
      arr.forEach(u => failedUrls.add(u))
    }
  }
  catch {
    // ignore
  }
}

function saveFailedCache() {
  try {
    const arr = Array.from(failedUrls).slice(-CACHE_MAX)
    sessionStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(arr))
  }
  catch {
    // ignore
  }
}

/** 判断是否为 QQ 平台（qq 或 uin 为纯数字） */
function isQQPlatform(acc: AccountLike): boolean {
  const p = (acc.platform || '').toLowerCase()
  if (p === 'qq')
    return true
  if (acc.uin && /^\d+$/.test(String(acc.uin)))
    return true
  return false
}

/** 获取 QQ 头像 URL（稳定，无时效） */
export function getQQAvatarUrl(uin: string, size = 100): string {
  return `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=${size}`
}

/** 获取平台默认头像 URL，无则返回 null（显示图标） */
export function getPlatformDefaultAvatarUrl(acc: AccountLike, size = 100): string | null {
  if (isQQPlatform(acc) && acc.uin != null) {
    return getQQAvatarUrl(String(acc.uin), size)
  }
  // 微信等平台无稳定默认 URL，返回 null 以显示默认图标
  return null
}

function isUrlFailed(url: string, failedRef?: Ref<string[]>) {
  if (!url)
    return true
  if (failedUrls.has(url))
    return true
  if (failedRef?.value?.includes(url))
    return true
  return false
}

/**
 * 获取用于展示的头像 URL
 * 优先级：acc.avatar（未失效）→ 平台默认 URL → undefined（显示图标）
 * @param acc 用户账户对象，包含 avatar 或 platform/uin 信息
 * @param size 头像请求尺寸（部分平台支持）
 * @param failedRef 可选，组件内响应式失效列表，用于触发重新渲染
 */
export function getAvatarUrl(acc: AccountLike, size = 100, failedRef?: Ref<string[]>): string | undefined {
  if (!acc)
    return undefined

  const customUrl = acc.avatar?.trim()
  const platformUrl = getPlatformDefaultAvatarUrl(acc, size)

  if (customUrl && !isUrlFailed(customUrl, failedRef)) {
    return customUrl
  }
  if (platformUrl && !isUrlFailed(platformUrl, failedRef)) {
    return platformUrl
  }
  return undefined
}

/** 标记 URL 已失效 */
export function markAvatarUrlFailed(url: string) {
  if (!url?.trim())
    return
  failedUrls.add(url)
  saveFailedCache()
}

/**
 * 头像 composable：提供响应式失效追踪
 */
export function useAvatar() {
  const failedUrlsRef = ref<string[]>([])

  const markFailed = (url: string) => {
    if (!url?.trim() || failedUrlsRef.value.includes(url))
      return
    failedUrlsRef.value = [...failedUrlsRef.value, url]
    markAvatarUrlFailed(url)
  }

  const getUrl = (acc: AccountLike, size = 100) =>
    getAvatarUrl(acc, size, failedUrlsRef)

  return { getAvatarUrl: getUrl, markFailed, failedUrlsRef }
}

/** 头像加载失败时的处理（供 @error 调用，兼容旧用法） */
export function onAvatarError(url: string) {
  markAvatarUrlFailed(url)
}

loadFailedCache()
