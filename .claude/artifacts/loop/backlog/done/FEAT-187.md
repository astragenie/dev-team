---
id: FEAT-187
status: done
priority: P2
category: capability
target_release: null
created: 2026-06-29
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
tags: [evals, viewer, ui, dx, observability, local-tooling]
---

# FEAT-187: Local eval-run viewer (static HTML/TS panel)

## Description

The eval framework writes per-run JSON artifacts to `evals/runs/`. Today the
only way to inspect them is `cat | jq` or reading the raw `bun run evals`
console output. That output truncates at line 250 in chat, and operators
have to manually correlate test names, judge verdicts, candidate output
excerpts, and rationale strings.

This FEAT adds a **standalone local HTML+TS viewer** at `evals/viewer/`
that:

1. Loads any `evals/runs/*.json` file from disk (file picker + drag-drop)
2. Renders a table of tests with PASS/FAIL badges, assertion-type icons,
   duration, judge id, candidate-live indicator
3. Per-test expand panel: rubric rationale, candidate output (collapsed by
   default, click to expand), fixture content, validate_with chain results
4. Side-by-side diff view: load two runs, see which tests changed
   verdict between them (used to track AC-4 drift bands and judge drift
   across model versions)
5. Filters: by `pass`, by `judge`, by assert-type, by test-name substring

No backend. No upload. No multi-tenant. No persistence. Pure static page
the operator opens locally to read a run.

## Acceptance criteria

1. New directory `evals/viewer/` with `index.html`, `main.tsx`, `viewer.css`.
2. Drag-drop OR file-picker loads a single `evals/runs/*.json` file. File
   stays in-browser; no upload.
3. Tests rendered as a sortable table: name, pass/fail badge, duration,
   judge id, candidate-live flag, assert count.
4. Click row -> expand panel shows: candidate output (collapsible),
   fixture content (collapsible), per-assert rationale + rubric.
5. "Compare runs" mode: two file pickers; renders side-by-side diff with
   verdict-change badges per test (passed_to_failed, failed_to_passed,
   stable_pass, stable_fail).
6. Filter inputs: pass/fail toggle, judge dropdown (auto-populated from
   loaded run), assert-type checkboxes, test-name substring search.
7. `bun run evals:viewer` script in package.json launches a local static
   server (Bun's built-in `Bun.serve`) on a free port and opens the page.
   No new npm dependencies.
8. Viewer runs entirely offline. No network calls. No analytics. No telemetry.
9. `bun run lint`, `bun run typecheck`, `bun run format:check`, `bun run test`
   all green.

## Out of scope

- Server-side persistence (FEAT-187-followup if useful)
- Multi-tenant / authentication (lives in SaaS runner repo if needed)
- Run comparison across more than two files at once
- Direct trigger of `bun run evals` from the viewer
- Embedding into the AstraRunner SaaS dashboard (separate FEAT in
  `/c/work/mega/runner` if promoted)
- Aggregate dashboards (pass rate over time, judge agreement matrix) —
  follow-up once the basic viewer is in operator hands

## Implementation notes

- Stack: React 19 + TypeScript + Tailwind (already in dev-team via
  evals tooling) — pin the version that the `/c/work/mega/runner` dashboard
  uses to keep aesthetics consistent if A→B promotion later.
- Bundle via Bun's native bundler (`bun build evals/viewer/main.tsx
  --outdir=evals/viewer/dist`); no vite, no webpack.
- File picker: `<input type="file" accept=".json">` + drag-drop on the
  viewport root.
- Server: `Bun.serve({ port: 0, fetch: (req) => ... })` for static files.
  Listen on `127.0.0.1` only.
- JSON shape contract: matches the existing `EvalRunResult` type in
  `evals/lib/run-eval.ts`. Type-checked at load time with a small
  hand-rolled validator (no Zod, no extra dep).

## Pre-mortem

- **Risk: bundle size creep with React.** Mitigation: viewer is local
  dev-tool only; if bundle balloons past 1MB gzipped, drop React for
  Preact (same JSX, 3KB). Don't pre-optimize.
- **Risk: scope drift to SaaS panel.** Mitigation: AC-9 explicitly
  forbids backend; "Out of scope" calls out SaaS embedding as a
  separate FEAT.
- **Risk: file picker / drag-drop UX inconsistency across browsers.**
  Mitigation: target Chromium-family only for v0; Firefox/Safari support
  is a follow-up.

## Demand evidence

Surfaced 2026-06-29 during AC-3 + AC-4 baseline runs. Operator
inspected three run JSON files via `jq` and the truncated CLI output
during a single session — visible friction for the day-to-day workflow.
A viewer panel reduces the inspect-loop from 30-60s (run jq → re-grep
→ correlate) to ~3s (open page, click test).

## Sibling work

- FEAT-171 (candidate dispatch) — done. Viewer renders `--candidate-live`
  output cleanly.
- FEAT-184 / FEAT-185 — done. Viewer renders the gepa-core judge id +
  cost + tokens fields shipped by those FEATs.
- FEAT-186 (cost-aggregation contract) — pending. Once landed, viewer
  should add a per-run cost column derived from the cost-report shape.
