const {
    buildVersionState,
    formatVersionTag,
} = require('../../services/system-update-utils');
const {
    getSystemUpdateConfig,
    saveSystemUpdateConfig,
    getSystemUpdateReleaseCache,
    saveSystemUpdateReleaseCache,
    getSystemUpdateRuntime,
    saveSystemUpdateRuntime,
} = require('../../services/system-update-config');
const { loadLatestRelease } = require('../../services/system-update-manifest');
const { saveClusterNodeDrainState } = require('../../services/system-update-runtime');
const {
    listUpdateJobs,
    getUpdateJobById,
    findActiveUpdateJob,
    createUpdateJob,
    updateUpdateJob,
    summarizeUpdateJobBatch,
    normalizeNodeIdList,
} = require('../../services/system-update-jobs');
const { buildDrainCutoverReadiness } = require('../../services/account-migration');

function ensureAdmin(req, res) {
    if (req.currentUser?.role !== 'admin') {
        res.status(403).json({ ok: false, error: 'Forbidden' });
        return false;
    }
    return true;
}

function buildOverviewPayload({ currentVersion, config, releaseCache, runtime, activeJob, activeBatch, drainCutoverReadiness }) {
    const latestRelease = releaseCache && releaseCache.latestRelease ? releaseCache.latestRelease : null;
    const versionState = buildVersionState(currentVersion, latestRelease && latestRelease.versionTag);
    return {
        currentVersion: formatVersionTag(currentVersion, ''),
        latestRelease,
        hasUpdate: versionState.hasUpdate,
        comparison: versionState.comparison,
        config,
        releaseCache,
        runtime,
        activeJob,
        activeBatch: activeBatch || null,
        drainCutoverReadiness: drainCutoverReadiness || buildDrainCutoverReadiness(),
    };
}

function normalizeAgentIdList(value) {
    return normalizeNodeIdList(
        Array.isArray(value)
            ? value
            : String(value || '')
                .split(',')
                .map(item => item.trim())
                .filter(Boolean),
    );
}

function buildAgentRuntimeMap(runtime = {}) {
    return new Map(
        (Array.isArray(runtime.agentSummary) ? runtime.agentSummary : [])
            .map((item) => ({
                nodeId: String(item && item.nodeId || '').trim(),
                managedNodeIds: normalizeNodeIdList(item && item.managedNodeIds),
            }))
            .filter(item => item.nodeId)
            .map(item => [item.nodeId, item]),
    );
}

function normalizeAccountsSnapshot(data) {
    if (!data) return [];
    if (Array.isArray(data.accounts)) return data.accounts;
    return [];
}

function buildBatchKey() {
    return `upd_batch_${Date.now()}`;
}

async function loadActiveBatchSummary(activeJob, listUpdateJobsRef) {
    if (!activeJob || !activeJob.batchKey) {
        return null;
    }
    return loadBatchSummary(activeJob.batchKey, listUpdateJobsRef);
}

async function loadBatchSummary(batchKey, listUpdateJobsRef) {
    const normalizedBatchKey = String(batchKey || '').trim();
    if (!normalizedBatchKey) {
        return null;
    }
    const batchJobs = await listUpdateJobsRef({
        limit: 200,
        batchKey: normalizedBatchKey,
    });
    return summarizeUpdateJobBatch(batchJobs);
}

function buildRuntimeFromActiveJob(runtime, activeJob) {
    return {
        ...(runtime || {}),
        activeJobId: activeJob ? activeJob.id : 0,
        activeJobKey: activeJob ? activeJob.jobKey : '',
        activeJobStatus: activeJob ? activeJob.status : '',
        activeTargetVersion: activeJob ? activeJob.targetVersion : '',
    };
}

async function syncActiveRuntime({
    getSystemUpdateRuntimeRef,
    saveSystemUpdateRuntimeRef,
    findActiveUpdateJobRef,
    listUpdateJobsRef,
}) {
    const activeJob = await findActiveUpdateJobRef();
    const [runtime, activeBatch] = await Promise.all([
        saveSystemUpdateRuntimeRef(
            buildRuntimeFromActiveJob(await getSystemUpdateRuntimeRef(), activeJob),
        ),
        loadActiveBatchSummary(activeJob, listUpdateJobsRef),
    ]);
    return { activeJob, activeBatch, runtime };
}

function buildCancelledJobPatch(job, options = {}) {
    const cancelledAt = Date.now();
    const cancelledBy = String(options.cancelledBy || job.createdBy || 'admin').trim() || 'admin';
    const cancelReason = String(options.cancelReason || '').trim();
    const summaryMessage = String(options.summaryMessage || 'Cancelled from admin panel').trim() || 'Cancelled from admin panel';
    const nextResult = {
        ...(job.result && typeof job.result === 'object' ? job.result : {}),
        cancelledAt,
        cancelledBy,
        cancelReason,
        source: 'admin_cancel',
    };
    return {
        status: 'cancelled',
        summaryMessage,
        errorMessage: cancelReason,
        progressPercent: 0,
        finishedAt: cancelledAt,
        result: nextResult,
    };
}

function buildRetryJobInput(job, options = {}) {
    return {
        kind: job.kind,
        scope: job.scope,
        strategy: job.strategy,
        status: 'pending',
        sourceVersion: job.sourceVersion,
        targetVersion: job.targetVersion,
        batchKey: options.batchKey !== undefined ? options.batchKey : '',
        preserveCurrent: !!job.preserveCurrent,
        requireDrain: !!job.requireDrain,
        drainNodeIds: normalizeNodeIdList(job.drainNodeIds),
        note: options.note !== undefined ? options.note : job.note,
        createdBy: options.createdBy || job.createdBy || 'admin',
        targetAgentId: options.targetAgentId !== undefined ? options.targetAgentId : job.targetAgentId,
        summaryMessage: options.summaryMessage || 'Retry queued from admin panel',
        payload: {
            ...(job.payload && typeof job.payload === 'object' ? job.payload : {}),
            retryOfJobId: job.id,
            retryRequestedAt: Date.now(),
            retryRequestedBy: options.createdBy || job.createdBy || 'admin',
            source: 'admin_retry',
        },
    };
}

function registerSystemUpdateAdminRoutes({
    app,
    authRequired,
    userRequired,
    adminLogger,
    version,
    getSystemUpdateConfigRef = getSystemUpdateConfig,
    saveSystemUpdateConfigRef = saveSystemUpdateConfig,
    getSystemUpdateReleaseCacheRef = getSystemUpdateReleaseCache,
    saveSystemUpdateReleaseCacheRef = saveSystemUpdateReleaseCache,
    getSystemUpdateRuntimeRef = getSystemUpdateRuntime,
    saveSystemUpdateRuntimeRef = saveSystemUpdateRuntime,
    saveClusterNodeDrainStateRef = saveClusterNodeDrainState,
    loadLatestReleaseRef = loadLatestRelease,
    listUpdateJobsRef = listUpdateJobs,
    getUpdateJobByIdRef = getUpdateJobById,
    findActiveUpdateJobRef = findActiveUpdateJob,
    createUpdateJobRef = createUpdateJob,
    updateUpdateJobRef = updateUpdateJob,
    getDispatcherRef = () => null,
    getAccountsSnapshotRef = async () => ({ accounts: [] }),
}) {
    app.get('/api/admin/system-update/overview', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const [config, releaseCache, runtime, activeJob, accountsSnapshot] = await Promise.all([
                getSystemUpdateConfigRef(),
                getSystemUpdateReleaseCacheRef(),
                getSystemUpdateRuntimeRef(),
                findActiveUpdateJobRef(),
                getAccountsSnapshotRef(),
            ]);
            const activeBatch = await loadActiveBatchSummary(activeJob, listUpdateJobsRef);
            const drainCutoverReadiness = buildDrainCutoverReadiness({
                accounts: normalizeAccountsSnapshot(accountsSnapshot),
                clusterNodes: runtime && runtime.clusterNodes,
                targetNodeIds: Array.isArray(runtime && runtime.clusterNodes)
                    ? runtime.clusterNodes.map(item => item && item.nodeId)
                    : [],
            });
            res.json({
                ok: true,
                data: buildOverviewPayload({
                    currentVersion: version,
                    config,
                    releaseCache,
                    runtime,
                    activeJob,
                    activeBatch,
                    drainCutoverReadiness,
                }),
            });
        } catch (error) {
            adminLogger.error('get system update overview failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/check', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const [config, accountsSnapshot] = await Promise.all([
                getSystemUpdateConfigRef(),
                getAccountsSnapshotRef(),
            ]);
            const releaseCache = await loadLatestReleaseRef({ config });
            const savedCache = await saveSystemUpdateReleaseCacheRef(releaseCache);
            const activeJob = await findActiveUpdateJobRef();
            const activeBatch = await loadActiveBatchSummary(activeJob, listUpdateJobsRef);
            const runtime = await saveSystemUpdateRuntimeRef({
                ...(await getSystemUpdateRuntimeRef()),
                lastCheckAt: Date.now(),
                lastCheckOk: !savedCache.lastError,
                lastError: String(savedCache.lastError || '').trim(),
                activeJobId: activeJob ? activeJob.id : 0,
                activeJobKey: activeJob ? activeJob.jobKey : '',
                activeJobStatus: activeJob ? activeJob.status : '',
                activeTargetVersion: activeJob ? activeJob.targetVersion : '',
            });
            const drainCutoverReadiness = buildDrainCutoverReadiness({
                accounts: normalizeAccountsSnapshot(accountsSnapshot),
                clusterNodes: runtime && runtime.clusterNodes,
                targetNodeIds: Array.isArray(runtime && runtime.clusterNodes)
                    ? runtime.clusterNodes.map(item => item && item.nodeId)
                    : [],
            });
            res.json({
                ok: true,
                data: buildOverviewPayload({
                    currentVersion: version,
                    config,
                    releaseCache: savedCache,
                    runtime,
                    activeJob,
                    activeBatch,
                    drainCutoverReadiness,
                }),
            });
        } catch (error) {
            const runtime = await saveSystemUpdateRuntimeRef({
                ...(await getSystemUpdateRuntimeRef()),
                lastCheckAt: Date.now(),
                lastCheckOk: false,
                lastError: error.message,
            });
            adminLogger.error('check system update failed:', error.message);
            res.status(500).json({
                ok: false,
                error: error.message,
                data: { runtime },
            });
        }
    });

    app.post('/api/admin/system-update/config', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const saved = await saveSystemUpdateConfigRef((req.body && typeof req.body === 'object') ? req.body : {});
            res.json({ ok: true, data: saved });
        } catch (error) {
            adminLogger.error('save system update config failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.get('/api/admin/system-update/jobs', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const statusText = String(req.query.status || '').trim();
            const statuses = statusText
                ? statusText.split(',').map(item => item.trim()).filter(Boolean)
                : [];
            const jobs = await listUpdateJobsRef({
                limit: req.query.limit,
                statuses,
                batchKey: req.query.batchKey,
            });
            res.json({ ok: true, data: jobs });
        } catch (error) {
            adminLogger.error('list system update jobs failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.get('/api/admin/system-update/jobs/:jobId', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const job = await getUpdateJobByIdRef(req.params.jobId);
            if (!job) {
                return res.status(404).json({ ok: false, error: 'Update job not found' });
            }
            res.json({ ok: true, data: job });
        } catch (error) {
            adminLogger.error('get system update job failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/nodes/:nodeId/drain', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const nodeId = String(req.params.nodeId || '').trim();
            if (!nodeId) {
                return res.status(400).json({ ok: false, error: '缺少节点标识。' });
            }

            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const draining = body.draining !== false;
            const dispatcher = typeof getDispatcherRef === 'function' ? getDispatcherRef() : null;

            await saveClusterNodeDrainStateRef(nodeId, draining, {
                updatedBy: req.currentUser?.username || 'admin',
            });
            if (dispatcher && typeof dispatcher.rebalance === 'function') {
                await dispatcher.rebalance();
            }

            const runtime = await getSystemUpdateRuntimeRef();
            const node = (runtime.clusterNodes || []).find(item => String(item.nodeId || '').trim() === nodeId) || null;
            res.json({
                ok: true,
                data: {
                    node,
                    runtime,
                    dispatcherApplied: !!(dispatcher && typeof dispatcher.rebalance === 'function'),
                },
            });
        } catch (error) {
            adminLogger.error('set system update node drain failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/jobs', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const [config, releaseCache, runtimeBeforeCreate, activeJob, accountsSnapshot] = await Promise.all([
                getSystemUpdateConfigRef(),
                getSystemUpdateReleaseCacheRef(),
                getSystemUpdateRuntimeRef(),
                findActiveUpdateJobRef(),
                getAccountsSnapshotRef(),
            ]);
            if (activeJob && body.force !== true) {
                return res.status(409).json({
                    ok: false,
                    error: '已有待执行或执行中的更新任务，请先完成当前任务，或显式强制创建。',
                    data: { activeJob },
                });
            }

            const targetVersion = formatVersionTag(
                body.targetVersion
                || (releaseCache.latestRelease && releaseCache.latestRelease.versionTag)
                || '',
                '',
            );
            if (!targetVersion) {
                return res.status(400).json({ ok: false, error: '缺少目标版本，请先执行一次更新检查或手动填写版本号。' });
            }

            const scope = String(body.scope || config.preferredScope || 'app').trim();
            const strategy = String(body.strategy || config.preferredStrategy || 'rolling').trim();
            const requireDrain = strategy === 'drain_and_cutover'
                ? true
                : (body.requireDrain !== undefined ? !!body.requireDrain : !!config.requireDrain);
            const preserveCurrent = body.preserveCurrent !== undefined
                ? !!body.preserveCurrent
                : strategy === 'parallel_new_dir';
            const explicitDrainNodeIds = Array.isArray(body.drainNodeIds)
                ? body.drainNodeIds
                : (config.defaultDrainNodeIds || []);
            const requestedTargetAgentIds = normalizeAgentIdList(body.targetAgentIds);
            const agentRuntimeMap = buildAgentRuntimeMap(runtimeBeforeCreate);
            const availableAgentIds = Array.from(agentRuntimeMap.keys());
            let targetAgentIds = requestedTargetAgentIds.slice();

            if (scope === 'cluster' && targetAgentIds.length === 0) {
                targetAgentIds = availableAgentIds;
            } else if (scope === 'worker' && targetAgentIds.length === 0 && availableAgentIds.length === 1) {
                targetAgentIds = availableAgentIds.slice(0, 1);
            }

            if (scope === 'cluster' && targetAgentIds.length === 0) {
                return res.status(400).json({ ok: false, error: '当前没有可用的宿主机更新代理，无法创建集群更新任务。' });
            }
            if (scope === 'worker' && targetAgentIds.length === 0 && availableAgentIds.length > 1) {
                return res.status(400).json({ ok: false, error: '检测到多个宿主机更新代理，请先选择目标代理。' });
            }

            const fanoutTargetAgentIds = scope === 'app'
                ? [targetAgentIds[0] || '']
                : (targetAgentIds.length > 0 ? targetAgentIds : ['']);
            const batchKey = fanoutTargetAgentIds.length > 1 ? `upd_batch_${Date.now()}` : '';
            const requestedAt = Date.now();
            const allAccounts = normalizeAccountsSnapshot(accountsSnapshot);
            const drainCutoverViolations = [];
            const workerRestartViolations = [];
            const pendingJobInputs = [];

            for (const targetAgentId of fanoutTargetAgentIds) {
                const managedNodeIds = targetAgentId
                    ? normalizeNodeIdList(agentRuntimeMap.get(targetAgentId)?.managedNodeIds || [])
                    : [];
                const drainNodeIds = normalizeNodeIdList(
                    explicitDrainNodeIds.length > 0
                        ? explicitDrainNodeIds
                        : (requireDrain ? managedNodeIds : []),
                );
                const drainCutoverReadiness = buildDrainCutoverReadiness({
                    accounts: allAccounts,
                    clusterNodes: runtimeBeforeCreate && runtimeBeforeCreate.clusterNodes,
                    targetNodeIds: drainNodeIds,
                });
                const requiresWorkerRestart = managedNodeIds.length > 0;
                if (strategy === 'drain_and_cutover' && drainCutoverReadiness.blockerCount > 0 && body.force !== true) {
                    drainCutoverViolations.push({
                        targetAgentId,
                        drainNodeIds,
                        readiness: drainCutoverReadiness,
                    });
                    continue;
                }
                if (requiresWorkerRestart && drainCutoverReadiness.blockerCount > 0 && body.force !== true) {
                    workerRestartViolations.push({
                        targetAgentId,
                        managedNodeIds,
                        drainNodeIds,
                        readiness: drainCutoverReadiness,
                    });
                    continue;
                }
                pendingJobInputs.push({
                    kind: scope === 'cluster' ? 'cluster_update' : (scope === 'worker' ? 'worker_update' : 'app_update'),
                    scope,
                    strategy,
                    status: 'pending',
                    sourceVersion: formatVersionTag(version, ''),
                    targetVersion,
                    batchKey,
                    preserveCurrent,
                    requireDrain,
                    drainNodeIds,
                    note: body.note,
                    createdBy: req.currentUser?.username || 'admin',
                    targetAgentId,
                    summaryMessage: targetAgentId ? `Waiting for target agent ${targetAgentId}` : 'Waiting for update agent',
                    payload: {
                        requestedAt,
                        requestedBy: req.currentUser?.username || 'admin',
                        source: 'admin_panel',
                        configSnapshot: config,
                        batchKey,
                        batchSize: fanoutTargetAgentIds.length,
                        options: {
                            scope,
                            strategy,
                            preserveCurrent,
                            requireDrain,
                            drainNodeIds,
                            force: body.force === true,
                            targetAgentId,
                            targetAgentIds: fanoutTargetAgentIds,
                            managedNodeIds,
                        },
                    },
                });
            }

            if (drainCutoverViolations.length > 0 && body.force !== true) {
                return res.status(409).json({
                    ok: false,
                    error: '目标节点上存在运行中的账号，当前版本不支持无感排空切换；请先手动停机/重新登录，或改用不切换运行账号的更新策略。',
                    data: {
                        drainCutoverReadiness: drainCutoverViolations[0].readiness,
                        drainCutoverViolations,
                    },
                });
            }
            if (workerRestartViolations.length > 0 && body.force !== true) {
                return res.status(409).json({
                    ok: false,
                    error: '目标 worker 上存在运行中的登录码账号。更新该节点会重启账号，当前通常需要重新登录或重新扫码；请先停机/重新登录，或显式强制创建更新任务。',
                    data: {
                        drainCutoverReadiness: workerRestartViolations[0].readiness,
                        workerRestartViolations,
                    },
                });
            }

            const createdJobs = [];
            for (const input of pendingJobInputs) {
                const job = await createUpdateJobRef(input);
                createdJobs.push(job);
            }

            const primaryJob = createdJobs[0] || null;

            const runtime = await saveSystemUpdateRuntimeRef(
                buildRuntimeFromActiveJob(await getSystemUpdateRuntimeRef(), primaryJob),
            );
            const batch = batchKey ? summarizeUpdateJobBatch(createdJobs) : null;

            res.json({
                ok: true,
                data: {
                    job: primaryJob,
                    jobs: createdJobs,
                    batch,
                    createdCount: createdJobs.length,
                    batchKey,
                    runtime,
                },
            });
        } catch (error) {
            adminLogger.error('create system update job failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/jobs/:jobId/retry', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const [job, activeJob] = await Promise.all([
                getUpdateJobByIdRef(req.params.jobId),
                findActiveUpdateJobRef(),
            ]);
            if (!job) {
                return res.status(404).json({ ok: false, error: 'Update job not found' });
            }
            if (!['failed', 'cancelled'].includes(String(job.status || ''))) {
                return res.status(400).json({ ok: false, error: '仅支持重试 failed 或 cancelled 的任务。' });
            }
            if (activeJob && body.force !== true) {
                return res.status(409).json({
                    ok: false,
                    error: '当前已有待执行或执行中的更新任务，请先完成当前任务，或显式强制重试。',
                    data: { activeJob },
                });
            }

            const retryJob = await createUpdateJobRef(buildRetryJobInput(job, {
                createdBy: req.currentUser?.username || 'admin',
                note: body.note !== undefined ? body.note : job.note,
            }));
            const runtime = await saveSystemUpdateRuntimeRef(
                buildRuntimeFromActiveJob(await getSystemUpdateRuntimeRef(), retryJob),
            );

            res.json({
                ok: true,
                data: {
                    job: retryJob,
                    activeJob: retryJob,
                    runtime,
                },
            });
        } catch (error) {
            adminLogger.error('retry system update job failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/batches/:batchKey/retry-failed', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const batchKey = String(req.params.batchKey || '').trim();
            if (!batchKey) {
                return res.status(400).json({ ok: false, error: '缺少批次号。' });
            }

            const [batchJobs, activeJob] = await Promise.all([
                listUpdateJobsRef({ limit: 200, batchKey }),
                findActiveUpdateJobRef(),
            ]);
            if (batchJobs.length === 0) {
                return res.status(404).json({ ok: false, error: '未找到对应批次任务。' });
            }
            if (activeJob && body.force !== true) {
                return res.status(409).json({
                    ok: false,
                    error: '当前已有待执行或执行中的更新任务，请先完成当前任务，或显式强制重试。',
                    data: { activeJob },
                });
            }

            const retrySourceJobs = batchJobs.filter(job => ['failed', 'cancelled'].includes(String(job.status || '')));
            if (retrySourceJobs.length === 0) {
                return res.status(400).json({ ok: false, error: '当前批次没有可重试的 failed/cancelled 子任务。' });
            }

            const retryBatchKey = retrySourceJobs.length > 1 ? buildBatchKey() : '';
            const retryJobs = [];
            for (const sourceJob of retrySourceJobs) {
                const retryJob = await createUpdateJobRef(buildRetryJobInput(sourceJob, {
                    createdBy: req.currentUser?.username || 'admin',
                    note: body.note !== undefined ? body.note : sourceJob.note,
                    batchKey: retryBatchKey,
                }));
                retryJobs.push(retryJob);
            }

            const primaryJob = retryJobs[0] || null;
            const runtime = await saveSystemUpdateRuntimeRef(
                buildRuntimeFromActiveJob(await getSystemUpdateRuntimeRef(), primaryJob),
            );

            res.json({
                ok: true,
                data: {
                    job: primaryJob,
                    jobs: retryJobs,
                    batch: retryBatchKey ? summarizeUpdateJobBatch(retryJobs) : null,
                    activeJob: primaryJob,
                    activeBatch: retryBatchKey ? summarizeUpdateJobBatch(retryJobs) : null,
                    batchKey: retryBatchKey,
                    createdCount: retryJobs.length,
                    runtime,
                },
            });
        } catch (error) {
            adminLogger.error('retry system update batch failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/jobs/:jobId/cancel', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const job = await getUpdateJobByIdRef(req.params.jobId);
            if (!job) {
                return res.status(404).json({ ok: false, error: 'Update job not found' });
            }
            if (!['pending', 'claimed'].includes(String(job.status || ''))) {
                return res.status(400).json({ ok: false, error: '仅支持取消 pending 或 claimed 的任务。' });
            }

            const cancelledJob = await updateUpdateJobRef(job.id, buildCancelledJobPatch(job, {
                cancelledBy: req.currentUser?.username || 'admin',
                cancelReason: body.reason !== undefined ? body.reason : body.note,
                summaryMessage: body.summaryMessage,
            }));
            const [{ activeJob, activeBatch, runtime }, batch] = await Promise.all([
                syncActiveRuntime({
                    getSystemUpdateRuntimeRef,
                    saveSystemUpdateRuntimeRef,
                    findActiveUpdateJobRef,
                    listUpdateJobsRef,
                }),
                loadBatchSummary(job.batchKey, listUpdateJobsRef),
            ]);

            res.json({
                ok: true,
                data: {
                    job: cancelledJob,
                    batch,
                    activeJob,
                    activeBatch,
                    runtime,
                },
            });
        } catch (error) {
            adminLogger.error('cancel system update job failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    app.post('/api/admin/system-update/batches/:batchKey/cancel-pending', authRequired, userRequired, async (req, res) => {
        if (!ensureAdmin(req, res)) return;
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const batchKey = String(req.params.batchKey || '').trim();
            if (!batchKey) {
                return res.status(400).json({ ok: false, error: '缺少批次号。' });
            }

            const batchJobs = await listUpdateJobsRef({ limit: 200, batchKey });
            if (batchJobs.length === 0) {
                return res.status(404).json({ ok: false, error: '未找到对应批次任务。' });
            }

            const cancellableJobs = batchJobs.filter(job => ['pending', 'claimed'].includes(String(job.status || '')));
            if (cancellableJobs.length === 0) {
                return res.status(400).json({ ok: false, error: '当前批次没有可取消的 pending/claimed 子任务。' });
            }

            const cancelledJobs = [];
            for (const job of cancellableJobs) {
                const cancelledJob = await updateUpdateJobRef(job.id, buildCancelledJobPatch(job, {
                    cancelledBy: req.currentUser?.username || 'admin',
                    cancelReason: body.reason !== undefined ? body.reason : body.note,
                    summaryMessage: body.summaryMessage || `Batch ${batchKey} cancelled from admin panel`,
                }));
                cancelledJobs.push(cancelledJob);
            }

            const [{ activeJob, activeBatch, runtime }, batch] = await Promise.all([
                syncActiveRuntime({
                    getSystemUpdateRuntimeRef,
                    saveSystemUpdateRuntimeRef,
                    findActiveUpdateJobRef,
                    listUpdateJobsRef,
                }),
                loadBatchSummary(batchKey, listUpdateJobsRef),
            ]);

            res.json({
                ok: true,
                data: {
                    jobs: cancelledJobs,
                    batch,
                    activeJob,
                    activeBatch,
                    cancelledCount: cancelledJobs.length,
                    runtime,
                },
            });
        } catch (error) {
            adminLogger.error('cancel system update batch failed:', error.message);
            res.status(500).json({ ok: false, error: error.message });
        }
    });
}

module.exports = {
    registerSystemUpdateAdminRoutes,
};
