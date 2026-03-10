function registerAnnouncementAdminRoutes({
    app,
    authRequired,
    userRequired,
    adminLogger,
    getAnnouncements,
    saveAnnouncement,
    deleteAnnouncement,
    parseUpdateLog,
    getIo,
    store,
}) {
    app.get('/api/announcement', async (req, res) => {
        try {
            const data = await getAnnouncements();
            res.json({ ok: true, data: data || [] });
        } catch (e) {
            adminLogger.error('getAnnouncements failed:', e.message);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.put('/api/announcement', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const { id, title = '', version = '', publish_date = '', content = '', enabled = true } = body;
            await saveAnnouncement({
                id: id ? Number(id) : null,
                title: String(title),
                version: String(version),
                publish_date: String(publish_date),
                content: String(content),
                enabled: !!enabled,
                createdBy: req.currentUser.username || null,
            });
            const io = getIo();
            if (io) io.emit('announcement:update', { ok: true });
            res.json({ ok: true });
        } catch (e) {
            adminLogger.error('saveAnnouncement failed:', e.message);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.delete('/api/announcement', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const id = req.query.id ? Number(req.query.id) : null;
            await deleteAnnouncement(id);
            const io = getIo();
            if (io) io.emit('announcement:update', { ok: true });
            res.json({ ok: true });
        } catch (e) {
            adminLogger.error('deleteAnnouncement failed:', e.message);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/announcement/sync', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const entries = parseUpdateLog().reverse();
            const existing = await getAnnouncements() || [];
            let addedCount = 0;
            for (const entry of entries) {
                const ex = existing.find(a => (a.version === entry.version && a.title === entry.title) || (a.publish_date === entry.date && a.title === entry.title));
                if (!ex) {
                    await saveAnnouncement({
                        title: entry.title,
                        version: entry.version || '',
                        publish_date: entry.date || '',
                        content: entry.content || '',
                        enabled: true,
                        createdBy: 'system_sync'
                    });
                    addedCount++;
                }
            }
            const io = getIo();
            if (addedCount > 0 && io) io.emit('announcement:update', { ok: true });
            await getAnnouncements();
            res.json({ ok: true, added: addedCount, totalParsed: entries.length });
        } catch (e) {
            adminLogger.error('sync announcements failed:', e.message);
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/admin/third-party-api', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const config = store.getThirdPartyApiConfig ? store.getThirdPartyApiConfig() : {};
            res.json({ ok: true, data: config });
        } catch (error) {
            adminLogger.error('获取第三方API配置失败', error);
            res.status(500).json({ ok: false, error: '获取第三方API配置失败' });
        }
    });

    app.post('/api/admin/third-party-api', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const data = store.setThirdPartyApiConfig(body);
            if (typeof store.flushGlobalConfigSave === 'function') {
                await store.flushGlobalConfigSave();
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/admin/cluster-config', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const config = store.getClusterConfig ? store.getClusterConfig() : { dispatcherStrategy: 'round_robin' };
            res.json({ ok: true, data: config });
        } catch (error) {
            adminLogger.error('获取集群调度配置失败', error);
            res.status(500).json({ ok: false, error: '获取集群调度配置失败' });
        }
    });

    app.post('/api/admin/cluster-config', authRequired, userRequired, async (req, res) => {
        if (req.currentUser.role !== 'admin') {
            return res.status(403).json({ ok: false, error: 'Forbidden' });
        }
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const data = store.setClusterConfig ? store.setClusterConfig(body) : body;
            if (typeof store.flushGlobalConfigSave === 'function') {
                await store.flushGlobalConfigSave();
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = {
    registerAnnouncementAdminRoutes,
};
