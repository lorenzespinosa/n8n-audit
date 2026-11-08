import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { join } from 'node:path';
import { scoreWorkflow } from '../src/score.js';
import { scoreCredentials } from '../src/scoring/credentials.js';
import { longestChain, walkStrings } from '../src/workflow.js';
import { expressionDepth } from '../src/scoring/complexity.js';
import { renderMarkdown } from '../src/render/markdown.js';
import { run } from '../src/cli.js';

const sink = () => new Writable({ write(_, __, cb) { cb(); } });

function workflow(overrides = {}) {
  return {
    name: 'Demo',
    nodes: [{ name: 'A', type: 'n8n-nodes-base.noOp', position: [0, 0] }],
    connections: {},
    settings: {},
    ...overrides,
  };
}

test('standard headerParameters Authorization headers are scanned', () => {
  const wf = workflow({
    nodes: [
      {
        name: 'Webhook Call',
        type: 'n8n-nodes-base.httpRequest',
        position: [0, 0],
        parameters: {
          headerParameters: {
            parameters: [{ name: 'Authorization', value: 'Bearer tok_1234567890' }],
          },
        },
      },
    ],
  });
  const findings = scoreCredentials(wf);
  assert.ok(
    findings.findings.some((f) => /Authorization header with a literal credential/.test(f.detail)),
    'literal Authorization header under headerParameters must be flagged'
  );
  const legacy = workflow({
    nodes: [
      {
        ...wf.nodes[0],
        parameters: {
          headers: {
            parameters: [{ name: 'Authorization', value: 'Bearer tok_1234567890' }],
          },
        },
      },
    ],
  });
  assert.ok(
    scoreCredentials(legacy).findings.some((f) => /Authorization header with a literal credential/.test(f.detail)),
    'legacy headers shape is still scanned'
  );
});

test('deep linear workflows and deep parameter nesting do not crash', () => {
  const N = 10_000;
  const nodes = Array.from({ length: N }, (_, i) => ({
    name: `n${i}`,
    type: 'n8n-nodes-base.noOp',
    position: [0, 0],
  }));
  const connections = {};
  for (let i = 0; i + 1 < N; i++) {
    connections[`n${i}`] = { main: [[{ node: `n${i + 1}` }]] };
  }
  assert.equal(longestChain(connections), N);

  // 50k-deep nested object
  let deep = { value: 'leaf' };
  for (let i = 0; i < 50_000; i++) deep = { child: deep };
  let visited = 0;
  walkStrings(deep, () => visited++);
  assert.ok(visited >= 1);

  let nested = deep;
  const wf = workflow({ nodes: [{ ...nodes[0], parameters: nested }] });
  assert.equal(expressionDepth(wf).depth, 0); // no {{ }} anywhere, must not throw

  // scoring a huge chain must produce a finite score
  const score = scoreWorkflow(workflow({ nodes, connections }));
  assert.ok(Number.isFinite(score.score));
});

test('--min-score with a blank value is a usage error, not a zero gate', async () => {
  const code = await run(['node', 'n8n-audit', 'test/fixtures', '--min-score', ''], {
    out: sink(),
    err: sink(),
  });
  assert.equal(code, 2);
});

test('hostile workflow text cannot inject markdown or HTML into the report', () => {
  const wf = workflow({
    name: 'X\n\n# Fake Heading<script>alert(1)</script>',
    nodes: [
      {
        name: 'A[[link]](https://evil.example)',
        type: 'n8n-nodes-base.noOp',
        position: [0, 0],
      },
    ],
  });
  const report = {
    summary: {
      filesScanned: 1,
      workflowsAudited: 1,
      skippedFiles: 0,
      belowMinScore: 0,
    },
    minScore: 0,
    workflows: [
      {
        name: wf.name,
        file: 'evil.json',
        score: 100,
        categories: [
          {
            id: 'naming',
            label: 'Naming',
            score: 10,
            max: 10,
            findings: [{ node: wf.nodes[0].name, detail: 'node name with [markup](x)' }],
            recommendation: 'Rename',
          },
        ],
      },
    ],
    skipped: [{ file: 'skipped<script>.json', reason: 'not a workflow\n# heading' }],
  };
  const md = renderMarkdown(report);
  assert.ok(!/^#{1,6} Fake Heading/m.test(md), 'no injected heading line');
  assert.ok(!md.includes('<script>'), 'no raw HTML');
  assert.ok(!md.includes('[link]](https://evil.example)'), 'links are escaped');
  assert.ok(!/\n# heading/.test(md), 'skipped reasons cannot start a heading');
});

test('cyclic scoring does not depend on connection key order', () => {
  const build = (names) => {
    const connections = {};
    const node = (name) => ({ name, type: 'n8n-nodes-base.noOp', position: [0, 0] });
    const nodes = names.map(node);
    // A -> B -> C -> A, plus C -> D (an exit)
    connections.A = { main: [[{ node: 'B' }]] };
    connections.B = { main: [[{ node: 'C' }]] };
    connections.C = { main: [[{ node: 'A' }, { node: 'D' }]] };
    // rebuild with insertion order from the given names list
    const ordered = {};
    for (const n of names) ordered[n] = connections[n];
    return workflow({ nodes, connections: ordered });
  };
  const forward = build(['A', 'B', 'C']);
  const shuffled = build(['C', 'A', 'B']);
  assert.equal(
    scoreWorkflow(forward).score,
    scoreWorkflow(shuffled).score,
    'same graph, different key order, same score'
  );
});
