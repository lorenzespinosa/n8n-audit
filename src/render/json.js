/**
 * The JSON format is the documented, stable report shape:
 *
 * {
 *   "tool": "n8n-audit",
 *   "version": "0.1.0",
 *   "generatedAt": "2026-11-07T12:00:00.000Z",
 *   "root": "workflows/",
 *   "minScore": 70,
 *   "summary": {
 *     "filesScanned": 12,
 *     "workflowsAudited": 10,
 *     "skippedFiles": 2,
 *     "belowMinScore": 2
 *   },
 *   "skipped": [{ "file": "package.json", "reason": "not an n8n workflow" }],
 *   "workflows": [
 *     {
 *       "file": "orders.json",
 *       "name": "Nightly orders",
 *       "active": true,
 *       "score": 84,
 *       "passed": true,
 *       "categories": [
 *         {
 *           "id": "error-handling",
 *           "label": "Error handling",
 *           "score": 16,
 *           "max": 20,
 *           "findings": [{ "node": "Fetch orders", "detail": "..." }],
 *           "recommendation": "..."
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * Workflows are ordered worst-first. The findings array omits "node"
 * for workflow-level findings. Consumers should treat unknown fields
 * as optional additions; existing fields keep their meaning.
 */
export function renderJson(report) {
  return `${JSON.stringify(report, null, 2)}\n`;
}
