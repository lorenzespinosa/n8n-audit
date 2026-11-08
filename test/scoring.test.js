import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreWorkflow, buildReport } from '../src/score.js';
import { loadFixture } from './helpers.js';

// Hand-computed expectations, one per fixture. Category order:
// error handling, credential hygiene, naming, complexity, hygiene.
const EXPECTED = {
  '01-clean-crm-sync.json': { score: 100, categories: [20, 20, 20, 20, 20] },
  '02-dirty-mess.json': { score: 28, categories: [0, 0, 0, 19, 9] },
  '03-no-error-handling.json': { score: 80, categories: [0, 20, 20, 20, 20] },
  '04-plaintext-secrets.json': { score: 76, categories: [16, 0, 20, 20, 20] },
  '05-auto-named.json': { score: 76, categories: [16, 20, 0, 20, 20] },
  '06-heavy-pipeline.json': { score: 90, categories: [20, 20, 20, 10, 20] },
  '07-hygiene-issues.json': { score: 88, categories: [16, 20, 20, 20, 12] },
  '08-partial-webhook-api.json': { score: 90, categories: [15, 20, 15, 20, 20] },
  '09-empty-workflow.json': { score: 96, categories: [16, 20, 20, 20, 20] },
  'nested/12-nested-status-ping.json': { score: 100, categories: [20, 20, 20, 20, 20] },
};

for (const [file, expected] of Object.entries(EXPECTED)) {
  test(`${file} scores ${expected.score}`, () => {
    const result = scoreWorkflow(loadFixture(file));
    assert.equal(result.score, expected.score, JSON.stringify(result.categories));
    assert.deepEqual(
      result.categories.map((c) => c.score),
      expected.categories
    );
    for (const category of result.categories) {
      assert.equal(category.max, 20);
      assert.ok(category.score >= 0 && category.score <= 20);
      assert.equal(typeof category.recommendation, 'string');
      assert.ok(category.recommendation.length > 0);
      assert.ok(Array.isArray(category.findings));
    }
  });
}

test('category ids are stable and ordered', () => {
  const result = scoreWorkflow(loadFixture('01-clean-crm-sync.json'));
  assert.deepEqual(
    result.categories.map((c) => c.id),
    ['error-handling', 'credential-hygiene', 'naming', 'complexity', 'hygiene']
  );
});

test('buildReport orders workflows worst-first with stable ties', () => {
  const entries = Object.keys(EXPECTED).map((file) => ({
    file,
    workflow: loadFixture(file),
  }));
  const report = buildReport({
    entries,
    skipped: [{ file: 'z.json', reason: 'not an n8n workflow' }],
    filesScanned: entries.length + 1,
    minScore: 70,
    version: '0.1.0',
    root: 'fixtures/',
  });

  assert.deepEqual(
    report.workflows.map((w) => w.file),
    [
      '02-dirty-mess.json',
      '04-plaintext-secrets.json',
      '05-auto-named.json',
      '03-no-error-handling.json',
      '07-hygiene-issues.json',
      '06-heavy-pipeline.json',
      '08-partial-webhook-api.json',
      '09-empty-workflow.json',
      '01-clean-crm-sync.json',
      'nested/12-nested-status-ping.json',
    ]
  );

  const scores = report.workflows.map((w) => w.score);
  const sorted = [...scores].sort((a, b) => a - b);
  assert.deepEqual(scores, sorted);
});

test('buildReport marks pass and fail against the min score', () => {
  const entries = [
    { file: 'a.json', workflow: loadFixture('01-clean-crm-sync.json') },
    { file: 'b.json', workflow: loadFixture('02-dirty-mess.json') },
  ];
  const report = buildReport({
    entries,
    skipped: [],
    filesScanned: 2,
    minScore: 70,
    version: '0.1.0',
    root: '.',
  });
  assert.equal(report.summary.belowMinScore, 1);
  const byFile = Object.fromEntries(report.workflows.map((w) => [w.file, w]));
  assert.equal(byFile['a.json'].passed, true);
  assert.equal(byFile['b.json'].passed, false);
});

test('min score boundary is inclusive', () => {
  const entries = [{ file: 'b.json', workflow: loadFixture('02-dirty-mess.json') }];
  const report = buildReport({
    entries,
    skipped: [],
    filesScanned: 1,
    minScore: 28,
    version: '0.1.0',
    root: '.',
  });
  assert.equal(report.workflows[0].passed, true);
});
