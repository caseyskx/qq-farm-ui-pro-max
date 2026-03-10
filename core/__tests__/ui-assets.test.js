const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    UI_BACKGROUND_MAX_AGE_MS,
    ITEM_ICON_CACHE_MAX_AGE_MS,
    cleanupUiBackgrounds,
    cleanupGeneratedItemIconCache,
} = require('../src/services/ui-assets');

function makeTempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function touchFile(filePath, mtimeMs) {
    fs.writeFileSync(filePath, 'fixture', 'utf8');
    const date = new Date(mtimeMs);
    fs.utimesSync(filePath, date, date);
}

test('cleanupUiBackgrounds keeps active and pending files while removing stale uploads', () => {
    const now = Date.now();
    const dirPath = makeTempDir('ui-backgrounds-');
    const active = path.join(dirPath, 'login-bg-active.png');
    const pending = path.join(dirPath, 'login-bg-pending.webp');
    const stale = path.join(dirPath, 'login-bg-stale.jpg');
    const recent = path.join(dirPath, 'login-bg-recent.png');

    touchFile(active, now - (UI_BACKGROUND_MAX_AGE_MS + 10_000));
    touchFile(pending, now - (UI_BACKGROUND_MAX_AGE_MS + 10_000));
    touchFile(stale, now - (UI_BACKGROUND_MAX_AGE_MS + 10_000));
    touchFile(recent, now - 60_000);

    const result = cleanupUiBackgrounds({
        dirPath,
        activeBackgroundUrl: '/ui-backgrounds/login-bg-active.png',
        pendingBackgroundUrls: ['/ui-backgrounds/login-bg-pending.webp'],
        now,
    });

    assert.deepEqual(result.deleted, ['login-bg-stale.jpg']);
    assert.equal(fs.existsSync(active), true);
    assert.equal(fs.existsSync(pending), true);
    assert.equal(fs.existsSync(recent), true);
    assert.equal(fs.existsSync(stale), false);

    fs.rmSync(dirPath, { recursive: true, force: true });
});

test('cleanupGeneratedItemIconCache removes invalid and expired generated icons', () => {
    const now = Date.now();
    const dirPath = makeTempDir('item-icons-');
    const recentValid = path.join(dirPath, 'item-1001.svg');
    const expiredValid = path.join(dirPath, 'item-1002.svg');
    const invalidId = path.join(dirPath, 'item-999999.svg');
    const ignored = path.join(dirPath, 'note.txt');

    touchFile(recentValid, now - 60_000);
    touchFile(expiredValid, now - (ITEM_ICON_CACHE_MAX_AGE_MS + 10_000));
    touchFile(invalidId, now - 60_000);
    touchFile(ignored, now - (ITEM_ICON_CACHE_MAX_AGE_MS + 10_000));

    const result = cleanupGeneratedItemIconCache({
        dirPath,
        validItemIds: [1001, 1002],
        now,
    });

    assert.deepEqual(result.deleted.sort(), ['item-1002.svg', 'item-999999.svg']);
    assert.equal(fs.existsSync(recentValid), true);
    assert.equal(fs.existsSync(expiredValid), false);
    assert.equal(fs.existsSync(invalidId), false);
    assert.equal(fs.existsSync(ignored), true);

    fs.rmSync(dirPath, { recursive: true, force: true });
});
