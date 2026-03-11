const fs = require('node:fs');
const path = require('node:path');
const { getDataDir } = require('../config/runtime-paths');

function getDiagnosticsDir() {
    return path.join(getDataDir(), 'diagnostics');
}

function listQqFriendDiagnosticFiles(appid = '') {
    const dir = getDiagnosticsDir();
    if (!fs.existsSync(dir)) return [];
    const normalizedAppid = String(appid || '').trim();

    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isFile() && /^qq-friend-signals-\d+-\d{8}-\d{6}\.log$/.test(entry.name))
        .map((entry) => {
            const match = entry.name.match(/^qq-friend-signals-(\d+)-(\d{8}-\d{6})\.log$/);
            const fullPath = path.join(dir, entry.name);
            const stat = fs.statSync(fullPath);
            return {
                name: entry.name,
                path: fullPath,
                appid: match ? match[1] : '',
                stamp: match ? match[2] : '',
                size: stat.size,
                mtimeMs: stat.mtimeMs,
                modifiedAt: stat.mtime.toISOString(),
            };
        })
        .filter(item => !normalizedAppid || item.appid === normalizedAppid)
        .sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name));
}

function parseQqFriendSignals(content, meta = {}) {
    const text = String(content || '');
    const lines = text.split(/\r?\n/);
    const result = {
        file: meta.path || '',
        fileName: meta.name || '',
        appid: '',
        createdAt: '',
        qqVersion: '',
        miniProject: {
            appid: '',
            projectname: '',
            openDataContext: false,
        },
        authBridge: {
            authoritySynchronized: null,
            shareFriendshipScope: null,
            getAuthStatusSeen: false,
            setAuthStatusSeen: false,
        },
        hostFriendProtocol: {
            reqCount: 0,
            rspCount: 0,
            latestRequest: null,
            latestResponse: null,
        },
        redisCaches: [],
        summary: {
            protocolLikely: 'unknown',
            latestOnlineInfoCount: 0,
            cacheAccountCount: 0,
            cacheFriendCount: 0,
        },
    };

    for (const line of lines) {
        let match = null;

        match = line.match(/^appid=(\d+)/);
        if (match) {
            result.appid = match[1];
            continue;
        }

        match = line.match(/^created_at=(.+)$/);
        if (match) {
            result.createdAt = match[1].trim();
            continue;
        }

        match = line.match(/versionName=([^\s]+)/);
        if (match && !result.qqVersion) {
            result.qqVersion = match[1];
            continue;
        }

        match = line.match(/<boolean name="authority_synchronized" value="(true|false)"/);
        if (match) {
            result.authBridge.authoritySynchronized = match[1] === 'true';
            continue;
        }

        match = line.match(/<int name="scope\.userInfoAndShareFriendship" value="(\d+)"/);
        if (match) {
            result.authBridge.shareFriendshipScope = Number(match[1]);
            continue;
        }

        match = line.match(/"projectname": "([^"]+)"/);
        if (match) {
            result.miniProject.projectname = match[1];
            continue;
        }

        match = line.match(/"appid": "(\d+)"/);
        if (match && !result.miniProject.appid) {
            result.miniProject.appid = match[1];
            continue;
        }

        if (line.includes('"openDataContext":"openDataContext"')) {
            result.miniProject.openDataContext = true;
            continue;
        }

        if (line.includes('http://fakeapi.qq.com/get_auth_status')) {
            result.authBridge.getAuthStatusSeen = true;
            continue;
        }

        if (line.includes('http://fakeapi.qq.com/set_auth_status')) {
            result.authBridge.setAuthStatusSeen = true;
            continue;
        }

        match = line.match(/EncodeGetAllFrdReq selfUid:([^,]+), startIndex:(-?\d+), socialStyle:(-?\d+), socialSwitch:(-?\d+), hasLocal:(\d+)/);
        if (match) {
            result.hostFriendProtocol.reqCount += 1;
            result.hostFriendProtocol.latestRequest = {
                selfUid: match[1],
                startIndex: Number(match[2]),
                socialStyle: Number(match[3]),
                socialSwitch: Number(match[4]),
                hasLocal: Number(match[5]),
            };
            continue;
        }

        match = line.match(/DecodeGetAllFrdRsp online_info_count:(\d+)/);
        if (match) {
            result.hostFriendProtocol.rspCount += 1;
            result.hostFriendProtocol.latestResponse = {
                onlineInfoCount: Number(match[1]),
            };
            continue;
        }

        if (line.startsWith('{"key":"account:') && line.includes('friends_cache')) {
            try {
                const parsed = JSON.parse(line);
                result.redisCaches.push({
                    key: String(parsed.key || ''),
                    count: Number(parsed.count || 0),
                    preview: Array.isArray(parsed.preview) ? parsed.preview : [],
                });
            } catch {}
        }
    }

    result.summary.latestOnlineInfoCount = Number(result.hostFriendProtocol.latestResponse?.onlineInfoCount || 0);
    result.summary.cacheAccountCount = result.redisCaches.length;
    result.summary.cacheFriendCount = result.redisCaches.reduce((sum, item) => sum + Number(item.count || 0), 0);
    result.summary.protocolLikely = (
        result.hostFriendProtocol.reqCount > 0
        || result.authBridge.getAuthStatusSeen
        || result.authBridge.setAuthStatusSeen
        || result.miniProject.openDataContext
    )
        ? 'qq-host-bridge'
        : 'unknown';

    return result;
}

function readQqFriendDiagnosticsFile(filePath) {
    const fullPath = path.resolve(String(filePath || ''));
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return parseQqFriendSignals(content, {
        path: fullPath,
        name: path.basename(fullPath),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
    });
}

function readLatestQqFriendDiagnostics(appid = '') {
    const latest = listQqFriendDiagnosticFiles(appid)[0];
    if (!latest) return null;
    return {
        ...readQqFriendDiagnosticsFile(latest.path),
        source: {
            path: latest.path,
            name: latest.name,
            size: latest.size,
            modifiedAt: latest.modifiedAt,
        },
        availableFiles: listQqFriendDiagnosticFiles(appid).slice(0, 10).map(item => ({
            name: item.name,
            appid: item.appid,
            size: item.size,
            modifiedAt: item.modifiedAt,
        })),
    };
}

module.exports = {
    getDiagnosticsDir,
    listQqFriendDiagnosticFiles,
    parseQqFriendSignals,
    readQqFriendDiagnosticsFile,
    readLatestQqFriendDiagnostics,
};
