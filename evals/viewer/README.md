# eval-run viewer

Zero-dependency, offline HTML viewer for `evals/runs/*.json`. Replaces
`cat evals/runs/<file>.json | jq` with a readable table.

## Usage

```bash
bun run evals:view
```

This prints a `file://` URL — open it in any browser (or just double-click
`evals/viewer/index.html` in a file explorer). No server, no build step, no
npm dependency: the page is a single self-contained HTML file with inline
CSS/JS.

Once open:

1. Click "Load a run file" and pick a file from `evals/runs/`.
2. The page renders a run-level summary (prompt, mode, timestamp, pass rate,
   total cases, judge, duration) and a per-test table (name, pass/fail,
   duration, `validate_with` verdicts, judge rationale, and an expandable
   asserts/candidate-output/fixture detail row).

Loading a different file replaces the table — there's no multi-run
comparison in this version.

## Malformed / empty files

If the selected file isn't valid JSON, isn't an eval-run shape (missing
`tests`/`summary`), or has an empty `tests` array, the page shows a red error
banner with the reason — it never renders a blank page.

## Schema source + why some columns show "—"

The rendered shape is `EvalRunResult` / `TestResult` from
[`evals/lib/run-eval.ts`](../lib/run-eval.ts) (read directly, not
re-derived). As of this writing that schema does **not** persist per-test
`cost` or `provider` into `evals/runs/*.json`:

- Judge cost (`cost_usd`) is computed at eval time inside
  `evals/lib/judge.ts` / `evals/lib/with-budget.ts`, but never written into
  the run artifact.
- Only a run-level `judgeId` exists (e.g. `groq`, `claude-p`) — there is no
  per-test provider.

The viewer renders those columns as `—` rather than fabricating numbers. If
a future schema version (see backlog FEAT-186, "unified cost-aggregation
contract") adds `cost`/`provider` fields to `TestResult`, update the render
logic in both `viewer.ts` and `index.html`'s inline script to read them.

## Files

- `index.html` — the actual runtime artifact. Fully self-contained (inline
  `<style>` + inline `<script>`, no external requests) so it works offline
  via `file://`.
- `viewer.ts` — typed source for the rendering logic, checked by
  `bun run typecheck` (`evals/**/*.ts` is in `tsconfig.json`'s `include`).
  Browsers can't execute TypeScript, so this file is **not** loaded by
  `index.html` directly — `index.html` embeds a type-erased copy of the same
  logic inline. The two are kept in sync by hand (no build tooling per this
  repo's constraints); if you change one, mirror the change in the other.

## Module boundary

This directory is not subject to the `evals/lib/**` / `evals/providers/**`
import-boundary rule (see root `evals/README.md`) since it imports nothing —
it's a standalone browser page with no dependency on the eval framework's
Node code, by design (it only needs to read the JSON the framework writes).
