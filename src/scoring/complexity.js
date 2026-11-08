import { longestChain } from '../workflow.js';

/**
 * Complexity, 0 to 20.
 *
 * Three gentle, linear ramps. No cliff: every extra node, chain step or
 * packed expression costs a fraction of a point.
 * - Node count: 0 penalty at 25 nodes, full 10 point penalty at 100.
 * - Longest dependency chain: 0 at 6 nodes, full 5 points at 30.
 * - Expression depth (most {{ }} expressions packed into one parameter
 *   value): 0 at 2, full 5 points at 8.
 */

function ramp(value, soft, hard) {
  if (value <= soft) return 0;
  if (value >= hard) return 1;
  return (value - soft) / (hard - soft);
}

/**
 * Deepest expression packing plus the node that owns it.
 */
export function expressionDepth(workflow) {
  let max = 0;
  let where = null;

  // iterative walk: deeply nested parameter trees must not exhaust the stack
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : [];
  for (const node of nodes) {
    if (!node || node.parameters === undefined) continue;
    const todo = [node.parameters];
    while (todo.length > 0) {
      const value = todo.pop();
      if (typeof value === 'string') {
        const count = value.split('{{').length - 1;
        if (count > max) {
          max = count;
          where = node ? node.name : where;
        }
      } else if (Array.isArray(value)) {
        for (const item of value) todo.push(item);
      } else if (value && typeof value === 'object') {
        for (const child of Object.values(value)) todo.push(child);
      }
    }
  }
  return { depth: max, node: where };
}

export function scoreComplexity(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const chain = longestChain(workflow.connections);
  const { depth, node: depthNode } = expressionDepth(workflow);

  const nodePenalty = 10 * ramp(nodes.length, 25, 100);
  const chainPenalty = 5 * ramp(chain, 6, 30);
  const depthPenalty = 5 * ramp(depth, 2, 8);

  const findings = [];
  if (nodePenalty > 0) {
    findings.push({
      detail: `workflow has ${nodes.length} nodes, cost grows past 25`,
    });
  }
  if (chainPenalty > 0) {
    findings.push({
      detail: `longest dependency chain is ${chain} nodes`,
    });
  }
  if (depthPenalty > 0 && depthNode) {
    findings.push({
      node: depthNode,
      detail: `packs ${depth} expressions into a single parameter value`,
    });
  }

  let recommendation;
  if (nodePenalty >= chainPenalty && nodePenalty >= depthPenalty && nodePenalty > 0) {
    recommendation = 'Split the workflow into smaller sub-workflows.';
  } else if (chainPenalty >= depthPenalty && chainPenalty > 0) {
    recommendation = 'Break the long chain with sub-workflows or merge points.';
  } else if (depthPenalty > 0) {
    recommendation = 'Split expression-heavy values across intermediate Set nodes.';
  } else {
    recommendation = 'Complexity looks good.';
  }

  const score = Math.round(Math.min(20, Math.max(0, 20 - (nodePenalty + chainPenalty + depthPenalty))));

  return {
    id: 'complexity',
    label: 'Complexity',
    score,
    max: 20,
    findings,
    recommendation,
  };
}
