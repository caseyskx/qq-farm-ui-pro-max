const { checkAndClaimEmails } = require('../../services/email');
const { buyFreeGifts } = require('../../services/mall');
const { performDailyMonthCardGift } = require('../../services/monthcard');
const { performDailyOpenServerGift } = require('../../services/openserver');
const { performDailyVipGift } = require('../../services/qqvip');
const { performDailyShare } = require('../../services/share');
const { initTaskSystem, resetTaskRuntimeState } = require('../../services/task');
const { RuntimeModuleBase } = require('../runtime-module-base');

const EMAIL_CALL_TIMEOUT_MS = 8000;
const DAILY_ROUTINE_AUTOMATION_KEYS = Object.freeze([
    'email',
    'free_gifts',
    'share_reward',
    'vip_gift',
    'month_card',
    'open_server_gift',
]);

function withTimeout(promise, timeoutMs, timeoutMessage) {
    let timer = null;
    return Promise.race([
        Promise.resolve(promise).finally(() => {
            if (timer) clearTimeout(timer);
        }),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(timeoutMessage || 'operation timeout'));
            }, Math.max(1000, Number(timeoutMs) || 1000));
        }),
    ]);
}

function hasEnabledDailyRoutine(auto) {
    const normalized = (auto && typeof auto === 'object') ? auto : {};
    return DAILY_ROUTINE_AUTOMATION_KEYS.some(key => !!normalized[key]);
}

function hasNewDailyRoutineEnabled(prevAuto, nextAuto) {
    const prev = (prevAuto && typeof prevAuto === 'object') ? prevAuto : {};
    const next = (nextAuto && typeof nextAuto === 'object') ? nextAuto : {};
    return DAILY_ROUTINE_AUTOMATION_KEYS.some(key => !prev[key] && !!next[key]);
}

function getDelayUntilNextDailyRoutineMs() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 1, 0);
    return Math.max(1000, next.getTime() - now.getTime());
}

class TaskRuntimeModule extends RuntimeModuleBase {
    constructor(context = {}) {
        super('task', context);
    }

    onStart() {
        initTaskSystem();
        this.startDailyRoutineTimer();
    }

    onStop() {
        resetTaskRuntimeState();
    }

    onConfigApplied(payload = {}) {
        const getAutomation = this.context && this.context.getAutomation;
        const isLoginReady = this.context && this.context.isLoginReady;
        if (typeof getAutomation !== 'function' || typeof isLoginReady !== 'function' || !isLoginReady()) {
            return;
        }

        const snapshot = payload && payload.snapshot ? payload.snapshot : {};
        const prevAutomation = payload && payload.prevAutomation ? payload.prevAutomation : {};
        const hasAutomationPayload = !!(snapshot && snapshot.automation && typeof snapshot.automation === 'object');
        if (!hasAutomationPayload) return;

        const nextAutomation = getAutomation();
        const wasEnabled = hasEnabledDailyRoutine(prevAutomation);
        const nowEnabled = hasEnabledDailyRoutine(nextAutomation);

        if (!wasEnabled && nowEnabled) {
            this.startDailyRoutineTimer({ runImmediately: false });
        } else if (wasEnabled && !nowEnabled) {
            this.stopDailyRoutineTimer();
        }

        if (hasNewDailyRoutineEnabled(prevAutomation, nextAutomation)) {
            this.scheduler.setTimeoutTask('daily_routine_immediate', 400, () => {
                void this.runDailyRoutines(true);
            });
        }
    }

    async runEmailClaimSafely(force = false, scene = 'daily_routine') {
        const log = this.context && this.context.log;
        try {
            return await withTimeout(
                checkAndClaimEmails(force),
                EMAIL_CALL_TIMEOUT_MS,
                `邮箱领取超时(${EMAIL_CALL_TIMEOUT_MS}ms)`,
            );
        } catch (error) {
            if (typeof log === 'function') {
                log('邮箱', `${scene} 邮箱领取已跳过: ${error.message}`, {
                    module: 'task',
                    event: 'email_rewards',
                    result: 'timeout',
                    scene,
                });
            }
            return { claimed: 0, rewardItems: 0, skipped: true };
        }
    }

    async runDailyRoutines(force = false) {
        const isLoginReady = this.context && this.context.isLoginReady;
        const getAutomation = this.context && this.context.getAutomation;
        const log = this.context && this.context.log;
        if (typeof isLoginReady !== 'function' || typeof getAutomation !== 'function' || !isLoginReady()) {
            return;
        }

        const automation = getAutomation();
        try {
            if (automation.email) await this.runEmailClaimSafely(force, 'daily_routine');
            if (automation.share_reward) await performDailyShare(force);
            if (automation.month_card) await performDailyMonthCardGift(force);
            if (automation.open_server_gift) await performDailyOpenServerGift(force);
            if (automation.free_gifts) await buyFreeGifts(force);
            if (automation.vip_gift) await performDailyVipGift(force);
        } catch (error) {
            if (typeof log === 'function') {
                log('系统', `每日任务调度失败: ${error.message}`, {
                    module: 'system',
                    event: 'daily_routine',
                    result: 'error',
                });
            }
        }
    }

    stopDailyRoutineTimer() {
        this.scheduler.clear('daily_routine_interval');
        this.scheduler.clear('daily_routine_immediate');
    }

    scheduleNextDailyRoutineRun() {
        const isLoginReady = this.context && this.context.isLoginReady;
        const getAutomation = this.context && this.context.getAutomation;
        if (typeof isLoginReady !== 'function' || typeof getAutomation !== 'function') {
            return;
        }

        this.stopDailyRoutineTimer();
        if (!isLoginReady() || !hasEnabledDailyRoutine(getAutomation())) {
            return;
        }

        this.scheduler.setTimeoutTask('daily_routine_interval', getDelayUntilNextDailyRoutineMs(), () => {
            void this.runDailyRoutines(true).finally(() => {
                this.scheduleNextDailyRoutineRun();
            });
        });
    }

    startDailyRoutineTimer(options = {}) {
        const isLoginReady = this.context && this.context.isLoginReady;
        const getAutomation = this.context && this.context.getAutomation;
        if (typeof isLoginReady !== 'function' || typeof getAutomation !== 'function') {
            return;
        }

        this.scheduleNextDailyRoutineRun();
        if (options.runImmediately === false) return;
        if (isLoginReady() && hasEnabledDailyRoutine(getAutomation())) {
            void this.runDailyRoutines(true);
        }
    }
}

function createTaskRuntimeModule(context = {}) {
    return new TaskRuntimeModule(context);
}

module.exports = {
    TaskRuntimeModule,
    createTaskRuntimeModule,
    DAILY_ROUTINE_AUTOMATION_KEYS,
    hasEnabledDailyRoutine,
    hasNewDailyRoutineEnabled,
};
