# Task Handoff: SLICE-08 mid-flight — noImplicitAny fix in progress

- Created: 2026-05-28T15:38:33.560Z
- From: lead
- To: lead
- Objective: Enable `noImplicitAny: true` in tsconfig.json and annotate all implicit-any parameters in scripts/**/*.mjs with JSDoc types so `npm run typecheck` passes clean. SLICE-08 / FEAT-004.
- Allowed Scope: `tsconfig.json`, all files under `scripts/`. No test files, no agents/, skills/, commands/, docs/.
- Forbidden Scope: No `any` type, no `@ts-ignore`, no `@ts-nocheck`. Do not rewrite logic — annotations only.
- Deliverable: `npm run typecheck` exit 0 with `noImplicitAny: true`, `npm test` all passing, `npm run lint` zero warnings.
- Changed Files (done by first builder pass):
  - tsconfig.json — `noImplicitAny: false` → `true`
  - scripts/lib/workflow-state.mjs — partial: typed structs added (RunGates, RunArtifacts, WorkflowRun typedefs), but ~88 errors remain including TS2345 (object literal missing required properties) and TS7006 (implicit any params)
- Confidence: low — typecheck not yet passing; agents still running
- Risks: Parallel agents (3 dispatched) may produce conflicting edits if they edit the same file. workflow-state.mjs is the riskiest (being edited by agent a6ffd7aa5879314cf AND showing new TS2345 errors from the first builder pass introducing strict typedefs). Next session should run `npm run typecheck` first to assess net state.
- Suggested Next Handoff: After all 3 background agents complete → run `npm run typecheck` → fix remaining errors → review + validate → `/loop:slice complete --id SLICE-08`

## State at session end

### tsconfig.json
`noImplicitAny: true` is **live**. This causes 654 type errors across 26 files.

### Background agents dispatched (3, still running at session end)
- Agent A: `workflow-state.mjs` + `session-cost.mjs` (168 errors)
- Agent B: `crew.mjs` + `briefing/render.mjs` + `briefing/collect.mjs` (168 errors)
- Agent C: `cost-advisor.mjs` + `artifacts.mjs` + `wakeup.mjs` + `deployment-guidance.mjs` (184 errors)

### Remaining files NOT yet assigned (134 errors)
- `claims.mjs` (30), `approvals.mjs` (28), `installer.mjs` (12), `installer/legacy-migration.mjs` (11), `validate-skills.mjs` (9), `installer/util.mjs` (8), `installer/settings.mjs` (8), `installer/global.mjs` (7), `installer/welcome.mjs` (4), `installer/claude-md.mjs` (4), `installer/gitignore.mjs` (3), `validate-slices.mjs` (2), `briefing.mjs` (2), `installer/repo-guides.mjs` (2), `installer/harness-files.mjs` (2), `installer/templates.mjs` (1), `installer/audit.mjs` (1)

### Next session entry point
1. `npm run typecheck 2>&1 | grep "error TS" | wc -l` — check net error count
2. `npm run typecheck 2>&1 | grep "error TS" | sed 's/(.*$//' | sort | uniq -c | sort -rn` — see remaining files
3. Fix remaining files
4. Run review + validation gates
5. `/loop:slice complete --id SLICE-08`

