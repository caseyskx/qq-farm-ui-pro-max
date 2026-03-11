const test = require('node:test');
const assert = require('node:assert/strict');

const { parseArgs } = require('../scripts/update-agent-bridge');

test('parseArgs keeps empty-string option values instead of converting them to boolean flags', () => {
    const args = parseArgs([
        'heartbeat',
        '--job-id', '0',
        '--job-status', '',
        '--target-version', '',
    ]);

    assert.equal(args._[0], 'heartbeat');
    assert.equal(args['job-id'], '0');
    assert.equal(args['job-status'], '');
    assert.equal(args['target-version'], '');
});

test('parseArgs still treats standalone flags as enabled', () => {
    const args = parseArgs(['claim', '--format', 'tsv', '--verbose']);

    assert.equal(args._[0], 'claim');
    assert.equal(args.format, 'tsv');
    assert.equal(args.verbose, '1');
});
