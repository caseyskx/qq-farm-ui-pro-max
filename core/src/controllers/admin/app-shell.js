function createAdminCorsMiddleware({ allowedOrigins }) {
    return (req, res, next) => {
        const origin = req.headers.origin || '';
        const isLocalDev = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?::\d+)?$/.test(origin);
        const isAllowed = isLocalDev || allowedOrigins.includes(origin);

        if (origin && isAllowed) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
        } else if (!origin) {
            res.header('Access-Control-Allow-Origin', '*');
        }

        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, x-account-id, x-admin-token');
        res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.header('Pragma', 'no-cache');
        res.header('Expires', '0');
        if (req.method === 'OPTIONS') return res.sendStatus(200);
        next();
    };
}

function createAdminApiGuard({ publicPaths, authRequired, userRequired }) {
    return (req, res, next) => {
        if (publicPaths.has(req.path)) return next();
        authRequired(req, res, (err) => {
            if (err) return next(err);
            userRequired(req, res, next);
        });
    };
}

function createAdminAppShell({
    createApp,
    jsonMiddleware,
    cookieParserMiddleware,
    aiStatusRouter,
    authRequired,
    userRequired,
    allowedOrigins,
    adminLogger,
    resolveWebDistDir,
    fsRef,
    expressStatic,
    ensureUiBackgroundDir,
    getResourcePath,
    ensureAssetCacheDir,
    runUiBackgroundCleanup,
}) {
    const app = createApp();
    app.use(jsonMiddleware);
    app.use(cookieParserMiddleware);
    app.use('/api/ai', authRequired, userRequired, aiStatusRouter);
    app.use(createAdminCorsMiddleware({ allowedOrigins }));

    const webDist = resolveWebDistDir();
    if (fsRef.existsSync(webDist)) {
        app.use(expressStatic(webDist));
    } else {
        adminLogger.warn('web build not found', { webDist });
        app.get('/', (req, res) => res.send('web build not found. Please build the web project.'));
    }
    app.use('/ui-backgrounds', expressStatic(ensureUiBackgroundDir()));
    app.use('/game-config', expressStatic(getResourcePath('gameConfig')));
    app.use('/asset-cache', expressStatic(ensureAssetCacheDir()));
    runUiBackgroundCleanup();

    return {
        app,
        webDist,
    };
}

module.exports = {
    createAdminCorsMiddleware,
    createAdminApiGuard,
    createAdminAppShell,
};
