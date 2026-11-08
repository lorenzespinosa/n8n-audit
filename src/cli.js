import { collect, AuditError } from './collect.js';
import { buildReport } from './score.js';
import { renderMarkdown } from './render/markdown.js';
import { renderHtml } from './render/html.js';
import { renderJson } from './render/json.js';
import { getVersion } from './version.js';

export const FORMATS = ['md', 'html', 'json'];
export const DEFAULT_MIN_SCORE = 70;

export const USAGE = `n8n-audit: scored health reports for exported n8n workflows

Usage:
  n8n-audit <file-or-directory> [--format md|html|json] [--min-score N]

Options:
  --format <fmt>    Report format: md (default), html, json
  --min-score <n>   Fail when a workflow scores below N. 0 to 100, default 70
  --help, -h        Show this help
  --version, -V     Show version

Exit codes:
  0  every workflow is at or above the min score
  1  at least one workflow is below the min score
  2  usage or IO error`;

/**
 * Parse CLI arguments. Throws AuditError on anything invalid.
 * Returns { target, format, minScore }.
 */
export function parseArgs(argv) {
  const parsed = { target: undefined, format: 'md', minScore: DEFAULT_MIN_SCORE };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }
    if (arg === '--version' || arg === '-V') {
      parsed.version = true;
      continue;
    }

    let value = null;
    let inline = false;
    if (arg.startsWith('--format=')) {
      value = arg.slice('--format='.length);
      inline = true;
    } else if (arg === '--format') {
      value = argv[++i];
      inline = true;
    } else if (arg.startsWith('--min-score=')) {
      value = arg.slice('--min-score='.length);
      inline = true;
    } else if (arg === '--min-score') {
      value = argv[++i];
      inline = true;
    }

    if (inline) {
      if (value === undefined) {
        throw new AuditError(`${arg} needs a value`);
      }
      if (arg.startsWith('--min-score')) {
        const num = Number(value);
        if (!Number.isInteger(num) || num < 0 || num > 100) {
          throw new AuditError(`--min-score needs an integer from 0 to 100, got '${value}'`);
        }
        parsed.minScore = num;
      } else {
        if (!FORMATS.includes(value)) {
          throw new AuditError(`unknown format '${value}', expected one of: ${FORMATS.join(', ')}`);
        }
        parsed.format = value;
      }
      continue;
    }

    if (arg.startsWith('-')) {
      throw new AuditError(`unknown option '${arg}'`);
    }

    if (parsed.target !== undefined) {
      throw new AuditError(`unexpected extra argument '${arg}'`);
    }
    parsed.target = arg;
  }

  if (parsed.target === undefined && !parsed.help && !parsed.version) {
    throw new AuditError('missing <file-or-directory> argument');
  }

  return parsed;
}

/**
 * Run the audit for real arguments and return the process exit code.
 * Writes the report to stdout, errors to stderr.
 */
export function run(argv, out = process.stdout, err = process.stderr) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    err.write(`n8n-audit: ${error.message}\n\n${USAGE}\n`);
    return 2;
  }

  if (parsed.help) {
    out.write(`${USAGE}\n`);
    return 0;
  }
  if (parsed.version) {
    out.write(`${getVersion()}\n`);
    return 0;
  }

  let collected;
  try {
    collected = collect(parsed.target);
  } catch (error) {
    const message = error instanceof AuditError ? error.message : `cannot scan ${parsed.target}`;
    err.write(`n8n-audit: ${message}\n`);
    return 2;
  }

  const report = buildReport({
    entries: collected.entries,
    skipped: collected.skipped,
    filesScanned: collected.filesScanned,
    minScore: parsed.minScore,
    version: getVersion(),
    root: parsed.target,
  });

  const render = parsed.format === 'html' ? renderHtml : parsed.format === 'json' ? renderJson : renderMarkdown;
  out.write(render(report));

  return report.summary.belowMinScore > 0 ? 1 : 0;
}
