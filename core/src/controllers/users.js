const userStore = require('../models/user-store');
const { createModuleLogger } = require('../services/logger');
const { validateUsername, validatePassword, validateCardCode } = require('../utils/validators');

const usersControllerLogger = createModuleLogger('users-controller');

function logUsersControllerError(message, error, meta = {}) {
    usersControllerLogger.error(message, {
        ...meta,
        error: error && error.message ? error.message : String(error || ''),
    });
}

/**
 * 创建用户（仅管理员）
 */
async function createUser(req, res) {
    try {
        const { username, password, cardCode } = req.body || {};

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ ok: false, error: usernameValidation.error });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ ok: false, error: passwordValidation.error });
        }

        const cardCodeValidation = validateCardCode(cardCode);
        if (!cardCodeValidation.valid) {
            return res.status(400).json({ ok: false, error: cardCodeValidation.error });
        }

        const result = await userStore.registerUser(username, password, cardCode);
        if (!result.ok) {
            return res.status(400).json(result);
        }

        res.json({ ok: true, user: result.user });
    } catch (error) {
        logUsersControllerError('创建用户失败', error);
        res.status(500).json({ ok: false, error: '创建用户失败' });
    }
}

/**
 * 用户管理控制器
 * 处理用户相关的 HTTP 请求
 */

/**
 * 获取用户列表（仅管理员）
 */
async function getAllUsers(req, res) {
    try {
        const users = await userStore.getAllUsers();
        res.json({ ok: true, users });
    } catch (error) {
        logUsersControllerError('获取用户列表失败', error);
        res.status(500).json({ ok: false, error: '获取用户列表失败' });
    }
}

/**
 * 获取用户详情（带密码，仅管理员）
 */
async function getAllUsersWithPassword(req, res) {
    try {
        const users = await userStore.getAllUsersWithPassword();
        res.json({ ok: true, users });
    } catch (error) {
        logUsersControllerError('获取用户详情失败', error);
        res.status(500).json({ ok: false, error: '获取用户详情失败' });
    }
}

/**
 * 更新用户信息（仅管理员）
 */
async function updateUser(req, res) {
    try {
        const { username } = req.params;
        const { expiresAt, enabled, role, password, nextUsername } = req.body;

        const updates = {};
        if (expiresAt !== undefined) updates.expiresAt = expiresAt;
        if (enabled !== undefined) updates.enabled = enabled;
        if (nextUsername !== undefined && String(nextUsername).trim() && String(nextUsername).trim() !== String(username)) {
            const usernameValidation = validateUsername(String(nextUsername).trim());
            if (!usernameValidation.valid) {
                return res.status(400).json({ ok: false, error: usernameValidation.error });
            }
            if (req.currentUser?.username === String(username)) {
                return res.status(400).json({ ok: false, error: '当前登录用户不支持直接修改用户名，请新建账号后迁移使用' });
            }
            updates.nextUsername = String(nextUsername).trim();
        }
        if (role !== undefined) {
            if (role !== 'admin' && role !== 'user') {
                return res.status(400).json({ ok: false, error: '用户角色无效' });
            }
            updates.role = role;
        }
        if (password !== undefined && String(password).trim()) {
            const passwordValidation = validatePassword(String(password));
            if (!passwordValidation.valid) {
                return res.status(400).json({ ok: false, error: passwordValidation.error });
            }
            updates.password = String(password);
        }

        const result = await userStore.updateUser(username, updates);
        if (!result) {
            return res.status(404).json({ ok: false, error: '用户不存在' });
        }

        res.json({ ok: true, user: result });
    } catch (error) {
        logUsersControllerError('更新用户失败', error, { username: req.params?.username });
        res.status(error.statusCode || 500).json({ ok: false, error: error.statusCode ? error.message : '更新用户失败' });
    }
}

async function renewUserCard(req, res) {
    try {
        const { username } = req.params;
        const { cardCode } = req.body || {};

        if (!cardCode) {
            return res.status(400).json({ ok: false, error: '卡密不能为空' });
        }

        const cardCodeValidation = validateCardCode(cardCode);
        if (!cardCodeValidation.valid) {
            return res.status(400).json({ ok: false, error: cardCodeValidation.error });
        }

        const result = await userStore.renewUser(username, String(cardCode).trim());
        if (!result.ok) {
            return res.status(400).json(result);
        }

        res.json({ ok: true, data: { card: result.card } });
    } catch (error) {
        logUsersControllerError('用户续卡失败', error, { username: req.params?.username });
        res.status(500).json({ ok: false, error: '用户续卡失败' });
    }
}

/**
 * 删除用户（仅管理员）
 */
async function deleteUser(req, res) {
    try {
        const { username } = req.params;
        const result = await userStore.deleteUser(username);

        if (!result.ok) {
            return res.status(400).json(result);
        }

        res.json({ ok: true });
    } catch (error) {
        logUsersControllerError('删除用户失败', error, { username: req.params?.username });
        res.status(500).json({ ok: false, error: '删除用户失败' });
    }
}

/**
 * 修改密码（根据当前登录用户自动隔离）
 */
async function changePassword(req, res) {
    try {
        // 从 req.currentUser 获取用户名（由 authRequired 中间件设置）
        const username = req.currentUser?.username;
        const role = req.currentUser?.role;
        const { oldPassword, newPassword } = req.body;

        if (!username) {
            return res.status(401).json({ ok: false, error: '未登录' });
        }

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ ok: false, error: '缺少必要参数' });
        }

        // 管理员：简化校验，仅要求 ≥4 位
        // 普通用户：完整复杂度校验（≥6位 + 字母 + 数字）
        if (role === 'admin') {
            if (newPassword.length < 4) {
                return res.status(400).json({ ok: false, error: '密码长度至少 4 位' });
            }
        } else {
            const { validatePassword } = require('../utils/validators');
            const pwdValidation = validatePassword(newPassword);
            if (!pwdValidation.valid) {
                return res.status(400).json({ ok: false, error: pwdValidation.error });
            }
        }

        // 管理员走简化密码修改（跳过 user-store 内部的强密码校验）
        const result = (role === 'admin' && userStore.changeAdminPassword)
            ? await userStore.changeAdminPassword(username, oldPassword, newPassword)
            : await userStore.changePassword(username, oldPassword, newPassword);

        if (!result.ok) {
            return res.status(400).json(result);
        }

        res.json({ ok: true, message: `用户 ${username} 密码修改成功` });
    } catch (error) {
        logUsersControllerError('修改密码失败', error, { username: req.currentUser?.username || '' });
        res.status(500).json({ ok: false, error: '修改密码失败' });
    }
}

module.exports = {
    createUser,
    getAllUsers,
    getAllUsersWithPassword,
    updateUser,
    renewUserCard,
    deleteUser,
    changePassword
};
