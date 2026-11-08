import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCredentials } from '../src/scoring/credentials.js';
import {
  loadFixture,
  FAKE_PASSWORD,
  FAKE_URL_TOKEN,
  FAKE_BEARER,
  FAKE_SK_TOKEN,
  FAKE_GHP_TOKEN,
} from './helpers.js';

const EXPR_PASSWORD = ['{{', '$vars.db_password', '}}'].join(' ');
const EXPR_BEARER = ['Bearer', '{{ $vars.token }}'].join(' ');
const PLACEHOLDER_URL = ['https://api.example.com/x?token=', '<your-token-here>'].join('');

test('clean fixture has no credential findings', () => {
  const result = scoreCredentials(loadFixture('01-clean-crm-sync.json'));
  assert.equal(result.score, 20);
  assert.equal(result.findings.length, 0);
});

test('each leaked secret kind in the secrets fixture produces exactly one finding', () => {
  const result = scoreCredentials(loadFixture('04-plaintext-secrets.json'));
  assert.equal(result.score, 0);
  assert.equal(result.findings.length, 4);
  const nodes = result.findings.map((f) => f.node).sort();
  assert.deepEqual(nodes, ['Query legacy CRM', 'Query legacy CRM', 'Read admin DB', 'Transform rows']);
});

test('a literal Authorization header is flagged', () => {
  const workflow = {
    nodes: [
      {
        name: 'Call API',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: 'https://api.example.com/v1',
          headers: { parameters: [{ name: 'Authorization', value: FAKE_BEARER }] },
        },
      },
    ],
  };
  const result = scoreCredentials(workflow);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].detail, /Authorization header/);
});

test('an expression-backed Authorization header is fine', () => {
  const workflow = {
    nodes: [
      {
        name: 'Call API',
        type: 'n8n-nodes-base.httpRequest',
        parameters: {
          url: 'https://api.example.com/v1',
          headers: {
            parameters: [{ name: 'Authorization', value: EXPR_BEARER }],
          },
        },
      },
    ],
  };
  assert.equal(scoreCredentials(workflow).score, 20);
});

test('a token in a URL query string is flagged', () => {
  const url = `https://api.example.com/x?api_key=${FAKE_URL_TOKEN}`;
  const workflow = {
    nodes: [
      { name: 'Fetch', type: 'n8n-nodes-base.httpRequest', parameters: { url } },
    ],
  };
  const result = scoreCredentials(workflow);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].detail, /api_key/);
});

test('a secret-named parameter with a literal value is flagged', () => {
  const workflow = {
    nodes: [
      {
        name: 'DB',
        type: 'n8n-nodes-base.postgres',
        parameters: { password: FAKE_PASSWORD },
      },
    ],
  };
  const result = scoreCredentials(workflow);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].detail, /password/);
});

test('placeholder and expression values are not flagged', () => {
  const workflow = {
    nodes: [
      {
        name: 'DB',
        type: 'n8n-nodes-base.postgres',
        parameters: { password: EXPR_PASSWORD },
      },
      {
        name: 'Other',
        type: 'n8n-nodes-base.httpRequest',
        parameters: { url: PLACEHOLDER_URL },
      },
    ],
  };
  assert.equal(scoreCredentials(workflow).score, 20);
});

test('well-known token patterns are flagged even outside secret keys', () => {
  const workflow = {
    nodes: [
      {
        name: 'Transform',
        type: 'n8n-nodes-base.code',
        parameters: { jsCode: `const key = '${FAKE_GHP_TOKEN}';` },
      },
    ],
  };
  const result = scoreCredentials(workflow);
  assert.equal(result.findings.length, 1);
  assert.match(result.findings[0].detail, /hardcoded token/);
});

test('findings never echo the secret value', () => {
  const workflow = {
    nodes: [
      {
        name: 'DB',
        type: 'n8n-nodes-base.postgres',
        parameters: { password: FAKE_SK_TOKEN },
      },
    ],
  };
  const text = JSON.stringify(scoreCredentials(workflow).findings);
  assert.ok(!text.includes(FAKE_SK_TOKEN));
});

test('each finding costs 5 points', () => {
  const workflow = {
    nodes: [
      {
        name: 'A',
        type: 'n8n-nodes-base.httpRequest',
        parameters: { url: `https://api.example.com/x?token=${FAKE_URL_TOKEN}` },
      },
      {
        name: 'B',
        type: 'n8n-nodes-base.postgres',
        parameters: { password: FAKE_PASSWORD },
      },
    ],
  };
  assert.equal(scoreCredentials(workflow).score, 10);
});
