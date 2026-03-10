const userStore = require('../models/user-store');
const { createModuleLogger } = require('../services/logger');

const cardsControllerLogger = createModuleLogger('cards-controller');

function logCardsControllerError(message, error, meta = {}) {
    cardsControllerLogger.error(message, {
        ...meta,
        error: error && error.message ? error.message : String(error || ''),
    });
}

/**
 * 卡密管理控制器
 * 处理卡密相关的 HTTP 请求
 */

/**
 * 获取所有卡密
 */
async function getAllCards(req, res) {
    try {
        const data = await userStore.getCardCatalog();
        res.json({ ok: true, ...data });
    } catch (error) {
        logCardsControllerError('获取卡密列表失败', error);
        res.status(500).json({ ok: false, error: '获取卡密列表失败' });
    }
}

/**
 * 获取卡密详情
 */
async function getCardDetail(req, res) {
    try {
        const { code } = req.params;
        const detail = await userStore.getCardDetail(code);
        if (!detail) {
            return res.status(404).json({ ok: false, error: '卡密不存在' });
        }

        res.json({ ok: true, ...detail });
    } catch (error) {
        logCardsControllerError('获取卡密详情失败', error, { code: req.params?.code });
        res.status(500).json({ ok: false, error: '获取卡密详情失败' });
    }
}

/**
 * 生成卡密
 */
async function createCard(req, res) {
    try {
        const {
            description,
            type,
            days,
            count = 1,
            batchNo,
            batchName,
            source,
            channel,
            note,
            createdBy,
        } = req.body;

        if (!type) {
            return res.status(400).json({ ok: false, error: '缺少必要参数' });
        }

        const cards = await userStore.createCardsBatch({
            description,
            type,
            days,
            count,
            batchNo,
            batchName,
            source,
            channel,
            note,
            createdBy: createdBy || req.currentUser?.username || 'admin',
            operator: req.currentUser?.username || 'admin',
        });

        res.json({ ok: true, cards });
    } catch (error) {
        logCardsControllerError('生成卡密失败', error, { operator: req.currentUser?.username || 'admin' });
        res.status(500).json({ ok: false, error: '生成卡密失败' });
    }
}

/**
 * 更新卡密
 */
async function updateCard(req, res) {
    try {
        const { code } = req.params;
        const updates = { ...req.body };

        const result = await userStore.updateCard(code, updates, req.currentUser?.username || 'admin');
        if (!result) {
            return res.status(404).json({ ok: false, error: '卡密不存在' });
        }
        if (!result.ok) {
            return res.status(400).json(result);
        }

        res.json({ ok: true, card: result.card });
    } catch (error) {
        logCardsControllerError('更新卡密失败', error, { code: req.params?.code, operator: req.currentUser?.username || 'admin' });
        res.status(500).json({ ok: false, error: '更新卡密失败' });
    }
}

/**
 * 删除卡密
 */
async function deleteCard(req, res) {
    try {
        const { code } = req.params;
        const result = await userStore.deleteCard(code, req.currentUser?.username || 'admin');

        if (!result.ok) {
            return res.status(result.error === '卡密不存在' ? 404 : 400).json(result);
        }

        res.json({ ok: true });
    } catch (error) {
        logCardsControllerError('删除卡密失败', error, { code: req.params?.code, operator: req.currentUser?.username || 'admin' });
        res.status(500).json({ ok: false, error: '删除卡密失败' });
    }
}

/**
 * 批量更新卡密
 */
async function batchUpdateCards(req, res) {
    try {
        const { codes, updates } = req.body;

        if (!Array.isArray(codes) || !updates || typeof updates !== 'object') {
            return res.status(400).json({ ok: false, error: '参数格式错误' });
        }

        const result = await userStore.batchUpdateCards(codes, updates, req.currentUser?.username || 'admin');
        res.json({ ok: true, ...result });
    } catch (error) {
        logCardsControllerError('批量更新卡密失败', error, { operator: req.currentUser?.username || 'admin' });
        res.status(500).json({ ok: false, error: '批量更新卡密失败' });
    }
}

/**
 * 批量删除卡密
 */
async function batchDeleteCards(req, res) {
    try {
        const { codes } = req.body;

        if (!Array.isArray(codes)) {
            return res.status(400).json({ ok: false, error: '卡密列表格式错误' });
        }

        const result = await userStore.batchDeleteCards(codes, req.currentUser?.username || 'admin');

        res.json({ ok: true, ...result });
    } catch (error) {
        logCardsControllerError('批量删除卡密失败', error, { operator: req.currentUser?.username || 'admin' });
        res.status(500).json({ ok: false, error: '批量删除卡密失败' });
    }
}

module.exports = {
    getAllCards,
    getCardDetail,
    createCard,
    updateCard,
    deleteCard,
    batchUpdateCards,
    batchDeleteCards
};
