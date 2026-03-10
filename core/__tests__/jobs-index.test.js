const test = require('node:test');
const assert = require('node:assert/strict');

const { initJobs } = require('../src/jobs/index');

test('initJobs wires both system jobs onto the shared scheduler and returns a stop handle', () => {
    const calls = [];
    const fakeScheduler = {
        clearAll() {
            calls.push('clearAll');
        },
        destroy() {
            calls.push('destroy');
        },
    };

    const runtime = initJobs({
        createSchedulerRef: (namespace) => {
            calls.push(['createScheduler', namespace]);
            return fakeScheduler;
        },
        startLogCleanupJobRef: (scheduler) => {
            calls.push(['startLogCleanupJob', scheduler]);
        },
        startDailyStatsJobRef: (scheduler) => {
            calls.push(['startDailyStatsJob', scheduler]);
        },
    });

    assert.equal(runtime.scheduler, fakeScheduler);
    assert.deepEqual(calls.slice(0, 3), [
        ['createScheduler', 'system-jobs'],
        ['startLogCleanupJob', fakeScheduler],
        ['startDailyStatsJob', fakeScheduler],
    ]);

    runtime.stop();
    assert.deepEqual(calls.slice(3), ['clearAll', 'destroy']);
});
