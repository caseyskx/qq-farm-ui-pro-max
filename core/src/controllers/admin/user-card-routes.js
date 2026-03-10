const { createModuleLogger } = require('../../services/logger');

const userCardRoutesLogger = createModuleLogger('user-card-routes');

function logUserCardRoutesError(message, error, meta = {}) {
    userCardRoutesLogger.error(message, {
        ...meta,
        error: error && error.message ? error.message : String(error || ''),
    });
}

function rejectUnlessAdmin(req, res) {
    if (req.currentUser.role !== 'admin') {
        res.status(403).json({ ok: false, error: 'Forbidden' });
        return true;
    }
    return false;
}

function registerUserCardRoutes({
    app,
    authRequired,
    userRequired,
    userStore,
    usersController,
    cardsController,
    validateUsername,
    validatePassword,
    validateCardCode,
    jwtService,
}) {
    app.post('/api/auth/register', async (req, res) => {
        try {
            const { username, password, cardCode } = req.body || {};

            if (!username || !password || !cardCode) {
                return res.status(400).json({
                    ok: false,
                    error: '缺少必要参数',
                    details: {
                        username: username ? '已提供' : '必填',
                        password: password ? '已提供' : '必填',
                        cardCode: cardCode ? '已提供' : '必填',
                    },
                });
            }

            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                return res.status(400).json({ ok: false, error: usernameValidation.error });
            }

            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                return res.status(400).json({ ok: false, error: passwordValidation.error });
            }

            const cardCodeValidation = validateCardCode(cardCode);
            if (!cardCodeValidation.valid) {
                return res.status(400).json({ ok: false, error: cardCodeValidation.error });
            }

            const result = await userStore.registerUser(username, password, cardCode);
            if (!result.ok) {
                return res.status(400).json(result);
            }

            const accessToken = jwtService.signAccessToken(result.user);
            const refreshToken = jwtService.generateRefreshToken();
            await jwtService.storeRefreshToken(result.user.username, refreshToken, result.user.role, req);
            jwtService.setTokenCookies(req, res, accessToken, refreshToken, result.user.role);

            res.json({ ok: true, data: { user: result.user } });
        } catch (error) {
            logUserCardRoutesError('用户注册失败', error, { username: req.body?.username || '' });
            res.status(500).json({ ok: false, error: '注册失败，请稍后重试' });
        }
    });

    app.post('/api/auth/renew', authRequired, async (req, res) => {
        try {
            const { cardCode } = req.body || {};
            if (!cardCode) {
                return res.status(400).json({ ok: false, error: '缺少卡密' });
            }

            const cardCodeValidation = validateCardCode(cardCode);
            if (!cardCodeValidation.valid) {
                return res.status(400).json({ ok: false, error: cardCodeValidation.error });
            }

            const result = await userStore.renewUser(req.currentUser.username, cardCode);
            if (!result.ok) {
                return res.status(400).json(result);
            }

            req.currentUser.card = result.card;
            res.json({ ok: true, data: { card: result.card } });
        } catch (error) {
            logUserCardRoutesError('用户续费失败', error, { username: req.currentUser?.username || '' });
            res.status(500).json({ ok: false, error: '续费失败，请稍后重试' });
        }
    });

    app.get('/api/users', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        usersController.getAllUsers(req, res);
    });

    app.post('/api/users', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        usersController.createUser(req, res);
    });

    app.put('/api/users/:username', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        usersController.updateUser(req, res);
    });

    app.post('/api/users/:username/renew', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        usersController.renewUserCard(req, res);
    });

    app.delete('/api/users/:username', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        usersController.deleteUser(req, res);
    });

    app.post('/api/auth/change-password', authRequired, async (req, res) => {
        usersController.changePassword(req, res);
    });

    app.get('/api/cards', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.getAllCards(req, res);
    });

    app.get('/api/cards/:code', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.getCardDetail(req, res);
    });

    app.post('/api/cards', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.createCard(req, res);
    });

    app.put('/api/cards/:code', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.updateCard(req, res);
    });

    app.delete('/api/cards/:code', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.deleteCard(req, res);
    });

    app.post('/api/cards/batch-delete', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.batchDeleteCards(req, res);
    });

    app.post('/api/cards/batch-update', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        cardsController.batchUpdateCards(req, res);
    });
}

function registerTrialCardRoutes({
    app,
    authRequired,
    userRequired,
    trialRateLimiter,
    getClientIP,
    userStore,
    store,
}) {
    app.post('/api/trial-card', trialRateLimiter, async (req, res) => {
        try {
            const clientIP = getClientIP(req);
            const result = await userStore.createTrialCard(clientIP);
            if (!result.ok) {
                return res.status(400).json(result);
            }
            res.json({ ok: true, data: { code: result.code, days: result.days } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/trial-card-config', authRequired, async (req, res) => {
        try {
            const config = store.getTrialCardConfig();
            if (req.currentUser && req.currentUser.role === 'admin') {
                return res.json({ ok: true, data: config });
            }
            res.json({ ok: true, data: { userRenewEnabled: config.userRenewEnabled, days: config.days } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/trial-card-config', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const data = store.setTrialCardConfig(body);
            if (typeof store.flushGlobalConfigSave === 'function') {
                await store.flushGlobalConfigSave();
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/users/:username/trial-renew', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }
        try {
            const result = await userStore.renewTrialUser(req.params.username, 'admin');
            if (!result.ok) {
                return res.status(400).json(result);
            }
            res.json({ ok: true, data: { card: result.card } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/auth/trial-renew', authRequired, async (req, res) => {
        try {
            const result = await userStore.renewTrialUser(req.currentUser.username, 'user');
            if (!result.ok) {
                return res.status(400).json(result);
            }
            req.currentUser.card = result.card;
            res.json({ ok: true, data: { card: result.card } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = {
    registerUserCardRoutes,
    registerTrialCardRoutes,
};
