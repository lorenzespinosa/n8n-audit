import { isFallible, hasWiredErrorOutput } from '../workflow.js';

/**
 * Error handling, 0 to 20.
 *
 * 16 points track the share of fallible nodes (HTTP, code, database,
 * remote command) that survive a failure: an onError setting, a legacy
 * continueOnFail flag, or a wired error output. 4 more points come from
 * the workflow-level error workflow setting. A workflow with no
 * fallible nodes gets the full 16 for coverage.
 */
export function scoreErrorHandling(workflow) {
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const connections = workflow.connections;

  const fallible = nodes.filter(
    (node) => node && isFallible(node)
  );

  const unprotected = fallible.filter((node) => {
    const continues =
      node.onError === 'continueRegularOutput' ||
      node.onError === 'continueErrorOutput' ||
      node.continueOnFail === true ||
      hasWiredErrorOutput(connections, node.name);
    return !continues;
  });

  const errorWorkflow =
    typeof workflow.settings?.errorWorkflow === 'string' &&
    workflow.settings.errorWorkflow.trim() !== '';

  const coverage = fallible.length === 0 ? 1 : (fallible.length - unprotected.length) / fallible.length;

  const findings = unprotected.map((node) => ({
    node: node.name,
    detail: 'has no error branch, onError setting or continueOnFail',
  }));
  if (!errorWorkflow) {
    findings.push({ detail: 'no error workflow is set in workflow settings' });
  }

  let recommendation;
  if (unprotected.length > 0 && !errorWorkflow) {
    recommendation =
      'Set onError or continueOnFail on fallible nodes, and set an error workflow in workflow settings.';
  } else if (unprotected.length > 0) {
    recommendation =
      'Set onError or continueOnFail on fallible nodes so failures route somewhere.';
  } else if (!errorWorkflow) {
    recommendation = 'Set an error workflow in workflow settings to catch failures.';
  } else {
    recommendation = 'Error handling looks good.';
  }

  const score = Math.round(Math.min(20, Math.max(0, 16 * coverage + (errorWorkflow ? 4 : 0))));

  return {
    id: 'error-handling',
    label: 'Error handling',
    score,
    max: 20,
    findings,
    recommendation,
  };
}
