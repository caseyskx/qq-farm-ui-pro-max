const { getPool } = require('./mysql-db');
const { createModuleLogger } = require('./logger');

const logger = createModuleLogger('account-bag-preferences');

const MAX_PURCHASE_MEMORY_ENTRIES = 200;
const MAX_ACTIVITY_HISTORY_ENTRIES = 30;
const MAX_ACTIVITY_DETAIL_ENTRIES = 8;
const MAX_ACTIVITY_ITEM_IDS = 12;

function clampInteger(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function normalizeShortText(value, maxLength = 160) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizePurchaseMemory(input) {
    const source = (input && typeof input === 'object') ? input : {};
    const entries = Object.entries(source)
        .filter(([key]) => normalizeShortText(key, 160))
        .slice(0, MAX_PURCHASE_MEMORY_ENTRIES)
        .map(([key, row]) => {
            const safeKey = normalizeShortText(key, 160);
            const safeRow = (row && typeof row === 'object') ? row : {};
            return [
                safeKey,
                {
                    count: clampInteger(safeRow.count, 0, 0, 999999),
                    lastPurchasedAt: clampInteger(safeRow.lastPurchasedAt, 0, 0, 9999999999999),
                    name: normalizeShortText(safeRow.name, 120),
                },
            ];
        })
        .filter(([, row]) => row.count > 0 || row.lastPurchasedAt > 0 || row.name);

    return Object.fromEntries(entries);
}

function normalizeActivityDetails(details) {
    if (!Array.isArray(details)) return [];
    return details
        .slice(0, MAX_ACTIVITY_DETAIL_ENTRIES)
        .map((detail) => {
            const safeDetail = (detail && typeof detail === 'object') ? detail : {};
            return {
                id: clampInteger(safeDetail.id, 0, 0),
                name: normalizeShortText(safeDetail.name, 120),
                count: clampInteger(safeDetail.count, 0, 0, 999999),
                image: normalizeShortText(safeDetail.image, 2048),
                meta: normalizeShortText(safeDetail.meta, 240),
            };
        })
        .filter((detail) => detail.id > 0 || detail.name || detail.count > 0 || detail.image || detail.meta);
}

function normalizeActivityHistory(input) {
    if (!Array.isArray(input)) return [];
    return input
        .slice(0, MAX_ACTIVITY_HISTORY_ENTRIES)
        .map((entry) => {
            const safeEntry = (entry && typeof entry === 'object') ? entry : {};
            return {
                ts: clampInteger(safeEntry.ts, Date.now(), 0, 9999999999999),
                type: normalizeShortText(safeEntry.type, 32),
                sourceType: normalizeShortText(safeEntry.sourceType, 32),
                entryKey: normalizeShortText(safeEntry.entryKey, 160),
                goodsId: clampInteger(safeEntry.goodsId, 0, 0),
                goodsName: normalizeShortText(safeEntry.goodsName, 120),
                itemId: clampInteger(safeEntry.itemId, 0, 0),
                itemName: normalizeShortText(safeEntry.itemName, 120),
                interactionType: normalizeShortText(safeEntry.interactionType, 64),
                title: normalizeShortText(safeEntry.title, 160),
                summary: normalizeShortText(safeEntry.summary, 240),
                count: clampInteger(safeEntry.count, 0, 0, 999999),
                soldCount: clampInteger(safeEntry.soldCount, 0, 0, 999999),
                soldKinds: clampInteger(safeEntry.soldKinds, 0, 0, 999999),
                goldEarned: clampInteger(safeEntry.goldEarned, 0, 0, 999999999),
                sectionLabel: normalizeShortText(safeEntry.sectionLabel, 120),
                priceLabel: normalizeShortText(safeEntry.priceLabel, 120),
                itemIds: Array.isArray(safeEntry.itemIds)
                    ? safeEntry.itemIds
                        .slice(0, MAX_ACTIVITY_ITEM_IDS)
                        .map((itemId) => clampInteger(itemId, 0, 0))
                        .filter((itemId) => itemId > 0)
                    : [],
                landIds: Array.isArray(safeEntry.landIds)
                    ? safeEntry.landIds
                        .slice(0, MAX_ACTIVITY_ITEM_IDS)
                        .map((landId) => clampInteger(landId, 0, 0))
                        .filter((landId) => landId > 0)
                    : [],
                details: normalizeActivityDetails(safeEntry.details),
            };
        })
        .filter((entry) => entry.ts > 0 && (entry.type || entry.title || entry.summary || entry.itemId > 0 || entry.goodsId > 0));
}

function parseJsonColumn(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function normalizeAccountBagPreferences(input = {}) {
    return {
        purchaseMemory: normalizePurchaseMemory(input.purchaseMemory),
        activityHistory: normalizeActivityHistory(input.activityHistory),
    };
}

async function getAccountBagPreferences(accountId) {
    const normalizedAccountId = String(accountId || '').trim();
    const pool = getPool();
    if (!normalizedAccountId || !pool) return null;

    try {
        const [rows] = await pool.query(
            `SELECT purchase_memory, activity_history
             FROM account_bag_preferences
             WHERE account_id = ?
             LIMIT 1`,
            [normalizedAccountId],
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;
        return normalizeAccountBagPreferences({
            purchaseMemory: parseJsonColumn(row.purchase_memory, {}),
            activityHistory: parseJsonColumn(row.activity_history, []),
        });
    } catch (err) {
        logger.warn(`读取账号背包偏好失败 [${normalizedAccountId}]: ${err.message}`);
        return null;
    }
}

async function saveAccountBagPreferences(accountId, input = {}) {
    const normalizedAccountId = String(accountId || '').trim();
    const pool = getPool();
    if (!normalizedAccountId || !pool) {
        throw new Error('账号背包偏好保存失败：缺少账号 ID 或数据库连接');
    }

    const nextPreferences = normalizeAccountBagPreferences(input);
    const [result] = await pool.query(
        `INSERT INTO account_bag_preferences (
            account_id, purchase_memory, activity_history
        )
        SELECT id, ?, ?
        FROM accounts
        WHERE id = ?
        ON DUPLICATE KEY UPDATE
            purchase_memory = VALUES(purchase_memory),
            activity_history = VALUES(activity_history)`,
        [
            JSON.stringify(nextPreferences.purchaseMemory),
            JSON.stringify(nextPreferences.activityHistory),
            normalizedAccountId,
        ],
    );

    if (!result || result.affectedRows === 0) {
        throw new Error(`账号不存在或背包偏好保存失败: ${normalizedAccountId}`);
    }

    return nextPreferences;
}

module.exports = {
    MAX_PURCHASE_MEMORY_ENTRIES,
    MAX_ACTIVITY_HISTORY_ENTRIES,
    normalizePurchaseMemory,
    normalizeActivityHistory,
    normalizeAccountBagPreferences,
    getAccountBagPreferences,
    saveAccountBagPreferences,
};
