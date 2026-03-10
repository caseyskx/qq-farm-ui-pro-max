/**
 * QR Code Login Module
 */
const axios = require('axios');
const QRCode = require('qrcode');
const store = require('../models/store');
const { createModuleLogger } = require('./logger');

const ChromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const qrLogger = createModuleLogger('qrlogin');

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

            return {
                status: 'OK',
                ticket,
                authCode,
                uin: data.uin ? String(data.uin) : '',
                nickname: data.nick || '',
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
            return {
                status: 'OK',
                ticket,
                authCode: ticket,
                uin: (data.data && data.data.uin) || trimmedUin,
                nickname: (data.data && data.data.nickname) || '',
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

module.exports = { QRLoginSession, MiniProgramLoginSession };
