#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ITEM_INFO_PATH = path.resolve(__dirname, '../../core/src/gameConfig/ItemInfo.json');
const DEFAULT_DEST_DIR = path.resolve(__dirname, '../../core/src/gameConfig/item_icons');
const DEFAULT_WECHAT_CACHE_DIR = path.join(process.env.HOME || '', 'Library/Containers/com.tencent.xinWeChat/Data/.wxapplet/packages');
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const WXAPKG_EXT_RE = /\.wxapkg$/i;
const EXT_PRIORITY = {
    png: 60,
    webp: 58,
    avif: 56,
    jpg: 54,
    jpeg: 54,
    svg: 30,
    gif: 20,
};

function printUsage() {
    console.log(`
用法:
  pnpm import:item-icons -- --source /path/to/extracted/assets
  pnpm import:item-icons -- --source /dir/a --source /dir/b --dry-run
  pnpm import:item-icons -- --wechat-cache --dry-run

参数:
  --source, -s   图标素材目录，可重复传入
  --wechat-cache 使用默认微信小程序缓存目录作为素材源
  --dest         导入目标目录，默认 core/src/gameConfig/item_icons
  --report       指定导入报告 JSON 输出路径
  --dry-run      只匹配不拷贝
  --force        覆盖已存在的目标文件
  --help, -h     显示帮助
`.trim());
}

function normalizeLookupKey(value) {
    return String(value || '')
        .replace(/\/spriteFrame$/i, '')
        .replace(IMAGE_EXT_RE, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function parseArgs(argv) {
    const options = {
        sourceDirs: [],
        destDir: DEFAULT_DEST_DIR,
        reportPath: '',
        dryRun: false,
        force: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--') {
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg === '--wechat-cache') {
            options.sourceDirs.push(DEFAULT_WECHAT_CACHE_DIR);
            continue;
        }
        if (arg === '--force') {
            options.force = true;
            continue;
        }
        if (arg === '--source' || arg === '-s') {
            const value = argv[i + 1];
            if (!value) throw new Error('--source 缺少目录参数');
            options.sourceDirs.push(...splitSourceArg(value));
            i += 1;
            continue;
        }
        if (arg.startsWith('--source=')) {
            options.sourceDirs.push(...splitSourceArg(arg.slice('--source='.length)));
            continue;
        }
        if (arg === '--dest') {
            const value = argv[i + 1];
            if (!value) throw new Error('--dest 缺少目录参数');
            options.destDir = path.resolve(value);
            i += 1;
            continue;
        }
        if (arg.startsWith('--dest=')) {
            options.destDir = path.resolve(arg.slice('--dest='.length));
            continue;
        }
        if (arg === '--report') {
            const value = argv[i + 1];
            if (!value) throw new Error('--report 缺少文件路径参数');
            options.reportPath = path.resolve(value);
            i += 1;
            continue;
        }
        if (arg.startsWith('--report=')) {
            options.reportPath = path.resolve(arg.slice('--report='.length));
            continue;
        }
        throw new Error(`未知参数: ${arg}`);
    }

    options.sourceDirs = [...new Set(options.sourceDirs.map(dir => path.resolve(dir)))];
    return options;
}

function splitSourceArg(value) {
    return String(value || '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => path.resolve(part));
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function walkImageFiles(dirPath, visitor) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkImageFiles(fullPath, visitor);
            continue;
        }
        if (!IMAGE_EXT_RE.test(entry.name)) continue;
        visitor(fullPath);
    }
}

function walkSourceFiles(dirPath, visitor) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walkSourceFiles(fullPath, visitor);
            continue;
        }
        visitor(fullPath);
    }
}

function getFileScoreFromRelPath(relPath, ext) {
    const depth = relPath.split(path.sep).length;
    const relSizePenalty = Math.min(relPath.length, 9999);
    return (EXT_PRIORITY[ext] || 0) * 100000 - depth * 1000 - relSizePenalty;
}

function getFileScore(filePath, sourceDir) {
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const relPath = path.relative(sourceDir, filePath);
    return getFileScoreFromRelPath(relPath, ext);
}

function storeBestCandidate(map, key, candidate) {
    if (!key) return;
    const existing = map.get(key);
    if (!existing || candidate.score > existing.score) {
        map.set(key, candidate);
    }
}

function indexCandidate(candidate, byId, byKey) {
    const ext = candidate.ext;
    const relWithoutExt = candidate.relPath.slice(0, -ext.length);
    const baseWithoutExt = path.basename(candidate.virtualName || candidate.relPath, ext);
    const relKey = normalizeLookupKey(relWithoutExt);
    const baseKey = normalizeLookupKey(baseWithoutExt);
    storeBestCandidate(byKey, relKey, candidate);
    storeBestCandidate(byKey, baseKey, candidate);

    const byIdMatch = baseWithoutExt.match(/^(\d+)(?:[_-].*)?$/);
    if (byIdMatch) {
        storeBestCandidate(byId, Number(byIdMatch[1]) || 0, candidate);
    }
}

function parseWxapkgEntries(filePath) {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 18 || buffer.readUInt8(0) !== 0xbe) {
        throw new Error(`不是有效的 wxapkg: ${filePath}`);
    }
    const fileCount = buffer.readUInt32BE(14);
    let offset = 18;
    const entries = [];
    for (let i = 0; i < fileCount; i += 1) {
        if (offset + 4 > buffer.length) {
            throw new Error(`wxapkg 文件索引已损坏: ${filePath}`);
        }
        const nameLen = buffer.readUInt32BE(offset);
        offset += 4;
        const name = buffer.toString('utf8', offset, offset + nameLen);
        offset += nameLen;
        const fileOffset = buffer.readUInt32BE(offset);
        offset += 4;
        const size = buffer.readUInt32BE(offset);
        offset += 4;
        entries.push({ name, fileOffset, size });
    }
    return entries;
}

function buildSourceIndex(sourceDirs) {
    const byId = new Map();
    const byKey = new Map();
    let filesScanned = 0;
    let packageFilesScanned = 0;
    let packageImageEntriesScanned = 0;

    for (const sourceDir of sourceDirs) {
        walkSourceFiles(sourceDir, (filePath) => {
            if (WXAPKG_EXT_RE.test(filePath)) {
                packageFilesScanned += 1;
                const packageRelPath = path.relative(sourceDir, filePath);
                let entries = [];
                try {
                    entries = parseWxapkgEntries(filePath);
                } catch (error) {
                    console.warn(`[import-item-icons] 跳过无法解析的 wxapkg: ${filePath} (${error.message})`);
                    return;
                }
                for (const entry of entries) {
                    if (!IMAGE_EXT_RE.test(entry.name)) continue;
                    packageImageEntriesScanned += 1;
                    const ext = path.extname(entry.name).toLowerCase();
                    const relPath = `${packageRelPath}::${entry.name.replace(/^\//, '')}`;
                    const candidate = {
                        sourceDir,
                        sourcePath: filePath,
                        relPath,
                        virtualName: path.posix.basename(entry.name),
                        ext,
                        kind: 'wxapkg',
                        packageEntry: entry,
                        score: getFileScoreFromRelPath(relPath, ext.slice(1)),
                    };
                    indexCandidate(candidate, byId, byKey);
                }
                return;
            }
            if (!IMAGE_EXT_RE.test(filePath)) {
                return;
            }
            filesScanned += 1;
            const ext = path.extname(filePath).toLowerCase();
            const relPath = path.relative(sourceDir, filePath);
            const candidate = {
                sourceDir,
                sourcePath: filePath,
                relPath,
                ext,
                kind: 'file',
                score: getFileScore(filePath, sourceDir),
            };
            indexCandidate(candidate, byId, byKey);
        });
    }

    return { byId, byKey, filesScanned, packageFilesScanned, packageImageEntriesScanned };
}

function readItemInfo() {
    return JSON.parse(fs.readFileSync(ITEM_INFO_PATH, 'utf8'))
        .map(entry => ({ ...entry, id: Number(entry.id) || 0 }))
        .filter(entry => entry.id > 0)
        .sort((a, b) => a.id - b.id);
}

function buildLookupCandidates(item) {
    const candidates = [];
    const seen = new Set();

    const pushCandidate = (matchType, key) => {
        const normalizedKey = typeof key === 'number' ? key : normalizeLookupKey(key);
        if (!normalizedKey || seen.has(`${matchType}:${normalizedKey}`)) return;
        seen.add(`${matchType}:${normalizedKey}`);
        candidates.push({ matchType, key: normalizedKey });
    };

    pushCandidate('item_id', item.id);

    for (const field of ['icon_res', 'asset_name']) {
        const rawValue = String(item[field] || '').trim();
        if (!rawValue) continue;
        pushCandidate(field, rawValue);

        const trimmed = rawValue.replace(/\/spriteFrame$/i, '').replace(IMAGE_EXT_RE, '');
        const baseName = path.posix.basename(trimmed);
        if (baseName && baseName !== trimmed) {
            pushCandidate(`${field}_basename`, baseName);
        }
    }

    return candidates;
}

function findBestMatch(item, sourceIndex) {
    const candidates = buildLookupCandidates(item);
    for (const candidate of candidates) {
        if (candidate.matchType === 'item_id') {
            const matched = sourceIndex.byId.get(candidate.key);
            if (matched) return { ...matched, matchType: candidate.matchType, matchKey: String(candidate.key) };
            continue;
        }
        const matched = sourceIndex.byKey.get(candidate.key);
        if (matched) return { ...matched, matchType: candidate.matchType, matchKey: String(candidate.key) };
    }
    return null;
}

function importIcons(items, sourceIndex, options) {
    if (!options.dryRun) {
        ensureDir(options.destDir);
    }

    const matched = [];
    const missing = [];
    const copied = [];
    const skipped = [];

    for (const item of items) {
        const match = findBestMatch(item, sourceIndex);
        if (!match) {
            missing.push({
                itemId: item.id,
                name: item.name || '',
                iconRes: item.icon_res || '',
                assetName: item.asset_name || '',
            });
            continue;
        }

        const destName = `${item.id}${match.ext}`;
        const destPath = path.join(options.destDir, destName);
        const record = {
            itemId: item.id,
            name: item.name || '',
            matchType: match.matchType,
            matchKey: match.matchKey,
            sourcePath: match.sourcePath,
            relativeSourcePath: match.relPath,
            destPath,
        };

        matched.push(record);

        if (fs.existsSync(destPath) && !options.force) {
            skipped.push({ ...record, reason: 'exists' });
            continue;
        }

        if (!options.dryRun) {
            if (match.kind === 'wxapkg') {
                const buffer = fs.readFileSync(match.sourcePath);
                const { fileOffset, size } = match.packageEntry;
                fs.writeFileSync(destPath, buffer.subarray(fileOffset, fileOffset + size));
            } else {
                fs.copyFileSync(match.sourcePath, destPath);
            }
        }
        copied.push(record);
    }

    return { matched, missing, copied, skipped };
}

function writeReport(reportPath, report) {
    ensureDir(path.dirname(reportPath));
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function printSummary(report, reportPath) {
    const { summary } = report;
    console.log(`已扫描素材文件: ${summary.filesScanned}`);
    console.log(`已扫描微信包: ${summary.packageFilesScanned}`);
    console.log(`微信包内图片条目: ${summary.packageImageEntriesScanned}`);
    console.log(`物品总数: ${summary.itemsTotal}`);
    console.log(`命中匹配: ${summary.matched}`);
    console.log(`实际导入: ${summary.copied}`);
    console.log(`跳过已存在: ${summary.skipped}`);
    console.log(`缺失图标: ${summary.missing}`);
    if (reportPath) {
        console.log(`导入报告: ${reportPath}`);
    }

    const preview = report.missing.slice(0, 12);
    if (preview.length > 0) {
        console.log('\n前 12 条缺失样例:');
        for (const item of preview) {
            console.log(`- #${item.itemId} ${item.name || '未命名'} | icon_res=${item.iconRes || '-'} | asset_name=${item.assetName || '-'}`);
        }
    }
}

function validateSourceDirs(sourceDirs) {
    if (sourceDirs.length === 0) {
        throw new Error('至少提供一个 --source 目录');
    }
    for (const dirPath of sourceDirs) {
        if (!fs.existsSync(dirPath)) {
            throw new Error(`素材目录不存在: ${dirPath}`);
        }
        if (!fs.statSync(dirPath).isDirectory()) {
            throw new Error(`素材路径不是目录: ${dirPath}`);
        }
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printUsage();
        return;
    }

    validateSourceDirs(options.sourceDirs);

    const items = readItemInfo();
    const sourceIndex = buildSourceIndex(options.sourceDirs);
    const result = importIcons(items, sourceIndex, options);
    const report = {
        generatedAt: new Date().toISOString(),
        dryRun: options.dryRun,
        force: options.force,
        sourceDirs: options.sourceDirs,
        destDir: options.destDir,
        summary: {
            filesScanned: sourceIndex.filesScanned,
            packageFilesScanned: sourceIndex.packageFilesScanned,
            packageImageEntriesScanned: sourceIndex.packageImageEntriesScanned,
            itemsTotal: items.length,
            matched: result.matched.length,
            copied: result.copied.length,
            skipped: result.skipped.length,
            missing: result.missing.length,
        },
        copied: result.copied,
        skipped: result.skipped,
        missing: result.missing,
    };

    const reportPath = options.reportPath || (!options.dryRun ? path.join(options.destDir, 'import-report.json') : '');
    if (reportPath) {
        writeReport(reportPath, report);
    }
    printSummary(report, reportPath);
}

try {
    main();
} catch (error) {
    console.error(`[import-item-icons] ${error.message}`);
    process.exit(1);
}
