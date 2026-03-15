const { log, logWarn } = require('../utils/utils');
const { sendPushooMessage } = require('./push');
const store = require('../models/store');

const NETWORK_THRESHOLD = Number.parseInt(process.env.FARM_NETWORK_BREAKER_THRESHOLD || '5', 10) || 5;
const NETWORK_WINDOW_MS = Math.max(10 * 1000, Number.parseInt(process.env.FARM_NETWORK_BREAKER_WINDOW_MS || `${10 * 60 * 1000}`, 10) || 10 * 60 * 1000);
const NETWORK_COOL_DOWN_MS = Math.max(10 * 1000, Number.parseInt(process.env.FARM_NETWORK_BREAKER_COOLDOWN_MS || `${30 * 60 * 1000}`, 10) || 30 * 60 * 1000);

const CACHE_THRESHOLD = Number.parseInt(process.env.FARM_CACHE_BREAKER_THRESHOLD || '5', 10) || 5;
const CACHE_WINDOW_MS = Math.max(10 * 1000, Number.parseInt(process.env.FARM_CACHE_BREAKER_WINDOW_MS || `${5 * 60 * 1000}`, 10) || 5 * 60 * 1000);
const CACHE_COOL_DOWN_MS = Math.max(10 * 1000, Number.parseInt(process.env.FARM_CACHE_BREAKER_COOLDOWN_MS || `${5 * 60 * 1000}`, 10) || 5 * 60 * 1000);

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = String(name || 'default');
        this.threshold = Math.max(1, Number.parseInt(options.threshold, 10) || 1);
        this.windowMs = Math.max(1000, Number.parseInt(options.windowMs, 10) || 1000);
        this.coolDownMs = Math.max(1000, Number.parseInt(options.coolDownMs, 10) || 1000);
        this.onTrip = typeof options.onTrip === 'function' ? options.onTrip : null;
        this.onHalfOpen = typeof options.onHalfOpen === 'function' ? options.onHalfOpen : null;
        this.onClose = typeof options.onClose === 'function' ? options.onClose : null;
        this.failures = [];
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.lastOpenTime = 0;
    }

    recordFailure(reason) {
        if (this.state === 'OPEN') return;

        const now = Date.now();
        this.failures.push(now);

        // 清理窗口外的数据
        this.failures = this.failures.filter(t => now - t < this.windowMs);

        if (this.failures.length >= this.threshold) {
            this.trip(reason);
        }
    }

    recordSuccess() {
        if (this.state === 'HALF_OPEN') {
            if (this.onClose) {
                this.onClose();
            } else {
                log('安全', `[${this.name}] 试探性请求成功，断路器恢复闭合状态 (CLOSED)`, { module: 'circuit-breaker' });
            }
            this.state = 'CLOSED';
            this.failures = [];
        } else if (this.state === 'CLOSED') {
            // 平时请求成功，偶尔清理一下过期失败
            const now = Date.now();
            this.failures = this.failures.filter(t => now - t < this.windowMs);
        }
    }

    trip(reason) {
        this.state = 'OPEN';
        this.lastOpenTime = Date.now();
        if (this.onTrip) {
            this.onTrip({
                reason,
                failures: this.failures.length,
                breakerName: this.name,
            });
        }
    }

    allowRequest() {
        if (this.state === 'CLOSED') {
            return true;
        }

        if (this.state === 'OPEN') {
            const now = Date.now();
            if (now - this.lastOpenTime >= this.coolDownMs) {
                this.state = 'HALF_OPEN';
                if (this.onHalfOpen) {
                    this.onHalfOpen();
                } else {
                    log('安全', `[${this.name}] 断路器冷却期结束，进入半开状态 (HALF_OPEN)，允许零星发送试探性请求`, { module: 'circuit-breaker' });
                }
                return true;
            }
            return false;
        }

        if (this.state === 'HALF_OPEN') {
            return true;
        }

        return true;
    }

    isAvailable() {
        return this.allowRequest();
    }

    getSnapshot() {
        const now = Date.now();
        const remaining = this.state === 'OPEN'
            ? Math.max(0, this.coolDownMs - Math.max(0, now - this.lastOpenTime))
            : 0;
        return {
            name: this.name,
            state: this.state,
            failures: this.failures.length,
            threshold: this.threshold,
            windowMs: this.windowMs,
            coolDownMs: this.coolDownMs,
            lastOpenTime: this.lastOpenTime,
            cooldownRemainingMs: remaining,
        };
    }
}

const networkCircuitBreaker = new CircuitBreaker('network', {
    threshold: NETWORK_THRESHOLD,
    windowMs: NETWORK_WINDOW_MS,
    coolDownMs: NETWORK_COOL_DOWN_MS,
    onTrip: ({ reason, failures }) => {
        logWarn(
            '安全',
            `【风控告警】网络断路器触发 (原因: ${reason || 'unknown'})，${Math.ceil(NETWORK_WINDOW_MS / 60000)} 分钟内异常 ${failures} 次。网络请求进入保护性冻结。`,
            { module: 'circuit-breaker' },
        );
        void notifyNetworkCircuitBreakerTrip({
            reason,
            failures,
        });
    },
    onHalfOpen: () => {
        log('安全', '网络断路器冷却结束，进入 HALF_OPEN 试探状态', { module: 'circuit-breaker' });
    },
    onClose: () => {
        log('安全', '网络断路器恢复 CLOSED 状态', { module: 'circuit-breaker' });
    },
});

const cacheCircuitBreaker = new CircuitBreaker('cache', {
    threshold: CACHE_THRESHOLD,
    windowMs: CACHE_WINDOW_MS,
    coolDownMs: CACHE_COOL_DOWN_MS,
    onTrip: ({ reason, failures }) => {
        logWarn(
            '系统',
            `缓存断路器触发 (原因: ${reason || 'unknown'})，${Math.ceil(CACHE_WINDOW_MS / 60000)} 分钟内异常 ${failures} 次，短时跳过 Redis 缓存请求。`,
            { module: 'circuit-breaker' },
        );
    },
    onHalfOpen: () => {
        log('系统', '缓存断路器进入 HALF_OPEN 试探状态', { module: 'circuit-breaker' });
    },
    onClose: () => {
        log('系统', '缓存断路器恢复 CLOSED 状态', { module: 'circuit-breaker' });
    },
});

// 兼容旧导出：默认 circuitBreaker 指向网络断路器
const circuitBreaker = networkCircuitBreaker;

async function notifyNetworkCircuitBreakerTrip({ reason, failures }) {
    try {
        const cfg = store.getOfflineReminder ? store.getOfflineReminder() : null;
        if (!cfg) return;

        const channel = String(cfg.channel || '').trim().toLowerCase();
        const endpoint = String(cfg.endpoint || '').trim();
        const token = String(cfg.token || '').trim();

        if (!channel) return;
        if (channel === 'webhook' && !endpoint) return;

        const result = await sendPushooMessage({
            channel,
            endpoint,
            token,
            title: '⚠️ 账户风控保护性熔断',
            content: `触发断路器，原因：近${Math.ceil(NETWORK_WINDOW_MS / 60000)}分钟内出现 ${failures} 次风控阻断(${reason || 'unknown'})。当前账号已自动丢弃所有排队请求，进入约 ${Math.ceil(NETWORK_COOL_DOWN_MS / 60000)} 分钟保护期。`,
        });

        if (!result?.ok) {
            logWarn('安全', `断路器告警推送失败: ${result?.msg || 'unknown'}`, { module: 'circuit-breaker' });
        }
    } catch (error) {
        logWarn('安全', `断路器告警推送异常: ${error.message}`, { module: 'circuit-breaker' });
    }
}

module.exports = {
    circuitBreaker,
    networkCircuitBreaker,
    cacheCircuitBreaker,
    NETWORK_COOL_DOWN_MS,
};
