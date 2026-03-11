const test = require('node:test');
const assert = require('node:assert/strict');

const { RuntimeModuleBase } = require('../src/runtime/runtime-module-base');
const { createRuntimeEventBus } = require('../src/runtime/runtime-event-bus');
const { createRuntimeModuleManager } = require('../src/runtime/runtime-module-manager');

class RecorderModule extends RuntimeModuleBase {
    constructor(name, context, calls) {
        super(name, context);
        this.calls = calls;
    }

    onStart(payload) {
        this.calls.push(['start', this.name, payload.source || '']);
        this.onRuntime('custom:event', (eventPayload) => {
            this.calls.push(['event', this.name, eventPayload.value]);
        });
        this.registerCleanup(() => {
            this.calls.push(['cleanup', this.name]);
        });
    }

    onConfigApplied(payload) {
        this.calls.push(['config', this.name, payload.mode || '']);
    }

    onStop(payload) {
        this.calls.push(['stop', this.name, payload.reason || '']);
    }
}

test('runtime module manager starts modules, distributes config, and stops in reverse order', () => {
    const calls = [];
    const runtimeBus = createRuntimeEventBus();
    const manager = createRuntimeModuleManager({ runtimeBus });

    manager.register(new RecorderModule('alpha', { runtimeBus }, calls));
    manager.register(new RecorderModule('beta', { runtimeBus }, calls));

    const configEvents = [];
    runtimeBus.on('config:applied', payload => configEvents.push(payload.mode));

    manager.startMany(['alpha', 'beta'], { source: 'bootstrap' });
    manager.emit('custom:event', { value: 7 });
    manager.applyConfig({ mode: 'sync' });
    manager.stopAll({ reason: 'shutdown' });

    assert.deepEqual(calls, [
        ['start', 'alpha', 'bootstrap'],
        ['start', 'beta', 'bootstrap'],
        ['event', 'alpha', 7],
        ['event', 'beta', 7],
        ['config', 'alpha', 'sync'],
        ['config', 'beta', 'sync'],
        ['stop', 'beta', 'shutdown'],
        ['cleanup', 'beta'],
        ['stop', 'alpha', 'shutdown'],
        ['cleanup', 'alpha'],
    ]);
    assert.deepEqual(configEvents, ['sync']);
    assert.deepEqual(manager.order, ['alpha', 'beta']);
});

test('runtime module manager reloads reloadable modules, recreates instances, and reapplies config', () => {
    const calls = [];
    const runtimeBus = createRuntimeEventBus();
    const invalidations = [];
    let generation = 0;
    const manager = createRuntimeModuleManager({
        runtimeBus,
        invalidateModules(names, records, payload) {
            invalidations.push([
                [...names],
                records.map(record => record.name),
                [...(payload.cacheKeys || [])],
            ]);
            return payload.cacheKeys || [];
        },
    });

    class ReloadableRecorderModule extends RuntimeModuleBase {
        constructor(name, context, instanceGeneration) {
            super(name, context);
            this.instanceGeneration = instanceGeneration;
        }

        onStart(payload) {
            calls.push(['start', this.name, this.instanceGeneration, payload.source || '']);
            this.onRuntime('custom:event', (eventPayload) => {
                calls.push(['event', this.name, this.instanceGeneration, eventPayload.value]);
            });
            this.registerCleanup(() => {
                calls.push(['cleanup', this.name, this.instanceGeneration]);
            });
        }

        onStop(payload) {
            calls.push(['stop', this.name, this.instanceGeneration, payload.reason || '']);
        }

        onConfigApplied(payload) {
            calls.push(['config', this.name, this.instanceGeneration, payload.mode || '']);
        }
    }

    function createDefinition(name, cacheKey) {
        return {
            name,
            reloadable: true,
            cacheKeys: [cacheKey],
            create() {
                generation += 1;
                return new ReloadableRecorderModule(name, { runtimeBus }, generation);
            },
        };
    }

    manager.register(createDefinition('alpha', 'cache:alpha'));
    manager.register(createDefinition('beta', 'cache:beta'));

    manager.startMany(['alpha', 'beta'], { source: 'bootstrap' });
    manager.applyConfig({ mode: 'sync' });
    manager.reloadMany(['alpha', 'beta'], {
        source: 'hot_reload',
        reason: 'reload',
        cacheKeys: ['cache:alpha', 'cache:beta', 'cache:shared'],
    });
    manager.emit('custom:event', { value: 9 });

    assert.deepEqual(calls, [
        ['start', 'alpha', 1, 'bootstrap'],
        ['start', 'beta', 2, 'bootstrap'],
        ['config', 'alpha', 1, 'sync'],
        ['config', 'beta', 2, 'sync'],
        ['stop', 'beta', 2, 'reload'],
        ['cleanup', 'beta', 2],
        ['stop', 'alpha', 1, 'reload'],
        ['cleanup', 'alpha', 1],
        ['start', 'alpha', 3, 'hot_reload'],
        ['start', 'beta', 4, 'hot_reload'],
        ['config', 'alpha', 3, 'sync'],
        ['config', 'beta', 4, 'sync'],
        ['event', 'alpha', 3, 9],
        ['event', 'beta', 4, 9],
    ]);
    assert.deepEqual(invalidations, [
        [
            ['alpha', 'beta'],
            ['alpha', 'beta'],
            ['cache:alpha', 'cache:beta', 'cache:shared'],
        ],
    ]);
    assert.equal(manager.get('alpha').instanceGeneration, 3);
    assert.equal(manager.get('beta').instanceGeneration, 4);
});
