const {
    getSystemUpdateRuntime,
    saveSystemUpdateRuntime,
    normalizeClusterNodeRecord,
} = require('./system-update-config');
const {
    formatVersionTag,
    toTimestamp,
} = require('./system-update-utils');

function normalizeAgentRecord(input = {}, options = {}) {
    const now = Number(options.now) || Date.now();
    const managedNodeIds = Array.isArray(input.managedNodeIds)
        ? Array.from(new Set(input.managedNodeIds.map(item => String(item || '').trim()).filter(Boolean)))
        : String(input.managedNodeIds || input.managedNodeId || '')
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    return {
        nodeId: String(input.nodeId || input.agentId || '').trim(),
        role: String(input.role || 'host_agent').trim() || 'host_agent',
        status: String(input.status || 'idle').trim() || 'idle',
        version: formatVersionTag(input.version || '', ''),
        managedNodeIds,
        jobId: Math.max(0, Number.parseInt(input.jobId, 10) || 0),
        jobStatus: String(input.jobStatus || '').trim(),
        targetVersion: formatVersionTag(input.targetVersion || '', ''),
        updatedAt: now,
    };
}

function mergeAgentSummary(currentList = [], agentRecord = {}, options = {}) {
    const now = Number(options.now) || Date.now();
    const maxAgeMs = Math.max(60 * 1000, Number.parseInt(options.maxAgeMs, 10) || 10 * 60 * 1000);
    const incoming = normalizeAgentRecord(agentRecord, { now });
    if (!incoming.nodeId) {
        return Array.isArray(currentList) ? currentList.slice(0, 20) : [];
    }

    const next = (Array.isArray(currentList) ? currentList : [])
        .filter((item) => {
            const nodeId = String(item && item.nodeId || '').trim();
            const updatedAt = toTimestamp(item && item.updatedAt, 0);
            if (!nodeId) return false;
            if (nodeId === incoming.nodeId) return false;
            return now - updatedAt <= maxAgeMs;
        })
        .map((item) => ({
            nodeId: String(item.nodeId || '').trim(),
            role: String(item.role || 'host_agent').trim() || 'host_agent',
            status: String(item.status || 'idle').trim() || 'idle',
            version: formatVersionTag(item.version || '', ''),
            managedNodeIds: Array.isArray(item.managedNodeIds)
                ? Array.from(new Set(item.managedNodeIds.map(value => String(value || '').trim()).filter(Boolean)))
                : [],
            jobId: Math.max(0, Number.parseInt(item.jobId, 10) || 0),
            jobStatus: String(item.jobStatus || '').trim(),
            targetVersion: formatVersionTag(item.targetVersion || '', ''),
            updatedAt: toTimestamp(item.updatedAt, now),
        }));

    next.push(incoming);
    next.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
    return next.slice(0, 20);
}

function buildActiveJobRuntimePatch(job) {
    if (!job) {
        return {
            activeJobId: 0,
            activeJobKey: '',
            activeJobStatus: '',
            activeTargetVersion: '',
        };
    }
    return {
        activeJobId: Number(job.id) || 0,
        activeJobKey: String(job.jobKey || '').trim(),
        activeJobStatus: String(job.status || '').trim(),
        activeTargetVersion: formatVersionTag(job.targetVersion || '', ''),
    };
}

function mergeClusterNodeSummary(currentList = [], incomingList = [], options = {}) {
    const now = Number(options.now) || Date.now();
    const maxAgeMs = Math.max(10 * 60 * 1000, Number.parseInt(options.maxAgeMs, 10) || 24 * 60 * 60 * 1000);
    const incomingRecords = (Array.isArray(incomingList) ? incomingList : [incomingList])
        .map(item => normalizeClusterNodeRecord(item))
        .filter(Boolean);
    if (incomingRecords.length === 0) {
        return Array.isArray(currentList) ? currentList.slice(0, 50) : [];
    }

    const incomingMap = new Map(incomingRecords.map(item => [item.nodeId, item]));
    const next = (Array.isArray(currentList) ? currentList : [])
        .map(item => normalizeClusterNodeRecord(item))
        .filter(Boolean)
        .filter((item) => {
            if (incomingMap.has(item.nodeId)) {
                return false;
            }
            if (item.connected || item.draining) {
                return true;
            }
            return now - toTimestamp(item.updatedAt, now) <= maxAgeMs;
        });

    next.push(...incomingMap.values());
    next.sort((left, right) => {
        if (!!left.connected !== !!right.connected) {
            return left.connected ? -1 : 1;
        }
        if (!!left.draining !== !!right.draining) {
            return left.draining ? -1 : 1;
        }
        return (right.updatedAt || 0) - (left.updatedAt || 0);
    });
    return next.slice(0, 50);
}

function buildClusterNodeDrainMap(runtime = {}) {
    const nodes = Array.isArray(runtime.clusterNodes) ? runtime.clusterNodes : [];
    return new Map(
        nodes
            .map(item => normalizeClusterNodeRecord(item))
            .filter(Boolean)
            .map(item => [item.nodeId, !!item.draining]),
    );
}

async function saveAgentHeartbeat(agentRecord = {}, options = {}) {
    const currentRuntime = await getSystemUpdateRuntime();
    const nextRuntime = {
        ...currentRuntime,
        agentSummary: mergeAgentSummary(currentRuntime.agentSummary, agentRecord, options),
    };
    return saveSystemUpdateRuntime(nextRuntime);
}

async function saveClusterNodeRuntimeSnapshot(nodeRecords = [], options = {}) {
    const currentRuntime = await getSystemUpdateRuntime();
    const nextRuntime = {
        ...currentRuntime,
        clusterNodes: mergeClusterNodeSummary(currentRuntime.clusterNodes, nodeRecords, options),
    };
    return saveSystemUpdateRuntime(nextRuntime);
}

async function saveClusterNodeDrainState(nodeId, draining, options = {}) {
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedNodeId) {
        return getSystemUpdateRuntime();
    }

    const now = Number(options.now) || Date.now();
    const currentRuntime = await getSystemUpdateRuntime();
    const currentNode = (currentRuntime.clusterNodes || [])
        .map(item => normalizeClusterNodeRecord(item))
        .find(item => item && item.nodeId === normalizedNodeId);
    const nextNode = normalizeClusterNodeRecord({
        ...(currentNode || {}),
        nodeId: normalizedNodeId,
        draining: !!draining,
        connected: currentNode ? currentNode.connected : false,
        status: currentNode && currentNode.connected
            ? (draining ? 'draining' : (currentNode.assignedCount > 0 ? 'active' : 'idle'))
            : 'offline',
        updatedAt: now,
    });
    const nextRuntime = {
        ...currentRuntime,
        clusterNodes: mergeClusterNodeSummary(currentRuntime.clusterNodes, [nextNode], { now }),
    };
    return saveSystemUpdateRuntime(nextRuntime);
}

async function saveActiveJobRuntime(job, options = {}) {
    const currentRuntime = await getSystemUpdateRuntime();
    const nextRuntime = {
        ...currentRuntime,
        ...buildActiveJobRuntimePatch(job),
    };
    if (options.lastError !== undefined) {
        nextRuntime.lastError = String(options.lastError || '').trim();
    }
    if (options.lastCheckAt !== undefined) {
        nextRuntime.lastCheckAt = Math.max(0, Number.parseInt(options.lastCheckAt, 10) || 0);
    }
    if (options.lastCheckOk !== undefined) {
        nextRuntime.lastCheckOk = !!options.lastCheckOk;
    }
    return saveSystemUpdateRuntime(nextRuntime);
}

module.exports = {
    normalizeAgentRecord,
    mergeAgentSummary,
    buildActiveJobRuntimePatch,
    mergeClusterNodeSummary,
    buildClusterNodeDrainMap,
    saveAgentHeartbeat,
    saveClusterNodeRuntimeSnapshot,
    saveClusterNodeDrainState,
    saveActiveJobRuntime,
};
