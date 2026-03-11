const { sellAllFruits, openFertilizerGiftPacksSilently, resetWarehouseRuntimeState } = require('../../services/warehouse');
const { recordOperation } = require('../../services/stats');
const { RuntimeModuleBase } = require('../runtime-module-base');

class WarehouseRuntimeModule extends RuntimeModuleBase {
    constructor(context = {}) {
        super('warehouse', context);
        this.harvestSellRunning = false;
    }

    onStart() {
        this.onRuntime('farm:harvested', this.handleFarmHarvested);
        this.onRuntime('warehouse:sold', this.handleWarehouseSold);

        const getAutomation = this.context && this.context.getAutomation;
        if (typeof getAutomation === 'function' && getAutomation().fertilizer_gift) {
            void openFertilizerGiftPacksSilently().catch(() => 0);
        }
    }

    onStop() {
        this.harvestSellRunning = false;
        resetWarehouseRuntimeState();
    }

    handleWarehouseSold(deltaGold) {
        const delta = Number(deltaGold || 0);
        if (!Number.isFinite(delta) || delta <= 0) return;
        recordOperation('sell', 1);
    }

    async handleFarmHarvested() {
        const getAutomation = this.context && this.context.getAutomation;
        const log = this.context && this.context.log;
        if (typeof getAutomation !== 'function') return;
        if (this.harvestSellRunning || !getAutomation().sell) return;

        this.harvestSellRunning = true;
        try {
            await sellAllFruits();
        } catch (error) {
            if (typeof log === 'function') {
                log('仓库', `收获后自动出售失败: ${error.message}`, {
                    module: 'warehouse',
                    event: 'sell_after_harvest',
                    result: 'error',
                });
            }
        } finally {
            this.harvestSellRunning = false;
        }
    }
}

function createWarehouseRuntimeModule(context = {}) {
    return new WarehouseRuntimeModule(context);
}

module.exports = {
    WarehouseRuntimeModule,
    createWarehouseRuntimeModule,
};
