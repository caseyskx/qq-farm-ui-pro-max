const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeReleaseRecord,
    normalizeSystemUpdateReleaseCache,
} = require('../src/services/system-update-config');

test('normalizeReleaseRecord returns null for nullish input', () => {
    assert.equal(normalizeReleaseRecord(null), null);
    assert.equal(normalizeReleaseRecord(undefined), null);
});

test('normalizeSystemUpdateReleaseCache tolerates null latest release', () => {
    const cache = normalizeSystemUpdateReleaseCache({
        checkedAt: 0,
        latestRelease: null,
        releases: [],
    });

    assert.equal(cache.latestRelease, null);
    assert.deepEqual(cache.releases, []);
    assert.equal(cache.lastError, '');
});
