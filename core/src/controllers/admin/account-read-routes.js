function getAccountRecentActivityAt(account) {
    const lastLoginAt = Number(account && account.lastLoginAt || 0);
    const updatedAt = Number(account && account.updatedAt || 0);
    const createdAt = Number(account && account.createdAt || 0);
    return Math.max(
        Number.isFinite(lastLoginAt) ? lastLoginAt : 0,
        Number.isFinite(updatedAt) ? updatedAt : 0,
        Number.isFinite(createdAt) ? createdAt : 0,
    );
}

function compareAccountDisplayName(a, b) {
    const aName = String((a && (a.name || a.nick || a.uin || a.id)) || '');
    const bName = String((b && (b.name || b.nick || b.uin || b.id)) || '');
    return aName.localeCompare(bName, 'zh-CN');
}

function registerAccountReadRoutes({
    app,
    getProvider,
    compareLeaderboardAccounts,
    toLeaderboardMetricNumber,
}) {
    app.get('/api/accounts', async (req, res) => {
        try {
            const data = await getProvider().getAccounts();
            let accountList = [...(data.accounts || [])];

            if (req.currentUser && req.currentUser.role !== 'admin') {
                accountList = accountList.filter(a => a.username === req.currentUser.username);
            }

            accountList.sort((a, b) => {
                const activityDiff = getAccountRecentActivityAt(b) - getAccountRecentActivityAt(a);
                if (activityDiff !== 0) return activityDiff;
                const aState = a.connected ? 2 : (a.running ? 1 : 0);
                const bState = b.connected ? 2 : (b.running ? 1 : 0);
                if (aState !== bState) return bState - aState;
                const levelDiff = (Number(b.level) || 0) - (Number(a.level) || 0);
                if (levelDiff !== 0) return levelDiff;
                return compareAccountDisplayName(a, b);
            });

            res.json({ ok: true, data: { ...data, accounts: accountList } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/leaderboard', async (req, res) => {
        try {
            const SORT_WHITELIST = new Set(['level', 'gold', 'coupon', 'uptime', 'exp']);
            const rawSort = String(req.query.sort_by || 'level');
            const sortBy = SORT_WHITELIST.has(rawSort) ? rawSort : 'level';
            const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '50', 10) || 50, 1), 200);

            const data = await getProvider().getAccounts();
            let accountList = [...(data.accounts || [])];

            accountList = accountList.map(acc => {
                const safeAcc = {
                    ...acc,
                    level: toLeaderboardMetricNumber(acc.level),
                    gold: toLeaderboardMetricNumber(acc.gold),
                    exp: toLeaderboardMetricNumber(acc.exp),
                    coupon: toLeaderboardMetricNumber(acc.coupon),
                    uptime: toLeaderboardMetricNumber(acc.uptime),
                    lastStatusAt: toLeaderboardMetricNumber(acc.lastStatusAt),
                    lastOnlineAt: toLeaderboardMetricNumber(acc.lastOnlineAt),
                };
                delete safeAcc.password;
                delete safeAcc.code;
                delete safeAcc.authTicket;
                delete safeAcc.authData;
                return safeAcc;
            });

            const isAdmin = req.currentUser?.role === 'admin';
            if (!isAdmin) {
                const currentUsername = req.currentUser?.username;
                accountList = accountList.filter(acc => acc.username === currentUsername);
            }

            accountList.sort((a, b) => compareLeaderboardAccounts(a, b, sortBy));
            accountList = accountList.map((acc, index) => ({ ...acc, ranking: index + 1 }));

            res.json({ ok: true, data: { accounts: accountList.slice(0, limit), total: accountList.length } });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

function registerLogReadRoutes({
    app,
    getProvider,
    getAccountsSnapshot,
    resolveAccId,
    getAccId,
}) {
    app.get('/api/account-logs', async (req, res) => {
        try {
            const limit = Number.parseInt(req.query.limit) || 100;
            let list = getProvider().getAccountLogs ? getProvider().getAccountLogs(limit) : [];

            if (req.currentUser && req.currentUser.role !== 'admin') {
                const allAccounts = await getAccountsSnapshot();
                const userOwnedAccountIds = allAccounts.accounts
                    .filter(a => a.username === req.currentUser.username)
                    .map(a => String(a.id));
                list = list.filter(l => l.accountId && userOwnedAccountIds.includes(String(l.accountId)));
            }

            res.json(Array.isArray(list) ? list : []);
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/logs', async (req, res) => {
        const queryAccountIdRaw = (req.query.accountId || '').toString().trim();
        const id = queryAccountIdRaw ? (queryAccountIdRaw === 'all' ? '' : await resolveAccId(queryAccountIdRaw)) : await getAccId(req);
        const targetId = id;

        if (req.currentUser && req.currentUser.role !== 'admin') {
            const allAccounts = await getAccountsSnapshot();
            const userAccountIds = allAccounts.accounts
                .filter(a => a.username === req.currentUser.username)
                .map(a => String(a.id));

            if (targetId) {
                if (!userAccountIds.includes(String(targetId))) {
                    return res.status(403).json({ ok: false, error: '无权查看此账号日志' });
                }
            }
        }

        const options = {
            limit: Number.parseInt(req.query.limit) || 100,
            tag: req.query.tag || '',
            module: req.query.module || '',
            event: req.query.event || '',
            keyword: req.query.keyword || '',
            isWarn: req.query.isWarn,
            timeFrom: req.query.timeFrom || '',
            timeTo: req.query.timeTo || '',
        };
        let list = await getProvider().getLogs(targetId, options);

        if (!targetId && req.currentUser && req.currentUser.role !== 'admin') {
            const allAccounts = await getAccountsSnapshot();
            const userAccountIds = allAccounts.accounts
                .filter(a => a.username === req.currentUser.username)
                .map(a => String(a.id));
            list = list.filter(l => l.accountId && userAccountIds.includes(String(l.accountId)));
        }

        res.json({ ok: true, data: list });
    });
}

module.exports = {
    registerAccountReadRoutes,
    registerLogReadRoutes,
};
