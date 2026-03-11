const test = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('node:events');

const { createRuntimeEventBus } = require('../src/runtime/runtime-event-bus');
const { createRuntimeNetworkEventBridge } = require('../src/runtime/runtime-network-event-bridge');

test('runtime network event bridge maps network events onto runtime events and detaches cleanly', () => {
    const networkEvents = new EventEmitter();
    const runtimeBus = createRuntimeEventBus();
    const received = [];

    runtimeBus.on('network:ws_error', payload => received.push(['ws_error', payload.code]));
    runtimeBus.on('network:kickout', payload => received.push(['kickout', payload.reason]));
    runtimeBus.on('warehouse:sold', payload => received.push(['sold', payload]));

    const bridge = createRuntimeNetworkEventBridge({
        networkEvents,
        runtimeBus,
    });

    bridge.attach();
    bridge.attach();

    networkEvents.emit('ws_error', { code: 400 });
    networkEvents.emit('kickout', { reason: 'duplicate_login' });
    networkEvents.emit('sell', 12888);

    assert.deepEqual(received, [
        ['ws_error', 400],
        ['kickout', 'duplicate_login'],
        ['sold', 12888],
    ]);

    bridge.detach();
    networkEvents.emit('ws_error', { code: 401 });

    assert.deepEqual(received, [
        ['ws_error', 400],
        ['kickout', 'duplicate_login'],
        ['sold', 12888],
    ]);
});
