function normalizeVersion(value, fallback = '') {
    const text = String(value || '').trim();
    if (!text) {
        return fallback;
    }
    const withoutPrefix = text.replace(/^v/i, '');
    const match = withoutPrefix.match(/\d+(?:\.\d+)*/);
    return match ? match[0] : withoutPrefix;
}

function formatVersionTag(value, fallback = '') {
    const text = String(value || '').trim();
    if (!text) {
        return fallback;
    }
    if (/^v?\d+(?:\.\d+)*$/i.test(text)) {
        return `v${text.replace(/^v/i, '')}`;
    }
    return text;
}

function compareVersions(left, right) {
    const l = normalizeVersion(left, '');
    const r = normalizeVersion(right, '');
    if (!l && !r) return 0;
    if (!l) return -1;
    if (!r) return 1;

    const leftParts = l.split('.').map(part => Number.parseInt(part, 10) || 0);
    const rightParts = r.split('.').map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
        const a = leftParts[index] || 0;
        const b = rightParts[index] || 0;
        if (a > b) return 1;
        if (a < b) return -1;
    }
    return 0;
}

function buildVersionState(currentVersion, latestVersion) {
    const current = formatVersionTag(currentVersion, '');
    const latest = formatVersionTag(latestVersion, '');
    const cmp = compareVersions(latest, current);
    return {
        currentVersion: current,
        latestVersion: latest,
        hasUpdate: cmp > 0,
        comparison: cmp,
    };
}

function normalizeUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    return /^https?:\/\//i.test(text) ? text : '';
}

function toTimestamp(value, fallback = 0) {
    if (!value) return fallback;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const ts = new Date(value).getTime();
    return Number.isFinite(ts) ? ts : fallback;
}

function parseJsonSafely(raw, fallback = null) {
    if (raw === undefined || raw === null) {
        return fallback;
    }
    if (typeof raw === 'object') {
        return raw;
    }
    const text = String(raw || '').trim();
    if (!text) {
        return fallback;
    }
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

module.exports = {
    normalizeVersion,
    formatVersionTag,
    compareVersions,
    buildVersionState,
    normalizeUrl,
    toTimestamp,
    parseJsonSafely,
};
