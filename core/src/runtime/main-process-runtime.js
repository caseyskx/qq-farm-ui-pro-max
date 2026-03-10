function createAiServiceRuntime({
    logger,
    loadAutostartModule,
    deferStartRef = setImmediate,
    startOptions = {},
    stopOptions = { waitForExit: true, timeoutMs: 12000 },
}) {
    let autostartModule = null;
    let startPromise = null;
    let startedByCurrentProcess = false;

    function start() {
        if (startPromise) {
            return startPromise;
        }

        startPromise = new Promise((resolve) => {
            deferStartRef(async () => {
                try {
                    autostartModule = typeof loadAutostartModule === 'function'
                        ? loadAutostartModule()
                        : null;
                    if (!autostartModule || typeof autostartModule.start !== 'function') {
                        throw new Error('AI 自动启动模块不可用');
                    }

                    if (logger && typeof logger.info === 'function') {
                        logger.info('[AI 服务] 正在自动启动 AI 编程助手服务...');
                    }

                    const beforeStatus = typeof autostartModule.getPidFileStatus === 'function'
                        ? autostartModule.getPidFileStatus(startOptions)
                        : { running: !!(autostartModule.isRunning && autostartModule.isRunning(startOptions)) };

                    await autostartModule.start(startOptions);

                    const afterStatus = typeof autostartModule.getPidFileStatus === 'function'
                        ? autostartModule.getPidFileStatus(startOptions)
                        : { running: !!(autostartModule.isRunning && autostartModule.isRunning(startOptions)) };

                    startedByCurrentProcess = !beforeStatus.running && !!afterStatus.running;

                    if (logger && typeof logger.info === 'function') {
                        logger.info('[AI 服务] AI 服务启动指令已发送（后台运行）', {
                            managedByCurrentProcess: startedByCurrentProcess,
                        });
                    }
                    resolve({ startedByCurrentProcess });
                } catch (error) {
                    if (logger && typeof logger.warn === 'function') {
                        logger.warn('[AI 服务] 自动启动失败，但不影响主程序运行', {
                            error: error && error.message ? error.message : String(error),
                        });
                    }
                    resolve({ startedByCurrentProcess: false, error });
                }
            });
        });

        return startPromise;
    }

    async function stop() {
        if (!startPromise) {
            return false;
        }

        await startPromise;
        if (!startedByCurrentProcess || !autostartModule || typeof autostartModule.stop !== 'function') {
            return false;
        }

        return !!(await autostartModule.stop(startOptions, stopOptions));
    }

    return {
        start,
        stop,
        isOwned() {
            return startedByCurrentProcess;
        },
    };
}

async function runShutdownStep(label, step, logger, errors) {
    if (typeof step !== 'function') {
        return;
    }

    try {
        await Promise.resolve(step());
    } catch (error) {
        errors.push({ label, error });
        if (logger && typeof logger.warn === 'function') {
            logger.warn(`${label} failed during shutdown`, {
                error: error && error.message ? error.message : String(error),
            });
        }
    }
}

function createMainShutdownRuntime({
    logger,
    stopJobs,
    disposeMasterDispatcher,
    stopRuntimeEngine,
    closeDatabase,
    stopAiServices,
}) {
    return {
        async stop() {
            const errors = [];

            await runShutdownStep('jobs.stop', stopJobs, logger, errors);
            await runShutdownStep('master dispatcher dispose', disposeMasterDispatcher, logger, errors);
            await runShutdownStep('runtime engine stop', stopRuntimeEngine, logger, errors);
            await runShutdownStep('database close', closeDatabase, logger, errors);
            await runShutdownStep('ai services stop', stopAiServices, logger, errors);

            if (errors.length > 0) {
                throw errors[0].error;
            }
        },
    };
}

module.exports = {
    createAiServiceRuntime,
    createMainShutdownRuntime,
};
