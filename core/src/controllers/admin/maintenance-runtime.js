function ensureAdminMaintenanceTasks({
    currentTasks,
    maintenanceContext,
    registerAdminMaintenanceTasks,
    cronRef,
    getProvider,
    getPool,
    adminLogger,
    jwtService,
}) {
    if (currentTasks) {
        return currentTasks;
    }

    const trialRateLimitMap = maintenanceContext && maintenanceContext.trialRateLimitMap;
    if (!(trialRateLimitMap instanceof Map)) {
        return null;
    }

    return registerAdminMaintenanceTasks({
        cronRef,
        getProvider,
        getPool,
        adminLogger,
        trialRateLimitMap,
        jwtService,
    });
}

function stopAdminMaintenanceTasks(currentTasks) {
    if (currentTasks && typeof currentTasks.stop === 'function') {
        currentTasks.stop();
    }
    return null;
}

module.exports = {
    ensureAdminMaintenanceTasks,
    stopAdminMaintenanceTasks,
};
