import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreErrorHandling } from '../src/scoring/error-handling.js';
import { loadFixture } from './helpers.js';

test('clean fixture scores a full 20', () => {
  const result = scoreErrorHandling(loadFixture('01-clean-crm-sync.json'));
  assert.equal(result.score, 20);
  assert.equal(result.findings.length, 0);
  assert.equal(result.recommendation, 'Error handling looks good.');
});

test('no error handling anywhere scores 0 with one finding per fallible node', () => {
  const result = scoreErrorHandling(loadFixture('03-no-error-handling.json'));
  assert.equal(result.score, 0);
  assert.equal(result.findings.length, 4);
  const nodeFindings = result.findings.filter((f) => f.node);
  assert.deepEqual(
    nodeFindings.map((f) => f.node).sort(),
    ['Call payments API', 'Save to ledger', 'Validate payload']
  );
});

test('partial coverage with error workflow set scores 15', () => {
  const result = scoreErrorHandling(loadFixture('08-partial-webhook-api.json'));
  assert.equal(result.score, 15);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].node, 'Call users API');
});

test('a workflow with no fallible nodes keeps the 16 coverage points', () => {
  const result = scoreErrorHandling(loadFixture('06-heavy-pipeline.json'));
  assert.equal(result.score, 20);
});

test('legacy continueOnFail counts as an error branch', () => {
  const workflow = {
    name: 'Legacy',
    nodes: [
      { name: 'Fetch', type: 'n8n-nodes-base.httpRequest', continueOnFail: true, parameters: {} },
    ],
    connections: {},
    settings: { errorWorkflow: 'wf_x' },
  };
  assert.equal(scoreErrorHandling(workflow).score, 20);
});

test('a wired second main output counts as an error branch', () => {
  const workflow = {
    name: 'Wired',
    nodes: [
      { name: 'Fetch', type: 'n8n-nodes-base.httpRequest', parameters: {} },
      { name: 'Handle error', type: 'n8n-nodes-base.noOp', parameters: {} },
    ],
    connections: {
      Fetch: { main: [[], [{ node: 'Handle error' }]] },
    },
    settings: {},
  };
  assert.equal(scoreErrorHandling(workflow).score, 16);
});

test('empty workflow gets 16 and only the error workflow finding', () => {
  const result = scoreErrorHandling(loadFixture('09-empty-workflow.json'));
  assert.equal(result.score, 16);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].node, undefined);
});
