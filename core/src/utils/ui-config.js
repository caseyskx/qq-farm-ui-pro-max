const DEFAULT_UI_CONFIG = {
    theme: 'dark',
    loginBackground: '',
    backgroundScope: 'login_only',
    loginBackgroundOverlayOpacity: 30,
    loginBackgroundBlur: 2,
    workspaceVisualPreset: 'console',
    appBackgroundOverlayOpacity: 54,
    appBackgroundBlur: 8,
    colorTheme: 'default',
    performanceMode: true,
    themeBackgroundLinked: false,
    siteTitle: '御农·QQ 农场智能助手',
    supportQqGroup: '227916149',
    copyrightText: '© 2026 御农 System | 架构与开发: smdk000',
    timestamp: 0,
};

function clampUiNumber(value, fallback, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

function normalizeUIConfig(input, fallback = DEFAULT_UI_CONFIG) {
    const src = (input && typeof input === 'object') ? input : {};
    const base = (fallback && typeof fallback === 'object') ? fallback : DEFAULT_UI_CONFIG;
    const rawTheme = String(src.theme !== undefined ? src.theme : base.theme || DEFAULT_UI_CONFIG.theme).toLowerCase();
    const theme = rawTheme === 'light' || rawTheme === 'auto' ? rawTheme : 'dark';
    const rawScope = String(src.backgroundScope !== undefined ? src.backgroundScope : base.backgroundScope || DEFAULT_UI_CONFIG.backgroundScope).toLowerCase();
    const backgroundScope = new Set(['login_only', 'login_and_app', 'global']).has(rawScope)
        ? rawScope
        : DEFAULT_UI_CONFIG.backgroundScope;
    const loginBackground = (src.loginBackground !== undefined && src.loginBackground !== null)
        ? String(src.loginBackground).trim().slice(0, 2048)
        : String(base.loginBackground || DEFAULT_UI_CONFIG.loginBackground);
    const rawColorTheme = (src.colorTheme !== undefined && src.colorTheme !== null)
        ? String(src.colorTheme).trim()
        : String(base.colorTheme || DEFAULT_UI_CONFIG.colorTheme);
    const colorTheme = rawColorTheme || DEFAULT_UI_CONFIG.colorTheme;
    const rawWorkspaceVisualPreset = String(
        src.workspaceVisualPreset !== undefined
            ? src.workspaceVisualPreset
            : (base.workspaceVisualPreset || DEFAULT_UI_CONFIG.workspaceVisualPreset),
    ).toLowerCase();
    const workspaceVisualPreset = new Set(['console', 'poster', 'pure_glass']).has(rawWorkspaceVisualPreset)
        ? rawWorkspaceVisualPreset
        : DEFAULT_UI_CONFIG.workspaceVisualPreset;
    const rawTimestamp = Number.parseInt(src.timestamp, 10);
    const fallbackTimestamp = Number.parseInt(base.timestamp, 10);
    const rawSiteTitle = (src.siteTitle !== undefined && src.siteTitle !== null)
        ? String(src.siteTitle).trim()
        : String(base.siteTitle || DEFAULT_UI_CONFIG.siteTitle);
    const siteTitle = rawSiteTitle ? rawSiteTitle.slice(0, 120) : DEFAULT_UI_CONFIG.siteTitle;
    const rawSupportQqGroup = (src.supportQqGroup !== undefined && src.supportQqGroup !== null)
        ? String(src.supportQqGroup).trim()
        : String(base.supportQqGroup || DEFAULT_UI_CONFIG.supportQqGroup);
    const supportQqGroupDigits = rawSupportQqGroup.replace(/[^\d]/g, '').slice(0, 20);
    const supportQqGroup = supportQqGroupDigits || DEFAULT_UI_CONFIG.supportQqGroup;
    const rawCopyrightText = (src.copyrightText !== undefined && src.copyrightText !== null)
        ? String(src.copyrightText).trim()
        : String(base.copyrightText || DEFAULT_UI_CONFIG.copyrightText);
    const copyrightText = rawCopyrightText ? rawCopyrightText.slice(0, 240) : DEFAULT_UI_CONFIG.copyrightText;

    return {
        theme,
        loginBackground,
        backgroundScope,
        loginBackgroundOverlayOpacity: clampUiNumber(
            src.loginBackgroundOverlayOpacity,
            clampUiNumber(base.loginBackgroundOverlayOpacity, DEFAULT_UI_CONFIG.loginBackgroundOverlayOpacity, 0, 80),
            0,
            80,
        ),
        loginBackgroundBlur: clampUiNumber(
            src.loginBackgroundBlur,
            clampUiNumber(base.loginBackgroundBlur, DEFAULT_UI_CONFIG.loginBackgroundBlur, 0, 12),
            0,
            12,
        ),
        workspaceVisualPreset,
        appBackgroundOverlayOpacity: clampUiNumber(
            src.appBackgroundOverlayOpacity,
            clampUiNumber(base.appBackgroundOverlayOpacity, DEFAULT_UI_CONFIG.appBackgroundOverlayOpacity, 20, 90),
            20,
            90,
        ),
        appBackgroundBlur: clampUiNumber(
            src.appBackgroundBlur,
            clampUiNumber(base.appBackgroundBlur, DEFAULT_UI_CONFIG.appBackgroundBlur, 0, 18),
            0,
            18,
        ),
        colorTheme,
        performanceMode: src.performanceMode !== undefined ? !!src.performanceMode : !!base.performanceMode,
        themeBackgroundLinked: src.themeBackgroundLinked !== undefined ? !!src.themeBackgroundLinked : !!base.themeBackgroundLinked,
        siteTitle,
        supportQqGroup,
        copyrightText,
        timestamp: Number.isFinite(rawTimestamp) && rawTimestamp >= 0
            ? rawTimestamp
            : (Number.isFinite(fallbackTimestamp) && fallbackTimestamp >= 0 ? fallbackTimestamp : DEFAULT_UI_CONFIG.timestamp),
    };
}

module.exports = {
    DEFAULT_UI_CONFIG,
    clampUiNumber,
    normalizeUIConfig,
};
