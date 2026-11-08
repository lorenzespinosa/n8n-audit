import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreComplexity, expressionDepth } from '../src/scoring/complexity.js';
import { loadFixture } from './helpers.js';

// A trigger fanning out to N parallel nodes. Chain length stays at 2,
// so only the node-count penalty varies with N.
function fanOutWorkflow(count) {
  const nodes = [{ name: 'Go', type: 'n8n-nodes-base.manualTrigger', parameters: {} }];
  const targets = [];
  for (let i = 1; i < count; i++) {
    nodes.push({ name: `N${i}`, type: 'n8n-nodes-base.set', parameters: {} });
    targets.push({ node: `N${i}` });
  }
  return {
    name: 'Fan out',
    nodes,
    connections: { Go: { main: [targets] } },
    settings: {},
  };
}

test('small workflows score a full 20', () => {
  assert.equal(scoreComplexity(loadFixture('01-clean-crm-sync.json')).score, 20);
  assert.equal(scoreComplexity(loadFixture('09-empty-workflow.json')).score, 20);
});

test('the heavy fixture lands gently at 10, not at a cliff', () => {
  const result = scoreComplexity(loadFixture('06-heavy-pipeline.json'));
  assert.equal(result.score, 10);
  assert.equal(result.findings.length, 3);
});

test('node count penalty ramps smoothly between 25 and 100 nodes', () => {
  const at25 = scoreComplexity(fanOutWorkflow(25));
  const at50 = scoreComplexity(fanOutWorkflow(50));
  assert.equal(at25.score, 20);
  assert.ok(at50.score < 20 && at50.score > 5, `expected gentle middle, got ${at50.score}`);
});

test('a 100 node workflow keeps half its complexity points', () => {
  const result = scoreComplexity(fanOutWorkflow(100));
  assert.equal(result.score, 10);
});

test('expression depth counts packed expressions in one value', () => {
  const workflow = {
    nodes: [
      {
        name: 'Packed',
        type: 'n8n-nodes-base.set',
        parameters: {
          value: 'a {{ $json.x }} b {{ $json.y }} c {{ $json.z }} d {{ $json.w }} e {{ $json.v }}',
        },
      },
    ],
  };
  const { depth, node } = expressionDepth(workflow);
  assert.equal(depth, 5);
  assert.equal(node, 'Packed');
  const result = scoreComplexity(workflow);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].detail, /5 expressions/);
});

test('a couple of expressions per value cost nothing', () => {
  const workflow = {
    nodes: [
      {
        name: 'Light',
        type: 'n8n-nodes-base.set',
        parameters: { value: '{{ $json.a }} and {{ $json.b }}' },
      },
    ],
  };
  assert.equal(scoreComplexity(workflow).score, 20);
});

test('recommendation points at the biggest penalty source', () => {
  assert.match(
    scoreComplexity(loadFixture('06-heavy-pipeline.json')).recommendation,
    /chain/i
  );
});
