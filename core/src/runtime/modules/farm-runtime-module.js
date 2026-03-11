const { startFarmCheckLoop, resetFarmRuntimeState } = require('../../services/farm');
const { RuntimeModuleBase } = require('../runtime-module-base');

class FarmRuntimeModule extends RuntimeModuleBase {
    constructor(context = {}) {
        super('farm', context);
    }

    onStart() {
        startFarmCheckLoop({ externalScheduler: true });
    }

    onStop() {
        resetFarmRuntimeState();
    }
}

function createFarmRuntimeModule(context = {}) {
    return new FarmRuntimeModule(context);
}

module.exports = {
    FarmRuntimeModule,
    createFarmRuntimeModule,
};
