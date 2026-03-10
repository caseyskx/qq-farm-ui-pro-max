function prepareAccountUpsertPayload(input, options = {}) {
    const payload = (input && typeof input === 'object') ? { ...input } : {};
    const existingAccount = (options.existingAccount && typeof options.existingAccount === 'object')
        ? options.existingAccount
        : null;
    const isUpdate = !!options.isUpdate;

    const platform = String(payload.platform || (existingAccount && existingAccount.platform) || 'qq').trim() || 'qq';
    const loginType = String(payload.loginType || '').trim().toLowerCase();
    payload.platform = platform;

    if (payload.code !== undefined) {
        payload.code = String(payload.code || '').trim();
    }

    if (platform === 'qq') {
        let resolvedUin = String(payload.uin || payload.qq || '').trim();
        if (!resolvedUin && isUpdate && existingAccount) {
            resolvedUin = String((existingAccount.uin || existingAccount.qq) || '').trim();
        }
        if (resolvedUin) {
            payload.uin = resolvedUin;
            payload.qq = resolvedUin;
        } else {
            delete payload.uin;
            delete payload.qq;
        }
    } else {
        if (payload.uin !== undefined) {
            payload.uin = String(payload.uin || '').trim();
        }
        // 非 QQ 账号必须清掉残留 QQ 标识，避免旧 auth_data 被再次持久化。
        payload.qq = '';
    }

    if (payload.authTicket !== undefined) {
        payload.authTicket = String(payload.authTicket || '').trim();
    } else if (loginType === 'manual') {
        // 手动填码必须清空旧扫码 ticket，避免下次重启继续复用旧授权链路。
        payload.authTicket = '';
    }

    if (platform !== 'qq' && loginType === 'manual' && !String(payload.uin || '').trim()) {
        return {
            payload,
            error: '微信账号手动填码时必须同时填写微信ID / OpenID',
        };
    }

    return { payload, error: '' };
}

module.exports = {
    prepareAccountUpsertPayload,
};
