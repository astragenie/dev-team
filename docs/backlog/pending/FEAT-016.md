---
id: FEAT-016
status: pending
priority: P2
category: tooling
target_release: tbd
created: 2026-05-23
updated: 2026-05-23
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 2
---

# FEAT-016: context7 MCP integration for live library docs

## Description

Wire up [context7](https://github.com/upstash/context7) as a repo-pinned
MCP server so crew agents can resolve live, version-correct library docs
during build / review / research instead of relying on stale model
knowledge.

Primary consumers:

- **researcher** — fetch current docs before option analysis.
- **builder** — verify API signatures pre-edit, kills hallucinated methods.
- **reviewer** — spot-check flagged API calls against current docs.

Pairs with existing `microsoft-docs:microsoft-code-reference` (which
covers MS-tech only). context7 fills the gap for everything else
(Node, React, Vite, ESLint, npm libs, etc.).

## Scope

In scope:

- Add `.mcp.json` at repo root declaring `context7` as an stdio MCP server
  (npm package `@upstash/context7-mcp` invoked via `npx`).
- Document trigger pattern + per-role guidance in `docs/routing-table.md`
  (new row: "Library / API uncertainty → context7").
- Add usage hint to the domain JS / TS skills so the builder reaches for
  it when touching unfamiliar packages.
- Add an opt-in callout in `README.md` under "Optional integrations".

Out of scope:

- Auto-invocation hooks. Manual / skill-triggered only.
- Mirror or self-host the context7 service.
- Replace `microsoft-code-reference` (keep both; tools route by topic).

## Acceptance hints

- `.mcp.json` validates (`node ./scripts/validate-manifests.mjs` passes,
  or new validator if needed).
- `context7.resolve-library-id` + `context7.get-library-docs` are
  discoverable from a fresh Claude Code session that opens this repo.
- Routing-table row added with trigger phrases ("verify API",
  "current docs for X", "is method Y still supported").
- README section documents:
  - what context7 is and what it costs (free, rate-limited per upstream
    docs);
  - how to disable it (delete `.mcp.json` entry);
  - which crew roles benefit and when.
- Smoke check: a researcher subagent successfully fetches docs for one
  representative library (e.g. `vite`) end-to-end.
- No new CI gate required (MCP server is runtime-only, no repo build
  impact).

## Risks / open questions

- Upstream package name + invocation may drift; pin to a tested version
  in `.mcp.json` args.
- Some libraries have no context7 coverage — agents must fall back
  gracefully rather than loop on retries. Document the fallback pattern
  in the routing-table row.
