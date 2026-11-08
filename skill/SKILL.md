---
name: n8n-audit
description: Scores exported n8n workflow JSON files from 0 to 100 across five categories (error handling, credential hygiene, naming, complexity, hygiene) and prints markdown, HTML or JSON reports. Use when asked to audit, score, health-check or review exported n8n workflows, or a folder of workflow JSON files.
---

# n8n-audit

A CLI that reads exported n8n workflow JSON and produces a scored health report. No network access, no n8n instance needed, zero npm dependencies. Runs on Node.js 24+.

## Run

```bash
npx github:lorenzespinosa/n8n-audit <file-or-directory> [--format md|html|json] [--min-score N]
```

Examples:

```bash
n8n-audit workflows/                    # markdown to stdout
n8n-audit order-flow.json --format json
n8n-audit workflows/ --format html > report.html
n8n-audit workflows/ --min-score 85
```

Directories are scanned recursively for `*.json`. Files that are not n8n workflows are skipped and listed with a reason. A single file argument must be a valid workflow JSON.

## Read the report

Each workflow gets a 0 to 100 score, summed from five categories worth 0 to 20 each: error handling, credential hygiene, naming, complexity, hygiene. Every category lists its findings and one recommendation line. The report lists workflows worst-first, so the top row is where to start fixing.

Categories in short:

- Error handling: share of fallible nodes (HTTP, code, database, remote command) with an error branch (`onError`, `continueOnFail` or a wired error output), plus 4 points for a workflow-level error workflow setting.
- Credential hygiene: plaintext secrets in parameters, literal Authorization headers, tokens in URL query strings, well-known token patterns. Each finding costs 5 points. Secret values are never echoed.
- Naming: share of nodes without auto-generated stock names like `HTTP Request1`.
- Complexity: gentle ramps on node count (25 to 100), longest dependency chain (6 to 30) and expressions packed into one value (2 to 8).
- Hygiene: dead nodes, disabled nodes left in the export, empty sticky notes.

## Exit codes

- 0: all workflows at or above the min score
- 1: any workflow below the min score (default 70, inclusive boundary)
- 2: usage or IO error

## JSON output

`--format json` prints the documented stable shape: `tool`, `version`, `generatedAt`, `root`, `minScore`, `summary` (filesScanned, workflowsAudited, skippedFiles, belowMinScore), `skipped` (file, reason), and `workflows` (file, name, active, score, passed, categories with id, label, score, max, findings, recommendation). Parse it to drive CI gates or dashboards.

## Pairing

Use n8n-lint (same author) to block bad patterns in CI. Use n8n-audit to tell a human where a workflow stands. See the project README for the full JSON schema and scoring formulas.
