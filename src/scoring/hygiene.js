import { connectedNames, isStickyNote, isTriggerLike } from '../workflow.js';

/**
 * Hygiene, 0 to 20.
 *
 * - Dead nodes: no incoming and no outgoing connections. Triggers and
 *   sticky notes are exempt: triggers have no inputs by design, sticky
 *   notes take no connections at all. Costs up to 8 points by share.
 * - Disabled nodes left in the export. Up to 4 points, full at 3 nodes.
 * - Empty sticky notes. Up to 8 points by share of all sticky notes.
 */
export function scoreHygiene(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const connected = connectedNames(workflow.connections);

  const candidates = nodes.filter((node) => node && !isTriggerLike(node) && !isStickyNote(node));
  const dead = candidates.filter((node) => !connected.has(node.name));

  const disabled = nodes.filter((node) => node && node.disabled === true);

  const stickies = nodes.filter((node) => node && isStickyNote(node));
  const emptyStickies = stickies.filter(
    (node) => !String(node.parameters?.content ?? '').trim()
  );

  const deadShare = candidates.length === 0 ? 0 : dead.length / candidates.length;
  const disabledPenalty = 4 * Math.min(1, disabled.length / 3);
  const emptyShare = stickies.length === 0 ? 0 : emptyStickies.length / stickies.length;

  const findings = [
    ...dead.map((node) => ({ node: node.name, detail: 'is not connected to anything' })),
    ...disabled.map((node) => ({ node: node.name, detail: 'is disabled but still in the export' })),
    ...emptyStickies.map((node) => ({
      node: node.name,
      detail: 'sticky note has no content',
    })),
  ];

  let recommendation;
  if (findings.length === 0) {
    recommendation = 'Hygiene looks good.';
  } else if (dead.length > 0 && disabled.length === 0 && emptyStickies.length === 0) {
    recommendation = 'Delete dead nodes, or wire them back in.';
  } else if (disabled.length > 0 && dead.length === 0 && emptyStickies.length === 0) {
    recommendation = 'Remove disabled nodes from the export, or turn them back on.';
  } else if (emptyStickies.length > 0 && dead.length === 0 && disabled.length === 0) {
    recommendation = 'Fill empty sticky notes or delete them.';
  } else {
    recommendation = 'Delete dead and disabled nodes, and fill or remove empty sticky notes.';
  }

  const penalty = 8 * deadShare + disabledPenalty + 8 * emptyShare;
  const score = Math.round(Math.min(20, Math.max(0, 20 - penalty)));

  return {
    id: 'hygiene',
    label: 'Hygiene',
    score,
    max: 20,
    findings,
    recommendation,
  };
}
