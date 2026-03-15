const { RuntimeModuleBase } = require('../runtime-module-base');
const { CONFIG } = require('../../config/config');

class SessionControlRuntimeModule extends RuntimeModuleBase {
    constructor(context = {}) {
        super('session-control', context);
        this.wsErrorHandledAt = 0;
    }

    onStart() {
        this.onRuntime('network:ws_error', this.handleWsError);
        this.onRuntime('network:kickout', this.handleKickout);
        this.onRuntime('network:ban', this.handleBan);
    }

    onStop() {
        this.wsErrorHandledAt = 0;
    }

    handleWsError(payload) {
        const code = Number(payload && payload.code) || 0;
        if (code !== 400) return;

        const now = Date.now();
        if (now - this.wsErrorHandledAt < 4000) return;
        this.wsErrorHandledAt = now;

        const log = this.context && this.context.log;
        const sendToMaster = this.context && this.context.sendToMaster;
        const isRunning = this.context && this.context.isRunning;
        const softDisconnectCurrentSession = this.context && this.context.softDisconnectCurrentSession;
        if (typeof log === 'function') {
            log('系统', '连接被拒绝，可能需要更新 Code');
        }
        if (typeof sendToMaster === 'function') {
            sendToMaster({
                type: 'ws_error',
                code: 400,
                message: payload && payload.message ? payload.message : '',
            });
        }
        if (typeof isRunning === 'function' && isRunning()) {
            this.scheduler.setTimeoutTask('ws_error_cleanup', 1000, () => {
                if (typeof isRunning === 'function' && isRunning() && typeof softDisconnectCurrentSession === 'function') {
                    softDisconnectCurrentSession();
                }
            });
        }
    }

    handleKickout(payload) {
        const log = this.context && this.context.log;
        const sendToMaster = this.context && this.context.sendToMaster;
        const requestStop = this.context && this.context.requestStop;
        const reason = payload && payload.reason ? payload.reason : '未知';
        const versionLow = /版本.*过低|升级到最新版本/.test(String(reason));
        if (typeof log === 'function') {
            log('系统', `检测到踢下线，准备自动停止账号。原因: ${reason}`);
            if (versionLow) {
                log(
                    '系统',
                    `当前 clientVersion=${CONFIG.clientVersion}，可通过环境变量 FARM_CLIENT_VERSION 覆盖版本后重试`,
                );
            }
        }
        if (typeof sendToMaster === 'function') {
            sendToMaster({ type: 'account_kicked', reason });
        }
        this.scheduler.setTimeoutTask('kickout_stop', 200, () => {
            if (typeof requestStop === 'function') {
                void Promise.resolve(requestStop({ source: 'kickout', reason })).catch(() => null);
            }
        });
    }

    handleBan(payload) {
        const sendToMaster = this.context && this.context.sendToMaster;
        const reason = payload && payload.reason ? payload.reason : '1002003';
        if (typeof sendToMaster === 'function') {
            sendToMaster({ type: 'account_banned', reason });
        }
    }
}

function createSessionControlRuntimeModule(context = {}) {
    return new SessionControlRuntimeModule(context);
}

module.exports = {
    SessionControlRuntimeModule,
    createSessionControlRuntimeModule,
};
