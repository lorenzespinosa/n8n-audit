import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../src/cli.js';
import { FIXTURES_DIR, BIN_PATH } from './helpers.js';

function capture() {
  const chunks = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  stream.text = () => chunks.join('');
  return stream;
}

function runCli(args) {
  const out = capture();
  const err = capture();
  const status = run(args, out, err);
  return { status, stdout: out.text(), stderr: err.text() };
}

test('no arguments prints usage and exits 2', () => {
  const result = runCli([]);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('Usage:'));
  assert.ok(result.stderr.includes('--min-score'));
});

test('unknown option exits 2', () => {
  const result = runCli([FIXTURES_DIR, '--nope']);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes("unknown option '--nope'"));
});

test('invalid format exits 2', () => {
  const result = runCli([FIXTURES_DIR, '--format', 'xml']);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes("unknown format 'xml'"));
});

test('invalid min-score exits 2', () => {
  assert.equal(runCli([FIXTURES_DIR, '--min-score', 'abc']).status, 2);
  assert.equal(runCli([FIXTURES_DIR, '--min-score', '101']).status, 2);
  assert.equal(runCli([FIXTURES_DIR, '--min-score']).status, 2);
});

test('extra positional argument exits 2', () => {
  const result = runCli([FIXTURES_DIR, join(FIXTURES_DIR, 'nested')]);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('unexpected extra argument'));
});

test('missing path exits 2', () => {
  const result = runCli(['/definitely/not/here']);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('path not found'));
});

test('a non-workflow JSON file argument exits 2', () => {
  const result = runCli([join(FIXTURES_DIR, '10-not-a-workflow.json')]);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('does not look like an n8n workflow'));
});

test('an invalid JSON file argument exits 2', () => {
  const result = runCli([join(FIXTURES_DIR, '11-broken.json')]);
  assert.equal(result.status, 2);
  assert.ok(result.stderr.includes('not valid JSON'));
});

test('help exits 0', () => {
  for (const flag of ['--help', '-h']) {
    const result = runCli([flag]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('--format'));
    assert.ok(result.stdout.includes('--min-score'));
  }
});

test('version exits 0 and prints the package version', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('fixtures directory reports 1 workflow below the default min score, exit 1', () => {
  const result = runCli([FIXTURES_DIR]);
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes('# n8n-audit report'));
  assert.ok(result.stdout.includes('Audited 10 workflows, skipped 2'));
  assert.ok(result.stdout.includes('1 below'));
});

test('lowering the min score flips the exit code to 0', () => {
  const result = runCli([FIXTURES_DIR, '--min-score', '10']);
  assert.equal(result.status, 0);
});

test('a passing single file exits 0', () => {
  const result = runCli([join(FIXTURES_DIR, '01-clean-crm-sync.json')]);
  assert.equal(result.status, 0);
  assert.ok(result.stdout.includes('100/100 CRM nightly sync'));
});

test('a failing single file exits 1, and a lower threshold passes it', () => {
  const failing = join(FIXTURES_DIR, '02-dirty-mess.json');
  assert.equal(runCli([failing]).status, 1);
  assert.equal(runCli([failing, '--min-score', '20']).status, 0);
});

test('min score boundary is inclusive', () => {
  const failing = join(FIXTURES_DIR, '02-dirty-mess.json');
  assert.equal(runCli([failing, '--min-score', '28']).status, 0);
  assert.equal(runCli([failing, '--min-score', '29']).status, 1);
});

test('--format=json emits parseable JSON with the right exit code', () => {
  const result = runCli([FIXTURES_DIR, '--format=json']);
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.summary.workflowsAudited, 10);
  assert.equal(parsed.workflows[0].file, '02-dirty-mess.json');
});

test('--format=html works with an inline value', () => {
  const result = runCli([join(FIXTURES_DIR, '01-clean-crm-sync.json'), '--format=html']);
  assert.equal(result.status, 0);
  assert.ok(result.stdout.startsWith('<!DOCTYPE html>'));
});

test('the bin entry is wired to the cli', async () => {
  const source = await readFile(BIN_PATH, 'utf8');
  assert.match(source, /from '\.\.\/src\/cli\.js'/);
  assert.match(source, /run\(process\.argv\.slice\(2\)\)/);
});
