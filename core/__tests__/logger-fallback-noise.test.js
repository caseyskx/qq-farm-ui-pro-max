const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const loggerModulePath = require.resolve('../src/services/logger');
const runtimePathsModulePath = require.resolve('../src/config/runtime-paths');
const winstonModulePath = require.resolve('winston');

function mockModule(modulePath, exports) {
    const previous = require.cache[modulePath];
    require.cache[modulePath] = {
        id: modulePath,
        filename: modulePath,
        loaded: true,
        exports,
    };

    return () => {
        if (previous) require.cache[modulePath] = previous;
        else delete require.cache[modulePath];
    };
}

function createRuntimePathsMock(rootDir) {
    const logDir = path.join(rootDir, 'logs');
    return {
        ensureLogDir() {
            fs.mkdirSync(logDir, { recursive: true });
            return logDir;
        },
    };
}

async function runFallbackLoggerScenario(consoleLevel) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fallback-logger-'));
    const previousLevel = process.env.FARM_FALLBACK_CONSOLE_LEVEL;
    if (consoleLevel === undefined) delete process.env.FARM_FALLBACK_CONSOLE_LEVEL;
    else process.env.FARM_FALLBACK_CONSOLE_LEVEL = consoleLevel;

    const stdoutLines = [];
    const stderrLines = [];
    const previousStdoutWrite = process.stdout.write;
    const previousStderrWrite = process.stderr.write;
    process.stdout.write = (chunk, ...args) => {
        stdoutLines.push(String(chunk));
        if (typeof args[args.length - 1] === 'function') {
            args[args.length - 1]();
        }
        return true;
    };
    process.stderr.write = (chunk, ...args) => {
        stderrLines.push(String(chunk));
        if (typeof args[args.length - 1] === 'function') {
            args[args.length - 1]();
        }
        return true;
    };

    const restoreRuntimePaths = mockModule(runtimePathsModulePath, createRuntimePathsMock(tempRoot));
    const restoreWinston = mockModule(winstonModulePath, null);

    try {
        delete require.cache[loggerModulePath];
        const { createModuleLogger } = require(loggerModulePath);
        const logger = createModuleLogger('fallback-test');
        logger.info('info message', { scope: 'info' });
        logger.warn('warn message', { scope: 'warn' });
        logger.error('error message', { scope: 'error' });
        logger.debug('debug message', { scope: 'debug' });

        const combinedLogPath = path.join(tempRoot, 'logs', 'combined.log');
        const combinedLog = fs.readFileSync(combinedLogPath, 'utf8');
        return {
            stdoutLines,
            stderrLines,
            combinedLog,
        };
    } finally {
        process.stdout.write = previousStdoutWrite;
        process.stderr.write = previousStderrWrite;
        delete require.cache[loggerModulePath];
        restoreWinston();
        restoreRuntimePaths();
        if (previousLevel === undefined) delete process.env.FARM_FALLBACK_CONSOLE_LEVEL;
        else process.env.FARM_FALLBACK_CONSOLE_LEVEL = previousLevel;
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

test('fallback logger only emits warn and error to terminal by default', async () => {
    const { stdoutLines, stderrLines, combinedLog } = await runFallbackLoggerScenario(undefined);

    assert.equal(stdoutLines.length, 0);
    assert.equal(stderrLines.some(line => line.includes('[warn]') && line.includes('warn message')), true);
    assert.equal(stderrLines.some(line => line.includes('[error]') && line.includes('error message')), true);
    assert.equal(stderrLines.some(line => line.includes('[info]')), false);
    assert.equal(stderrLines.some(line => line.includes('[debug]')), false);
    assert.match(combinedLog, /"message":"info message"/);
    assert.match(combinedLog, /"message":"debug message"/);
});

test('fallback logger emits all levels to terminal when FARM_FALLBACK_CONSOLE_LEVEL=debug', async () => {
    const { stdoutLines, stderrLines } = await runFallbackLoggerScenario('debug');

    assert.equal(stdoutLines.some(line => line.includes('[info]') && line.includes('info message')), true);
    assert.equal(stdoutLines.some(line => line.includes('[debug]') && line.includes('debug message')), true);
    assert.equal(stderrLines.some(line => line.includes('[warn]') && line.includes('warn message')), true);
    assert.equal(stderrLines.some(line => line.includes('[error]') && line.includes('error message')), true);
});
