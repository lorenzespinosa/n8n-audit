# Changelog

All notable changes to this project are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-07

### Added
- First release. Scored health reports for exported n8n workflow JSON.
- Five scored categories, 0 to 20 points each: error handling, credential hygiene, naming, complexity, hygiene.
- Three report formats: markdown (default), single-file HTML with inline CSS, and JSON with a documented stable shape.
- Directory scanning that recurses for `*.json`, detects n8n workflows, and skips other JSON files gracefully.
- Exit codes: 0 all workflows pass, 1 any workflow under `--min-score` (default 70), 2 usage or IO error.
- Zero runtime npm dependencies. Node.js standard library only.
- Offline test suite with synthetic fixtures: clean, partial, and dirty workflows, plus non-workflow JSON, broken JSON, and a nested subdirectory.
- `skill/SKILL.md` so coding assistants can run the tool.
