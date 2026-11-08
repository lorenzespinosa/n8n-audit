import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreNaming, isAutoName } from '../src/scoring/naming.js';
import { loadFixture } from './helpers.js';

test('auto names are stock labels with or without a digit suffix', () => {
  assert.equal(isAutoName('HTTP Request1'), true);
  assert.equal(isAutoName('HTTP Request'), true);
  assert.equal(isAutoName('Code'), true);
  assert.equal(isAutoName('Code2'), true);
  assert.equal(isAutoName('Set1'), true);
  assert.equal(isAutoName('Sticky Note3'), true);
  assert.equal(isAutoName('Webhook'), true);
});

test('meaningful names are not auto names', () => {
  assert.equal(isAutoName('Fetch deals'), false);
  assert.equal(isAutoName('Step 01'), false);
  assert.equal(isAutoName('Note2'), false);
  assert.equal(isAutoName('Upsert into Postgres'), false);
});

test('all auto names score 0', () => {
  const result = scoreNaming(loadFixture('05-auto-named.json'));
  assert.equal(result.score, 0);
  assert.equal(result.findings.length, 5);
});

test('clean fixture scores 20', () => {
  const result = scoreNaming(loadFixture('01-clean-crm-sync.json'));
  assert.equal(result.score, 20);
  assert.equal(result.findings.length, 0);
});

test('score follows the meaningful share', () => {
  const workflow = {
    nodes: [
      { name: 'Webhook', type: 'n8n-nodes-base.webhook' },
      { name: 'Call tickets API', type: 'n8n-nodes-base.httpRequest' },
      { name: 'Call users API', type: 'n8n-nodes-base.httpRequest' },
      { name: 'Format response', type: 'n8n-nodes-base.code' },
    ],
  };
  assert.equal(scoreNaming(workflow).score, 15);
});

test('an empty workflow scores 20', () => {
  assert.equal(scoreNaming(loadFixture('09-empty-workflow.json')).score, 20);
});
