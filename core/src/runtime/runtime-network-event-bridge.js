const DEFAULT_EVENT_MAP = Object.freeze({
    ws_error: 'network:ws_error',
    kickout: 'network:kickout',
    ban: 'network:ban',
    farmHarvested: 'farm:harvested',
    friends_updated: 'friend:list_updated',
    sell: 'warehouse:sold',
});

function createRuntimeNetworkEventBridge(options = {}) {
    const networkEvents = options.networkEvents;
    const runtimeBus = options.runtimeBus;
    const eventMap = options.eventMap || DEFAULT_EVENT_MAP;
    const listeners = new Map();

    function attach() {
        if (!networkEvents || !runtimeBus) {
            throw new Error('runtime network event bridge 缺少 networkEvents 或 runtimeBus');
        }
        if (listeners.size > 0) return;

        for (const [sourceEvent, targetEvent] of Object.entries(eventMap)) {
            const handler = (payload) => {
                runtimeBus.emit(targetEvent, payload);
            };
            listeners.set(sourceEvent, handler);
            networkEvents.on(sourceEvent, handler);
        }
    }

    function detach() {
        if (!networkEvents || listeners.size === 0) return;
        for (const [sourceEvent, handler] of listeners.entries()) {
            networkEvents.off(sourceEvent, handler);
        }
        listeners.clear();
    }

    return {
        attach,
        detach,
        eventMap: { ...eventMap },
    };
}

module.exports = {
    DEFAULT_EVENT_MAP,
    createRuntimeNetworkEventBridge,
};
