const { prepareAccountUpsertPayload } = require('../account-upsert-payload');

function getAccountEntries(snapshot) {
    return Array.isArray(snapshot && snapshot.accounts) ? snapshot.accounts : [];
}

function allocateNextAccountId(snapshot) {
    const accounts = getAccountEntries(snapshot);
    const maxId = accounts.reduce((max, account) => {
        const numericId = Number.parseInt(account && account.id, 10);
        return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
    }, 0);
    const snapshotNextId = Number.parseInt(snapshot && snapshot.nextId, 10);
    const nextId = Number.isFinite(snapshotNextId) && snapshotNextId > maxId
        ? snapshotNextId
        : maxId + 1;
    return String(Math.max(nextId, 1));
}

function getDuplicateIdentityRef(body) {
    return String((body && (body.uin || body.qq)) || '').trim();
}

function findDuplicateAccountByIdentity(snapshot, options = {}) {
    const identityRef = String(options.identityRef || '').trim();
    const platform = String(options.platform || '').trim();
    const excludeId = String(options.excludeId || '').trim();
    if (!identityRef || !platform) return null;

    return getAccountEntries(snapshot).find((account) => {
        if (!account) return false;
        const accountId = String((account && account.id) || '').trim();
        if (excludeId && accountId === excludeId) return false;
        const accountPlatform = String((account && account.platform) || 'qq').trim() || 'qq';
        if (accountPlatform !== platform) return false;
        const accountIdentityRef = String((account && (account.uin || account.qq)) || '').trim();
        return accountIdentityRef === identityRef;
    }) || null;
}

function hasFreshLoginCredential(body) {
    const loginType = String((body && body.loginType) || '').trim().toLowerCase();
    if (loginType !== 'qr' && loginType !== 'manual') {
        return false;
    }
    return !!String((body && body.code) || '').trim() || !!String((body && body.authTicket) || '').trim();
}

function registerAccountManagementRoutes({
    app,
    accountOwnershipRequired,
    getAccountsSnapshot,
    getAccountList,
    resolveAccId,
    findAccountByRef,
    addOrUpdateAccount,
    deleteAccount,
    getProvider,
    store,
    consoleRef,
}) {
    app.post('/api/account/remark', accountOwnershipRequired, async (req, res) => {
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const rawRef = body.id || body.accountId || body.uin || req.headers['x-account-id'];
            const accountList = await getAccountList();
            const target = findAccountByRef(accountList, rawRef);
            if (!target || !target.id) {
                return res.status(404).json({ ok: false, error: 'Account not found' });
            }

            const remark = String(body.remark !== undefined ? body.remark : body.name || '').trim();
            if (!remark) {
                return res.status(400).json({ ok: false, error: 'Missing remark' });
            }

            const accountId = String(target.id);
            const data = await addOrUpdateAccount({ id: accountId, name: remark });
            const provider = getProvider();
            if (provider && typeof provider.setRuntimeAccountName === 'function') {
                await provider.setRuntimeAccountName(accountId, remark);
            }
            if (provider && provider.addAccountLog) {
                provider.addAccountLog('update', `更新账号备注: ${remark}`, accountId, remark);
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/accounts', async (req, res) => {
        try {
            const body = (req.body && typeof req.body === 'object') ? req.body : {};
            const isCreateRequest = !body.id;
            let createSnapshot = null;
            const shouldStartAfterSave = hasFreshLoginCredential(body);

            if (isCreateRequest) {
                createSnapshot = await getAccountsSnapshot({ force: true });
            }

            const duplicateIdentityRef = getDuplicateIdentityRef(body);
            const requestPlatform = String(body.platform || 'qq').trim() || 'qq';
            if (isCreateRequest && duplicateIdentityRef) {
                const duplicateEntry = findDuplicateAccountByIdentity(createSnapshot, {
                    platform: requestPlatform,
                    identityRef: duplicateIdentityRef,
                });
                if (duplicateEntry) {
                    consoleRef.log(`[API /api/accounts] 拦截重复创建: 标识 ${duplicateIdentityRef} 已存在，转为更新 (ID: ${duplicateEntry.id})`);
                    body.id = duplicateEntry.id;
                    if (!body.name || body.name === '扫码账号' || body.name === duplicateIdentityRef) {
                        body.name = duplicateEntry.name;
                    }
                }
            }

            const provider = getProvider();
            const isUpdate = !!body.id;
            const resolvedUpdateId = isUpdate ? await resolveAccId(body.id) : '';
            let payload = isUpdate ? { ...body, id: resolvedUpdateId || String(body.id) } : { ...body };
            let existingAccount = null;
            if (isUpdate) {
                const allAccounts = await getAccountsSnapshot();
                existingAccount = getAccountEntries(allAccounts).find(a => String(a.id) === String(payload.id)) || null;
            }
            let wasRunning = false;
            if (isUpdate && provider.isAccountRunning) {
                wasRunning = await provider.isAccountRunning(payload.id);
            }

            if (!isUpdate && req.currentUser && req.currentUser.maxAccounts > 0) {
                const allAccounts = createSnapshot || await getAccountsSnapshot({ force: true });
                const userAccounts = getAccountEntries(allAccounts).filter(a => a.username === req.currentUser.username);
                if (userAccounts.length >= req.currentUser.maxAccounts) {
                    return res.status(400).json({ ok: false, error: `体验卡用户最多绑定 ${req.currentUser.maxAccounts} 个账号` });
                }
            }

            if (isUpdate && req.currentUser && req.currentUser.role !== 'admin') {
                if (!existingAccount || existingAccount.username !== req.currentUser.username) {
                    return res.status(403).json({ ok: false, error: '无权修改此账号' });
                }
                payload.username = req.currentUser.username;
            }

            const prepared = prepareAccountUpsertPayload(payload, {
                existingAccount,
                isUpdate,
            });
            payload = prepared.payload;
            if (prepared.error) {
                return res.status(400).json({ ok: false, error: prepared.error });
            }

            if (!isUpdate && req.currentUser) {
                payload.username = req.currentUser.username;
            }
            if (!isUpdate) {
                const freshSnapshot = createSnapshot || await getAccountsSnapshot({ force: true });
                payload.id = allocateNextAccountId(freshSnapshot);
                payload.__createIfMissing = true;
            }

            if (isUpdate) {
                const payloadIdentityRef = getDuplicateIdentityRef(payload);
                if (payloadIdentityRef && payload.platform) {
                    const identitySnapshot = await getAccountsSnapshot({ force: true });
                    const duplicateEntry = findDuplicateAccountByIdentity(identitySnapshot, {
                        platform: payload.platform,
                        identityRef: payloadIdentityRef,
                        excludeId: payload.id,
                    });
                    if (duplicateEntry) {
                        if (req.currentUser && req.currentUser.role !== 'admin') {
                            const duplicateOwner = String(duplicateEntry.username || '').trim();
                            if (duplicateOwner && duplicateOwner !== req.currentUser.username) {
                                return res.status(409).json({ ok: false, error: `该账号已被用户 ${duplicateOwner} 绑定，无法覆盖` });
                            }
                        }

                        const previousId = String(payload.id || '').trim();
                        payload.id = String(duplicateEntry.id || '').trim();
                        existingAccount = duplicateEntry;
                        if (!payload.name || payload.name === '扫码账号' || payload.name === payloadIdentityRef) {
                            payload.name = duplicateEntry.name || payload.name;
                        }
                        if (provider.isAccountRunning) {
                            wasRunning = await provider.isAccountRunning(payload.id);
                        } else {
                            wasRunning = false;
                        }
                        consoleRef.log(`[API /api/accounts] 检测到同平台重复标识 ${payloadIdentityRef}，更新目标从 ${previousId || '-'} 切换到 ${payload.id}`);
                    }
                }
            }

            const data = await addOrUpdateAccount(payload);
            const savedAccountId = isUpdate
                ? String((data && data.touchedAccountId) || payload.id || '')
                : String((data && data.touchedAccountId) || payload.id || (data.accounts[data.accounts.length - 1] || {}).id || '');
            const savedAccount = savedAccountId
                ? (getAccountEntries(data).find(account => String(account && account.id) === savedAccountId) || null)
                : null;

            if (savedAccountId && typeof store.persistAccountsNow === 'function') {
                try {
                    await store.persistAccountsNow(savedAccountId, { strict: true });
                } catch (persistErr) {
                    if (typeof store.getAccountsFresh === 'function') {
                        await store.getAccountsFresh({ force: true }).catch(() => { });
                    }
                    throw persistErr;
                }
            }

            if (provider.addAccountLog) {
                const accountId = savedAccountId;
                const accountName = payload.name || '';
                provider.addAccountLog(
                    isUpdate ? 'update' : 'add',
                    isUpdate ? `更新账号: ${accountName || accountId}` : `添加账号: ${accountName || accountId}`,
                    accountId,
                    accountName
                );
            }

            if (!isUpdate) {
                const newAcc = savedAccount || data.accounts[data.accounts.length - 1];
                if (newAcc) await provider.startAccount(newAcc.id);
            } else if (wasRunning) {
                await provider.restartAccount(savedAccountId || payload.id);
            } else if (shouldStartAfterSave && savedAccountId) {
                await provider.startAccount(savedAccountId);
            }

            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });

    app.delete('/api/accounts/:id', accountOwnershipRequired, async (req, res) => {
        try {
            const accountList = await getAccountList();
            const target = findAccountByRef(accountList, req.params.id);
            if (!target || !target.id) {
                return res.status(404).json({ ok: false, error: 'Account not found' });
            }

            const resolvedId = await resolveAccId(target.id) || String(target.id || '');
            const provider = getProvider();
            await provider.stopAccount(resolvedId);
            const data = deleteAccount(resolvedId);
            if (provider.addAccountLog) {
                provider.addAccountLog('delete', `删除账号: ${(target && target.name) || req.params.id}`, resolvedId, target ? target.name : '');
            }
            res.json({ ok: true, data });
        } catch (e) {
            res.status(500).json({ ok: false, error: e.message });
        }
    });
}

module.exports = {
    registerAccountManagementRoutes,
};
