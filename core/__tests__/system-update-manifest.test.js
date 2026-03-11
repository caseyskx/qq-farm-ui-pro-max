const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeManifestPayload,
    normalizeGithubRelease,
} = require('../src/services/system-update-manifest');
const {
    buildVersionState,
    formatVersionTag,
} = require('../src/services/system-update-utils');

test('normalize manifest payload picks latest release and normalizes tag', () => {
    const payload = {
        releases: [
            { version: '4.5.18', title: 'stable 18', publishedAt: 1000 },
            { version: 'v4.5.20', title: 'stable 20', publishedAt: 2000 },
        ],
    };

    const normalized = normalizeManifestPayload(payload, 'https://example.com/manifest.json');

    assert.equal(normalized.latestRelease.versionTag, 'v4.5.20');
    assert.equal(normalized.releases.length, 2);
    assert.equal(normalized.releases[0].source, 'https://example.com/manifest.json');
});

test('normalize github release keeps assets and prerelease flag', () => {
    const normalized = normalizeGithubRelease({
        tag_name: 'v4.5.19',
        name: 'Release 4.5.19',
        prerelease: true,
        body: 'notes',
        html_url: 'https://github.com/demo/repo/releases/tag/v4.5.19',
        assets: [
            {
                name: 'bundle.tar.gz',
                browser_download_url: 'https://example.com/bundle.tar.gz',
                size: 123,
            },
        ],
    });

    assert.equal(normalized.versionTag, 'v4.5.19');
    assert.equal(normalized.prerelease, true);
    assert.deepEqual(normalized.assets, [{
        name: 'bundle.tar.gz',
        url: 'https://example.com/bundle.tar.gz',
        size: 123,
    }]);
});

test('buildVersionState detects when latest version is newer', () => {
    const state = buildVersionState('v4.5.18', '4.5.19');
    assert.equal(state.currentVersion, 'v4.5.18');
    assert.equal(state.latestVersion, 'v4.5.19');
    assert.equal(state.hasUpdate, true);
    assert.equal(state.comparison, 1);
});

test('formatVersionTag preserves custom image tags while still normalizing semver tags', () => {
    assert.equal(formatVersionTag('test-cluster-v5'), 'test-cluster-v5');
    assert.equal(formatVersionTag('v4.5.18'), 'v4.5.18');
    assert.equal(formatVersionTag('4.5.19'), 'v4.5.19');
});
