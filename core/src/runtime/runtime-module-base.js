const { createScheduler } = require('../services/scheduler');

class RuntimeModuleBase {
    constructor(name, context = {}) {
        const normalizedName = String(name || '').trim();
        if (!normalizedName) {
            throw new Error('runtime module 缺少有效名称');
        }

        this.name = normalizedName;
        this.context = context;
        this.started = false;
        this._cleanupFns = [];
        this._scheduler = null;
    }

    get scheduler() {
        if (!this._scheduler) {
            this._scheduler = createScheduler(`runtime:${this.name}`);
        }
        return this._scheduler;
    }

    registerCleanup(fn) {
        if (typeof fn === 'function') {
            this._cleanupFns.push(fn);
        }
    }

    onRuntime(eventName, handler) {
        const runtimeBus = this.context && this.context.runtimeBus;
        if (!runtimeBus || typeof runtimeBus.on !== 'function' || typeof runtimeBus.off !== 'function') {
            throw new Error(`runtime module ${this.name} 缺少 runtimeBus`);
        }
        return this.onEmitter(runtimeBus, eventName, handler);
    }

    onEmitter(emitter, eventName, handler) {
        if (!emitter || typeof emitter.on !== 'function' || typeof emitter.off !== 'function') {
            throw new Error(`runtime module ${this.name} 收到无效 emitter`);
        }
        if (typeof handler !== 'function') {
            throw new Error(`runtime module ${this.name} 的监听器必须是函数`);
        }

        const boundHandler = (...args) => handler.apply(this, args);
        emitter.on(eventName, boundHandler);
        this.registerCleanup(() => emitter.off(eventName, boundHandler));
        return boundHandler;
    }

    start(payload = {}) {
        if (this.started) return;
        this.started = true;
        if (typeof this.onStart === 'function') {
            this.onStart(payload);
        }
    }

    stop(payload = {}) {
        if (!this.started) {
            this._cleanupResources();
            return;
        }

        try {
            if (typeof this.onStop === 'function') {
                this.onStop(payload);
            }
        } finally {
            this.started = false;
            this._cleanupResources();
        }
    }

    applyConfig(payload = {}) {
        if (!this.started) return;
        if (typeof this.onConfigApplied === 'function') {
            this.onConfigApplied(payload);
        }
    }

    _cleanupResources() {
        const cleanupFns = this._cleanupFns.splice(0).reverse();
        for (const cleanup of cleanupFns) {
            try {
                cleanup();
            } catch {
                // ignore cleanup failures during runtime module teardown
            }
        }

        if (this._scheduler) {
            try {
                this._scheduler.clearAll();
            } catch {
                // ignore scheduler cleanup failures during teardown
            }
        }
    }
}

module.exports = {
    RuntimeModuleBase,
};
