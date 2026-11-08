import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/render/markdown.js';
import { renderHtml } from '../src/render/html.js';
import { renderJson } from '../src/render/json.js';
import { buildReport } from '../src/score.js';
import { collect } from '../src/collect.js';
import { FIXTURES_DIR } from './helpers.js';

function buildFixtureReport() {
  const collected = collect(FIXTURES_DIR);
  return buildReport({
    entries: collected.entries,
    skipped: collected.skipped,
    filesScanned: collected.filesScanned,
    minScore: 70,
    version: '0.1.0',
    root: 'test/fixtures',
  });
}

test('markdown report has a summary and a worst-first table', () => {
  const md = renderMarkdown(buildFixtureReport());
  assert.ok(md.startsWith('# n8n-audit report'));
  assert.ok(md.includes('| Score | Workflow | File | Error | Cred | Naming | Cmplx | Hygiene |'));
  const dirtyLine = md.split('\n').find((l) => l.includes('Everything wrong'));
  assert.ok(dirtyLine, 'dirty workflow row missing');
  assert.ok(dirtyLine.startsWith('| 28 |'));
  assert.ok(md.includes('## 28/100 Everything wrong'));
});

test('markdown shows findings and recommendations per category', () => {
  const md = renderMarkdown(buildFixtureReport());
  assert.ok(md.includes('### Error handling 0/20'));
  assert.ok(md.includes("has no error branch, onError setting or continueOnFail."));
  assert.ok(md.includes('Recommendation: '));
  assert.ok(md.includes('- No findings.'));
});

test('markdown lists skipped files with reasons', () => {
  const md = renderMarkdown(buildFixtureReport());
  assert.ok(md.includes('## Skipped files'));
  assert.ok(md.includes('10-not-a-workflow.json: not an n8n workflow'));
  assert.ok(md.includes('11-broken.json: invalid JSON'));
});

test('html report is one self-contained file with inline CSS', () => {
  const html = renderHtml(buildFixtureReport());
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<style>'));
  assert.ok(html.includes('</html>'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.toLowerCase().includes('stylesheet" href'));
  assert.ok(!html.toLowerCase().includes('<img'));
  assert.ok(html.includes('Everything wrong'));
  assert.ok(html.includes('Recommendation:'));
});

test('html escapes workflow names', () => {
  const report = buildFixtureReport();
  report.workflows[0].name = 'Evil <script> & "quotes"';
  const html = renderHtml(report);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('json report parses and matches the documented shape', () => {
  const parsed = JSON.parse(renderJson(buildFixtureReport()));
  assert.equal(parsed.tool, 'n8n-audit');
  assert.equal(parsed.version, '0.1.0');
  assert.equal(typeof parsed.generatedAt, 'string');
  assert.equal(parsed.minScore, 70);

  assert.deepEqual(Object.keys(parsed.summary), [
    'filesScanned',
    'workflowsAudited',
    'skippedFiles',
    'belowMinScore',
  ]);
  assert.equal(parsed.summary.filesScanned, 12);
  assert.equal(parsed.summary.workflowsAudited, 10);
  assert.equal(parsed.summary.skippedFiles, 2);
  assert.equal(parsed.summary.belowMinScore, 1);

  assert.equal(parsed.skipped.length, 2);
  for (const item of parsed.skipped) {
    assert.deepEqual(Object.keys(item), ['file', 'reason']);
  }

  const workflow = parsed.workflows[0];
  assert.deepEqual(
    Object.keys(workflow),
    ['file', 'name', 'active', 'score', 'passed', 'categories']
  );
  assert.equal(workflow.file, '02-dirty-mess.json');
  assert.equal(workflow.score, 28);
  assert.equal(workflow.passed, false);

  const category = workflow.categories[0];
  assert.deepEqual(Object.keys(category), [
    'id',
    'label',
    'score',
    'max',
    'findings',
    'recommendation',
  ]);
  const finding = category.findings.find((f) => f.node);
  assert.deepEqual(Object.keys(finding), ['node', 'detail']);
});

test('json workflows are ordered worst-first', () => {
  const parsed = JSON.parse(renderJson(buildFixtureReport()));
  const scores = parsed.workflows.map((w) => w.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
});
