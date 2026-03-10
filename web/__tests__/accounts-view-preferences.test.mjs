import assert from 'node:assert/strict'
import test from 'node:test'

const { hydrateAccountsPagePreferences } = await import('../src/utils/accounts-view-preferences.ts')

test('hydrateAccountsPagePreferences fetches once and fans out the same payload to both account preference hydrators', async () => {
  const calls = {
    fetchCount: 0,
    viewPayloads: [],
    historyPayloads: [],
  }
  const payload = {
    accountsViewState: {
      viewMode: 'table',
      tableSortKey: 'owner',
      tableSortDirection: 'asc',
    },
    accountsActionHistory: [
      { id: 'one', actionLabel: '批量启动', status: 'success' },
    ],
  }

  const result = await hydrateAccountsPagePreferences({
    fetchPreferences: async () => {
      calls.fetchCount += 1
      return payload
    },
    hydrateViewState: async (nextPayload) => {
      calls.viewPayloads.push(nextPayload)
    },
    hydrateActionHistory: async (nextPayload) => {
      calls.historyPayloads.push(nextPayload)
    },
  })

  assert.equal(result, payload)
  assert.equal(calls.fetchCount, 1)
  assert.deepEqual(calls.viewPayloads, [payload])
  assert.deepEqual(calls.historyPayloads, [payload])
})

test('hydrateAccountsPagePreferences still hydrates both sections with null when fetch fails', async () => {
  const calls = {
    errors: [],
    viewPayloads: [],
    historyPayloads: [],
  }
  const expectedError = new Error('network down')

  const result = await hydrateAccountsPagePreferences({
    fetchPreferences: async () => {
      throw expectedError
    },
    hydrateViewState: async (nextPayload) => {
      calls.viewPayloads.push(nextPayload)
    },
    hydrateActionHistory: async (nextPayload) => {
      calls.historyPayloads.push(nextPayload)
    },
    onFetchError: (error) => {
      calls.errors.push(error)
    },
  })

  assert.equal(result, null)
  assert.deepEqual(calls.errors, [expectedError])
  assert.deepEqual(calls.viewPayloads, [null])
  assert.deepEqual(calls.historyPayloads, [null])
})
