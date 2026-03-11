const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeCredentialKind,
    evaluateAccountCutover,
    buildDrainCutoverReadiness,
} = require('../src/services/account-migration');

test('normalizeCredentialKind prefers auth ticket over login code', () => {
    assert.equal(normalizeCredentialKind({ code: 'abc', authTicket: 'ticket-1' }), 'auth_ticket');
    assert.equal(normalizeCredentialKind({ code: 'abc' }), 'login_code');
    assert.equal(normalizeCredentialKind({}), 'none');
});

test('evaluateAccountCutover marks running code-only accounts as relogin blockers', () => {
    const result = evaluateAccountCutover({
        running: true,
        code: 'used-code',
        authTicket: '',
    });

    assert.equal(result.cutoverEligible, false);
    assert.equal(result.cutoverReason, 'hot_migration_missing_relogin_required');
    assert.equal(result.needsReloginAfterStop, true);
});

test('buildDrainCutoverReadiness only blocks running assigned accounts on targeted nodes', () => {
    const readiness = buildDrainCutoverReadiness({
        accounts: [
            { id: '1', name: '账号一', running: true, code: 'used-code', platform: 'wx_car' },
            { id: '2', name: '账号二', running: true, code: 'used-code', platform: 'wx_car' },
            { id: '3', name: '账号三', running: false, code: 'used-code', platform: 'wx_car' },
        ],
        clusterNodes: [
            { nodeId: 'worker-a', assignedAccountIds: ['1', '3'] },
            { nodeId: 'worker-b', assignedAccountIds: ['2'] },
        ],
        targetNodeIds: ['worker-a'],
    });

    assert.equal(readiness.canDrainCutover, false);
    assert.equal(readiness.runningAccountCount, 2);
    assert.equal(readiness.targetedRunningAccountCount, 1);
    assert.equal(readiness.blockerCount, 1);
    assert.equal(readiness.blockers[0].accountId, '1');
    assert.equal(readiness.blockers[0].nodeId, 'worker-a');
});
