const { getPool } = require('./mysql-db');
const { createModuleLogger } = require('./logger');
const { DEFAULT_UI_CONFIG, normalizeUIConfig } = require('../utils/ui-config');

const logger = createModuleLogger('user-ui-settings');

const USER_UI_SETTING_KEYS = Object.freeze([
    'theme',
    'loginBackground',
    'backgroundScope',
    'loginBackgroundOverlayOpacity',
    'loginBackgroundBlur',
    'workspaceVisualPreset',
    'appBackgroundOverlayOpacity',
    'appBackgroundBlur',
    'colorTheme',
    'performanceMode',
    'themeBackgroundLinked',
    'timestamp',
]);

function pickUserUiConfig(input, fallback = DEFAULT_UI_CONFIG) {
    const normalized = normalizeUIConfig(input, fallback);
    return {
        theme: normalized.theme,
        loginBackground: normalized.loginBackground,
        backgroundScope: normalized.backgroundScope,
        loginBackgroundOverlayOpacity: normalized.loginBackgroundOverlayOpacity,
        loginBackgroundBlur: normalized.loginBackgroundBlur,
        workspaceVisualPreset: normalized.workspaceVisualPreset,
        appBackgroundOverlayOpacity: normalized.appBackgroundOverlayOpacity,
        appBackgroundBlur: normalized.appBackgroundBlur,
        colorTheme: normalized.colorTheme,
        performanceMode: normalized.performanceMode,
        themeBackgroundLinked: normalized.themeBackgroundLinked,
        timestamp: normalized.timestamp,
    };
}

function buildUserUiBody(input = {}) {
    const body = {};
    for (const key of USER_UI_SETTING_KEYS) {
        if (input[key] !== undefined) {
            body[key] = input[key];
        }
    }
    return body;
}

function mapUserUiRow(row = {}) {
    return {
        theme: row.theme,
        loginBackground: row.login_background,
        backgroundScope: row.background_scope,
        loginBackgroundOverlayOpacity: row.login_background_overlay_opacity,
        loginBackgroundBlur: row.login_background_blur,
        workspaceVisualPreset: row.workspace_visual_preset,
        appBackgroundOverlayOpacity: row.app_background_overlay_opacity,
        appBackgroundBlur: row.app_background_blur,
        colorTheme: row.color_theme,
        performanceMode: row.performance_mode === 1 || row.performance_mode === true,
        themeBackgroundLinked: row.theme_background_linked === 1 || row.theme_background_linked === true,
        timestamp: row.ui_timestamp,
    };
}

async function getUserUiConfig(username, fallbackUi = DEFAULT_UI_CONFIG) {
    const normalizedUsername = String(username || '').trim();
    const pool = getPool();
    if (!normalizedUsername || !pool) return null;

    try {
        const [rows] = await pool.query(
            `SELECT us.*
             FROM ui_settings us
             INNER JOIN users u ON u.id = us.user_id
             WHERE u.username = ?
             ORDER BY us.updated_at DESC, us.id DESC
             LIMIT 1`,
            [normalizedUsername],
        );
        const row = Array.isArray(rows) ? rows[0] : null;
        if (!row) return null;
        return pickUserUiConfig(mapUserUiRow(row), fallbackUi);
    } catch (err) {
        logger.warn(`读取用户 UI 设置失败 [${normalizedUsername}]: ${err.message}`);
        return null;
    }
}

async function saveUserUiConfig(username, input, fallbackUi = DEFAULT_UI_CONFIG) {
    const normalizedUsername = String(username || '').trim();
    const pool = getPool();
    if (!normalizedUsername || !pool) {
        throw new Error('用户 UI 设置保存失败：缺少用户名或数据库连接');
    }

    const nextUi = pickUserUiConfig(input, fallbackUi);
    const params = [
        nextUi.theme,
        nextUi.performanceMode ? 1 : 0,
        nextUi.loginBackground,
        nextUi.backgroundScope,
        nextUi.loginBackgroundOverlayOpacity,
        nextUi.loginBackgroundBlur,
        nextUi.workspaceVisualPreset,
        nextUi.appBackgroundOverlayOpacity,
        nextUi.appBackgroundBlur,
        nextUi.colorTheme,
        nextUi.themeBackgroundLinked ? 1 : 0,
        Number(nextUi.timestamp) || 0,
        normalizedUsername,
    ];

    const [result] = await pool.query(
        `INSERT INTO ui_settings (
            user_id, theme, performance_mode, login_background, background_scope,
            login_background_overlay_opacity, login_background_blur, workspace_visual_preset,
            app_background_overlay_opacity, app_background_blur, color_theme,
            theme_background_linked, ui_timestamp
        )
        SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        FROM users
        WHERE username = ?
        ON DUPLICATE KEY UPDATE
            theme = VALUES(theme),
            performance_mode = VALUES(performance_mode),
            login_background = VALUES(login_background),
            background_scope = VALUES(background_scope),
            login_background_overlay_opacity = VALUES(login_background_overlay_opacity),
            login_background_blur = VALUES(login_background_blur),
            workspace_visual_preset = VALUES(workspace_visual_preset),
            app_background_overlay_opacity = VALUES(app_background_overlay_opacity),
            app_background_blur = VALUES(app_background_blur),
            color_theme = VALUES(color_theme),
            theme_background_linked = VALUES(theme_background_linked),
            ui_timestamp = VALUES(ui_timestamp)`,
        params,
    );

    if (!result || result.affectedRows === 0) {
        throw new Error(`用户不存在或 UI 设置保存失败: ${normalizedUsername}`);
    }

    return nextUi;
}

function mergeUiConfig(baseUi, userUi) {
    const base = normalizeUIConfig(baseUi, DEFAULT_UI_CONFIG);
    if (!userUi || typeof userUi !== 'object') {
        return base;
    }
    const merged = {
        ...base,
        ...pickUserUiConfig(userUi, base),
    };
    merged.siteTitle = base.siteTitle;
    merged.supportQqGroup = base.supportQqGroup;
    merged.copyrightText = base.copyrightText;
    merged.timestamp = Math.max(Number(base.timestamp) || 0, Number(userUi.timestamp) || 0);
    return normalizeUIConfig(merged, base);
}

module.exports = {
    USER_UI_SETTING_KEYS,
    buildUserUiBody,
    getUserUiConfig,
    saveUserUiConfig,
    mergeUiConfig,
};
