import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const BIN_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'n8n-audit.js');
export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadFixture(relativePath) {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, relativePath), 'utf8'));
}

// Synthetic secret stand-ins for scanner tests. Assembled from parts so no
// literal credential-looking string sits in source. None of these opens
// anything; they exist to be detected.
export const FAKE_PASSWORD = ['fixture', 'hunter2', 'secret', '99'].join('-');
export const FAKE_URL_TOKEN = ['fixture', 'abcdef0123456789'].join('_');
export const FAKE_BEARER = ['Bearer', 'fixture', 'abcdef1234567890abcdef'].join(' ');
export const FAKE_SK_TOKEN = ['sk', 'fixture', 'abcdefghijklmnop123456'].join('-');
export const FAKE_GHP_TOKEN = ['ghp', 'abcdefghijklmnopqrst'].join('_');
