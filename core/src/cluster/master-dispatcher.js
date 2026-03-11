const { version } = require('../../package.json');
const { createModuleLogger } = require('../services/logger');
const defaultStore = require('../models/store');
const {
    getSystemUpdateRuntime,
} = require('../services/system-update-config');
const {
    buildClusterNodeDrainMap,
    saveClusterNodeRuntimeSnapshot,
} = require('../services/system-update-runtime');

const masterLogger = createModuleLogger('master-dispatcher');

function removeEventListener(target, event, handler) {
    if (!target || typeof handler !== 'function') {
        return;
    }
    if (typeof target.off === 'function') {
        target.off(event, handler);
        return;
    }
    if (typeof target.removeListener === 'function') {
        target.removeListener(event, handler);
    }
}

function syncAccountRuntimeSnapshot(accountId, status, extra = {}) {
    const id = String(accountId || '').trim();
    if (!id || typeof defaultStore.addOrUpdateAccount !== 'function') return;

    const panelStatus = (status && typeof status === 'object') ? status : {};
    const liveStatus = (panelStatus.status && typeof panelStatus.status === 'object') ? panelStatus.status : {};
    const connected = !!(panelStatus.connection && panelStatus.connection.connected);
    const now = Date.now();

    try {
        defaultStore.addOrUpdateAccount({
            id,
            running: extra.running !== undefined ? !!extra.running : true,
            connected,
            wsError: extra.wsError !== undefined ? extra.wsError : (panelStatus.wsError || null),
            nick: liveStatus.name || '',
            level: Number(liveStatus.level) || 0,
            gold: Number(liveStatus.gold) || 0,
            exp: Number(liveStatus.exp) || 0,
            coupon: Number(liveStatus.coupon) || 0,
            uptime: Number(panelStatus.uptime) || 0,
            lastStatusAt: now,
            ...(connected ? { lastOnlineAt: now } : {}),
        });
    } catch (error) {
        masterLogger.warn(`[Master] 写回账号运行时快照失败: ${id} -> ${error.message}`);
    }
}

class MasterDispatcher {
    constructor(io, deps = {}) {
        this.io = io;
        this.store = deps.store || defaultStore;
        this.logger = deps.logger || masterLogger;
        this.runtimeVersion = String(deps.version || version || '').trim();
        this.getSystemUpdateRuntimeRef = deps.getSystemUpdateRuntimeRef || getSystemUpdateRuntime;
        this.saveClusterNodeRuntimeSnapshotRef = deps.saveClusterNodeRuntimeSnapshotRef || saveClusterNodeRuntimeSnapshot;
        this.workers = new Map(); // socketId -> { nodeId, socket, assigned: [], draining, version, lastSeenAt }
        this.accountToWorker = new Map(); // accountId -> socketId (Sticky Sessions)
        this.gcHandle = null;
        this.connectionHandler = null;
        this.socketBindings = new Map();
        this.clusterRuntimeSyncPromise = null;
    }

    init() {
        if (!this.io) {
            this.logger.error('MasterDispatcher required initialized Socket.IO instance');
            return;
        }

        this.logger.info('✅ MasterDispatcher(分布式控制面) 初始化成功, 等待 Worker 接入...');

        this.gcHandle = setInterval(() => {
            if (this.accountToWorker) {
                let removed = 0;
                for (const [accId, socketId] of this.accountToWorker.entries()) {
                    if (!this.workers.has(socketId)) {
                        this.accountToWorker.delete(accId);
                        removed++;
                    }
                }
                if (removed > 0) {
                    this.logger.warn(`[Master GC] 成功清理了 ${removed} 个遗留的幽灵 Session 绑定, 当前路由表大小: ${this.accountToWorker.size}`);
                }
            }
        }, 15 * 60 * 1000);
        if (this.gcHandle && typeof this.gcHandle.unref === 'function') {
            this.gcHandle.unref();
        }

        this.connectionHandler = (socket) => {
            const workerReadyHandler = async () => {
                const nodeId = String(socket.handshake.auth?.nodeId || `unknown-${socket.id}`).trim();
                this.logger.info(`[Master] 探测到新的 Worker 接入就绪: ${nodeId}`);

                this.workers.set(socket.id, {
                    nodeId,
                    socket,
                    assigned: [],
                    draining: false,
                    version: this.runtimeVersion,
                    lastSeenAt: Date.now(),
                });

                await this.rebalance();
            };

            const workerHeartbeatHandler = async (payload = {}) => {
                const workerBox = this.workers.get(socket.id);
                if (!workerBox) {
                    return;
                }

                const previousNodeId = workerBox.nodeId;
                const previousDraining = !!workerBox.draining;
                workerBox.lastSeenAt = Date.now();
                if (payload.version) {
                    workerBox.version = String(payload.version || '').trim();
                }
                if (payload.nodeId) {
                    workerBox.nodeId = String(payload.nodeId || '').trim() || workerBox.nodeId;
                }
                try {
                    const drainNodeIds = await this.getDrainNodeIdSet();
                    const candidateNodeIds = new Set([
                        String(previousNodeId || '').trim(),
                        String(workerBox.nodeId || '').trim(),
                    ].filter(Boolean));
                    const nextDraining = Array.from(candidateNodeIds).some(nodeId => drainNodeIds.has(nodeId));
                    if (nextDraining !== previousDraining) {
                        workerBox.draining = nextDraining;
                        this.logger.info(`[Master] Worker(${workerBox.nodeId}) 排空状态变化 -> ${nextDraining ? 'draining' : 'active'}, 立即触发重新分配`);
                        await this.rebalance();
                        return;
                    }
                } catch (error) {
                    this.logger.warn(`[Master] 处理 Worker 心跳排空状态失败: ${error.message}`);
                }
                this.queueClusterNodeRuntimeSync();
            };

            const disconnectHandler = async () => {
                if (this.workers.has(socket.id)) {
                    const workerBox = this.workers.get(socket.id);
                    this.logger.warn(`[Master] Worker 节点掉线: ${workerBox.nodeId}`);
                    for (const acc of (workerBox.assigned || [])) {
                        syncAccountRuntimeSnapshot(acc && acc.id, {
                            connection: { connected: false },
                            status: {
                                name: acc && (acc.nick || acc.name || ''),
                                level: acc && acc.level || 0,
                                gold: acc && acc.gold || 0,
                                exp: acc && acc.exp || 0,
                                coupon: acc && acc.coupon || 0,
                            },
                            uptime: acc && acc.uptime || 0,
                            wsError: { message: `Worker 节点 ${workerBox.nodeId} 已断开` },
                        }, { running: !!(acc && acc.running), wsError: { message: `Worker 节点 ${workerBox.nodeId} 已断开` } });
                    }
                    this.workers.delete(socket.id);
                    await this.rebalance();
                    await this.saveClusterNodeRuntimeSnapshotRef([{
                        nodeId: workerBox.nodeId,
                        role: 'worker',
                        status: 'offline',
                        version: workerBox.version || this.runtimeVersion,
                        connected: false,
                        draining: !!workerBox.draining,
                        assignedCount: 0,
                        assignedAccountIds: [],
                        updatedAt: Date.now(),
                    }]).catch((error) => {
                        this.logger.warn(`[Master] 写入离线节点状态失败: ${error.message}`);
                    });
                }
                this.socketBindings.delete(socket.id);
                this.queueClusterNodeRuntimeSync();
            };

            const workerStatusSyncHandler = (payload) => {
                const { accountId, status } = payload || {};
                if (accountId) {
                    syncAccountRuntimeSnapshot(accountId, status);
                    this.io.to(`account:${accountId}`).emit('status:update', { accountId, status });
                    this.io.to('account:all').emit('status:update', { accountId, status });
                }
            };

            const workerLogHandler = (payload) => {
                const id = String((payload && payload.accountId) || '').trim();
                if (id) this.io.to(`account:${id}`).emit('log:new', payload);
                this.io.to('account:all').emit('log:new', payload);
            };

            const workerAccountLogHandler = (payload) => {
                const id = String((payload && payload.accountId) || '').trim();
                if (id) this.io.to(`account:${id}`).emit('account-log:new', payload);
                this.io.to('account:all').emit('account-log:new', payload);
            };

            socket.on('worker:ready', workerReadyHandler);
            socket.on('worker:heartbeat', workerHeartbeatHandler);
            socket.on('disconnect', disconnectHandler);
            socket.on('worker:status:sync', workerStatusSyncHandler);
            socket.on('worker:log:new', workerLogHandler);
            socket.on('worker:account-log:new', workerAccountLogHandler);

            this.socketBindings.set(socket.id, {
                socket,
                handlers: {
                    'worker:ready': workerReadyHandler,
                    'worker:heartbeat': workerHeartbeatHandler,
                    disconnect: disconnectHandler,
                    'worker:status:sync': workerStatusSyncHandler,
                    'worker:log:new': workerLogHandler,
                    'worker:account-log:new': workerAccountLogHandler,
                },
            });
        };

        this.io.on('connection', this.connectionHandler);
    }

    dispose() {
        if (this.gcHandle) {
            clearInterval(this.gcHandle);
            this.gcHandle = null;
        }

        if (this.io && this.connectionHandler) {
            removeEventListener(this.io, 'connection', this.connectionHandler);
            this.connectionHandler = null;
        }

        for (const binding of this.socketBindings.values()) {
            const { socket, handlers } = binding;
            for (const [event, handler] of Object.entries(handlers)) {
                removeEventListener(socket, event, handler);
            }
        }

        this.socketBindings.clear();
        this.workers.clear();
        this.accountToWorker.clear();
    }

    async getDrainNodeIdSet() {
        try {
            const runtime = await this.getSystemUpdateRuntimeRef();
            return new Set(
                Array.from(buildClusterNodeDrainMap(runtime).entries())
                    .filter(([, draining]) => !!draining)
                    .map(([nodeId]) => nodeId),
            );
        } catch (error) {
            this.logger.warn(`[Master] 读取节点排空状态失败，已回退到非排空模式: ${error.message}`);
            return new Set();
        }
    }

    buildWorkerNodeSnapshot() {
        return Array.from(this.workers.values()).map(worker => ({
            nodeId: worker.nodeId,
            role: 'worker',
            status: worker.draining ? 'draining' : (worker.assigned.length > 0 ? 'active' : 'idle'),
            version: worker.version || this.runtimeVersion,
            connected: true,
            draining: !!worker.draining,
            assignedCount: Array.isArray(worker.assigned) ? worker.assigned.length : 0,
            assignedAccountIds: Array.isArray(worker.assigned) ? worker.assigned.map(item => String(item && item.id || '').trim()).filter(Boolean) : [],
            updatedAt: worker.lastSeenAt || Date.now(),
        }));
    }

    async syncClusterNodeRuntime() {
        await this.saveClusterNodeRuntimeSnapshotRef(this.buildWorkerNodeSnapshot());
    }

    queueClusterNodeRuntimeSync() {
        if (this.clusterRuntimeSyncPromise) {
            return this.clusterRuntimeSyncPromise;
        }
        this.clusterRuntimeSyncPromise = Promise.resolve()
            .then(() => this.syncClusterNodeRuntime())
            .catch((error) => {
                this.logger.warn(`[Master] 写入集群节点状态失败: ${error.message}`);
            })
            .finally(() => {
                this.clusterRuntimeSyncPromise = null;
            });
        return this.clusterRuntimeSyncPromise;
    }

    getWorkerNodes() {
        return this.buildWorkerNodeSnapshot();
    }

    async rebalance() {
        if (this.workers.size === 0) {
            this.logger.warn('[Master] 警告: 当前没有可用的 Worker 节点, 全局任务停滞。');
            await this.queueClusterNodeRuntimeSync();
            return;
        }

        const data = typeof this.store.getAccountsFresh === 'function'
            ? await this.store.getAccountsFresh()
            : await this.store.getAccounts();
        const activeAccounts = (data?.accounts || []).filter(a => a.running);

        const clusterConfig = this.store.getClusterConfig ? this.store.getClusterConfig() : { dispatcherStrategy: 'round_robin' };
        const isLeastLoad = clusterConfig.dispatcherStrategy === 'least_load';
        const drainNodeIds = await this.getDrainNodeIdSet();

        this.logger.info(`[Master] 开始 Rebalance (策略: ${clusterConfig.dispatcherStrategy})! 总执行账号: ${activeAccounts.length}, 可用 Worker 数: ${this.workers.size}`);

        const wList = Array.from(this.workers.values());
        wList.forEach((worker) => {
            worker.draining = drainNodeIds.has(worker.nodeId);
        });

        let assignmentWorkers = wList.filter(worker => !worker.draining);
        if (assignmentWorkers.length === 0) {
            assignmentWorkers = wList;
            if (drainNodeIds.size > 0) {
                this.logger.warn('[Master] 所有在线 Worker 都处于排空状态，暂时忽略排空限制以避免任务停滞。');
            }
        }

        if (!isLeastLoad) {
            wList.forEach(w => w.assigned = []);
            this.accountToWorker.clear();

            activeAccounts.forEach((acc, index) => {
                const targetWorker = assignmentWorkers[index % assignmentWorkers.length];
                if (!targetWorker) return;
                targetWorker.assigned.push(acc);
                const socketId = Array.from(this.workers.entries()).find(([, item]) => item === targetWorker)?.[0];
                if (socketId) {
                    this.accountToWorker.set(String(acc.id), socketId);
                }
            });
        } else {
            const activeIds = new Set(activeAccounts.map(a => String(a.id)));
            for (const [accId, socketId] of this.accountToWorker.entries()) {
                const workerBox = this.workers.get(socketId);
                if (!activeIds.has(accId) || !workerBox || workerBox.draining) {
                    this.accountToWorker.delete(accId);
                }
            }

            wList.forEach(w => w.assigned = []);

            for (const acc of activeAccounts) {
                const sId = String(acc.id);
                let targetSocketId = this.accountToWorker.get(sId);

                if (!targetSocketId) {
                    let leastWorkerSocketId = '';
                    let minCount = Infinity;

                    for (const [workerSocketId, workerBox] of this.workers.entries()) {
                        if (workerBox.draining) {
                            continue;
                        }
                        if (workerBox.assigned.length < minCount) {
                            leastWorkerSocketId = workerSocketId;
                            minCount = workerBox.assigned.length;
                        }
                    }

                    if (!leastWorkerSocketId) {
                        for (const [workerSocketId, workerBox] of this.workers.entries()) {
                            if (workerBox.assigned.length < minCount) {
                                leastWorkerSocketId = workerSocketId;
                                minCount = workerBox.assigned.length;
                            }
                        }
                    }

                    targetSocketId = leastWorkerSocketId;
                    if (targetSocketId) {
                        this.accountToWorker.set(sId, targetSocketId);
                    }
                }

                const wBox = this.workers.get(targetSocketId);
                if (wBox) {
                    wBox.assigned.push(acc);
                }
            }
        }

        for (const worker of wList) {
            this.logger.info(`[Master] 向 Worker(${worker.nodeId}) 下发分配集: ${worker.assigned.length} 个账号.`);
            worker.socket.emit('master:assign:accounts', {
                accounts: worker.assigned,
            });
        }

        await this.queueClusterNodeRuntimeSync();
    }
}

let _instance = null;
function initDispatcher(io, deps = {}) {
    if (!_instance) {
        _instance = new MasterDispatcher(io, deps);
        _instance.init();
    }
    return _instance;
}

function getDispatcher() {
    return _instance;
}

function disposeDispatcher() {
    if (_instance && typeof _instance.dispose === 'function') {
        _instance.dispose();
    }
    _instance = null;
}

module.exports = { MasterDispatcher, initDispatcher, getDispatcher, disposeDispatcher };
