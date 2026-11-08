/**
 * Naming, 0 to 20.
 *
 * A node name is auto-generated when it equals a stock node label, or a
 * stock label plus a digit suffix, like "HTTP Request1". The score is
 * 20 times the share of nodes with meaningful names.
 */
const DEFAULT_LABELS = new Set([
  'http request',
  'code',
  'webhook',
  'if',
  'switch',
  'set',
  'edit fields',
  'merge',
  'noop',
  'wait',
  'sticky note',
  'schedule trigger',
  'cron trigger',
  'manual trigger',
  'interval',
  'date & time',
  'postgres',
  'mysql',
  'mongo db',
  'redis',
  'execute command',
  'email send',
  'split in batches',
  'loop over items',
  'filter',
  'aggregate',
  'summarize',
  'item lists',
  'html',
  'xml',
  'function',
  'function item',
  'edit image',
  'google sheets',
  'gmail',
  'slack',
  'telegram',
  'notion',
  'airtable',
]);

export function isAutoName(name) {
  const lower = String(name).trim().toLowerCase();
  if (DEFAULT_LABELS.has(lower)) return true;
  const match = lower.match(/^(.*?)\s*\d+$/);
  return !!match && DEFAULT_LABELS.has(match[1].trim());
}

export function scoreNaming(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];

  const autoNamed = nodes.filter((node) => node && isAutoName(node.name));
  const share = nodes.length === 0 ? 1 : (nodes.length - autoNamed.length) / nodes.length;

  const findings = autoNamed.map((node) => ({
    node: node.name,
    detail: 'looks like an auto-generated name',
  }));

  return {
    id: 'naming',
    label: 'Naming',
    score: Math.round(20 * share),
    max: 20,
    findings,
    recommendation:
      findings.length > 0
        ? 'Rename auto-named nodes so the canvas explains itself.'
        : 'Naming looks good.',
  };
}
