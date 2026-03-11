const crypto = require('node:crypto');
const { getPool, transaction } = require('./mysql-db');
const {
    parseJsonSafely,
    toTimestamp,
} = require('./system-update-utils');

const UPDATE_JOB_STATUS = Object.freeze({
    PENDING: 'pending',
    CLAIMED: 'claimed',
    RUNNING: 'running',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
});

const UPDATE_SCOPE_OPTIONS = new Set(['app', 'worker', 'cluster']);
const UPDATE_STRATEGY_OPTIONS = new Set(['in_place', 'rolling', 'parallel_new_dir', 'drain_and_cutover']);
const UPDATE_KIND_OPTIONS = new Set(['app_update', 'worker_update', 'cluster_update']);

function normalizeBatchKey(batchKey) {
    return String(batchKey || '').trim().slice(0, 64);
}

function normalizeAgentId(agentId) {
    return String(agentId || '').trim().slice(0, 128);
}

function normalizeJobStatus(status, fallback = UPDATE_JOB_STATUS.PENDING) {
    const value = String(status || '').trim().toLowerCase();
    return Object.values(UPDATE_JOB_STATUS).includes(value) ? value : fallback;
}

function normalizeScope(scope, fallback = 'app') {
    const value = String(scope || '').trim().toLowerCase();
    return UPDATE_SCOPE_OPTIONS.has(value) ? value : fallback;
}

function normalizeStrategy(strategy, fallback = 'rolling') {
    const value = String(strategy || '').trim().toLowerCase();
    return UPDATE_STRATEGY_OPTIONS.has(value) ? value : fallback;
}

function normalizeKind(kind, fallback = 'app_update') {
    const value = String(kind || '').trim().toLowerCase();
    return UPDATE_KIND_OPTIONS.has(value) ? value : fallback;
}

function normalizeNodeIdList(input) {
    if (!Array.isArray(input)) return [];
    return Array.from(new Set(input.map(item => String(item || '').trim()).filter(Boolean)));
}

function buildJobKey() {
    return `upd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function mapJobRow(row) {
    if (!row) return null;
    return {
        id: Number(row.id) || 0,
        jobKey: String(row.job_key || '').trim(),
        kind: normalizeKind(row.kind),
        scope: normalizeScope(row.scope),
        strategy: normalizeStrategy(row.strategy),
        status: normalizeJobStatus(row.status),
        sourceVersion: String(row.source_version || '').trim(),
        targetVersion: String(row.target_version || '').trim(),
        batchKey: normalizeBatchKey(row.batch_key),
        preserveCurrent: !!row.preserve_current,
        requireDrain: !!row.require_drain,
        drainNodeIds: normalizeNodeIdList(parseJsonSafely(row.drain_node_ids, [])),
        note: String(row.note || '').trim(),
        createdBy: String(row.created_by || '').trim(),
        targetAgentId: normalizeAgentId(row.target_agent_id),
        claimAgentId: normalizeAgentId(row.claim_agent_id),
        progressPercent: Math.max(0, Math.min(100, Number.parseInt(row.progress_percent, 10) || 0)),
        summaryMessage: String(row.summary_message || '').trim(),
        payload: parseJsonSafely(row.payload_json, null),
        result: parseJsonSafely(row.result_json, null),
        errorMessage: String(row.error_message || '').trim(),
        claimedAt: toTimestamp(row.claimed_at),
        startedAt: toTimestamp(row.started_at),
        finishedAt: toTimestamp(row.finished_at),
        createdAt: toTimestamp(row.created_at),
        updatedAt: toTimestamp(row.updated_at),
    };
}

async function listUpdateJobs(options = {}) {
    const pool = getPool();
    const limit = Math.max(1, Math.min(100, Number.parseInt(options.limit, 10) || 20));
    const statuses = Array.isArray(options.statuses)
        ? options.statuses.map(item => normalizeJobStatus(item, '')).filter(Boolean)
        : [];
    const batchKey = normalizeBatchKey(options.batchKey);

    let sql = 'SELECT * FROM update_jobs';
    const params = [];
    const clauses = [];
    if (statuses.length > 0) {
        clauses.push(`status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
    }
    if (batchKey) {
        clauses.push('batch_key = ?');
        params.push(batchKey);
    }
    if (clauses.length > 0) {
        sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const [rows] = await pool.query(sql, params);
    return (rows || []).map(mapJobRow).filter(Boolean);
}

async function getUpdateJobById(idOrKey) {
    const pool = getPool();
    const text = String(idOrKey || '').trim();
    if (!text) return null;
    const isNumericId = /^\d+$/.test(text);
    const [rows] = await pool.query(
        isNumericId
            ? 'SELECT * FROM update_jobs WHERE id = ? LIMIT 1'
            : 'SELECT * FROM update_jobs WHERE job_key = ? LIMIT 1',
        [isNumericId ? Number(text) : text],
    );
    return mapJobRow(rows && rows[0]);
}

async function findActiveUpdateJob() {
    const jobs = await listUpdateJobs({
        limit: 1,
        statuses: [UPDATE_JOB_STATUS.PENDING, UPDATE_JOB_STATUS.CLAIMED, UPDATE_JOB_STATUS.RUNNING],
    });
    return jobs[0] || null;
}

async function createUpdateJob(input = {}) {
    const jobKey = buildJobKey();
    const record = {
        jobKey,
        kind: normalizeKind(input.kind),
        scope: normalizeScope(input.scope),
        strategy: normalizeStrategy(input.strategy),
        status: normalizeJobStatus(input.status),
        sourceVersion: String(input.sourceVersion || '').trim(),
        targetVersion: String(input.targetVersion || '').trim(),
        batchKey: normalizeBatchKey(input.batchKey),
        preserveCurrent: !!input.preserveCurrent,
        requireDrain: !!input.requireDrain,
        drainNodeIds: normalizeNodeIdList(input.drainNodeIds),
        note: String(input.note || '').trim(),
        createdBy: String(input.createdBy || '').trim(),
        targetAgentId: normalizeAgentId(input.targetAgentId),
        claimAgentId: normalizeAgentId(input.claimAgentId),
        progressPercent: Math.max(0, Math.min(100, Number.parseInt(input.progressPercent, 10) || 0)),
        summaryMessage: String(input.summaryMessage || '').trim(),
        payload: input.payload && typeof input.payload === 'object' ? input.payload : null,
        result: input.result && typeof input.result === 'object' ? input.result : null,
        errorMessage: String(input.errorMessage || '').trim(),
    };

    const insertId = await transaction(async (conn) => {
        const [result] = await conn.query(
            `INSERT INTO update_jobs (
                job_key, kind, scope, strategy, status, source_version, target_version,
                batch_key, preserve_current, require_drain, drain_node_ids, note, created_by, target_agent_id, claim_agent_id,
                progress_percent, summary_message, payload_json, result_json, error_message,
                claimed_at, started_at, finished_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record.jobKey,
                record.kind,
                record.scope,
                record.strategy,
                record.status,
                record.sourceVersion,
                record.targetVersion,
                record.batchKey,
                record.preserveCurrent ? 1 : 0,
                record.requireDrain ? 1 : 0,
                record.drainNodeIds.length > 0 ? JSON.stringify(record.drainNodeIds) : null,
                record.note,
                record.createdBy,
                record.targetAgentId,
                record.claimAgentId,
                record.progressPercent,
                record.summaryMessage,
                record.payload ? JSON.stringify(record.payload) : null,
                record.result ? JSON.stringify(record.result) : null,
                record.errorMessage,
                input.claimedAt ? new Date(input.claimedAt) : null,
                input.startedAt ? new Date(input.startedAt) : null,
                input.finishedAt ? new Date(input.finishedAt) : null,
            ],
        );
        return Number(result.insertId) || 0;
    });

    return getUpdateJobById(insertId);
}

async function updateUpdateJob(idOrKey, patch = {}) {
    const target = await getUpdateJobById(idOrKey);
    if (!target) return null;

    const assignments = [];
    const params = [];
    const applyValue = (field, value) => {
        assignments.push(`${field} = ?`);
        params.push(value);
    };

    if (patch.status !== undefined) applyValue('status', normalizeJobStatus(patch.status, target.status));
    if (patch.strategy !== undefined) applyValue('strategy', normalizeStrategy(patch.strategy, target.strategy));
    if (patch.scope !== undefined) applyValue('scope', normalizeScope(patch.scope, target.scope));
    if (patch.targetVersion !== undefined) applyValue('target_version', String(patch.targetVersion || '').trim());
    if (patch.sourceVersion !== undefined) applyValue('source_version', String(patch.sourceVersion || '').trim());
    if (patch.batchKey !== undefined) applyValue('batch_key', normalizeBatchKey(patch.batchKey));
    if (patch.note !== undefined) applyValue('note', String(patch.note || '').trim());
    if (patch.targetAgentId !== undefined) applyValue('target_agent_id', normalizeAgentId(patch.targetAgentId));
    if (patch.claimAgentId !== undefined) applyValue('claim_agent_id', normalizeAgentId(patch.claimAgentId));
    if (patch.summaryMessage !== undefined) applyValue('summary_message', String(patch.summaryMessage || '').trim());
    if (patch.errorMessage !== undefined) applyValue('error_message', String(patch.errorMessage || '').trim());
    if (patch.progressPercent !== undefined) applyValue('progress_percent', Math.max(0, Math.min(100, Number.parseInt(patch.progressPercent, 10) || 0)));
    if (patch.preserveCurrent !== undefined) applyValue('preserve_current', patch.preserveCurrent ? 1 : 0);
    if (patch.requireDrain !== undefined) applyValue('require_drain', patch.requireDrain ? 1 : 0);
    if (patch.drainNodeIds !== undefined) {
        const drainNodeIds = normalizeNodeIdList(patch.drainNodeIds);
        applyValue('drain_node_ids', drainNodeIds.length > 0 ? JSON.stringify(drainNodeIds) : null);
    }
    if (patch.payload !== undefined) applyValue('payload_json', patch.payload ? JSON.stringify(patch.payload) : null);
    if (patch.result !== undefined) applyValue('result_json', patch.result ? JSON.stringify(patch.result) : null);
    if (patch.claimedAt !== undefined) applyValue('claimed_at', patch.claimedAt ? new Date(patch.claimedAt) : null);
    if (patch.startedAt !== undefined) applyValue('started_at', patch.startedAt ? new Date(patch.startedAt) : null);
    if (patch.finishedAt !== undefined) applyValue('finished_at', patch.finishedAt ? new Date(patch.finishedAt) : null);

    if (assignments.length === 0) {
        return target;
    }

    const pool = getPool();
    await pool.query(
        `UPDATE update_jobs SET ${assignments.join(', ')} WHERE id = ?`,
        [...params, target.id],
    );

    return getUpdateJobById(target.id);
}

async function claimNextUpdateJob(agentId) {
    const normalizedAgentId = String(agentId || '').trim();
    if (!normalizedAgentId) {
        throw new Error('agentId is required');
    }

    return transaction(async (conn) => {
        const [rows] = await conn.query(
            `SELECT id
             FROM update_jobs
             WHERE status = ?
               AND (target_agent_id = '' OR target_agent_id = ?)
             ORDER BY id ASC
             LIMIT 1
             FOR UPDATE`,
            [UPDATE_JOB_STATUS.PENDING, normalizedAgentId],
        );
        const row = rows && rows[0];
        if (!row || !row.id) {
            return null;
        }
        await conn.query(
            `UPDATE update_jobs
             SET status = ?, claim_agent_id = ?, claimed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [UPDATE_JOB_STATUS.CLAIMED, normalizedAgentId, Number(row.id)],
        );
        return Number(row.id);
    }).then((jobId) => {
        if (!jobId) return null;
        return getUpdateJobById(jobId);
    });
}

function summarizeUpdateJobBatch(jobs = []) {
    const items = (Array.isArray(jobs) ? jobs : []).filter(Boolean);
    if (items.length === 0) return null;

    const latestJob = items
        .slice()
        .sort((left, right) => (right.updatedAt || right.createdAt || 0) - (left.updatedAt || left.createdAt || 0))[0];
    const progressTotal = items.reduce((sum, item) => sum + (Number(item.progressPercent) || 0), 0);
    const statusCounts = {
        pending: 0,
        claimed: 0,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0,
    };
    for (const item of items) {
        if (Object.prototype.hasOwnProperty.call(statusCounts, item.status)) {
            statusCounts[item.status] += 1;
        }
    }
    const activeCount = statusCounts.pending + statusCounts.claimed + statusCounts.running;
    const failedCount = statusCounts.failed;
    const summaryStatus = activeCount > 0
        ? (statusCounts.running > 0 ? 'running' : (statusCounts.claimed > 0 ? 'claimed' : 'pending'))
        : (failedCount > 0 ? 'failed' : (statusCounts.cancelled === items.length ? 'cancelled' : 'succeeded'));

    return {
        batchKey: normalizeBatchKey(latestJob.batchKey),
        scope: latestJob.scope,
        strategy: latestJob.strategy,
        targetVersion: latestJob.targetVersion,
        sourceVersion: latestJob.sourceVersion,
        total: items.length,
        pendingCount: statusCounts.pending,
        claimedCount: statusCounts.claimed,
        runningCount: statusCounts.running,
        succeededCount: statusCounts.succeeded,
        failedCount: statusCounts.failed,
        cancelledCount: statusCounts.cancelled,
        activeCount,
        progressPercent: Math.max(0, Math.min(100, Math.round(progressTotal / items.length))),
        status: summaryStatus,
        targetAgentIds: Array.from(new Set(items.map(item => normalizeAgentId(item.targetAgentId)).filter(Boolean))),
        claimAgentIds: Array.from(new Set(items.map(item => normalizeAgentId(item.claimAgentId)).filter(Boolean))),
        drainNodeIds: Array.from(new Set(items.flatMap(item => normalizeNodeIdList(item.drainNodeIds)))),
        jobs: items,
        latestJobId: latestJob.id || 0,
        latestJobKey: latestJob.jobKey || '',
        latestSummaryMessage: latestJob.summaryMessage || '',
        latestErrorMessage: latestJob.errorMessage || '',
        createdAt: Math.min(...items.map(item => item.createdAt || Date.now())),
        updatedAt: Math.max(...items.map(item => item.updatedAt || item.createdAt || 0)),
    };
}

module.exports = {
    UPDATE_JOB_STATUS,
    mapJobRow,
    listUpdateJobs,
    getUpdateJobById,
    findActiveUpdateJob,
    createUpdateJob,
    updateUpdateJob,
    claimNextUpdateJob,
    normalizeJobStatus,
    normalizeScope,
    normalizeStrategy,
    normalizeKind,
    normalizeNodeIdList,
    normalizeBatchKey,
    normalizeAgentId,
    summarizeUpdateJobBatch,
};
