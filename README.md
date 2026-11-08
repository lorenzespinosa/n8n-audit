# n8n-audit

Scored health reports for exported n8n workflows.

Give it a workflow JSON file or a folder. It scores each workflow from 0 to 100 across five categories and prints a report with findings and one-line fixes, worst workflow first.

n8n-lint (same author) blocks bad patterns in CI. n8n-audit tells a human where a workflow stands. The two tools pair: lint the pull request, audit the whole collection.

Zero runtime dependencies. Node.js standard library only.

## Install

Run it once with npx:

```bash
npx github:lorenzespinosa/n8n-audit workflows/
```

Or install from a clone:

```bash
git clone https://github.com/lorenzespinosa/n8n-audit.git
cd n8n-audit
npm install -g .
```

## Quick start

```bash
n8n-audit workflows/                     # markdown report to stdout
n8n-audit order-flow.json                # one file
n8n-audit workflows/ --format html > report.html
n8n-audit workflows/ --format json > report.json
n8n-audit workflows/ --min-score 85      # stricter gate
```

Sample output on the test fixtures:

```
# n8n-audit report

Scanned 12 JSON files. Audited 10 workflows, skipped 2. Min score 70, 1 below.

| Score | Workflow | File | Error | Cred | Naming | Cmplx | Hygiene |
| ----- | -------- | ---- | ----- | ---- | ------ | ----- | ------- |
| 28 | Everything wrong | 02-dirty-mess.json | 0 | 0 | 0 | 19 | 9 |
| 76 | Legacy CRM export | 04-plaintext-secrets.json | 16 | 0 | 20 | 20 | 20 |
| 76 | Auto named pipeline | 05-auto-named.json | 16 | 20 | 0 | 20 | 20 |
| 80 | Payments settle without a net | 03-no-error-handling.json | 0 | 20 | 20 | 20 | 20 |
| 88 | Kitchen sink hygiene | 07-hygiene-issues.json | 16 | 20 | 20 | 20 | 12 |
| 90 | Heavy nightly batch | 06-heavy-pipeline.json | 20 | 20 | 20 | 10 | 20 |
...
```

## Scoring

Each category is worth 0 to 20 points. The overall score is the sum.

### 1. Error handling

Share of fallible nodes (HTTP, code, database, remote command types) that have an error branch: an `onError` setting, a legacy `continueOnFail` flag, or a wired error output. 16 points. A workflow-level error workflow in settings adds 4 more. No fallible nodes counts as fully covered.

Example finding: `'Fetch orders' has no error branch, onError setting or continueOnFail.`

### 2. Credential hygiene

Looks for plaintext secrets in node parameters: literal `Authorization` headers, tokens in URL query strings, secret-named parameters with literal values (`password`, `apiKey`, ...), and well-known token patterns (`sk-`, `ghp_`, `xox`, `AKIA`, JWTs, private key blocks). Each finding costs 5 points. Secret values are never printed in the report.

Example finding: `'Read admin DB' has a plaintext secret in parameter 'password'.`

### 3. Naming

Share of nodes whose name is not an auto-generated stock label such as `HTTP Request1`, `Code` or `Sticky Note3`. Score is 20 times the share of meaningful names.

Example finding: `'HTTP Request1' looks like an auto-generated name.`

### 4. Complexity

Three gentle linear ramps, no cliff:

- Node count: no penalty up to 25 nodes, full 10 point penalty at 100.
- Longest dependency chain: no penalty up to 6 nodes, full 5 points at 30.
- Expression depth: the most `{{ }}` expressions packed into one parameter value. No penalty up to 2, full 5 points at 8.

Example finding: `longest dependency chain is 41 nodes.`

### 5. Hygiene

- Dead nodes: no incoming and no outgoing connections. Triggers and sticky notes are exempt. Up to 8 points by share.
- Disabled nodes left in the export. Up to 4 points, full at 3 nodes.
- Empty sticky notes. Up to 8 points by share.

Example finding: `'Old draft step' is not connected to anything.`

## Formats

- `md` (default): plain markdown to stdout.
- `html`: one self-contained file with inline CSS only. No scripts, no external assets.
- `json`: stable documented shape:

```json
{
  "tool": "n8n-audit",
  "version": "0.1.0",
  "generatedAt": "2026-11-07T12:00:00.000Z",
  "root": "workflows/",
  "minScore": 70,
  "summary": {
    "filesScanned": 12,
    "workflowsAudited": 10,
    "skippedFiles": 2,
    "belowMinScore": 1
  },
  "skipped": [{ "file": "package.json", "reason": "not an n8n workflow" }],
  "workflows": [
    {
      "file": "orders.json",
      "name": "Nightly orders",
      "active": true,
      "score": 84,
      "passed": true,
      "categories": [
        {
          "id": "error-handling",
          "label": "Error handling",
          "score": 16,
          "max": 20,
          "findings": [{ "node": "Fetch orders", "detail": "has no error branch, onError setting or continueOnFail" }],
          "recommendation": "Set an error workflow in workflow settings to catch failures."
        }
      ]
    }
  ]
}
```

Category ids in order: `error-handling`, `credential-hygiene`, `naming`, `complexity`, `hygiene`. The `node` key is omitted on workflow-level findings. Workflows are ordered worst-first. Treat unknown fields as optional additions; existing fields keep their meaning.

## What counts as a workflow

A directory scan recurses for `*.json` (skipping hidden folders and `node_modules`) and keeps files that look like n8n exports: an object with a `name` string and a `nodes` array where each node has `name` and `type` strings. Everything else is skipped with a reason, listed at the end of the report.

Point the tool at a single file and it is stricter: the file must be valid JSON and a workflow, otherwise it exits with an error.

## Exit codes

| Code | Meaning |
| ---- | ------- |
| 0 | every workflow is at or above the min score |
| 1 | at least one workflow is below the min score |
| 2 | usage or IO error |

The default min score is 70. The check is inclusive: a workflow scoring exactly the min score passes.

## Pairing with n8n-lint

Run both:

```bash
npx github:lorenzespinosa/n8n-lint .        # block bad patterns in CI
n8n-audit . --min-score 70                  # health report for humans
```

Lint fails a build on rule violations. Audit scores what is already shipped and tells you what to fix first.

## Roadmap

- Score diff between runs, to see whether a workflow got better or worse
- Community node types in the fallible-node list
- CSV format for spreadsheet rollups
- Score rollup across sub-workflow calls
- Optional config file for category weights

## License

MIT
