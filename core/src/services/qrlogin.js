/**
 * QR Code Login Module
 */
const axios = require('axios');
const QRCode = require('qrcode');
const store = require('../models/store');
const { createModuleLogger } = require('./logger');

const ChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const qrLogger = createModuleLogger('qrlogin');

function normalizeTextValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'bigint') return String(value);
    return '';
}

function readPathValue(source, path) {
    const root = (source && typeof source === 'object') ? source : null;
    if (!root || !path) return undefined;
    const parts = String(path).split('.').filter(Boolean);
    let cursor = root;
    for (const part of parts) {
        if (!cursor || typeof cursor !== 'object' || !(part in cursor)) {
            return undefined;
        }
        cursor = cursor[part];
    }
    return cursor;
}

function pickFirstTextValue(source, paths = []) {
    for (const path of paths) {
        const text = normalizeTextValue(readPathValue(source, path));
        if (text) return text;
    }
    return '';
}

function normalizeNumericQQUin(value) {
    const text = normalizeTextValue(value);
    return /^\d+$/.test(text) ? text : '';
}

function extractQQIdentity(source, fallback = {}) {
    const root = (source && typeof source === 'object') ? source : {};
    const backup = (fallback && typeof fallback === 'object') ? fallback : {};

    const rawUin = pickFirstTextValue(root, [
        'uin',
        'qq',
        'qq_number',
        'qqNumber',
        'qq_uin',
        'qqUin',
        'uin_str',
        'uinStr',
        'user.uin',
        'user.qq',
        'user.qq_number',
        'user.mobileqq',
        'user_info.uin',
        'user_info.qq',
        'user_info.qq_number',
        'user_info.mobileqq',
        'userInfo.uin',
        'userInfo.qq',
        'userInfo.qqNumber',
        'userInfo.mobileqq',
        'account.uin',
        'account.qq',
        'account.mobileqq',
        'account_info.uin',
        'accountInfo.uin',
        'profile.uin',
        'profile.qq',
        'profile.mobileqq',
    ]) || normalizeTextValue(backup.uin);

    const rawOpenId = pickFirstTextValue(root, [
        'open_id',
        'openId',
        'openid',
        'openID',
        'user.open_id',
        'user.openId',
        'user.openid',
        'user_info.open_id',
        'user_info.openId',
        'user_info.openid',
        'userInfo.openId',
        'userInfo.openid',
        'account.open_id',
        'account.openId',
        'profile.open_id',
        'profile.openId',
    ]) || normalizeTextValue(backup.openId);

    const nickname = pickFirstTextValue(root, [
        'nick',
        'nickname',
        'nick_name',
        'nickName',
        'name',
        'user.nick',
        'user.nickname',
        'user.nick_name',
        'user.nickName',
        'user.name',
        'user_info.nick',
        'user_info.nickname',
        'user_info.nick_name',
        'user_info.nickName',
        'user_info.name',
        'userInfo.nick',
        'userInfo.nickname',
        'userInfo.nickName',
        'userInfo.name',
        'profile.nick',
        'profile.nickname',
        'profile.name',
    ]) || normalizeTextValue(backup.nickname);

    const avatar = pickFirstTextValue(root, [
        'avatar_url',
        'avatarUrl',
        'avatar',
        'head_url',
        'headUrl',
        'head_img_url',
        'headImgUrl',
        'head_image',
        'headImage',
        'face_url',
        'faceUrl',
        'faceimg',
        'faceImg',
        'figureurl',
        'figureUrl',
        'portrait',
        'qlogo',
        'user.avatar_url',
        'user.avatarUrl',
        'user.avatar',
        'user.head_url',
        'user.headUrl',
        'user_info.avatar_url',
        'user_info.avatarUrl',
        'user_info.avatar',
        'user_info.head_url',
        'user_info.headUrl',
        'userInfo.avatarUrl',
        'userInfo.avatar',
        'profile.avatar_url',
        'profile.avatarUrl',
        'profile.avatar',
    ]) || normalizeTextValue(backup.avatar);

    let uin = normalizeNumericQQUin(rawUin);
    if (!uin) {
        uin = normalizeNumericQQUin(rawOpenId);
    }

    const openId = rawOpenId && rawOpenId !== uin ? rawOpenId : '';

    return {
        uin,
        openId,
        nickname,
        avatar,
    };
}

class QRLoginSession {
    static async requestQRCode() {
        return MiniProgramLoginSession.requestLoginCode();
    }

    static async checkStatus(qrsig) {
        return MiniProgramLoginSession.queryStatus(qrsig);
    }
}

class MiniProgramLoginSession {
    static QUA = 'V1_HT5_QDT_0.70.2209190_x64_0_DEV_D';
    static OFFICIAL_APP_ID = '1112386029';

    static getOfficialHeaders() {
        return {
            qua: MiniProgramLoginSession.QUA,
            host: 'q.qq.com',
            accept: 'application/json',
            'content-type': 'application/json',
            'user-agent': ChromeUA,
        };
    }

    static async requestOfficialLoginCode() {
        const response = await axios.get('https://q.qq.com/ide/devtoolAuth/GetLoginCode', {
            headers: this.getOfficialHeaders(),
            timeout: 15000,
        });

        const { code, data } = response.data || {};
        if (`${code}` !== '0' || !data?.code) {
            throw new Error(response.data?.message || '获取 QQ 登录码失败');
        }

        const loginCode = String(data.code);
        const loginUrl = `https://h5.qzone.qq.com/qqq/code/${loginCode}?_proxy=1&from=ide`;
        const image = await QRCode.toDataURL(loginUrl, {
            width: 300,
            margin: 1,
            errorCorrectionLevel: 'M',
        });

        return {
            code: loginCode,
            url: loginUrl,
            image,
        };
    }

    static async queryOfficialStatus(code) {
        const response = await axios.get(`https://q.qq.com/ide/devtoolAuth/syncScanSateGetTicket?code=${encodeURIComponent(code)}`, {
            headers: this.getOfficialHeaders(),
            timeout: 15000,
        });

        if (response.status !== 200) {
            return { status: 'Error', msg: 'QQ 登录状态查询失败' };
        }

        const body = response.data || {};
        const resCode = `${body.code ?? ''}`;
        const data = body.data || {};

        if (resCode === '0') {
            if (`${data.ok ?? ''}` !== '1' || !data.ticket) {
                return { status: 'Wait' };
            }

            const ticket = String(data.ticket);
            const authCode = await this.exchangeOfficialAuthCode(ticket, MiniProgramLoginSession.OFFICIAL_APP_ID);
            if (!authCode) {
                return { status: 'Error', msg: '获取 QQ 授权码失败' };
            }
            const identity = extractQQIdentity(data, {
                uin: data.uin,
                openId: data.open_id || data.openid,
                nickname: data.nick || data.nickname,
                avatar: data.avatar_url || data.avatarUrl || data.avatar,
            });

            return {
                status: 'OK',
                ticket,
                authCode,
                uin: identity.uin,
                openId: identity.openId,
                nickname: identity.nickname,
                avatar: identity.avatar,
            };
        }

        if (resCode === '-10003') {
            return { status: 'Used' };
        }

        return { status: 'Error', msg: body.message || `Code: ${resCode}` };
    }

    static async requestAineisheLoginCode(uin = '') {
        const trimmedUin = String(uin || '').trim();
        if (!trimmedUin) {
            throw new Error('第三方 QQ 扫码回退需要先填写 QQ 号');
        }

        const apiConfig = store.getThirdPartyApiConfig ? store.getThirdPartyApiConfig() : {};
        const apiKey = apiConfig.aineisheKey || '0KOp6C8f1QtUDS0P75D5KEKb';
        const response = await axios.get('https://api.aineishe.com/api/qqnc/login', {
            params: {
                api_key: apiKey,
                uin: trimmedUin,
            },
            headers: {
                'User-Agent': ChromeUA,
            },
            timeout: 40000,
        });

        const data = response.data;
        if (data.code !== 200 && data.code !== 0 && !data.data) {
            throw new Error(data.msg || data.message || '获取二维码失败');
        }

        const qrData = data.data || data;
        return {
            code: qrData.qrsig || qrData.token || Date.now().toString(),
            url: qrData.qrcode_url || qrData.url || '',
            image: qrData.qrcode_base64 || qrData.image || qrData.qrcode || '',
        };
    }

    static async requestLoginCode(uin = '') {
        try {
            return await this.requestOfficialLoginCode();
        } catch (officialError) {
            qrLogger.warn('官方登录码获取失败，尝试第三方回退', {
                error: officialError && officialError.message ? officialError.message : String(officialError),
            });
            try {
                return await this.requestAineisheLoginCode(uin);
            } catch (fallbackError) {
                qrLogger.error('第三方登录码回退失败', {
                    error: fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError),
                });
                throw fallbackError;
            }
        }
    }

    static async queryAineisheStatus(code, uin = '') {
        const trimmedUin = String(uin || '').trim();
        if (!trimmedUin) {
            throw new Error('第三方 QQ 扫码回退需要先填写 QQ 号');
        }

        const apiConfig = store.getThirdPartyApiConfig ? store.getThirdPartyApiConfig() : {};
        const apiKey = apiConfig.aineisheKey || '0KOp6C8f1QtUDS0P75D5KEKb';
        const response = await axios.get('https://api.aineishe.com/api/qqnc/login', {
            params: {
                api_key: apiKey,
                uin: trimmedUin,
                ...(code ? { qrsig: code } : {}),
            },
            headers: {
                'User-Agent': ChromeUA,
            },
            timeout: 40000,
        });

        if (response.status !== 200) return { status: 'Error' };
        const data = response.data;

        if (data.code === 200 || data.code === 0) {
            const ticket = typeof data.data === 'string'
                ? data.data
                : (data.data && data.data.token ? data.data.token : 'TICKET');
            const identity = extractQQIdentity(
                (data.data && typeof data.data === 'object') ? data.data : data,
                {
                    uin: trimmedUin,
                    nickname: data.nickname || data.nick,
                    avatar: data.avatar_url || data.avatarUrl || data.avatar,
                },
            );
            return {
                status: 'OK',
                ticket,
                authCode: ticket,
                uin: identity.uin || trimmedUin,
                openId: identity.openId,
                nickname: identity.nickname,
                avatar: identity.avatar,
            };
        } else if (data.code === 10001 || data.msg?.includes('等待验证') || data.msg?.includes('请扫描')) {
            return { status: 'Wait' };
        } else if (data.code === 10002 || data.msg?.includes('过期') || data.msg?.includes('失效')) {
            return { status: 'Used' };
        }

        return { status: 'Wait' };
    }

    static async queryStatus(code, uin = '') {
        try {
            return await this.queryOfficialStatus(code);
        } catch (officialError) {
            qrLogger.warn('官方状态轮询失败，尝试第三方回退', {
                error: officialError && officialError.message ? officialError.message : String(officialError),
            });
            try {
                return await this.queryAineisheStatus(code, uin);
            } catch (fallbackError) {
                qrLogger.error('第三方状态轮询回退失败', {
                    error: fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError),
                });
                throw fallbackError;
            }
        }
    }

    static async exchangeOfficialAuthCode(ticket, appid = MiniProgramLoginSession.OFFICIAL_APP_ID) {
        const response = await axios.post('https://q.qq.com/ide/login', {
            appid,
            ticket,
        }, {
            headers: this.getOfficialHeaders(),
            timeout: 15000,
        });

        if (response.status !== 200) return '';

        const body = response.data || {};
        if (body?.data?.code) {
            return String(body.data.code);
        }

        const maybeCode = String(body.code || '');
        if (maybeCode && !/^-?\d+$/.test(maybeCode)) {
            return maybeCode;
        }

        return '';
    }

    static async getAuthCode(ticket, appid = '1112386029') {
        if (!ticket) {
            return '';
        }

        try {
            const authCode = await this.exchangeOfficialAuthCode(ticket, appid);
            return authCode || ticket || '';
        } catch (error) {
            qrLogger.error('获取授权码失败，回退使用 ticket', {
                error: error && error.message ? error.message : String(error),
            });
            return ticket || '';
        }
    }
}

module.exports = {
    QRLoginSession,
    MiniProgramLoginSession,
    __testExtractQQIdentity: extractQQIdentity,
};
