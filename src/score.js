import { scoreErrorHandling } from './scoring/error-handling.js';
import { scoreCredentials } from './scoring/credentials.js';
import { scoreNaming } from './scoring/naming.js';
import { scoreComplexity } from './scoring/complexity.js';
import { scoreHygiene } from './scoring/hygiene.js';

export const CATEGORY_ORDER = [
  'error-handling',
  'credential-hygiene',
  'naming',
  'complexity',
  'hygiene',
];

/**
 * Score one workflow, 0 to 100, five categories of 0 to 20 each.
 */
export function scoreWorkflow(workflow) {
  const categories = [
    scoreErrorHandling(workflow),
    scoreCredentials(workflow),
    scoreNaming(workflow),
    scoreComplexity(workflow),
    scoreHygiene(workflow),
  ];
  const score = categories.reduce((sum, category) => sum + category.score, 0);
  return { score, categories };
}

/**
 * Turn collected entries into the report model used by every renderer.
 * Workflows are listed worst-first: score ascending, then file path for
 * stable tie ordering.
 */
export function buildReport({ entries, skipped, filesScanned, minScore, version, root }) {
  const workflows = entries
    .map((entry) => {
      const { score, categories } = scoreWorkflow(entry.workflow);
      return {
        file: entry.file,
        name: typeof entry.workflow.name === 'string' && entry.workflow.name !== ''
          ? entry.workflow.name
          : entry.file,
        active: entry.workflow.active === true,
        score,
        passed: score >= minScore,
        categories,
      };
    })
    .sort((a, b) => (a.score - b.score) || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));

  return {
    tool: 'n8n-audit',
    version,
    generatedAt: new Date().toISOString(),
    root,
    minScore,
    summary: {
      filesScanned,
      workflowsAudited: workflows.length,
      skippedFiles: skipped.length,
      belowMinScore: workflows.filter((workflow) => !workflow.passed).length,
    },
    skipped: [...skipped].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)),
    workflows,
  };
}
