/**
 * 令牌桶 + 优先级队列限流器
 *
 * 注意：本模块当前未被 network.js 等调用方接入，为预留实现。
 * 实际限流由 network.js 内置的 enqueueSend / enqueueSendUrgent 承担。
 *
 * 三层架构:
 *   TokenBucket     — 全局请求速率控制
 *   PriorityQueue   — 紧急请求(防偷抢收)可插队
 *   RequestQueue    — FIFO + 超时
 *   BatchOptimizer  — 合并同类操作
 */

const { createModuleLogger } = require('./logger');
const limiterLogger = createModuleLogger('rate-limiter');

// ============ 令牌桶 ============

class TokenBucket {
    /**
     * @param {object} opts
     * @param {number} opts.capacity    - 桶容量(最大令牌数)
     * @param {number} opts.refillRate  - 每秒补充令牌数
     * @param {number} opts.initialTokens - 初始令牌(默认 = capacity)
     */
    constructor({ capacity = 10, refillRate = 3, initialTokens } = {}) {
        this.capacity = Math.max(1, capacity);
        this.refillRate = Math.max(0.1, refillRate);
        this.tokens = initialTokens !== undefined ? initialTokens : this.capacity;
        this.lastRefillTime = Date.now();
    }

    _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefillTime) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
        this.lastRefillTime = now;
    }

    tryConsume(count = 1) {
        this._refill();
        if (this.tokens >= count) {
            this.tokens -= count;
            return true;
        }
        return false;
    }

    /**
     * 等待直到有足够令牌
     * @param {number} count - 需要消耗的令牌数
     * @returns {Promise<void>}
     */
    async waitForToken(count = 1) {
        while (!this.tryConsume(count)) {
            const deficit = count - this.tokens;
            const waitMs = Math.ceil((deficit / this.refillRate) * 1000) + 10;
            await new Promise(r => setTimeout(r, Math.min(waitMs, 5000)));
        }
    }

    getStatus() {
        this._refill();
        return {
            tokens: Math.floor(this.tokens * 100) / 100,
            capacity: this.capacity,
            refillRate: this.refillRate,
        };
    }
}

// ============ 优先级队列 ============

const PRIORITY = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
    LOW: 3,
};

class PriorityQueue {
    constructor() {
        this._queues = new Map();
        for (const level of Object.values(PRIORITY)) {
            this._queues.set(level, []);
        }
        this._size = 0;
    }

    enqueue(item, priority = PRIORITY.NORMAL) {
        const level = this._queues.has(priority) ? priority : PRIORITY.NORMAL;
        this._queues.get(level).push(item);
        this._size++;
    }

    dequeue() {
        for (const level of [PRIORITY.URGENT, PRIORITY.HIGH, PRIORITY.NORMAL, PRIORITY.LOW]) {
            const queue = this._queues.get(level);
            if (queue && queue.length > 0) {
                this._size--;
                return queue.shift();
            }
        }
        return null;
    }

    get size() {
        return this._size;
    }

    isEmpty() {
        return this._size === 0;
    }

    clear() {
        for (const queue of this._queues.values()) {
            queue.length = 0;
        }
        this._size = 0;
    }
}

// ============ 请求队列 (FIFO + 超时) ============

class RequestQueue {
    /**
     * @param {object} opts
     * @param {number} opts.maxQueueSize - 队列最大长度
     * @param {number} opts.timeoutMs    - 单个请求超时(ms)
     */
    constructor({ maxQueueSize = 200, timeoutMs = 30000 } = {}) {
        this.maxQueueSize = maxQueueSize;
        this.timeoutMs = timeoutMs;
        this._queue = new PriorityQueue();
        this._processing = false;
        this._totalProcessed = 0;
        this._totalDropped = 0;
    }

    /**
     * 提交请求到队列
     * @param {Function} fn       - 异步执行函数
     * @param {number} priority   - 优先级
     * @returns {Promise<*>}      - 执行结果
     */
    submit(fn, priority = PRIORITY.NORMAL) {
        if (this._queue.size >= this.maxQueueSize) {
            this._totalDropped++;
            return Promise.reject(new Error('请求队列已满，请稍后再试'));
        }

        return new Promise((resolve, reject) => {
            const task = {
                fn,
                resolve,
                reject,
                enqueuedAt: Date.now(),
            };
            this._queue.enqueue(task, priority);
            this._drain();
        });
    }

    async _drain() {
        if (this._processing) return;
        this._processing = true;

        while (!this._queue.isEmpty()) {
            const task = this._queue.dequeue();
            if (!task) break;

            const waitedMs = Date.now() - task.enqueuedAt;
            if (waitedMs > this.timeoutMs) {
                task.reject(new Error(`请求排队超时 (${waitedMs}ms)`));
                this._totalDropped++;
                continue;
            }

            try {
                const result = await Promise.race([
                    task.fn(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('请求执行超时')), this.timeoutMs)),
                ]);
                task.resolve(result);
                this._totalProcessed++;
            } catch (e) {
                task.reject(e);
            }
        }

        this._processing = false;
    }

    getStats() {
        return {
            queueSize: this._queue.size,
            maxQueueSize: this.maxQueueSize,
            totalProcessed: this._totalProcessed,
            totalDropped: this._totalDropped,
        };
    }
}

// ============ 批量操作优化器 ============

class BatchOperationOptimizer {
    /**
     * @param {object} opts
     * @param {number} opts.batchWindowMs - 批量窗口(ms)，在此窗口内的同类操作会被合并
     * @param {number} opts.maxBatchSize  - 单批最大操作数
     */
    constructor({ batchWindowMs = 200, maxBatchSize = 20 } = {}) {
        this.batchWindowMs = batchWindowMs;
        this.maxBatchSize = maxBatchSize;
        this._pending = new Map();
        this._timers = new Map();
    }

    /**
     * 提交一个可以被批量合并的操作
     * @param {string} operationType - 操作类型标识
     * @param {*} item               - 操作项
     * @param {Function} batchExecutor - 批量执行函数 (items[]) => Promise
     * @returns {Promise<*>}
     */
    submit(operationType, item, batchExecutor) {
        return new Promise((resolve, reject) => {
            if (!this._pending.has(operationType)) {
                this._pending.set(operationType, []);
            }

            const batch = this._pending.get(operationType);
            batch.push({ item, resolve, reject, executor: batchExecutor });

            if (batch.length >= this.maxBatchSize) {
                this._flush(operationType);
                return;
            }

            if (!this._timers.has(operationType)) {
                const timer = setTimeout(() => {
                    this._timers.delete(operationType);
                    this._flush(operationType);
                }, this.batchWindowMs);
                this._timers.set(operationType, timer);
            }
        });
    }

    async _flush(operationType) {
        const timer = this._timers.get(operationType);
        if (timer) {
            clearTimeout(timer);
            this._timers.delete(operationType);
        }

        const batch = this._pending.get(operationType) || [];
        this._pending.delete(operationType);
        if (batch.length === 0) return;

        const executor = batch[0].executor;
        const items = batch.map(b => b.item);

        try {
            const result = await executor(items);
            for (const entry of batch) {
                entry.resolve(result);
            }
        } catch (e) {
            for (const entry of batch) {
                entry.reject(e);
            }
        }
    }

    destroy() {
        for (const timer of this._timers.values()) {
            clearTimeout(timer);
        }
        this._timers.clear();
        this._pending.clear();
    }
}

// ============ 统一门面类 ============

class RateLimiter {
    /**
     * @param {object} opts
     * @param {object} opts.bucket       - TokenBucket 配置
     * @param {object} opts.queue        - RequestQueue 配置
     * @param {object} opts.batch        - BatchOperationOptimizer 配置
     */
    constructor(opts = {}) {
        this.bucket = new TokenBucket(opts.bucket || {});
        this.requestQueue = new RequestQueue(opts.queue || {});
        this.batchOptimizer = new BatchOperationOptimizer(opts.batch || {});
        this._enabled = true;
    }

    /**
     * 提交一个限流请求
     * @param {Function} fn       - 异步函数
     * @param {object} options
     * @param {number} options.priority - 优先级
     * @returns {Promise<*>}
     */
    async execute(fn, { priority = PRIORITY.NORMAL } = {}) {
        if (!this._enabled) return fn();

        return this.requestQueue.submit(async () => {
            await this.bucket.waitForToken();
            return fn();
        }, priority);
    }

    /**
     * 紧急请求（真正跳过排队，直接消耗令牌执行）
     * 用于蹲守偷菜、防偷抢收等对延迟敏感的操作
     * @param {Function} fn - 异步函数
     * @param {object} options
     * @param {number} options.timeoutMs - 等待令牌超时(ms)，默认 30000，0 表示不超时
     */
    async executeUrgent(fn, { timeoutMs = 30000 } = {}) {
        if (!this._enabled) return fn();
        if (timeoutMs > 0) {
            await Promise.race([
                this.bucket.waitForToken(),
                new Promise((_, rej) =>
                    setTimeout(() => rej(new Error('紧急请求等待令牌超时')), timeoutMs)
                ),
            ]);
        } else {
            await this.bucket.waitForToken();
        }
        return fn();
    }

    /**
     * 提交批量合并操作
     */
    async executeBatch(operationType, item, batchExecutor) {
        if (!this._enabled) return batchExecutor([item]);
        return this.batchOptimizer.submit(operationType, item, async (items) => {
            await this.bucket.waitForToken();
            return batchExecutor(items);
        });
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
    }

    getStatus() {
        return {
            enabled: this._enabled,
            bucket: this.bucket.getStatus(),
            queue: this.requestQueue.getStats(),
        };
    }

    destroy() {
        this.batchOptimizer.destroy();
        this.requestQueue._queue.clear();
    }
}

// 默认全局实例
let _defaultInstance = null;

function getDefaultLimiter() {
    if (!_defaultInstance) {
        _defaultInstance = new RateLimiter({
            bucket: { capacity: 10, refillRate: 3 },
            queue: { maxQueueSize: 200, timeoutMs: 30000 },
            batch: { batchWindowMs: 200, maxBatchSize: 20 },
        });
        limiterLogger.info('全局限流器已初始化', _defaultInstance.getStatus());
    }
    return _defaultInstance;
}

module.exports = {
    TokenBucket,
    PriorityQueue,
    RequestQueue,
    BatchOperationOptimizer,
    RateLimiter,
    PRIORITY,
    getDefaultLimiter,
};
