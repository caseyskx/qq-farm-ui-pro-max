import type { ViewPreferencesPayload } from '../utils/view-preferences'
import { computed, onScopeDispose, ref, watch } from 'vue'

type ViewPreferencesFetcher = () => Promise<ViewPreferencesPayload | null>
type ViewPreferencesSaver = (payload: ViewPreferencesPayload) => Promise<unknown>

export interface UseViewPreferenceSyncOptions<T, K extends keyof ViewPreferencesPayload> {
  key: K
  label: string
  buildState: () => T
  applyState: (state: ViewPreferencesPayload[K] | null | undefined) => void
  defaultState?: T
  readLocalFallback?: () => T
  shouldSyncFallback?: (state: T) => boolean
  debounceMs?: number
  fetchPreferences?: ViewPreferencesFetcher
  savePreferences?: ViewPreferencesSaver
}

function hasPersistedViewPreferenceValue(value: unknown) {
  return value !== undefined && value !== null
}

function buildViewPreferencePayload<K extends keyof ViewPreferencesPayload>(
  key: K,
  state: ViewPreferencesPayload[K],
): ViewPreferencesPayload {
  return { [key]: state } as ViewPreferencesPayload
}

async function resolveDefaultFetchPreferences(): Promise<ViewPreferencesFetcher> {
  const { fetchViewPreferences } = await import('../utils/view-preference-api')
  return fetchViewPreferences
}

async function resolveDefaultSavePreferences(): Promise<ViewPreferencesSaver> {
  const { saveViewPreferences } = await import('../utils/view-preference-api')
  return saveViewPreferences
}

export function useViewPreferenceSync<T, K extends keyof ViewPreferencesPayload>(
  options: UseViewPreferenceSyncOptions<T, K>,
) {
  const hydrating = ref(false)
  const syncEnabled = ref(false)
  let syncTimer: ReturnType<typeof setTimeout> | null = null
  const debounceMs = options.debounceMs ?? 240
  const fetchPreferences = options.fetchPreferences ?? (() => resolveDefaultFetchPreferences().then(load => load()))
  const savePreferences = options.savePreferences ?? (payload => resolveDefaultSavePreferences().then(save => save(payload)))

  const signature = computed(() => JSON.stringify(options.buildState()))

  function clearSyncTimer() {
    if (syncTimer) {
      clearTimeout(syncTimer)
      syncTimer = null
    }
  }

  function applyHydratedState(state: ViewPreferencesPayload[K] | null | undefined) {
    hydrating.value = true
    options.applyState(state)
    hydrating.value = false
  }

  function readFallbackState() {
    return options.readLocalFallback ? options.readLocalFallback() : options.buildState()
  }

  function shouldSyncFallbackState(state: T) {
    if (options.shouldSyncFallback)
      return options.shouldSyncFallback(state)
    if (options.defaultState === undefined)
      return false
    return JSON.stringify(state) !== JSON.stringify(options.defaultState)
  }

  async function persistState(state: T = options.buildState()) {
    try {
      await savePreferences(
        buildViewPreferencePayload(options.key, state as ViewPreferencesPayload[K]),
      )
    }
    catch (error) {
      console.warn(`保存${options.label}失败`, error)
    }
  }

  async function hydrate(preloadedPayload?: ViewPreferencesPayload | null) {
    const fallbackState = readFallbackState()
    try {
      const payload = preloadedPayload ?? await fetchPreferences()
      const remoteState = payload?.[options.key]
      if (hasPersistedViewPreferenceValue(remoteState)) {
        applyHydratedState(remoteState)
        return
      }

      applyHydratedState(fallbackState as ViewPreferencesPayload[K])
      if (shouldSyncFallbackState(fallbackState))
        await persistState(fallbackState)
    }
    catch (error) {
      console.warn(`读取${options.label}失败`, error)
      applyHydratedState(fallbackState as ViewPreferencesPayload[K])
    }
  }

  function scheduleSync() {
    clearSyncTimer()
    const payload = options.buildState()
    syncTimer = setTimeout(() => {
      void persistState(payload)
    }, debounceMs)
  }

  watch(signature, () => {
    if (!syncEnabled.value || hydrating.value)
      return
    scheduleSync()
  })

  onScopeDispose(() => {
    clearSyncTimer()
  })

  return {
    hydrating,
    syncEnabled,
    hydrate,
    enableSync: () => {
      syncEnabled.value = true
    },
    disableSync: () => {
      syncEnabled.value = false
    },
  }
}
