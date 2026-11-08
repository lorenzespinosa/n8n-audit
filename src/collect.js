import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import { looksLikeWorkflow } from './workflow.js';

const MAX_DEPTH = 20;

/**
 * IO or usage error. The CLI maps it to exit code 2.
 */
export class AuditError extends Error {}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

function parseJsonFile(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new AuditError(`cannot read ${filePath}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new AuditError(`${filePath} is not valid JSON`);
  }
}

/**
 * Recursively list *.json files under a directory. Skips hidden
 * entries and node_modules, and refuses to follow symlink loops via a
 * depth cap.
 */
export function discoverJsonFiles(dirPath, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const results = [];
  for (const entry of readdirSync(dirPath).sort()) {
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const fullPath = join(dirPath, entry);
    let stat;
    try {
      stat = statSync(fullPath, { throwIfNoEntry: false });
    } catch {
      continue;
    }
    if (!stat) continue;
    if (stat.isDirectory()) {
      results.push(...discoverJsonFiles(fullPath, depth + 1));
    } else if (stat.isFile() && extname(entry) === '.json') {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load every n8n workflow reachable from a file or directory argument.
 *
 * A directory scan skips non-workflow and invalid JSON files gently and
 * records them with a reason. A single file argument must be a valid
 * workflow JSON; anything else is an error, because the user pointed
 * at it on purpose.
 *
 * Returns { filesScanned, entries, skipped }.
 */
export function collect(target) {
  const absTarget = resolve(target);
  let stat;
  try {
    stat = statSync(absTarget, { throwIfNoEntry: false });
  } catch (err) {
    throw new AuditError(`cannot inspect ${target}: ${err.message}`);
  }
  if (!stat) {
    throw new AuditError(`path not found: ${target}`);
  }

  if (stat.isFile()) {
    if (extname(absTarget) !== '.json') {
      throw new AuditError(`not a JSON file: ${target}`);
    }
    const data = parseJsonFile(absTarget);
    if (!looksLikeWorkflow(data)) {
      throw new AuditError(`${target} does not look like an n8n workflow`);
    }
    return {
      filesScanned: 1,
      entries: [{ file: basename(absTarget), workflow: data }],
      skipped: [],
    };
  }

  if (!stat.isDirectory()) {
    throw new AuditError(`not a file or directory: ${target}`);
  }

  const files = discoverJsonFiles(absTarget);
  const entries = [];
  const skipped = [];

  for (const filePath of files) {
    let data;
    try {
      data = parseJsonFile(filePath);
    } catch (err) {
      skipped.push({ file: toPosix(relative(absTarget, filePath)), reason: 'invalid JSON' });
      continue;
    }
    if (looksLikeWorkflow(data)) {
      entries.push({ file: toPosix(relative(absTarget, filePath)), workflow: data });
    } else {
      skipped.push({ file: toPosix(relative(absTarget, filePath)), reason: 'not an n8n workflow' });
    }
  }

  return { filesScanned: files.length, entries, skipped };
}
