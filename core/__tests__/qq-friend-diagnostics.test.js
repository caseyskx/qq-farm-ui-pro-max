const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const diagnosticsModulePath = require.resolve('../src/services/qq-friend-diagnostics');

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

test('parseQqFriendSignals extracts QQ host bridge and cache summary', () => {
    delete require.cache[diagnosticsModulePath];
    const { parseQqFriendSignals } = require(diagnosticsModulePath);
    const parsed = parseQqFriendSignals(`
appid=1112386029
created_at=2026-03-11 00:25:11 +0800
    versionName=9.2.70
    <boolean name="authority_synchronized" value="true" />
    <int name="scope.userInfoAndShareFriendship" value="2" />
    "appid": "1112386029",
    "projectname": "client_1.7.0.5",
{"deviceOrientation":"portrait","openDataContext":"openDataContext"}
03-10 23:27:28.467 I NTKernel: EncodeGetAllFrdReq selfUid:u_xxx, startIndex:0, socialStyle:0, socialSwitch:0, hasLocal:1
03-10 23:27:28.612 I NTKernel: DecodeGetAllFrdRsp online_info_count:5
http://fakeapi.qq.com/get_auth_status
http://fakeapi.qq.com/set_auth_status
{"key":"account:1005:friends_cache","count":2,"preview":[{"gid":1,"name":"A","uin":""}]}
{"key":"account:30:friends_cache","count":1,"preview":[{"gid":2,"name":"B","uin":""}]}
`);

    assert.equal(parsed.appid, '1112386029');
    assert.equal(parsed.qqVersion, '9.2.70');
    assert.equal(parsed.authBridge.authoritySynchronized, true);
    assert.equal(parsed.authBridge.shareFriendshipScope, 2);
    assert.equal(parsed.miniProject.projectname, 'client_1.7.0.5');
    assert.equal(parsed.miniProject.openDataContext, true);
    assert.equal(parsed.hostFriendProtocol.reqCount, 1);
    assert.equal(parsed.hostFriendProtocol.latestResponse.onlineInfoCount, 5);
    assert.equal(parsed.summary.protocolLikely, 'qq-host-bridge');
    assert.equal(parsed.summary.cacheAccountCount, 2);
    assert.equal(parsed.summary.cacheFriendCount, 3);
});

test('readLatestQqFriendDiagnostics reads newest matching diagnostics file from data dir', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qq-friend-diag-'));
    const dataDir = path.join(tempRoot, 'data');
    const diagnosticsDir = path.join(dataDir, 'diagnostics');
    fs.mkdirSync(diagnosticsDir, { recursive: true });

    const olderFile = path.join(diagnosticsDir, 'qq-friend-signals-1112386029-20260311-000000.log');
    const newerFile = path.join(diagnosticsDir, 'qq-friend-signals-1112386029-20260311-000100.log');
    fs.writeFileSync(olderFile, 'appid=1112386029\nversionName=9.2.60\n');
    fs.writeFileSync(newerFile, 'appid=1112386029\nversionName=9.2.70\n');

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, {
        getDataDir() {
            return dataDir;
        },
    });

    try {
        delete require.cache[diagnosticsModulePath];
        const { readLatestQqFriendDiagnostics } = require(diagnosticsModulePath);
        const data = readLatestQqFriendDiagnostics('1112386029');

        assert.ok(data);
        assert.equal(data.qqVersion, '9.2.70');
        assert.equal(data.source.name, 'qq-friend-signals-1112386029-20260311-000100.log');
        assert.equal(data.availableFiles.length, 2);
    } finally {
        delete require.cache[diagnosticsModulePath];
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
