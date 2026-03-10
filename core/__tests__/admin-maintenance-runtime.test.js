const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ensureAdminMaintenanceTasks,
    stopAdminMaintenanceTasks,
} = require('../src/controllers/admin/maintenance-runtime');

test('ensureAdminMaintenanceTasks starts tasks once, reuses existing handle, and can restart after stop', () => {
    const calls = [];
    const handles = [
        { stop() {} },
        { stop() {} },
    ];
    const maintenanceContext = {
        trialRateLimitMap: new Map(),
    };
    const registerAdminMaintenanceTasks = (args) => {
        calls.push(args);
        return handles[calls.length - 1];
    };

    const first = ensureAdminMaintenanceTasks({
        currentTasks: null,
        maintenanceContext,
        registerAdminMaintenanceTasks,
        cronRef: { name: 'cron' },
        getProvider: () => ({ name: 'provider' }),
        getPool: () => ({ name: 'pool' }),
        adminLogger: { name: 'logger' },
        jwtService: { name: 'jwt' },
    });
    const second = ensureAdminMaintenanceTasks({
        currentTasks: first,
        maintenanceContext,
        registerAdminMaintenanceTasks,
        cronRef: { name: 'cron' },
        getProvider: () => ({ name: 'provider' }),
        getPool: () => ({ name: 'pool' }),
        adminLogger: { name: 'logger' },
        jwtService: { name: 'jwt' },
    });
    const third = ensureAdminMaintenanceTasks({
        currentTasks: stopAdminMaintenanceTasks(second),
        maintenanceContext,
        registerAdminMaintenanceTasks,
        cronRef: { name: 'cron' },
        getProvider: () => ({ name: 'provider' }),
        getPool: () => ({ name: 'pool' }),
        adminLogger: { name: 'logger' },
        jwtService: { name: 'jwt' },
    });

    assert.equal(first, handles[0]);
    assert.equal(second, handles[0]);
    assert.equal(third, handles[1]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].trialRateLimitMap, maintenanceContext.trialRateLimitMap);
    assert.equal(calls[1].trialRateLimitMap, maintenanceContext.trialRateLimitMap);
});

test('ensureAdminMaintenanceTasks skips registration when maintenance context is missing', () => {
    const result = ensureAdminMaintenanceTasks({
        currentTasks: null,
        maintenanceContext: null,
        registerAdminMaintenanceTasks: () => {
            throw new Error('should not register without context');
        },
        cronRef: {},
        getProvider: () => null,
        getPool: () => null,
        adminLogger: {},
        jwtService: {},
    });

    assert.equal(result, null);
});

test('stopAdminMaintenanceTasks calls stop hook and clears handle', () => {
    const calls = [];
    const result = stopAdminMaintenanceTasks({
        stop() {
            calls.push('stop');
        },
    });

    assert.equal(result, null);
    assert.deepEqual(calls, ['stop']);
});
