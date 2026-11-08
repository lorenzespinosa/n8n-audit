import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, discoverJsonFiles, AuditError } from '../src/collect.js';
import { FIXTURES_DIR, loadFixture } from './helpers.js';

test('directory scan finds workflows recursively and skips others gently', () => {
  const result = collect(FIXTURES_DIR);
  assert.equal(result.filesScanned, 12);
  assert.equal(result.entries.length, 10);
  assert.equal(result.skipped.length, 2);

  const skipped = Object.fromEntries(result.skipped.map((s) => [s.file, s.reason]));
  assert.equal(skipped['10-not-a-workflow.json'], 'not an n8n workflow');
  assert.equal(skipped['11-broken.json'], 'invalid JSON');

  const files = result.entries.map((e) => e.file);
  assert.ok(files.includes('nested/12-nested-status-ping.json'));
  assert.ok(files.includes('01-clean-crm-sync.json'));
});

test('single file mode audits one workflow', () => {
  const result = collect(join(FIXTURES_DIR, '01-clean-crm-sync.json'));
  assert.equal(result.filesScanned, 1);
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].file, '01-clean-crm-sync.json');
  assert.equal(result.entries[0].workflow.name, 'CRM nightly sync');
});

test('single file mode rejects a non-workflow JSON file', () => {
  assert.throws(
    () => collect(join(FIXTURES_DIR, '10-not-a-workflow.json')),
    AuditError
  );
});

test('single file mode rejects invalid JSON and non-JSON files', () => {
  assert.throws(() => collect(join(FIXTURES_DIR, '11-broken.json')), AuditError);
  assert.throws(() => collect(join(FIXTURES_DIR, '..', 'helpers.js')), AuditError);
});

test('missing paths raise an AuditError', () => {
  assert.throws(() => collect('/definitely/not/here.json'), AuditError);
});

test('directory scan ignores hidden dirs and node_modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'n8n-audit-collect-'));
  try {
    writeFileSync(
      join(dir, 'real.json'),
      JSON.stringify(loadFixture('09-empty-workflow.json'))
    );
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(
      join(dir, 'node_modules', 'hidden.json'),
      JSON.stringify(loadFixture('09-empty-workflow.json'))
    );
    mkdirSync(join(dir, '.git'));
    writeFileSync(
      join(dir, '.git', 'config.json'),
      JSON.stringify(loadFixture('09-empty-workflow.json'))
    );
    mkdirSync(join(dir, 'sub'));
    writeFileSync(
      join(dir, 'sub', 'deep.json'),
      JSON.stringify(loadFixture('09-empty-workflow.json'))
    );

    const files = discoverJsonFiles(dir);
    assert.deepEqual(files.map((f) => f.split('/').pop()), ['real.json', 'deep.json']);

    const result = collect(dir);
    assert.equal(result.entries.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an empty directory audits nothing without error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'n8n-audit-empty-'));
  try {
    const result = collect(dir);
    assert.equal(result.filesScanned, 0);
    assert.equal(result.entries.length, 0);
    assert.equal(result.skipped.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
