const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const gameConfigModulePath = require.resolve('../src/config/gameConfig');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const uiAssetsModulePath = require.resolve('../src/services/ui-assets');

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

test('requiring gameConfig does not resolve resource paths eagerly', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-config-runtime-side-effects-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, {
        getResourcePath() {
            throw new Error('should not resolve gameConfig resources during require');
        },
        ensureAssetCacheDir(...segments) {
            const dir = path.join(tempRoot, 'asset-cache', ...segments);
            fs.mkdirSync(dir, { recursive: true });
            return dir;
        },
    });
    const restoreUiAssets = mockModule(uiAssetsModulePath, {
        cleanupGeneratedItemIconCache() {
            return { deleted: [] };
        },
    });

    try {
        delete require.cache[gameConfigModulePath];
        const gameConfig = require(gameConfigModulePath);
        assert.equal(typeof gameConfig.getItemImageById, 'function');
    } finally {
        delete require.cache[gameConfigModulePath];
        restoreUiAssets();
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
