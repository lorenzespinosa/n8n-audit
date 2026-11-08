import { isPlainObject, walkStrings } from '../workflow.js';

/**
 * Credential hygiene, 0 to 20.
 *
 * Scans node parameters for four kinds of leaked secrets:
 * - Authorization headers carrying a literal credential
 * - URLs with a token or password in the query string
 * - Secret-named parameters holding literal values (password, apiKey...)
 * - Well-known token patterns (sk-, ghp_, xox, AKIA, JWTs, private keys)
 *
 * Each finding costs 5 points. Secret values are never echoed into
 * the report.
 */

const URL_TOKEN_KEY = /(token|api_?key|apikey|access_?token|client_?secret|secret|passwo?rd|sig|auth)/i;

const SECRET_PARAM_KEY = /(passwo?rd|secret|api[-_]?key|apikey|token|bearer|credential|private[-_]?key|client[-_]?secret|access[-_]?key)/i;

const KNOWN_TOKEN_PATTERN =
  /(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

const PLACEHOLDER_START = /^(<|\$\{|xxx+|changeme|change-me|example|placeholder|your[_-]|redacted|dummy)/i;

function isLiteralSecret(value) {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    !value.includes('{{') &&
    !PLACEHOLDER_START.test(value)
  );
}

function scanAuthHeaders(node, findings, seen) {
  // current n8n stores header auth under headerParameters; older workflows
  // under headers. Both shapes must be scanned or leaks score as clean.
  const params = node.parameters ?? {};
  const list = [];
  for (const key of ['headers', 'headerParameters']) {
    const headers = params[key];
    if (isPlainObject(headers) && Array.isArray(headers.parameters)) {
      list.push(...headers.parameters);
    }
  }
  for (const header of list) {
    if (!isPlainObject(header)) continue;
    if (String(header.name || '').toLowerCase() !== 'authorization') continue;
    if (!isLiteralSecret(header.value)) continue;
    const message = `Authorization header on '${node.name}' carries a literal credential`;
    if (!seen.has(message)) {
      seen.add(message);
      findings.push({
        node: node.name,
        detail: 'sends an Authorization header with a literal credential',
      });
    }
  }
}

function scanUrl(node, findings, seen) {
  const url = node.parameters?.url;
  if (typeof url !== 'string') return;
  const match = url.match(/[?&][^&#\s=]+=[^&#\s]*/g) || [];
  for (const pair of match) {
    const eq = pair.indexOf('=');
    const key = pair.slice(1, eq);
    const value = pair.slice(eq + 1);
    if (!URL_TOKEN_KEY.test(key)) continue;
    if (!isLiteralSecret(value)) continue;
    const message = `URL on '${node.name}' carries a token in the '${key}' query parameter`;
    if (!seen.has(message)) {
      seen.add(message);
      findings.push({
        node: node.name,
        detail: `has a token in the '${key}' URL query parameter`,
      });
    }
  }
}

function scanSecretParams(node, findings, seen) {
  walkStrings(node.parameters, (value, key) => {
    if (!key || !SECRET_PARAM_KEY.test(key)) return;
    if (!isLiteralSecret(value)) return;
    const message = `Parameter '${key}' on '${node.name}' looks like a plaintext secret`;
    if (!seen.has(message)) {
      seen.add(message);
      findings.push({
        node: node.name,
        detail: `has a plaintext secret in parameter '${key}'`,
      });
    }
  });
}

function scanKnownTokens(node, findings, seen) {
  walkStrings(node.parameters, (value) => {
    if (value.length < 12) return;
    if (!KNOWN_TOKEN_PATTERN.test(value)) return;
    const message = `Value on '${node.name}' contains a hardcoded token pattern`;
    if (!seen.has(message)) {
      seen.add(message);
      findings.push({ node: node.name, detail: 'contains a hardcoded token pattern' });
    }
  });
}

export function scoreCredentials(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const findings = [];
  const seen = new Set();

  for (const node of nodes) {
    if (!isPlainObject(node)) continue;
    scanAuthHeaders(node, findings, seen);
    scanUrl(node, findings, seen);
    scanSecretParams(node, findings, seen);
    scanKnownTokens(node, findings, seen);
  }

  const score = Math.max(0, 20 - 5 * findings.length);

  return {
    id: 'credential-hygiene',
    label: 'Credential hygiene',
    score,
    max: 20,
    findings,
    recommendation:
      findings.length > 0
        ? 'Move secrets into n8n credentials, or reference environment variables with expressions.'
        : 'Credential hygiene looks good.',
  };
}
