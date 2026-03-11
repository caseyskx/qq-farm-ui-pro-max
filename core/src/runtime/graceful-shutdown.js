const { execFileSync } = require('node:child_process');

function getShutdownSignalContext(processRef) {
    const context = {};

    if (processRef && typeof processRef.pid === 'number') {
        context.pid = processRef.pid;
        context.platform = process.platform;
    }

    if (processRef && typeof processRef.ppid === 'number') {
        context.ppid = processRef.ppid;
    }

    try {
        if (processRef && typeof processRef.cwd === 'function') {
            context.cwd = processRef.cwd();
        }
    } catch {}

    try {
        if (processRef && typeof processRef.uptime === 'function') {
            context.uptimeSec = Math.floor(processRef.uptime());
        }
    } catch {}

    try {
        if (Array.isArray(processRef?.argv) && processRef.argv.length > 0) {
            context.argv = processRef.argv.slice(0, 4);
        }
    } catch {}

    if (process.platform === 'win32' || !context.pid || !context.ppid) {
        return context;
    }

    try {
        const output = execFileSync(
            'ps',
            ['-o', 'pid=,ppid=,command=', '-p', String(context.pid), '-p', String(context.ppid)],
            { encoding: 'utf8' },
        ).trim();
        if (output) {
            context.processTree = output
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean);
        }
    } catch {}

    return context;
}

function registerRuntimeShutdownHandlers({
    processRef,
    runtimeEngine,
    logger,
    signals = ['SIGINT', 'SIGTERM'],
    forceExitAfterMs = 10 * 1000,
    setTimeoutRef = setTimeout,
    clearTimeoutRef = clearTimeout,
    exitFn = (code) => processRef.exit(code),
}) {
    let shuttingDown = false;
    let forceExitTimer = null;

    const stopRuntime = (runtimeEngine && typeof runtimeEngine.stop === 'function')
        ? () => runtimeEngine.stop()
        : async () => {};

    const handleSignal = async (signal) => {
        const signalContext = getShutdownSignalContext(processRef);
        if (shuttingDown) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn('graceful shutdown already in progress', { signal, ...signalContext });
            }
            return;
        }

        shuttingDown = true;
        if (logger && typeof logger.info === 'function') {
            logger.info('received shutdown signal', { signal, ...signalContext });
        }

        if (forceExitAfterMs > 0) {
            forceExitTimer = setTimeoutRef(() => {
                if (logger && typeof logger.error === 'function') {
                    logger.error('graceful shutdown timed out; forcing exit', { signal, timeoutMs: forceExitAfterMs });
                }
                exitFn(1);
            }, forceExitAfterMs);
            if (forceExitTimer && typeof forceExitTimer.unref === 'function') {
                forceExitTimer.unref();
            }
        }

        try {
            await Promise.resolve(stopRuntime());
            if (forceExitTimer) {
                clearTimeoutRef(forceExitTimer);
                forceExitTimer = null;
            }
            if (logger && typeof logger.info === 'function') {
                logger.info('graceful shutdown completed', { signal });
            }
            exitFn(0);
        } catch (error) {
            if (forceExitTimer) {
                clearTimeoutRef(forceExitTimer);
                forceExitTimer = null;
            }
            if (logger && typeof logger.error === 'function') {
                logger.error('graceful shutdown failed', {
                    signal,
                    error: error && error.message ? error.message : String(error),
                });
            }
            exitFn(1);
        }
    };

    const listeners = signals.map((signal) => {
        const listener = () => {
            void handleSignal(signal);
        };
        processRef.on(signal, listener);
        return { signal, listener };
    });

    return {
        dispose() {
            for (const { signal, listener } of listeners) {
                processRef.off(signal, listener);
            }
        },
        isShuttingDown() {
            return shuttingDown;
        },
    };
}

module.exports = {
    registerRuntimeShutdownHandlers,
};
