const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const scriptPath = path.resolve(__dirname, '../../scripts/utils/check-workspace-permissions.sh');

function createWorkspaceFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-permissions-'));
    fs.mkdirSync(path.join(root, 'web', 'node_modules'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), '{}');
    fs.writeFileSync(path.join(root, 'web', 'package.json'), '{}');

    const ownershipAuditScript = path.join(root, 'ownership-audit.sh');
    fs.writeFileSync(
        ownershipAuditScript,
        '#!/usr/bin/env bash\nset -euo pipefail\necho "[ownership-audit] fixture clean"\n',
    );
    fs.chmodSync(ownershipAuditScript, 0o755);

    return { root, ownershipAuditScript };
}

function runPermissionAudit(root, ownershipAuditScript) {
    return spawnSync('bash', [scriptPath], {
        encoding: 'utf8',
        env: {
            ...process.env,
            WORKSPACE_PERMISSION_ROOT: root,
            WORKSPACE_OWNERSHIP_AUDIT_SCRIPT: ownershipAuditScript,
            WORKSPACE_PERMISSION_LIMIT: '10',
        },
    });
}

test('check-workspace-permissions passes for a clean workspace fixture', () => {
    const { root, ownershipAuditScript } = createWorkspaceFixture();

    try {
        const result = runPermissionAudit(root, ownershipAuditScript);
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, /\[ownership-audit] fixture clean/);
        assert.match(result.stdout, /\[permission-audit] web \(excluding node_modules\): clean/);
        assert.match(result.stdout, /\[permission-audit] scripts \(excluding symlinks\): clean/);
        assert.match(result.stdout, /\[permission-audit] package manifests: clean/);
        assert.match(result.stdout, /\[permission-audit] workspace permission and ownership checks passed/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('check-workspace-permissions reports world-writable script files and ignores node_modules noise', () => {
    const { root, ownershipAuditScript } = createWorkspaceFixture();
    const noisyNodeModulesFile = path.join(root, 'web', 'node_modules', 'ignored.txt');
    const badScriptFile = path.join(root, 'scripts', 'problem.txt');
    const logTarget = path.join(root, 'logs');

    fs.writeFileSync(noisyNodeModulesFile, 'ignore me');
    fs.writeFileSync(badScriptFile, 'bad perms');
    fs.mkdirSync(logTarget, { recursive: true });
    fs.symlinkSync('../logs', path.join(root, 'scripts', 'logs'));
    fs.chmodSync(noisyNodeModulesFile, 0o666);
    fs.chmodSync(badScriptFile, 0o666);

    try {
        const result = runPermissionAudit(root, ownershipAuditScript);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /\[permission-audit] scripts \(excluding symlinks\): found 1 world-writable path\(s\)/);
        assert.match(result.stdout, /scripts\/problem.txt/);
        assert.doesNotMatch(result.stdout, /web\/node_modules\/ignored.txt/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('check-workspace-permissions fails fast when the ownership audit script is missing', () => {
    const { root } = createWorkspaceFixture();
    const missingOwnershipAuditScript = path.join(root, 'missing-ownership-audit.sh');

    try {
        const result = runPermissionAudit(root, missingOwnershipAuditScript);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /\[permission-audit] ownership audit script not found:/);
        assert.match(result.stdout, /missing-ownership-audit\.sh/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('check-workspace-permissions reports world-writable package manifests', () => {
    const { root, ownershipAuditScript } = createWorkspaceFixture();
    const badManifest = path.join(root, 'web', 'package.json');
    fs.chmodSync(badManifest, 0o666);

    try {
        const result = runPermissionAudit(root, ownershipAuditScript);
        assert.equal(result.status, 1, result.stdout);
        assert.match(result.stdout, /\[permission-audit] package manifests: found 1 world-writable path\(s\)/);
        assert.match(result.stdout, /web\/package\.json/);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
