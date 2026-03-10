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
        if (shuttingDown) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn('graceful shutdown already in progress', { signal });
            }
            return;
        }

        shuttingDown = true;
        if (logger && typeof logger.info === 'function') {
            logger.info('received shutdown signal', { signal });
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
