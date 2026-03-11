const test = require('node:test');
const assert = require('node:assert/strict');

const { getDetailedRewardSummary, getRewardSummary } = require('../src/services/common');

test('getRewardSummary resolves configured item names instead of raw item ids', () => {
    const summary = getRewardSummary([
        { id: 1002, count: 50 },
        { id: 80011, count: 5 },
        { id: 90004, count: 1 },
        { id: 100003, count: 2 },
    ]);

    assert.equal(summary, '点券50/有机化肥(1小时)x5/1天狗粮x1/化肥礼包x2');
});

test('getDetailedRewardSummary attaches resolved item names', () => {
    const result = getDetailedRewardSummary([
        { id: 1001, count: 1200 },
        { id: 80001, count: 3 },
    ]);

    assert.equal(result.gold, 1200);
    assert.deepEqual(result.items, [
        { id: 80001, count: 3, name: '化肥(1小时)' },
    ]);
});
