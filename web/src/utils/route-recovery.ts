const ROUTE_RECOVERY_TARGET_KEY = '__route_recovery_target__'
const ROUTE_RECOVERY_AT_KEY = '__route_recovery_at__'
const ROUTE_RECOVERY_GUARD_MS = 12000

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'failed to load module script',
  'loading chunk',
  'chunkloaderror',
  'unable to preload css',
  'unable to preload module',
  'module script has an unsupported mime type',
  'failed to fetch module',
]

export function extractRouteErrorMessage(error: unknown) {
  if (error instanceof Error)
    return error.message || error.name || String(error)

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? String(error.message || '') : ''
    const maybeReason = 'reason' in error ? String(error.reason || '') : ''
    return maybeMessage || maybeReason || String(error)
  }

  return String(error || '')
}

export function isRecoverableRouteError(error: unknown) {
  const message = extractRouteErrorMessage(error).toLowerCase()
  if (!message)
    return false

  return DYNAMIC_IMPORT_ERROR_PATTERNS.some(pattern => message.includes(pattern))
}

export function getCurrentRouteLocation() {
  if (typeof window === 'undefined')
    return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}

export function clearRouteRecoveryState() {
  if (typeof window === 'undefined')
    return

  sessionStorage.removeItem(ROUTE_RECOVERY_TARGET_KEY)
  sessionStorage.removeItem(ROUTE_RECOVERY_AT_KEY)
}

export function attemptRouteRecovery(targetPath = getCurrentRouteLocation()) {
  if (typeof window === 'undefined')
    return false

  const normalizedTarget = String(targetPath || getCurrentRouteLocation()).trim() || '/'
  const now = Date.now()
  const previousTarget = sessionStorage.getItem(ROUTE_RECOVERY_TARGET_KEY) || ''
  const previousAt = Number(sessionStorage.getItem(ROUTE_RECOVERY_AT_KEY) || '0')
  const shouldGuard = previousTarget === normalizedTarget && now - previousAt < ROUTE_RECOVERY_GUARD_MS

  if (shouldGuard)
    return false

  sessionStorage.setItem(ROUTE_RECOVERY_TARGET_KEY, normalizedTarget)
  sessionStorage.setItem(ROUTE_RECOVERY_AT_KEY, String(now))

  const url = new URL(normalizedTarget, window.location.origin)
  url.searchParams.set('__route_reload', String(now))
  window.location.replace(`${url.pathname}${url.search}${url.hash}`)
  return true
}
