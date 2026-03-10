function initMasterRuntimeDispatcher({
    currentRole,
    getIO,
    initDispatcher,
    logger,
}) {
    if (currentRole !== 'master') {
        return null;
    }

    const io = typeof getIO === 'function' ? getIO() : null;
    if (!io) {
        throw new Error('MasterDispatcher 初始化失败: Admin Socket.IO 未就绪');
    }

    const dispatcher = initDispatcher(io);
    if (logger && typeof logger.info === 'function') {
        logger.info('master dispatcher initialized');
    }
    return dispatcher;
}

function disposeMasterRuntimeDispatcher({
    currentRole,
    disposeDispatcher,
    logger,
}) {
    if (currentRole !== 'master') {
        return null;
    }

    if (typeof disposeDispatcher === 'function') {
        disposeDispatcher();
        if (logger && typeof logger.info === 'function') {
            logger.info('master dispatcher disposed');
        }
    }

    return null;
}

module.exports = {
    initMasterRuntimeDispatcher,
    disposeMasterRuntimeDispatcher,
};
