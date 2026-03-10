const fs = require('node:fs');
const path = require('node:path');

const UI_BACKGROUND_PREFIX = '/ui-backgrounds/';
const UI_BACKGROUND_FILE_RE = /^login-bg-[a-z0-9-]+\.(png|jpe?g|webp)$/i;
const GENERATED_ITEM_ICON_FILE_RE = /^item-(\d+)\.svg$/i;

const UI_BACKGROUND_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const ITEM_ICON_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function toSafeFileName(url, prefix) {
    const text = String(url || '').trim();
    if (!text.startsWith(prefix)) return '';
    const rawName = decodeURIComponent(text.slice(prefix.length));
    if (!rawName || rawName.includes('/') || rawName.includes('\\')) return '';
    return rawName;
}

function cleanupUiBackgrounds(options = {}) {
    const dirPath = String(options.dirPath || '').trim();
    if (!dirPath || !fs.existsSync(dirPath)) {
        return { scanned: 0, deleted: [] };
    }

    const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
    const maxAgeMs = Number.isFinite(options.maxAgeMs) ? Number(options.maxAgeMs) : UI_BACKGROUND_MAX_AGE_MS;
    const keepFiles = new Set([
        toSafeFileName(options.activeBackgroundUrl, UI_BACKGROUND_PREFIX),
        ...(Array.isArray(options.pendingBackgroundUrls) ? options.pendingBackgroundUrls : [])
            .map(url => toSafeFileName(url, UI_BACKGROUND_PREFIX)),
    ].filter(Boolean));

    const deleted = [];
    let scanned = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (!entry.isFile() || !UI_BACKGROUND_FILE_RE.test(entry.name)) continue;
        scanned += 1;
        if (keepFiles.has(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);
        const stat = fs.statSync(fullPath);
        if ((now - stat.mtimeMs) < maxAgeMs) continue;
        fs.unlinkSync(fullPath);
        deleted.push(entry.name);
    }

    return { scanned, deleted };
}

function cleanupGeneratedItemIconCache(options = {}) {
    const dirPath = String(options.dirPath || '').trim();
    if (!dirPath || !fs.existsSync(dirPath)) {
        return { scanned: 0, deleted: [] };
    }

    const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
    const maxAgeMs = Number.isFinite(options.maxAgeMs) ? Number(options.maxAgeMs) : ITEM_ICON_CACHE_MAX_AGE_MS;
    const validItemIds = new Set(
        (Array.isArray(options.validItemIds) ? options.validItemIds : [])
            .map(id => Number(id) || 0)
            .filter(id => id > 0),
    );

    const deleted = [];
    let scanned = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const matched = entry.name.match(GENERATED_ITEM_ICON_FILE_RE);
        if (!matched) continue;
        scanned += 1;

        const itemId = Number(matched[1]) || 0;
        const fullPath = path.join(dirPath, entry.name);
        const stat = fs.statSync(fullPath);
        const isExpired = (now - stat.mtimeMs) >= maxAgeMs;
        const isInvalid = itemId <= 0 || !validItemIds.has(itemId);

        if (!isExpired && !isInvalid) continue;
        fs.unlinkSync(fullPath);
        deleted.push(entry.name);
    }

    return { scanned, deleted };
}

module.exports = {
    UI_BACKGROUND_PREFIX,
    UI_BACKGROUND_MAX_AGE_MS,
    ITEM_ICON_CACHE_MAX_AGE_MS,
    cleanupUiBackgrounds,
    cleanupGeneratedItemIconCache,
};
