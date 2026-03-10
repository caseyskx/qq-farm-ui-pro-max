function registerAuthRoutes({
    app,
    getClientIP,
    security,
    userStore,
    jwtService,
    adminLogger,
    configRef,
}) {
    app.post('/api/login', async (req, res) => {
        try {
            const username = String(req.body?.username || '').trim();
            const password = String(req.body?.password || '');
            const clientIP = getClientIP(req);
            const lockKey = username ? `user:${username}` : `ip:${clientIP}`;

            if (!username || !password) {
                return res.status(400).json({
                    ok: false,
                    error: '用户名和密码不能为空',
                });
            }

            const lockStatus = security.loginLock.checkLock(lockKey);
            if (lockStatus.locked) {
                const remainMin = Math.ceil(lockStatus.remainingMs / 60000);
                return res.status(429).json({
                    ok: false,
                    error: `登录尝试过多，请 ${remainMin} 分钟后再试`,
                });
            }

            const user = await userStore.validateUser(username, password);
            if (!user) {
                security.loginLock.recordFailure(lockKey);
                return res.status(401).json({ ok: false, error: '用户名或密码错误' });
            }
            if (user.error) {
                return res.status(403).json({ ok: false, error: user.error });
            }
            const validatedUser = { username: user.username, role: user.role, card: user.card };

            security.loginLock.recordSuccess(lockKey);

            const accessToken = jwtService.signAccessToken(validatedUser);
            const refreshToken = jwtService.generateRefreshToken();
            await jwtService.storeRefreshToken(validatedUser.username, refreshToken, validatedUser.role, req);
            jwtService.setTokenCookies(req, res, accessToken, refreshToken, validatedUser.role);

            const defaultPwd = configRef.adminPassword || 'admin';
            const isDefaultPassword = password === defaultPwd;

            res.json({
                ok: true,
                data: {
                    user: {
                        username: validatedUser.username,
                        role: validatedUser.role,
                        card: validatedUser.card,
                    },
                    ...(isDefaultPassword && { passwordWarning: '您正在使用默认密码，建议尽快修改以保障账户安全' }),
                },
            });
        } catch (err) {
            adminLogger.error(`Login error: ${err.message}`);
            return res.status(500).json({ ok: false, error: '服务器内部错误' });
        }
    });

    app.post('/api/auth/refresh', async (req, res) => {
        try {
            const oldRefresh = req.cookies?.refresh_token;
            if (!oldRefresh) {
                return res.status(401).json({ ok: false, error: '缺少刷新令牌' });
            }

            const consumed = await jwtService.atomicConsumeRefreshToken(oldRefresh);
            if (!consumed) {
                return res.status(401).json({ ok: false, error: '刷新令牌无效或已过期' });
            }

            const userInfo = await userStore.getUserInfo(consumed.username);
            if (!userInfo) {
                return res.status(401).json({ ok: false, error: '未找到用户' });
            }

            const newAccess = jwtService.signAccessToken(userInfo);
            const newRefresh = jwtService.generateRefreshToken();
            await jwtService.storeRefreshToken(userInfo.username, newRefresh, userInfo.role, req);
            jwtService.setTokenCookies(req, res, newAccess, newRefresh, userInfo.role);

            res.json({ ok: true });
        } catch (err) {
            adminLogger.error(`Token refresh error: ${err.message}`);
            return res.status(500).json({ ok: false, error: '服务器内部错误' });
        }
    });

    app.post('/api/auth/logout', async (req, res) => {
        try {
            const refreshToken = req.cookies?.refresh_token;
            if (refreshToken) {
                await jwtService.revokeRefreshToken(refreshToken);
            }
        } catch (err) {
            adminLogger.error(`Logout error: ${err.message}`);
        }
        jwtService.clearTokenCookies(req, res);
        res.json({ ok: true });
    });
}

function registerLegacyLogoutRoute({
    app,
    jwtService,
    adminLogger,
}) {
    app.post('/api/logout', async (req, res) => {
        try {
            const refreshToken = req.cookies?.refresh_token;
            if (refreshToken) {
                await jwtService.revokeRefreshToken(refreshToken);
            }
        } catch (err) {
            adminLogger.error(`Legacy logout error: ${err.message}`);
        }
        jwtService.clearTokenCookies(req, res);
        res.json({ ok: true });
    });
}

module.exports = {
    registerAuthRoutes,
    registerLegacyLogoutRoute,
};
