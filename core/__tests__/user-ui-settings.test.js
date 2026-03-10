const test = require('node:test');
const assert = require('node:assert/strict');

const mysqlDbModulePath = require.resolve('../src/services/mysql-db');
const userUiSettingsModulePath = require.resolve('../src/services/user-ui-settings');

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

function createMysqlMock(initialState = {}) {
    const state = {
        users: Array.isArray(initialState.users) ? initialState.users.map(item => ({ ...item })) : [],
        uiSettings: Array.isArray(initialState.uiSettings) ? initialState.uiSettings.map(item => ({ ...item })) : [],
    };

    async function handleQuery(sql, params = []) {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();

        if (normalizedSql.startsWith('select us.* from ui_settings us inner join users u on u.id = us.user_id')) {
            const username = String(params[0] || '');
            const user = state.users.find(item => item.username === username);
            if (!user) return [[]];
            const rows = state.uiSettings
                .filter(item => Number(item.user_id) === Number(user.id))
                .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
            return [rows.slice(0, 1)];
        }

        if (normalizedSql.startsWith('insert into ui_settings')) {
            const username = String(params[params.length - 1] || '');
            const user = state.users.find(item => item.username === username);
            if (!user) {
                return [{ affectedRows: 0 }];
            }

            const nextRow = {
                id: state.uiSettings.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1,
                user_id: user.id,
                theme: params[0],
                performance_mode: params[1],
                login_background: params[2],
                background_scope: params[3],
                login_background_overlay_opacity: params[4],
                login_background_blur: params[5],
                workspace_visual_preset: params[6],
                app_background_overlay_opacity: params[7],
                app_background_blur: params[8],
                color_theme: params[9],
                theme_background_linked: params[10],
                ui_timestamp: params[11],
            };

            const existingIndex = state.uiSettings.findIndex(item => Number(item.user_id) === Number(user.id));
            if (existingIndex >= 0) {
                nextRow.id = state.uiSettings[existingIndex].id;
                state.uiSettings[existingIndex] = nextRow;
            } else {
                state.uiSettings.push(nextRow);
            }

            return [{ affectedRows: 1 }];
        }

        return [[]];
    }

    return {
        getPool() {
            return {
                query: handleQuery,
                execute: handleQuery,
            };
        },
        __state: state,
    };
}

test('user ui settings persist per user and merge with global ui defaults', async () => {
    const mysqlMock = createMysqlMock({
        users: [{ id: 7, username: 'alice' }],
    });
    const restoreMysql = mockModule(mysqlDbModulePath, mysqlMock);

    try {
        delete require.cache[userUiSettingsModulePath];
        const { getUserUiConfig, mergeUiConfig, saveUserUiConfig } = require(userUiSettingsModulePath);

        const globalUi = {
            theme: 'dark',
            loginBackground: '/global-bg.webp',
            backgroundScope: 'login_only',
            loginBackgroundOverlayOpacity: 30,
            loginBackgroundBlur: 2,
            workspaceVisualPreset: 'console',
            appBackgroundOverlayOpacity: 54,
            appBackgroundBlur: 8,
            colorTheme: 'default',
            performanceMode: true,
            themeBackgroundLinked: false,
            siteTitle: '全局标题',
            supportQqGroup: '123456',
            copyrightText: 'global copyright',
            timestamp: 100,
        };

        const savedUi = await saveUserUiConfig('alice', {
            theme: 'light',
            loginBackground: '/personal-bg.webp',
            backgroundScope: 'login_and_app',
            workspaceVisualPreset: 'poster',
            appBackgroundOverlayOpacity: 68,
            appBackgroundBlur: 12,
            colorTheme: 'ocean',
            performanceMode: false,
            themeBackgroundLinked: true,
            timestamp: 250,
        }, globalUi);

        assert.equal(savedUi.theme, 'light');
        assert.equal(savedUi.colorTheme, 'ocean');
        assert.equal(savedUi.performanceMode, false);
        assert.equal(mysqlMock.__state.uiSettings.length, 1);

        const loadedUi = await getUserUiConfig('alice', globalUi);
        assert.deepEqual(loadedUi, {
            theme: 'light',
            loginBackground: '/personal-bg.webp',
            backgroundScope: 'login_and_app',
            loginBackgroundOverlayOpacity: 30,
            loginBackgroundBlur: 2,
            workspaceVisualPreset: 'poster',
            appBackgroundOverlayOpacity: 68,
            appBackgroundBlur: 12,
            colorTheme: 'ocean',
            performanceMode: false,
            themeBackgroundLinked: true,
            timestamp: 250,
        });

        const mergedUi = mergeUiConfig(globalUi, loadedUi);
        assert.equal(mergedUi.theme, 'light');
        assert.equal(mergedUi.loginBackground, '/personal-bg.webp');
        assert.equal(mergedUi.colorTheme, 'ocean');
        assert.equal(mergedUi.siteTitle, '全局标题');
        assert.equal(mergedUi.supportQqGroup, '123456');
        assert.equal(mergedUi.copyrightText, 'global copyright');
        assert.equal(mergedUi.timestamp, 250);
    } finally {
        delete require.cache[userUiSettingsModulePath];
        restoreMysql();
    }
});
