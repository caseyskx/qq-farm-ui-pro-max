import type { ViewPreferencesPayload } from './view-preferences'

interface AccountsPagePreferenceHydrationOptions {
  fetchPreferences: () => Promise<ViewPreferencesPayload | null>
  hydrateViewState: (payload?: ViewPreferencesPayload | null) => Promise<unknown> | unknown
  hydrateActionHistory: (payload?: ViewPreferencesPayload | null) => Promise<unknown> | unknown
  onFetchError?: (error: unknown) => void
}

export async function hydrateAccountsPagePreferences(
  options: AccountsPagePreferenceHydrationOptions,
) {
  let payload: ViewPreferencesPayload | null = null
  try {
    payload = await options.fetchPreferences()
  }
  catch (error) {
    options.onFetchError?.(error)
  }

  await Promise.all([
    options.hydrateViewState(payload),
    options.hydrateActionHistory(payload),
  ])

  return payload
}
