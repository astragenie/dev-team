---
id: SLICE-195
parent: FEAT-187
status: done
priority: P2
created: 2026-07-04
title: "FEAT-187 — local eval-run viewer (static HTML/TS panel over evals/runs/)"
stack: typescript + html
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - evals/viewer/index.html
  - evals/viewer/viewer.ts
  - evals/viewer/README.md
  - package.json
---

# SLICE-195: local eval-run viewer (FEAT-187)

## Problem
Eval framework writes per-run JSON to `evals/runs/`. Only inspection today is `cat | jq`.

## Scope
Static, self-contained HTML/TS panel that loads an `evals/runs/*.json` artifact and renders it
readable: per-test pass/fail, judge scores, cost, provider, timestamps. No server, no external CDN
(inline all CSS/JS; CSP-safe). A `bun run evals:view` (or documented `open`) entry in package.json.

## Acceptance criteria
- AC-1: Opening `evals/viewer/index.html` and loading a real `evals/runs/*.json` renders a table of tests with pass/fail, score, and cost — no network/server required.
- AC-2: Assets fully inlined (no remote fonts/scripts/styles); page renders offline.
- AC-3: `package.json` gains a documented viewer entry point; `evals/viewer/README.md` explains usage.
- AC-4: Handles an empty / malformed run file with a visible error, not a blank page.

## Notes
Read the actual shape of an `evals/runs/*.json` artifact first (run `bun run evals --dry-run` if none exist, or infer from `evals/lib/run-eval.ts`). Keep it dependency-free — this is a DX nicety, not a build target.
