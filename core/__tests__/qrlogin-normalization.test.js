const test = require('node:test');
const assert = require('node:assert/strict');

const qrloginModulePath = require.resolve('../src/services/qrlogin');
const axiosModulePath = require.resolve('axios');
const qrcodeModulePath = require.resolve('qrcode');
const storeModulePath = require.resolve('../src/models/store');
const loggerModulePath = require.resolve('../src/services/logger');

function mockModule(modulePath, exports) {
    const previous = require.cache[modulePath];
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    };

    return () => {
        if (previous) require.cache[modulePath] = previous;
        else delete require.cache[modulePath];
    };
}

test('MiniProgramLoginSession normalizes nested QQ identity fields from official scan status', async () => {
    const axiosStub = {
        async get(url) {
            assert.match(url, /syncScanSateGetTicket\?code=demo-code$/);
            return {
                status: 200,
                data: {
                    code: 0,
                    data: {
                        ok: 1,
                        ticket: 'ticket-1',
                        userInfo: {
                            uin: '416409364',
                            nickName: '悠然恍若隔世梦',
                            openId: '68AF60B1D1B712B9F41693B3FA378DE1',
                            avatarUrl: 'https://thirdqq.qlogo.cn/qqapp/1112386029/68AF60B1D1B712B9F41693B3FA378DE1/100',
                        },
                    },
                },
            };
        },
        async post(url, body) {
            assert.equal(url, 'https://q.qq.com/ide/login');
            assert.deepEqual(body, {
                appid: '1112386029',
                ticket: 'ticket-1',
            });
            return {
                status: 200,
                data: {
                    data: {
                        code: 'auth-code-1',
                    },
                },
            };
        },
    };

    const restoreAxios = mockModule(axiosModulePath, axiosStub);
    const restoreQrCode = mockModule(qrcodeModulePath, {
        toDataURL: async () => 'data:image/png;base64,QR',
    });
    const restoreStore = mockModule(storeModulePath, {
        getThirdPartyApiConfig() {
            return {};
        },
    });
    const restoreLogger = mockModule(loggerModulePath, {
        createModuleLogger() {
            return {
                info() {},
                warn() {},
                error() {},
            };
        },
    });

    try {
        delete require.cache[qrloginModulePath];
        const { MiniProgramLoginSession } = require(qrloginModulePath);

        const result = await MiniProgramLoginSession.queryOfficialStatus('demo-code');
        assert.deepEqual(result, {
            status: 'OK',
            ticket: 'ticket-1',
            authCode: 'auth-code-1',
            uin: '416409364',
            openId: '68AF60B1D1B712B9F41693B3FA378DE1',
            nickname: '悠然恍若隔世梦',
            avatar: 'https://thirdqq.qlogo.cn/qqapp/1112386029/68AF60B1D1B712B9F41693B3FA378DE1/100',
        });
    } finally {
        delete require.cache[qrloginModulePath];
        restoreLogger();
        restoreStore();
        restoreQrCode();
        restoreAxios();
    }
});
