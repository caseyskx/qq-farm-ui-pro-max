const test = require('node:test');
const assert = require('node:assert/strict');

const {
    computeNextRunAt,
    normalizeIntervalRangeSec,
    resolveRuntimeIntervals,
} = require('../src/core/unified-intervals');

test('resolveRuntimeIntervals lets default help and steal ranges follow customized friend range', () => {
    const resolved = resolveRuntimeIntervals({
        friendMin: 10,
        friendMax: 20,
        helpMin: 60,
        helpMax: 180,
        stealMin: 60,
        stealMax: 180,
    });

    assert.deepEqual(resolved.friend, { min: 10, max: 20 });
    assert.deepEqual(resolved.help, { min: 10, max: 20 });
    assert.deepEqual(resolved.steal, { min: 10, max: 20 });
});

test('resolveRuntimeIntervals preserves explicit help and steal overrides', () => {
    const resolved = resolveRuntimeIntervals({
        friendMin: 10,
        friendMax: 20,
        helpMin: 90,
        helpMax: 120,
        stealMin: 150,
        stealMax: 210,
    });

    assert.deepEqual(resolved.friend, { min: 10, max: 20 });
    assert.deepEqual(resolved.help, { min: 90, max: 120 });
    assert.deepEqual(resolved.steal, { min: 150, max: 210 });
});

test('resolveRuntimeIntervals falls back to full friend range when help and steal are omitted', () => {
    const resolved = resolveRuntimeIntervals({
        friendMin: 12,
        friendMax: 24,
    });

    assert.deepEqual(resolved.friend, { min: 12, max: 24 });
    assert.deepEqual(resolved.help, { min: 12, max: 24 });
    assert.deepEqual(resolved.steal, { min: 12, max: 24 });
});

test('normalizeIntervalRangeSec swaps inverted ranges', () => {
    assert.deepEqual(normalizeIntervalRangeSec(20, 10, 5), { min: 10, max: 20 });
});

test('computeNextRunAt keeps interval anchored to task start time', () => {
    assert.equal(computeNextRunAt(1_000, 15_000), 16_000);
});
