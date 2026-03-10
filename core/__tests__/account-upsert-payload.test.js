const test = require('node:test');
const assert = require('node:assert/strict');

const { prepareAccountUpsertPayload } = require('../src/controllers/account-upsert-payload');

test('prepareAccountUpsertPayload clears qq residue and authTicket for non-qq manual updates', () => {
    const result = prepareAccountUpsertPayload({
        platform: 'wx_car',
        loginType: 'manual',
        code: '  fresh-code  ',
        uin: ' smdk007 ',
    }, {
        isUpdate: true,
        existingAccount: {
            id: '1006',
            platform: 'wx_car',
            uin: 'old-wxid',
            qq: '123456789',
            authTicket: 'legacy-ticket',
        },
    });

    assert.equal(result.error, '');
    assert.equal(result.payload.platform, 'wx_car');
    assert.equal(result.payload.uin, 'smdk007');
    assert.equal(result.payload.qq, '');
    assert.equal(result.payload.code, 'fresh-code');
    assert.equal(result.payload.authTicket, '');
});

test('prepareAccountUpsertPayload rejects non-qq manual updates without uin', () => {
    const result = prepareAccountUpsertPayload({
        platform: 'wx_car',
        loginType: 'manual',
        code: 'fresh-code',
    }, {
        isUpdate: true,
        existingAccount: {
            id: '1006',
            platform: 'wx_car',
            uin: 'old-wxid',
            qq: '123456789',
        },
    });

    assert.equal(result.error, '微信账号手动填码时必须同时填写微信ID / OpenID');
    assert.equal(result.payload.qq, '');
    assert.equal(result.payload.authTicket, '');
});

test('prepareAccountUpsertPayload keeps qq identity aligned when qq code update omits uin', () => {
    const result = prepareAccountUpsertPayload({
        platform: 'qq',
        loginType: 'manual',
        code: '  qq-code  ',
    }, {
        isUpdate: true,
        existingAccount: {
            id: '1005',
            platform: 'qq',
            uin: '3400470486',
            qq: '3400470486',
        },
    });

    assert.equal(result.error, '');
    assert.equal(result.payload.uin, '3400470486');
    assert.equal(result.payload.qq, '3400470486');
    assert.equal(result.payload.code, 'qq-code');
    assert.equal(result.payload.authTicket, '');
});
