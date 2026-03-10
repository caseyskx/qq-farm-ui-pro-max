const io = require('socket.io-client');
const { createModuleLogger } = require('../services/logger');
const { createRuntimeEngine } = require('../runtime/runtime-engine');
const { initJobs } = require('../jobs/index');
const { registerRuntimeShutdownHandlers } = require('../runtime/graceful-shutdown');
const process = require('node:process');
const workerLogger = createModuleLogger('worker-client');

class WorkerClient {
    constructor(masterUrl, workerToken, deps = {}) {
        this.processRef = deps.processRef || process;
        this.ioFactory = deps.ioFactory || io;
        this.createRuntimeEngineRef = deps.createRuntimeEngineRef || createRuntimeEngine;
        this.initJobsRef = deps.initJobsRef || initJobs;
        this.registerRuntimeShutdownHandlersRef = deps.registerRuntimeShutdownHandlersRef || registerRuntimeShutdownHandlers;
        this.logger = deps.logger || workerLogger;
        this.masterUrl = masterUrl || this.processRef.env.MASTER_URL || 'http://localhost:3000';
        this.workerToken = workerToken || this.processRef.env.WORKER_TOKEN || 'default_cluster_token';
        this.socket = null;
        this.runtimeEngine = null;
        this.jobRuntime = null;
        this.shutdownRegistration = null;
        this.assignedAccounts = new Set();
        this.assignedAccountData = new Map(); // 用于差分比对 (Diff Loading)
    }

    async init() {
        this.logger.info(`[Worker] 正在初始化工作节点...`);
        // 初始化必要的执行队列 (不包括写库操作，纯业务运行库)
        this.jobRuntime = this.initJobsRef();

        this.runtimeEngine = this.createRuntimeEngineRef({
            processRef: this.processRef,
            mainEntryPath: __filename,
            startAdminServer: () => { /* Worker不启动Admin */ },
            onStatusSync: (accountId, status) => {
                if (this.socket && this.socket.connected) {
                    this.socket.emit('worker:status:sync', { accountId, status });
                }
            },
            onLog: (entry) => {
                if (this.socket && this.socket.connected) {
                    this.socket.emit('worker:log:new', entry);
                }
            },
            onAccountLog: (entry) => {
                if (this.socket && this.socket.connected) {
                    this.socket.emit('worker:account-log:new', entry);
                }
            }
        });
        this.shutdownRegistration = this.registerRuntimeShutdownHandlersRef({
            processRef: this.processRef,
            runtimeEngine: {
                stop: async () => {
                    await this.stop();
                },
            },
            logger: this.logger,
        });

        // 启动本地引擎（但不自动加载本地DB账号）
        await this.runtimeEngine.start({
            startAdminServer: false,
            autoStartAccounts: false, // 全部由 Master 下放
        });

        this.connectToMaster();
    }

    async stop() {
        const shutdownRegistration = this.shutdownRegistration;
        this.shutdownRegistration = null;
        if (shutdownRegistration && typeof shutdownRegistration.dispose === 'function') {
            shutdownRegistration.dispose();
        }

        const socket = this.socket;
        this.socket = null;
        if (socket) {
            try {
                if (typeof socket.removeAllListeners === 'function') {
                    socket.removeAllListeners();
                }
                if (typeof socket.disconnect === 'function') {
                    socket.disconnect();
                }
                if (typeof socket.close === 'function') {
                    socket.close();
                }
            } catch {
                // ignore socket close errors during worker shutdown
            }
        }

        const jobRuntime = this.jobRuntime;
        this.jobRuntime = null;
        if (jobRuntime && typeof jobRuntime.stop === 'function') {
            jobRuntime.stop();
        }

        const runtimeEngine = this.runtimeEngine;
        this.runtimeEngine = null;
        if (runtimeEngine && typeof runtimeEngine.stop === 'function') {
            await runtimeEngine.stop({
                stopAdminServer: false,
            });
        }

        this.assignedAccounts = new Set();
        this.assignedAccountData = new Map();
    }

    connectToMaster() {
        this.logger.info(`[Worker] 尝试连接到 Master: ${this.masterUrl}`);
        this.socket = this.ioFactory(this.masterUrl, {
            path: '/socket.io',
            transports: ['websocket'],
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            auth: {
                token: this.workerToken,
                nodeId: `worker-${this.processRef.pid}-${Date.now().toString().slice(-4)}`
            }
        });

        this.socket.on('connect', () => {
            this.logger.info(`[Worker] 已成功连接到 Master，准备接收任务...`);
            this.socket.emit('worker:ready');
        });

        this.socket.on('disconnect', () => {
            this.logger.warn(`[Worker] 与 Master 的连接已断开，进入离线保护模式`);
        });

        this.socket.on('connect_error', (err) => {
            this.logger.error(`[Worker] 连接 Master 失败: ${err.message}`);
        });

        // 接收 Master 委派的账户任务集 (差分重载 Diff Loading)
        this.socket.on('master:assign:accounts', async (payload) => {
            const { accounts } = payload || {};
            if (!Array.isArray(accounts)) return;

            this.logger.info(`[Worker] 收到 Master 分配: ${accounts.length} 个账号`);

            const newSet = new Set();
            const newMap = new Map();
            const accountMap = new Map();

            // 构建新分配的指纹字典
            for (const acc of accounts) {
                const id = String(acc.id);
                newSet.add(id);
                newMap.set(id, JSON.stringify(acc)); // 以字串作为指纹比对凭据变化
                accountMap.set(id, acc);
            }

            let changesDetected = false;

            // Step 1: 对比找出被移除或已变更的旧账号 (执行 Stop)
            for (const [oldId, oldDataStr] of this.assignedAccountData.entries()) {
                if (!newMap.has(oldId)) {
                    this.logger.info(`[Worker 差分] 移除掉线账号，执行停止: ${oldId}`);
                    try { this.runtimeEngine.stopWorker(oldId); } catch { }
                    changesDetected = true;
                } else if (newMap.get(oldId) !== oldDataStr) {
                    this.logger.info(`[Worker 差分] 账号配置发生改变，执行重启: ${oldId}`);
                    try { await this.runtimeEngine.restartWorker(accountMap.get(oldId)); } catch { }
                    changesDetected = true;
                }
            }

            // Step 2: 启动全新下发，或配置刚刚发生变更重载的账号
            for (const [newId, newDataStr] of newMap.entries()) {
                if (!this.assignedAccountData.has(newId) || this.assignedAccountData.get(newId) !== newDataStr) {
                    if (this.assignedAccountData.has(newId)) {
                        continue;
                    }
                    this.logger.info(`[Worker 差分] 挂载并启动账号: ${newId}`);
                    try {
                        await this.runtimeEngine.startWorker(accountMap.get(newId));
                    } catch (e) {
                        this.logger.error(`[Worker 差分] 启动账号失败: ${newId}`, { error: e.message });
                    }
                    changesDetected = true;
                }
            }

            if (!changesDetected) {
                this.logger.debug(`[Worker 差分] 侦测到状态完全吻合，未影响任何正在运行的排队调度。`);
            }

            // 更新引用
            this.assignedAccounts = newSet;
            this.assignedAccountData = newMap;
        });
    }
}

module.exports = { WorkerClient };
