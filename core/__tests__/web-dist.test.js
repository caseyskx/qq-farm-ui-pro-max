const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    archiveDefaultWebDistForRecovery,
    inspectWebDistState,
    rehydrateDefaultWebDistFromFallback,
    resolveBuildWebDistDir,
    resolveConfiguredWebDistDir,
    resolveDefaultWebDistDir,
    syncDefaultWebDistToFallback,
} = require('../src/utils/web-dist');

test('resolveConfiguredWebDistDir keeps absolute paths and resolves relative paths against the requested base directory', () => {
    const projectRoot = '/tmp/project-root';
    const webRoot = path.join(projectRoot, 'web');
    assert.equal(
        resolveConfiguredWebDistDir('/var/app/web/dist', projectRoot),
        '/var/app/web/dist',
    );
    assert.equal(
        resolveConfiguredWebDistDir('web/dist-runtime', projectRoot),
        path.join(projectRoot, 'web/dist-runtime'),
    );
    assert.equal(
        resolveConfiguredWebDistDir('dist-runtime', projectRoot, webRoot),
        path.join(projectRoot, 'web/dist-runtime'),
    );
});

test('resolveDefaultWebDistDir falls back to dist-runtime when dist is not writable and fallback build exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');

    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html></html>');
    fs.chmodSync(distDir, 0o555);

    try {
        assert.equal(resolveDefaultWebDistDir(tempRoot), fallbackDir);
    } finally {
        fs.chmodSync(distDir, 0o755);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('resolveDefaultWebDistDir keeps dist when fallback build does not exist', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-primary-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');

    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>');
    fs.chmodSync(distDir, 0o555);

    try {
        assert.equal(resolveDefaultWebDistDir(tempRoot), distDir);
    } finally {
        fs.chmodSync(distDir, 0o755);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('resolveDefaultWebDistDir prefers dist-runtime when dist has no built assets but fallback build exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-fallback-primary-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');

    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html></html>');

    try {
        assert.equal(resolveDefaultWebDistDir(tempRoot), fallbackDir);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('resolveDefaultWebDistDir falls back when dist contains read-only child files from a stale build', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-stale-child-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');
    const assetsDir = path.join(distDir, 'assets');
    const staleAsset = path.join(assetsDir, 'stale.js.gz');

    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>');
    fs.writeFileSync(staleAsset, 'old gzip payload');
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html></html>');
    fs.chmodSync(distDir, 0o777);
    fs.chmodSync(assetsDir, 0o777);
    fs.chmodSync(staleAsset, 0o444);

    try {
        assert.equal(resolveDefaultWebDistDir(tempRoot), fallbackDir);
    } finally {
        fs.chmodSync(staleAsset, 0o644);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('resolveBuildWebDistDir keeps dist when default directory is missing but fallback build exists', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-dist-missing-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');

    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html></html>');

    try {
        assert.equal(resolveBuildWebDistDir(tempRoot), distDir);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('resolveBuildWebDistDir falls back to dist-runtime when dist contains stale read-only child files', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-dist-stale-child-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');
    const assetsDir = path.join(distDir, 'assets');
    const staleAsset = path.join(assetsDir, 'stale.js.gz');

    fs.mkdirSync(assetsDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html></html>');
    fs.writeFileSync(staleAsset, 'old gzip payload');
    fs.chmodSync(distDir, 0o777);
    fs.chmodSync(assetsDir, 0o777);
    fs.chmodSync(staleAsset, 0o444);

    try {
        assert.equal(resolveBuildWebDistDir(tempRoot), fallbackDir);
    } finally {
        fs.chmodSync(staleAsset, 0o644);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('archiveDefaultWebDistForRecovery archives stale dist and restores build target to standard dist', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-dist-recover-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');
    const assetsDir = path.join(distDir, 'assets');
    const staleAsset = path.join(assetsDir, 'stale.js.gz');
    const archiveDir = path.join(tempRoot, 'archive', 'runtime-snapshots', 'recover-test');

    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>stale</html>');
    fs.writeFileSync(staleAsset, 'old gzip payload');
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html>fallback</html>');
    fs.chmodSync(distDir, 0o777);
    fs.chmodSync(assetsDir, 0o777);
    fs.chmodSync(staleAsset, 0o444);

    try {
        const recovery = archiveDefaultWebDistForRecovery({
            projectRoot: tempRoot,
            archiveDir,
            now: '2026-03-10T10:45:00.000Z',
        });

        assert.equal(recovery.recovered, true);
        assert.equal(recovery.reason, 'archived_stale_default_dist');
        assert.equal(fs.existsSync(distDir), false);
        assert.equal(
            fs.existsSync(path.join(archiveDir, 'dist-before-rebuild', 'index.html')),
            true,
        );
        assert.match(
            fs.readFileSync(path.join(archiveDir, 'README.txt'), 'utf8'),
            /web\/dist auto recovery snapshot/,
        );
        assert.equal(resolveBuildWebDistDir(tempRoot), distDir);
    } finally {
        const archivedAsset = path.join(archiveDir, 'dist-before-rebuild', 'assets', 'stale.js.gz');
        if (fs.existsSync(archivedAsset)) {
            fs.chmodSync(archivedAsset, 0o644);
        }
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('syncDefaultWebDistToFallback mirrors the latest default dist into fallback when default becomes unwritable', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-dist-sync-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');
    const assetsDir = path.join(distDir, 'assets');
    const staleAsset = path.join(assetsDir, 'stale.js.gz');

    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>latest</html>');
    fs.writeFileSync(path.join(distDir, 'app.js'), 'console.log("fresh")');
    fs.writeFileSync(staleAsset, 'old gzip payload');
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html>old-fallback</html>');
    fs.writeFileSync(path.join(fallbackDir, 'legacy.txt'), 'legacy');
    fs.chmodSync(distDir, 0o777);
    fs.chmodSync(assetsDir, 0o777);
    fs.chmodSync(staleAsset, 0o444);

    try {
        const syncResult = syncDefaultWebDistToFallback({
            projectRoot: tempRoot,
            now: '2026-03-10T11:00:00.000Z',
        });

        assert.equal(syncResult.synced, true);
        assert.equal(syncResult.reason, 'mirrored_default_dist_to_fallback');
        assert.equal(
            fs.readFileSync(path.join(fallbackDir, 'index.html'), 'utf8'),
            '<html>latest</html>',
        );
        assert.equal(
            fs.readFileSync(path.join(fallbackDir, 'app.js'), 'utf8'),
            'console.log("fresh")',
        );
        assert.equal(fs.existsSync(path.join(fallbackDir, 'legacy.txt')), false);
    } finally {
        fs.chmodSync(staleAsset, 0o644);
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('rehydrateDefaultWebDistFromFallback rebuilds standard dist from a healthy fallback snapshot', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-build-dist-rehydrate-'));
    const webDir = path.join(tempRoot, 'web');
    const distDir = path.join(webDir, 'dist');
    const fallbackDir = path.join(webDir, 'dist-runtime');
    const archiveDir = path.join(tempRoot, 'archive', 'runtime-snapshots', 'rehydrate-test');

    fs.mkdirSync(distDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>stale</html>');
    fs.writeFileSync(path.join(distDir, 'legacy.txt'), 'legacy payload');
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html>fallback</html>');
    fs.writeFileSync(path.join(fallbackDir, 'app.js'), 'console.log("fallback")');

    try {
        const result = rehydrateDefaultWebDistFromFallback({
            projectRoot: tempRoot,
            archiveDir,
            now: '2026-03-10T17:20:00.000Z',
        });

        assert.equal(result.rehydrated, true);
        assert.equal(result.reason, 'restored_default_dist_from_fallback');
        assert.equal(
            fs.readFileSync(path.join(distDir, 'index.html'), 'utf8'),
            '<html>fallback</html>',
        );
        assert.equal(
            fs.readFileSync(path.join(distDir, 'app.js'), 'utf8'),
            'console.log("fallback")',
        );
        assert.equal(fs.existsSync(path.join(distDir, 'legacy.txt')), false);
        assert.equal(
            fs.readFileSync(path.join(archiveDir, 'dist', 'index.html'), 'utf8'),
            '<html>stale</html>',
        );
        assert.match(
            fs.readFileSync(path.join(archiveDir, 'README.txt'), 'utf8'),
            /web\/dist rehydrate snapshot/,
        );
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('inspectWebDistState keeps runtime on fallback while build target stays on dist when default directory is missing', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-state-missing-default-'));
    const webDir = path.join(tempRoot, 'web');
    const fallbackDir = path.join(webDir, 'dist-runtime');

    fs.mkdirSync(fallbackDir, { recursive: true });
    fs.writeFileSync(path.join(fallbackDir, 'index.html'), '<html></html>');

    try {
        const state = inspectWebDistState({ projectRoot: tempRoot, configuredPath: '' });
        assert.equal(state.activeDirRelative, 'web/dist-runtime');
        assert.equal(state.activeSource, 'fallback');
        assert.equal(state.selectionReason, 'fallback_missing_default_assets');
        assert.equal(state.buildTargetDirRelative, 'web/dist');
        assert.equal(state.buildTargetSource, 'default');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});

test('inspectWebDistState reports configured WEB_DIST_DIR as both runtime and build target', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-dist-state-configured-'));
    const customDir = path.join(tempRoot, 'custom-web-output');

    fs.mkdirSync(customDir, { recursive: true });
    fs.writeFileSync(path.join(customDir, 'index.html'), '<html></html>');

    try {
        const state = inspectWebDistState({
            projectRoot: tempRoot,
            configuredPath: 'custom-web-output',
        });
        assert.equal(state.activeDirRelative, 'custom-web-output');
        assert.equal(state.activeSource, 'configured');
        assert.equal(state.selectionReason, 'configured_env');
        assert.equal(state.buildTargetDirRelative, 'custom-web-output');
        assert.equal(state.buildTargetSource, 'configured');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
});
