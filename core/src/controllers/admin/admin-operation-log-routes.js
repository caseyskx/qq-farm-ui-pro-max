function rejectUnlessAdmin(req, res) {
    if (req.currentUser.role !== 'admin') {
        res.status(403).json({ ok: false, error: 'Forbidden' });
        return true;
    }
    return false;
}

function registerAdminOperationLogRoutes({
    app,
    authRequired,
    userRequired,
    adminOperationLogService,
}) {
    app.get('/api/admin-operation-logs', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }

        try {
            const hasActorUsername = Object.prototype.hasOwnProperty.call(req.query || {}, 'actorUsername');
            const items = await adminOperationLogService.listAdminOperationLogs({
                actorUsername: hasActorUsername ? req.query.actorUsername : req.currentUser?.username,
                scope: req.query.scope,
                status: req.query.status,
                keyword: req.query.keyword,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                limit: req.query.limit,
            });
            res.json({ ok: true, data: { items } });
        } catch (error) {
            res.status(500).json({ ok: false, error: error.message || '读取操作日志失败' });
        }
    });

    app.post('/api/admin-operation-logs', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }

        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const item = await adminOperationLogService.createAdminOperationLog({
                ...body,
                actorUsername: req.currentUser?.username,
            });
            if (!item) {
                return res.status(400).json({ ok: false, error: '日志参数无效' });
            }
            res.json({ ok: true, data: { item } });
        } catch (error) {
            res.status(500).json({ ok: false, error: error.message || '写入操作日志失败' });
        }
    });

    app.delete('/api/admin-operation-logs', authRequired, userRequired, async (req, res) => {
        if (rejectUnlessAdmin(req, res)) {
            return;
        }

        try {
            const deletedCount = await adminOperationLogService.clearAdminOperationLogs({
                actorUsername: req.currentUser?.username,
                scope: req.query.scope,
            });
            res.json({ ok: true, data: { deletedCount } });
        } catch (error) {
            res.status(500).json({ ok: false, error: error.message || '清空操作日志失败' });
        }
    });
}

module.exports = {
    registerAdminOperationLogRoutes,
};
