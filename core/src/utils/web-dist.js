const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_WEB_DIST_DIRNAME = 'dist';
const FALLBACK_WEB_DIST_DIRNAME = 'dist-runtime';

function getProjectRoot() {
    return path.join(__dirname, '../../..');
}

function getDefaultWebDistDir(projectRoot = getProjectRoot()) {
    return path.join(projectRoot, 'web', DEFAULT_WEB_DIST_DIRNAME);
}

function getFallbackWebDistDir(projectRoot = getProjectRoot()) {
    return path.join(projectRoot, 'web', FALLBACK_WEB_DIST_DIRNAME);
}

function resolveConfiguredWebDistDir(configuredPath, projectRoot = getProjectRoot(), relativeBaseDir = projectRoot) {
    if (!configuredPath) {
        return '';
    }

    return path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(relativeBaseDir || projectRoot, configuredPath);
}

function toProjectRelativePath(projectRoot, targetDir) {
    if (!targetDir) {
        return '';
    }
    const relativePath = path.relative(projectRoot, targetDir);
    if (!relativePath || relativePath === '') {
        return '.';
    }
    return relativePath.startsWith('..') ? targetDir : relativePath;
}

function hasBuiltWebAssets(targetDir) {
    if (!targetDir) {
        return false;
    }
    return fs.existsSync(path.join(targetDir, 'index.html'));
}

function isDirectoryWritable(targetDir) {
    if (!targetDir || !fs.existsSync(targetDir)) {
        return true;
    }

    try {
        fs.accessSync(targetDir, fs.constants.W_OK);
    } catch {
        return false;
    }

    const stack = [targetDir];
    while (stack.length > 0) {
        const current = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return false;
        }

        for (const entry of entries) {
            const entryPath = path.join(current, entry.name);
            try {
                fs.accessSync(entryPath, fs.constants.W_OK);
            } catch {
                return false;
            }

            if (entry.isDirectory()) {
                stack.push(entryPath);
            }
        }
    }

    return true;
}

function resolveDefaultWebDistDir(projectRoot = getProjectRoot()) {
    const defaultDir = getDefaultWebDistDir(projectRoot);
    const fallbackDir = getFallbackWebDistDir(projectRoot);
    const defaultHasAssets = hasBuiltWebAssets(defaultDir);
    const fallbackHasAssets = hasBuiltWebAssets(fallbackDir);

    if (!defaultHasAssets && fallbackHasAssets) {
        return fallbackDir;
    }

    if (!isDirectoryWritable(defaultDir) && fallbackHasAssets) {
        return fallbackDir;
    }

    return defaultDir;
}

function resolveBuildWebDistDir(projectRoot = getProjectRoot()) {
    const defaultDir = getDefaultWebDistDir(projectRoot);
    if (isDirectoryWritable(defaultDir)) {
        return defaultDir;
    }

    return getFallbackWebDistDir(projectRoot);
}

function formatArchiveTimestamp(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hour = String(value.getHours()).padStart(2, '0');
    const minute = String(value.getMinutes()).padStart(2, '0');
    const second = String(value.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

function archiveDefaultWebDistForRecovery(options = {}) {
    const projectRoot = options.projectRoot || getProjectRoot();
    const state = inspectWebDistState({ projectRoot, configuredPath: '' });
    if (state.selectionReason !== 'fallback_unwritable_default' || !state.fallbackHasAssets) {
        return {
            recovered: false,
            reason: 'not_needed',
            archiveDir: '',
            archiveDirRelative: '',
        };
    }

    if (!fs.existsSync(state.defaultDir)) {
        return {
            recovered: false,
            reason: 'default_missing',
            archiveDir: '',
            archiveDirRelative: '',
        };
    }

    const archiveDir = options.archiveDir
        ? path.resolve(projectRoot, options.archiveDir)
        : path.join(projectRoot, 'archive', 'runtime-snapshots', `${formatArchiveTimestamp(options.now)}-auto-web-dist-recover`);
    const archiveDistDir = path.join(archiveDir, 'dist-before-rebuild');

    try {
        fs.mkdirSync(archiveDir, { recursive: true });
        fs.renameSync(state.defaultDir, archiveDistDir);
        fs.writeFileSync(
            path.join(archiveDir, 'README.txt'),
            [
                'web/dist auto recovery snapshot',
                `- created_at: ${new Date(options.now || Date.now()).toISOString()}`,
                `- source: ${state.defaultDirRelative}`,
                '- reason: regular web build detected a stale dist tree that could not be overwritten',
                '- note: local archive only; ignored by git',
                '',
            ].join('\n'),
            'utf8',
        );
        return {
            recovered: true,
            reason: 'archived_stale_default_dist',
            archiveDir,
            archiveDirRelative: toProjectRelativePath(projectRoot, archiveDir),
        };
    } catch (error) {
        return {
            recovered: false,
            reason: 'archive_failed',
            archiveDir,
            archiveDirRelative: toProjectRelativePath(projectRoot, archiveDir),
            error,
        };
    }
}

function syncDefaultWebDistToFallback(options = {}) {
    const projectRoot = options.projectRoot || getProjectRoot();
    const state = inspectWebDistState({ projectRoot, configuredPath: '' });
    const syncTimestamp = formatArchiveTimestamp(options.now);
    const tempFallbackDir = `${state.fallbackDir}.sync-${syncTimestamp}`;
    const backupFallbackDir = `${state.fallbackDir}.bak-${syncTimestamp}`;
    let backupCreated = false;

    if (state.selectionReason !== 'fallback_unwritable_default' || !state.defaultHasAssets) {
        return {
            synced: false,
            reason: 'not_needed',
            sourceDir: state.defaultDir,
            sourceDirRelative: state.defaultDirRelative,
            targetDir: state.fallbackDir,
            targetDirRelative: state.fallbackDirRelative,
        };
    }

    try {
        fs.rmSync(tempFallbackDir, { recursive: true, force: true });
        fs.rmSync(backupFallbackDir, { recursive: true, force: true });
        fs.cpSync(state.defaultDir, tempFallbackDir, {
            recursive: true,
            force: true,
            dereference: true,
        });

        if (fs.existsSync(state.fallbackDir)) {
            fs.renameSync(state.fallbackDir, backupFallbackDir);
            backupCreated = true;
        }
        fs.renameSync(tempFallbackDir, state.fallbackDir);

        if (backupCreated) {
            fs.rmSync(backupFallbackDir, { recursive: true, force: true });
        }

        return {
            synced: true,
            reason: 'mirrored_default_dist_to_fallback',
            sourceDir: state.defaultDir,
            sourceDirRelative: state.defaultDirRelative,
            targetDir: state.fallbackDir,
            targetDirRelative: state.fallbackDirRelative,
        };
    } catch (error) {
        fs.rmSync(tempFallbackDir, { recursive: true, force: true });
        if (!fs.existsSync(state.fallbackDir) && backupCreated && fs.existsSync(backupFallbackDir)) {
            fs.renameSync(backupFallbackDir, state.fallbackDir);
            backupCreated = false;
        }
        if (backupCreated && fs.existsSync(backupFallbackDir)) {
            fs.rmSync(backupFallbackDir, { recursive: true, force: true });
        }

        return {
            synced: false,
            reason: 'sync_failed',
            error,
            sourceDir: state.defaultDir,
            sourceDirRelative: state.defaultDirRelative,
            targetDir: state.fallbackDir,
            targetDirRelative: state.fallbackDirRelative,
        };
    }
}

function rehydrateDefaultWebDistFromFallback(options = {}) {
    const projectRoot = options.projectRoot || getProjectRoot();
    const state = inspectWebDistState({ projectRoot, configuredPath: '' });
    const rehydrateTimestamp = formatArchiveTimestamp(options.now);
    const tempDefaultDir = `${state.defaultDir}.rehydrate-${rehydrateTimestamp}`;
    const archiveDir = options.archiveDir
        ? path.resolve(projectRoot, options.archiveDir)
        : path.join(projectRoot, 'archive', 'runtime-snapshots', `${rehydrateTimestamp}-web-dist-rehydrate-from-fallback`);
    const archiveDistDir = path.join(archiveDir, 'dist');
    let archivedDefault = false;

    if (!state.fallbackHasAssets) {
        return {
            rehydrated: false,
            reason: 'fallback_missing_assets',
            sourceDir: state.fallbackDir,
            sourceDirRelative: state.fallbackDirRelative,
            targetDir: state.defaultDir,
            targetDirRelative: state.defaultDirRelative,
            archiveDir: '',
            archiveDirRelative: '',
        };
    }

    try {
        fs.rmSync(tempDefaultDir, { recursive: true, force: true });
        fs.cpSync(state.fallbackDir, tempDefaultDir, {
            recursive: true,
            force: true,
            dereference: true,
        });

        fs.mkdirSync(path.dirname(state.defaultDir), { recursive: true });
        if (fs.existsSync(state.defaultDir)) {
            fs.mkdirSync(archiveDir, { recursive: true });
            fs.renameSync(state.defaultDir, archiveDistDir);
            archivedDefault = true;
            fs.writeFileSync(
                path.join(archiveDir, 'README.txt'),
                [
                    'web/dist rehydrate snapshot',
                    `- created_at: ${new Date(options.now || Date.now()).toISOString()}`,
                    `- source: ${state.defaultDirRelative}`,
                    `- restore_from: ${state.fallbackDirRelative}`,
                    '- reason: rebuild standard dist from a healthy fallback runtime bundle',
                    '- note: local archive only; ignored by git',
                    '',
                ].join('\n'),
                'utf8',
            );
        }

        fs.renameSync(tempDefaultDir, state.defaultDir);

        return {
            rehydrated: true,
            reason: 'restored_default_dist_from_fallback',
            sourceDir: state.fallbackDir,
            sourceDirRelative: state.fallbackDirRelative,
            targetDir: state.defaultDir,
            targetDirRelative: state.defaultDirRelative,
            archiveDir: archivedDefault ? archiveDir : '',
            archiveDirRelative: archivedDefault ? toProjectRelativePath(projectRoot, archiveDir) : '',
        };
    } catch (error) {
        fs.rmSync(tempDefaultDir, { recursive: true, force: true });
        if (!fs.existsSync(state.defaultDir) && archivedDefault && fs.existsSync(archiveDistDir)) {
            fs.renameSync(archiveDistDir, state.defaultDir);
        }

        return {
            rehydrated: false,
            reason: 'rehydrate_failed',
            error,
            sourceDir: state.fallbackDir,
            sourceDirRelative: state.fallbackDirRelative,
            targetDir: state.defaultDir,
            targetDirRelative: state.defaultDirRelative,
            archiveDir: archivedDefault ? archiveDir : '',
            archiveDirRelative: archivedDefault ? toProjectRelativePath(projectRoot, archiveDir) : '',
        };
    }
}

function inspectWebDistState(options = {}) {
    const projectRoot = options.projectRoot || getProjectRoot();
    const configuredValue = options.configuredPath !== undefined
        ? options.configuredPath
        : process.env.WEB_DIST_DIR;
    const configuredDir = resolveConfiguredWebDistDir(configuredValue, projectRoot);
    const defaultDir = getDefaultWebDistDir(projectRoot);
    const fallbackDir = getFallbackWebDistDir(projectRoot);
    const defaultHasAssets = hasBuiltWebAssets(defaultDir);
    const fallbackHasAssets = hasBuiltWebAssets(fallbackDir);
    const defaultWritable = isDirectoryWritable(defaultDir);
    const fallbackWritable = isDirectoryWritable(fallbackDir);

    let activeDir = defaultDir;
    let activeSource = 'default';
    let selectionReason = defaultHasAssets
        ? 'default_ready'
        : 'default_selected_without_assets';
    let selectionReasonLabel = defaultHasAssets
        ? '默认目录存在有效产物'
        : '默认目录将作为活动目录，等待下一次构建';

    if (configuredDir) {
        activeDir = configuredDir;
        activeSource = 'configured';
        selectionReason = 'configured_env';
        selectionReasonLabel = '环境变量 WEB_DIST_DIR 显式指定';
    } else if (!defaultHasAssets && fallbackHasAssets) {
        activeDir = fallbackDir;
        activeSource = 'fallback';
        selectionReason = 'fallback_missing_default_assets';
        selectionReasonLabel = '默认目录缺少有效产物，回退目录可用';
    } else if (!defaultWritable && fallbackHasAssets) {
        activeDir = fallbackDir;
        activeSource = 'fallback';
        selectionReason = 'fallback_unwritable_default';
        selectionReasonLabel = '默认目录不可覆盖，回退目录可用';
    }

    const buildTargetDir = configuredDir || resolveBuildWebDistDir(projectRoot);
    let buildTargetSource = 'default';
    if (configuredDir) {
        buildTargetSource = 'configured';
    } else if (buildTargetDir === fallbackDir) {
        buildTargetSource = 'fallback';
    }

    return {
        projectRoot,
        configuredDir,
        configuredDirRelative: toProjectRelativePath(projectRoot, configuredDir),
        activeDir,
        activeDirRelative: toProjectRelativePath(projectRoot, activeDir),
        activeSource,
        selectionReason,
        selectionReasonLabel,
        buildTargetDir,
        buildTargetDirRelative: toProjectRelativePath(projectRoot, buildTargetDir),
        buildTargetSource,
        defaultDir,
        defaultDirRelative: toProjectRelativePath(projectRoot, defaultDir),
        defaultHasAssets,
        defaultWritable,
        fallbackDir,
        fallbackDirRelative: toProjectRelativePath(projectRoot, fallbackDir),
        fallbackHasAssets,
        fallbackWritable,
    };
}

function resolveWebDistDir() {
    const projectRoot = getProjectRoot();
    const configuredPath = resolveConfiguredWebDistDir(process.env.WEB_DIST_DIR, projectRoot);
    if (configuredPath) {
        return configuredPath;
    }

    return resolveDefaultWebDistDir(projectRoot);
}

function resolveWebDistPath(...segments) {
    return path.join(resolveWebDistDir(), ...segments);
}

module.exports = {
    DEFAULT_WEB_DIST_DIRNAME,
    FALLBACK_WEB_DIST_DIRNAME,
    archiveDefaultWebDistForRecovery,
    getDefaultWebDistDir,
    getFallbackWebDistDir,
    getProjectRoot,
    hasBuiltWebAssets,
    inspectWebDistState,
    isDirectoryWritable,
    rehydrateDefaultWebDistFromFallback,
    resolveBuildWebDistDir,
    resolveConfiguredWebDistDir,
    resolveDefaultWebDistDir,
    resolveWebDistDir,
    resolveWebDistPath,
    syncDefaultWebDistToFallback,
};
