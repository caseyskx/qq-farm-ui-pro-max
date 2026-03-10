function createSocketCorsOriginResolver(allowedOrigins) {
    if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) {
        return '*';
    }

    return (origin, callback) => {
        const isLocalDev = /^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?::\d+)?$/.test(origin || '');
        if (!origin || allowedOrigins.includes(origin) || isLocalDev) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    };
}

function createAdminRealtimeServer({
    httpRef,
    socketServerFactory,
    app,
    allowedOrigins,
    createSocketAuthMiddleware,
    createSocketConnectionHandler,
    jwtService,
    userStore,
    applySocketSubscription,
}) {
    const server = httpRef.createServer(app);
    const io = socketServerFactory(server, {
        path: '/socket.io',
        pingTimeout: 5000,
        pingInterval: 10000,
        cors: {
            origin: createSocketCorsOriginResolver(allowedOrigins),
            methods: ['GET', 'POST'],
            credentials: Array.isArray(allowedOrigins) && allowedOrigins.length > 0,
        },
    });

    io.use(createSocketAuthMiddleware({
        jwtService,
        userStore,
    }));

    io.on('connection', createSocketConnectionHandler({
        applySocketSubscription,
    }));

    return {
        server,
        io,
    };
}

function createAdminListenPromise({
    server,
    port,
    host = '0.0.0.0',
    adminLogger,
    buildAdminListenError,
    cleanupFailedAdminStart,
    clearServerStartPromise,
}) {
    return new Promise((resolve, reject) => {
        const onListening = () => {
            server.off('error', onError);
            clearServerStartPromise();
            adminLogger.info('admin panel started', { url: `http://localhost:${port}`, port });
            resolve(server);
        };

        const onError = (error) => {
            const wrapped = buildAdminListenError(error, port);
            adminLogger.error('admin panel failed to start', {
                port,
                code: wrapped.code,
                error: wrapped.message,
            });
            cleanupFailedAdminStart();
            reject(wrapped);
        };

        server.once('listening', onListening);
        server.once('error', onError);

        try {
            server.listen(port, host);
        } catch (error) {
            onError(error);
        }
    });
}

function closeAdminRealtimeServer({
    server,
    io,
}) {
    if (io) {
        try {
            io.close();
        } catch {
            // ignore realtime close errors during shutdown
        }
    }

    if (!server) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        try {
            server.removeAllListeners('error');
            server.removeAllListeners('listening');

            if (!server.listening) {
                resolve();
                return;
            }

            server.close(() => resolve());
        } catch {
            resolve();
        }
    });
}

module.exports = {
    createSocketCorsOriginResolver,
    createAdminRealtimeServer,
    createAdminListenPromise,
    closeAdminRealtimeServer,
};
