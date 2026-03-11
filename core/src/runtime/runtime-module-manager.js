const { createRuntimeEventBus } = require('./runtime-event-bus');

function createRuntimeModuleManager(options = {}) {
    const runtimeBus = options.runtimeBus || createRuntimeEventBus();
    const records = new Map();
    const modules = new Map();
    const order = [];
    let lastConfigPayload = null;

    function defaultInvalidateModules(_names = [], targetRecords = [], payload = {}) {
        const cacheKeys = new Set();
        for (const record of targetRecords) {
            for (const cacheKey of (Array.isArray(record && record.cacheKeys) ? record.cacheKeys : [])) {
                if (cacheKey) cacheKeys.add(cacheKey);
            }
        }
        for (const cacheKey of (Array.isArray(payload && payload.cacheKeys) ? payload.cacheKeys : [])) {
            if (cacheKey) cacheKeys.add(cacheKey);
        }
        for (const cacheKey of cacheKeys) {
            delete require.cache[cacheKey];
        }
        return [...cacheKeys];
    }

    const invalidateModules = typeof options.invalidateModules === 'function'
        ? options.invalidateModules
        : defaultInvalidateModules;

    function createModuleInstance(record, payload = {}) {
        if (!record || typeof record.factory !== 'function') {
            return record ? record.instance : null;
        }
        const moduleInstance = record.factory(payload);
        if (!moduleInstance || !moduleInstance.name) {
            throw new Error(`runtime module 重建失败: ${record.name}`);
        }
        const normalizedName = String(moduleInstance.name || '').trim();
        if (normalizedName !== record.name) {
            throw new Error(`runtime module 重建名称不匹配: ${record.name} -> ${normalizedName}`);
        }
        return moduleInstance;
    }

    function register(moduleInstance) {
        const isDefinition = !!moduleInstance
            && typeof moduleInstance === 'object'
            && typeof moduleInstance.create === 'function'
            && (
                typeof moduleInstance.start !== 'function'
                || typeof moduleInstance.stop !== 'function'
                || moduleInstance.reloadable !== undefined
                || Array.isArray(moduleInstance.cacheKeys)
            );
        const nameSource = isDefinition ? moduleInstance.name : (moduleInstance && moduleInstance.name);
        if (!nameSource) {
            throw new Error('runtime module 注册失败: 缺少名称');
        }
        const name = String(nameSource).trim();
        if (!name) {
            throw new Error('runtime module 注册失败: 缺少有效名称');
        }
        if (modules.has(name)) {
            throw new Error(`runtime module 重复注册: ${name}`);
        }

        const record = {
            name,
            reloadable: !!(isDefinition && moduleInstance.reloadable !== false),
            cacheKeys: isDefinition && Array.isArray(moduleInstance.cacheKeys)
                ? [...moduleInstance.cacheKeys]
                : [],
            factory: isDefinition
                ? (payload = {}) => moduleInstance.create(payload)
                : null,
            instance: null,
        };

        record.instance = isDefinition ? createModuleInstance(record) : moduleInstance;
        records.set(name, record);
        modules.set(name, record.instance);
        order.push(name);
        return record.instance;
    }

    function get(name) {
        return modules.get(String(name || '').trim());
    }

    function start(name, payload = {}) {
        const moduleInstance = get(name);
        if (!moduleInstance) {
            throw new Error(`runtime module 未找到: ${name}`);
        }
        moduleInstance.start(payload);
        return moduleInstance;
    }

    function startMany(names = [], payload = {}) {
        for (const name of names) {
            start(name, payload);
        }
    }

    function startAll(payload = {}) {
        startMany(order, payload);
    }

    function stop(name, payload = {}) {
        const moduleInstance = get(name);
        if (!moduleInstance) return;
        moduleInstance.stop(payload);
    }

    function stopMany(names = [], payload = {}) {
        const reversed = [...names].reverse();
        for (const name of reversed) {
            stop(name, payload);
        }
    }

    function stopAll(payload = {}) {
        stopMany(order, payload);
    }

    function applyConfig(payload = {}) {
        lastConfigPayload = payload;
        runtimeBus.emit('config:applied', payload);
        for (const name of order) {
            const moduleInstance = modules.get(name);
            if (!moduleInstance) continue;
            moduleInstance.applyConfig(payload);
        }
    }

    function reload(name, payload = {}) {
        return reloadMany([name], payload);
    }

    function reloadMany(names = [], payload = {}) {
        const uniqueNames = [];
        for (const rawName of (Array.isArray(names) ? names : [])) {
            const normalized = String(rawName || '').trim();
            if (!normalized || uniqueNames.includes(normalized)) continue;
            uniqueNames.push(normalized);
        }
        if (uniqueNames.length <= 0) {
            return {
                reloadedNames: [],
                restartedNames: [],
                cacheKeys: [],
            };
        }

        const targetRecords = uniqueNames.map((name) => {
            const record = records.get(name);
            if (!record) {
                throw new Error(`runtime module 未找到: ${name}`);
            }
            if (!record.reloadable || typeof record.factory !== 'function') {
                throw new Error(`runtime module 不支持热重载: ${name}`);
            }
            return record;
        });

        const restartedNames = uniqueNames.filter((name) => {
            const moduleInstance = modules.get(name);
            return !!(moduleInstance && moduleInstance.started);
        });

        stopMany(uniqueNames, {
            ...payload,
            reason: payload.reason || 'reload',
        });

        const cacheKeys = invalidateModules(uniqueNames, targetRecords, payload) || [];
        const nextInstances = new Map();
        for (const record of targetRecords) {
            nextInstances.set(record.name, createModuleInstance(record, payload));
        }

        for (const record of targetRecords) {
            const nextInstance = nextInstances.get(record.name);
            record.instance = nextInstance;
            modules.set(record.name, nextInstance);
        }

        startMany(restartedNames, {
            ...payload,
            source: payload.source || 'reload',
        });

        if (lastConfigPayload) {
            for (const name of restartedNames) {
                const moduleInstance = modules.get(name);
                if (!moduleInstance) continue;
                moduleInstance.applyConfig(lastConfigPayload);
            }
        }

        return {
            reloadedNames: [...uniqueNames],
            restartedNames,
            cacheKeys: [...cacheKeys],
        };
    }

    function emit(eventName, payload) {
        runtimeBus.emit(eventName, payload);
    }

    return {
        runtimeBus,
        modules,
        get order() {
            return [...order];
        },
        register,
        get,
        start,
        startMany,
        startAll,
        stop,
        stopMany,
        stopAll,
        reload,
        reloadMany,
        applyConfig,
        emit,
    };
}

module.exports = {
    createRuntimeModuleManager,
};
