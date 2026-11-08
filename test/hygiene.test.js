import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHygiene } from '../src/scoring/hygiene.js';
import { loadFixture } from './helpers.js';

test('clean fixture scores a full 20', () => {
  const result = scoreHygiene(loadFixture('01-clean-crm-sync.json'));
  assert.equal(result.score, 20);
  assert.equal(result.findings.length, 0);
});

test('dead, disabled and empty sticky findings are all reported', () => {
  const result = scoreHygiene(loadFixture('07-hygiene-issues.json'));
  assert.equal(result.score, 12);
  assert.equal(result.findings.length, 3);
  const details = result.findings.map((f) => f.detail);
  assert.ok(details.some((d) => d.includes('not connected')));
  assert.ok(details.some((d) => d.includes('disabled')));
  assert.ok(details.some((d) => d.includes('no content')));
});

test('triggers and sticky notes are never dead nodes', () => {
  const workflow = {
    nodes: [
      { name: 'Hook', type: 'n8n-nodes-base.webhook', parameters: {} },
      { name: 'Note', type: 'n8n-nodes-base.stickyNote', parameters: { content: 'docs' } },
    ],
    connections: {},
  };
  assert.equal(scoreHygiene(workflow).score, 20);
});

test('a filled sticky note is fine, an empty one is flagged', () => {
  const workflow = {
    nodes: [
      { name: 'Go', type: 'n8n-nodes-base.manualTrigger', parameters: {} },
      { name: 'A', type: 'n8n-nodes-base.set', parameters: {} },
      { name: 'Full note', type: 'n8n-nodes-base.stickyNote', parameters: { content: 'why' } },
      { name: 'Hollow note', type: 'n8n-nodes-base.stickyNote', parameters: { content: '   ' } },
    ],
    connections: { Go: { main: [[{ node: 'A' }]] } },
  };
  const result = scoreHygiene(workflow);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].node, 'Hollow note');
});

test('an empty workflow scores 20', () => {
  assert.equal(scoreHygiene(loadFixture('09-empty-workflow.json')).score, 20);
});
