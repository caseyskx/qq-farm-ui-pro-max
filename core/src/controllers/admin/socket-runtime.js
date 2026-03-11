const process = require('node:process');

function parseCookieHeader(cookieHeader = '') {
    const cookies = {};
    for (const part of String(cookieHeader || '').split(';')) {
        const [key, ...valueParts] = part.trim().split('=');
        if (!key) {
            continue;
        }
        const rawValue = valueParts.join('=').trim();
        try {
            cookies[key.trim()] = decodeURIComponent(rawValue);
        } catch {
            cookies[key.trim()] = rawValue;
        }
    }
    return cookies;
}

function createSocketAuthMiddleware({
    jwtService,
    userStore,
    currentRole = process.env.ROLE || 'standalone',
    workerToken = process.env.WORKER_TOKEN || 'default_cluster_token',
}) {
    return async (socket, next) => {
        try {
            const cookies = parseCookieHeader(socket.handshake.headers?.cookie || '');
            const accessToken = cookies.access_token
                || socket.handshake.auth?.token
                || socket.handshake.headers?.['x-admin-token']
                || '';
            const nodeId = String(socket.handshake.auth?.nodeId || '').trim();

            if (String(currentRole || '').trim() === 'master' && nodeId) {
                if (accessToken && accessToken === String(workerToken || '')) {
                    socket.data.currentUser = {
                        username: `worker:${nodeId}`,
                        role: 'worker',
                    };
                    socket.data.authKind = 'worker';
                    socket.data.workerNodeId = nodeId;
                    return next();
                }
                return next(new Error('Unauthorized'));
            }

            if (!accessToken) {
                return next(new Error('Unauthorized'));
            }

            const decoded = jwtService.verifyAccessToken(accessToken);
            if (!decoded) {
                return next(new Error('Unauthorized'));
            }

            const userInfo = await userStore.getUserInfo(decoded.username);
            if (!userInfo) {
                return next(new Error('Unauthorized'));
            }

            socket.data.currentUser = userInfo;
            socket.data.authKind = 'user';
            return next();
        } catch {
            return next(new Error('Unauthorized'));
        }
    };
}

function createSocketSubscriptionHandler({
    getAccountsSnapshot,
    resolveAccId,
    getProvider,
}) {
    return async (socket, accountRef = '') => {
        for (const room of socket.rooms) {
            if (room.startsWith('account:')) {
                socket.leave(room);
            }
        }

        const currentUser = socket.data.currentUser;

        if (Array.isArray(accountRef)) {
            socket.data.accountId = '';
            socket.data.accountIds = accountRef;
            const targetIds = [];

            for (const ref of accountRef) {
                const incoming = String(ref || '').trim();
                const resolved = incoming && incoming !== 'all' ? await resolveAccId(incoming) : '';
                if (!resolved) {
                    continue;
                }

                let allow = true;
                if (currentUser && currentUser.role !== 'admin') {
                    const allAccounts = await getAccountsSnapshot();
                    const account = (allAccounts.accounts || []).find(a => String(a.id) === String(resolved));
                    if (!account || account.username !== currentUser.username) {
                        allow = false;
                    }
                }
                if (allow) {
                    targetIds.push(resolved);
                }
            }

            for (const uid of targetIds) {
                socket.join(`account:${uid}`);
            }
            socket.emit('subscribed', { accountId: 'multi', count: targetIds.length });

            try {
                const provider = getProvider();
                if (provider && typeof provider.getStatus === 'function') {
                    for (const targetId of targetIds) {
                        const currentStatus = await provider.getStatus(targetId);
                        socket.emit('status:update', { accountId: targetId, status: currentStatus });
                    }
                }
            } catch {
                // ignore snapshot push errors
            }

            return;
        }

        const incoming = String(accountRef || '').trim();
        const resolved = incoming && incoming !== 'all' ? await resolveAccId(incoming) : '';

        if (resolved) {
            let allow = true;
            if (currentUser && currentUser.role !== 'admin') {
                const allAccounts = await getAccountsSnapshot();
                const account = (allAccounts.accounts || []).find(a => String(a.id) === String(resolved));
                if (!account || account.username !== currentUser.username) {
                    allow = false;
                }
            }

            if (allow) {
                socket.join(`account:${resolved}`);
                socket.data.accountId = resolved;
                socket.emit('subscribed', { accountId: resolved });
            } else {
                socket.data.accountId = '';
                socket.emit('subscribed', { accountId: '' });
                return;
            }
        } else {
            socket.data.accountId = '';
            if (!currentUser || currentUser.role === 'admin') {
                socket.join('account:all');
                socket.emit('subscribed', { accountId: 'all' });
            } else {
                const allAccounts = await getAccountsSnapshot();
                const userOwnedAccountIds = (allAccounts.accounts || [])
                    .filter(a => a.username === currentUser.username)
                    .map(a => String(a.id));
                for (const uid of userOwnedAccountIds) {
                    socket.join(`account:${uid}`);
                }
                socket.emit('subscribed', { accountId: 'user_all' });
            }
        }

        try {
            const provider = getProvider();
            const targetId = socket.data.accountId || '';
            if (targetId && provider && typeof provider.getStatus === 'function') {
                const currentStatus = await provider.getStatus(targetId);
                socket.emit('status:update', { accountId: targetId, status: currentStatus });
            }

            if (provider && typeof provider.getLogs === 'function') {
                let currentLogs = await provider.getLogs(targetId, { limit: 40 });
                if (!targetId && currentUser && currentUser.role !== 'admin') {
                    const allAccounts = await getAccountsSnapshot();
                    const userAccountIds = (allAccounts.accounts || [])
                        .filter(a => a.username === currentUser.username)
                        .map(a => String(a.id));
                    currentLogs = currentLogs.filter(log => log.accountId && userAccountIds.includes(String(log.accountId)));
                }
                socket.emit('logs:snapshot', {
                    accountId: targetId || (currentUser && currentUser.role !== 'admin' ? 'user_all' : 'all'),
                    logs: Array.isArray(currentLogs) ? currentLogs : [],
                });
            }

            if (provider && typeof provider.getAccountLogs === 'function') {
                let currentAccountLogs = provider.getAccountLogs(40);
                if (!targetId && currentUser && currentUser.role !== 'admin') {
                    const allAccounts = await getAccountsSnapshot();
                    const userAccountIds = (allAccounts.accounts || [])
                        .filter(a => a.username === currentUser.username)
                        .map(a => String(a.id));
                    currentAccountLogs = currentAccountLogs.filter(log => log.accountId && userAccountIds.includes(String(log.accountId)));
                }
                socket.emit('account-logs:snapshot', {
                    logs: Array.isArray(currentAccountLogs) ? currentAccountLogs : [],
                });
            }
        } catch {
            // ignore snapshot push errors
        }
    };
}

function createSocketConnectionHandler({
    applySocketSubscription,
    nowFn = () => Date.now(),
}) {
    return async (socket) => {
        const initialAccountRef = (socket.handshake.auth && socket.handshake.auth.accountId)
            || (socket.handshake.query && socket.handshake.query.accountId)
            || '';
        await applySocketSubscription(socket, initialAccountRef);
        socket.emit('ready', { ok: true, ts: nowFn() });

        socket.on('subscribe', async (payload) => {
            const body = (payload && typeof payload === 'object') ? payload : {};
            if (Array.isArray(body.accountIds)) {
                await applySocketSubscription(socket, body.accountIds);
            } else {
                await applySocketSubscription(socket, body.accountId || '');
            }
        });
    };
}

module.exports = {
    parseCookieHeader,
    createSocketAuthMiddleware,
    createSocketSubscriptionHandler,
    createSocketConnectionHandler,
};
