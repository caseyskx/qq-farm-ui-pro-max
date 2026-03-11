const {
    compareVersions,
    formatVersionTag,
    normalizeUrl,
} = require('./system-update-utils');
const {
    normalizeReleaseRecord,
    normalizeSystemUpdateConfig,
} = require('./system-update-config');

function buildGithubReleaseApiUrl(config) {
    const owner = String(config.githubOwner || '').trim();
    const repo = String(config.githubRepo || '').trim();
    if (!owner || !repo) return '';
    return `https://api.github.com/repos/${owner}/${repo}/releases${config.allowPreRelease ? '' : '/latest'}`;
}

function normalizeGithubRelease(input = {}) {
    return normalizeReleaseRecord({
        versionTag: input.tag_name,
        title: input.name,
        publishedAt: input.published_at,
        prerelease: input.prerelease,
        notes: input.body,
        url: input.html_url,
        assets: Array.isArray(input.assets)
            ? input.assets.map(asset => ({
                name: asset.name,
                url: asset.browser_download_url,
                size: asset.size,
            }))
            : [],
    });
}

function sortReleasesDescending(left, right) {
    const cmp = compareVersions(right && right.versionTag, left && left.versionTag);
    if (cmp !== 0) return cmp;
    return (Number(right && right.publishedAt) || 0) - (Number(left && left.publishedAt) || 0);
}

function normalizeManifestPayload(payload, source) {
    if (!payload || typeof payload !== 'object') {
        return {
            checkedAt: Date.now(),
            source,
            lastError: 'Empty update payload',
            latestRelease: null,
            releases: [],
        };
    }

    const rawLatest = payload.latestRelease || payload.latest || payload.release || null;
    const latestRelease = normalizeReleaseRecord({
        ...(rawLatest || {}),
        source,
    });

    const releaseCandidates = Array.isArray(payload.releases)
        ? payload.releases.map(entry => normalizeReleaseRecord({ ...(entry || {}), source })).filter(Boolean)
        : [];

    if (latestRelease) {
        releaseCandidates.push(latestRelease);
    }

    const releases = Array.from(
        new Map(
            releaseCandidates
                .sort(sortReleasesDescending)
                .map(item => [item.versionTag, item]),
        ).values(),
    );

    return {
        checkedAt: Date.now(),
        source,
        lastError: '',
        latestRelease: releases[0] || latestRelease || null,
        releases,
    };
}

async function fetchJson(url, options = {}) {
    const fetchImpl = options.fetchImpl || fetch;
    const timeoutMs = Math.max(1000, Number.parseInt(options.timeoutMs, 10) || 12000);
    const AbortControllerRef = options.AbortControllerRef || AbortController;
    const ctrl = new AbortControllerRef();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'User-Agent': 'qq-farm-bot-update-checker',
            },
            signal: ctrl.signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

function selectGithubReleases(payload, allowPreRelease) {
    const releases = Array.isArray(payload) ? payload : [];
    return releases
        .filter(item => item && !item.draft)
        .filter(item => allowPreRelease || !item.prerelease)
        .map(normalizeGithubRelease)
        .filter(Boolean)
        .sort(sortReleasesDescending);
}

async function loadLatestRelease(options = {}) {
    const config = normalizeSystemUpdateConfig(options.config || {});
    const fetchImpl = options.fetchImpl || fetch;
    const AbortControllerRef = options.AbortControllerRef || AbortController;

    const manifestUrl = normalizeUrl(config.manifestUrl);
    const releaseApiUrl = normalizeUrl(config.releaseApiUrl);
    const githubApiUrl = buildGithubReleaseApiUrl(config);

    if (config.provider === 'manifest_url' && manifestUrl) {
        const payload = await fetchJson(manifestUrl, { fetchImpl, AbortControllerRef });
        return normalizeManifestPayload(payload, manifestUrl);
    }

    if (config.provider === 'release_api_url' && releaseApiUrl) {
        const payload = await fetchJson(releaseApiUrl, { fetchImpl, AbortControllerRef });
        if (Array.isArray(payload)) {
            const releases = selectGithubReleases(payload, config.allowPreRelease);
            return {
                checkedAt: Date.now(),
                source: releaseApiUrl,
                lastError: '',
                latestRelease: releases[0] || null,
                releases,
            };
        }
        const latestRelease = normalizeGithubRelease(payload) || normalizeReleaseRecord({ ...(payload || {}), source: releaseApiUrl });
        return {
            checkedAt: Date.now(),
            source: releaseApiUrl,
            lastError: latestRelease ? '' : 'No release found in response',
            latestRelease,
            releases: latestRelease ? [latestRelease] : [],
        };
    }

    if (githubApiUrl) {
        const payload = await fetchJson(githubApiUrl, { fetchImpl, AbortControllerRef });
        if (Array.isArray(payload)) {
            const releases = selectGithubReleases(payload, config.allowPreRelease);
            return {
                checkedAt: Date.now(),
                source: githubApiUrl,
                lastError: '',
                latestRelease: releases[0] || null,
                releases,
            };
        }
        const latestRelease = normalizeGithubRelease(payload);
        return {
            checkedAt: Date.now(),
            source: githubApiUrl,
            lastError: latestRelease ? '' : 'No release found in GitHub response',
            latestRelease,
            releases: latestRelease ? [latestRelease] : [],
        };
    }

    throw new Error('System update source is not configured');
}

module.exports = {
    normalizeManifestPayload,
    normalizeGithubRelease,
    loadLatestRelease,
};
