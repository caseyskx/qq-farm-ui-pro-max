const EventEmitter = require('node:events');

class RuntimeEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(200);
    }
}

function createRuntimeEventBus() {
    return new RuntimeEventBus();
}

module.exports = {
    RuntimeEventBus,
    createRuntimeEventBus,
};
