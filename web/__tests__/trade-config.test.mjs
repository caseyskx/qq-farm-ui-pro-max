import assert from 'node:assert/strict'
import test from 'node:test'

const {
  buildTradeSellConfigFromDraft,
  buildTradeSellStrategyDraft,
  normalizeTradeConfig,
} = await import('../src/utils/trade-config.ts')

test('normalizeTradeConfig keeps front-end trade payload aligned with backend bounds', () => {
  const normalized = normalizeTradeConfig({
    legacyField: 'should-drop',
    sell: {
      keepMinEachFruit: -7,
      keepFruitIds: '20059, 20059 20060 foo 0',
      rareKeep: {
        enabled: true,
        judgeBy: 'unexpected',
        minPlantLevel: 5000,
        minUnitPrice: 9999999999,
      },
      batchSize: 999,
      previewBeforeManualSell: 1,
    },
  })

  assert.deepEqual(normalized, {
    sell: {
      scope: 'fruit_only',
      keepMinEachFruit: 0,
      keepFruitIds: [20059, 20060],
      rareKeep: {
        enabled: true,
        judgeBy: 'either',
        minPlantLevel: 999,
        minUnitPrice: 999999999,
      },
      batchSize: 50,
      previewBeforeManualSell: true,
    },
  })
})

test('trade sell draft round trip preserves the saved strategy shape', () => {
  const savedConfig = buildTradeSellConfigFromDraft({
    keepMinEachFruit: 3,
    rareKeepEnabled: true,
    judgeBy: 'unit_price',
    minPlantLevel: 25,
    minUnitPrice: 555,
    batchSize: 5,
    previewBeforeManualSell: true,
  }, '20060, 20059, 20060')

  assert.deepEqual(buildTradeSellStrategyDraft({ sell: savedConfig }), {
    keepMinEachFruit: 3,
    keepFruitIds: [20060, 20059],
    rareKeepEnabled: true,
    judgeBy: 'unit_price',
    minPlantLevel: 25,
    minUnitPrice: 555,
    batchSize: 5,
    previewBeforeManualSell: true,
  })
})
