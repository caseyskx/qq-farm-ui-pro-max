const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

test('requiring gameConfig does not print successful load noise by default', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'game-config-noise-'));
    const restoreRuntimePaths = mockModule(runtimePathsModulePath, {
        getResourcePath(...segments) {
            return path.join(__dirname, '../src', ...segments);
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
    const warnCalls = [];
    const previousWarn = console.warn;
    console.warn = (...args) => warnCalls.push(args.map(item => String(item)).join(' '));

    try {
        delete require.cache[gameConfigModulePath];
        require(gameConfigModulePath);

        const successfulLoadMessages = warnCalls.filter(message => message.includes('[配置] 已加载'));
        assert.deepEqual(successfulLoadMessages, []);
    } finally {
        console.warn = previousWarn;
        delete require.cache[gameConfigModulePath];
        restoreUiAssets();
        restoreRuntimePaths();
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
