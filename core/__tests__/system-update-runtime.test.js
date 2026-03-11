const test = require('node:test');
const assert = require('node:assert/strict');

const {
    mergeAgentSummary,
    buildActiveJobRuntimePatch,
    mergeClusterNodeSummary,
    buildClusterNodeDrainMap,
} = require('../src/services/system-update-runtime');

test('mergeAgentSummary upserts same node and drops stale entries', () => {
    const now = 1741564800000;
    const summary = mergeAgentSummary([
        { nodeId: 'worker-old', status: 'idle', updatedAt: now - (15 * 60 * 1000) },
        { nodeId: 'worker-a', status: 'idle', updatedAt: now - 1000 },
    ], {
        nodeId: 'worker-a',
        status: 'running',
        version: '4.5.19',
        managedNodeIds: ['worker-a', 'worker-a'],
        jobId: 11,
        jobStatus: 'running',
        targetVersion: 'v4.5.19',
    }, { now, maxAgeMs: 5 * 60 * 1000 });

    assert.equal(summary.length, 1);
    assert.deepEqual(summary[0], {
        nodeId: 'worker-a',
        role: 'host_agent',
        status: 'running',
        version: 'v4.5.19',
        managedNodeIds: ['worker-a'],
        jobId: 11,
        jobStatus: 'running',
        targetVersion: 'v4.5.19',
        updatedAt: now,
    });
});

test('buildActiveJobRuntimePatch clears active job when input is null', () => {
    assert.deepEqual(buildActiveJobRuntimePatch(null), {
        activeJobId: 0,
        activeJobKey: '',
        activeJobStatus: '',
        activeTargetVersion: '',
    });
});

test('buildActiveJobRuntimePatch keeps active job fields for running job', () => {
    assert.deepEqual(buildActiveJobRuntimePatch({
        id: 7,
        jobKey: 'upd_7',
        status: 'running',
        targetVersion: '4.5.19',
    }), {
        activeJobId: 7,
        activeJobKey: 'upd_7',
        activeJobStatus: 'running',
        activeTargetVersion: 'v4.5.19',
    });
});

test('mergeClusterNodeSummary keeps drain flag and prunes stale offline nodes', () => {
    const now = 1741564800000;
    const nodes = mergeClusterNodeSummary([
        { nodeId: 'worker-old', status: 'offline', connected: false, updatedAt: now - (2 * 24 * 60 * 60 * 1000) },
        { nodeId: 'worker-a', status: 'active', connected: true, draining: false, assignedCount: 1, assignedAccountIds: ['acc-1'], updatedAt: now - 5000 },
    ], [{
        nodeId: 'worker-a',
        status: 'draining',
        connected: true,
        draining: true,
        assignedCount: 0,
        assignedAccountIds: [],
        version: '4.5.19',
        updatedAt: now,
    }], { now, maxAgeMs: 24 * 60 * 60 * 1000 });

    assert.equal(nodes.length, 1);
    assert.deepEqual(nodes[0], {
        nodeId: 'worker-a',
        role: 'worker',
        status: 'draining',
        version: 'v4.5.19',
        connected: true,
        draining: true,
        assignedCount: 0,
        assignedAccountIds: [],
        updatedAt: now,
    });
    assert.deepEqual(Array.from(buildClusterNodeDrainMap({ clusterNodes: nodes }).entries()), [['worker-a', true]]);
});
