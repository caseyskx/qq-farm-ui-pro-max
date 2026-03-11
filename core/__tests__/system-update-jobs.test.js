const test = require('node:test');
const assert = require('node:assert/strict');

const {
    summarizeUpdateJobBatch,
    normalizeNodeIdList,
} = require('../src/services/system-update-jobs');

test('summarizeUpdateJobBatch aggregates progress, status counts and agent lists', () => {
    const summary = summarizeUpdateJobBatch([
        {
            id: 1,
            jobKey: 'upd_1',
            batchKey: 'upd_batch_1',
            scope: 'cluster',
            strategy: 'rolling',
            status: 'running',
            sourceVersion: 'v4.5.18',
            targetVersion: 'v4.5.19',
            targetAgentId: 'agent-a',
            claimAgentId: 'agent-a',
            drainNodeIds: ['worker-a'],
            progressPercent: 60,
            summaryMessage: 'agent-a running',
            errorMessage: '',
            createdAt: 100,
            updatedAt: 140,
        },
        {
            id: 2,
            jobKey: 'upd_2',
            batchKey: 'upd_batch_1',
            scope: 'cluster',
            strategy: 'rolling',
            status: 'failed',
            sourceVersion: 'v4.5.18',
            targetVersion: 'v4.5.19',
            targetAgentId: 'agent-b',
            claimAgentId: 'agent-b',
            drainNodeIds: ['worker-b'],
            progressPercent: 25,
            summaryMessage: 'agent-b failed',
            errorMessage: 'network',
            createdAt: 110,
            updatedAt: 150,
        },
    ]);

    assert.equal(summary.batchKey, 'upd_batch_1');
    assert.equal(summary.total, 2);
    assert.equal(summary.runningCount, 1);
    assert.equal(summary.failedCount, 1);
    assert.equal(summary.progressPercent, 43);
    assert.equal(summary.status, 'running');
    assert.deepEqual(summary.targetAgentIds, ['agent-a', 'agent-b']);
    assert.deepEqual(summary.claimAgentIds, ['agent-a', 'agent-b']);
    assert.deepEqual(summary.drainNodeIds, ['worker-a', 'worker-b']);
    assert.equal(summary.latestJobId, 2);
    assert.equal(summary.latestSummaryMessage, 'agent-b failed');
    assert.equal(summary.latestErrorMessage, 'network');
});

test('normalizeNodeIdList deduplicates and trims node ids', () => {
    assert.deepEqual(normalizeNodeIdList([' worker-a ', '', 'worker-a', 'worker-b']), ['worker-a', 'worker-b']);
});
