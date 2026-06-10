---
feature: FEAT-146
---
# Run Brief: FEAT146 SLICE67: Hook-core extraction: in-process testable hooks (kill per-test node spawns)

- Created: 2026-06-10T19:06:30.283Z
- Goal: The 4 per-tool hooks (check-redundant-read, check-subagent-return, record-read-content, preflight-shell) are only testable by spawning a fresh node --experimental-strip-types process per test (~120 spawn-based tests across preflight-shell / subagent-return / cost-hygiene-hook suites, ~0.3-0.6s per spawn on Windows). Post-WS1 (suite 115.9s -> 21.1s) these spawn tests are the largest remaining wall-clock lever.
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - - Extract each of the 4 hook flows into `hooks/lib/<name>.ts` exporting a unified core signature: `run<Name>Hook(raw: string
  - env: NodeJS.ProcessEnv): Promise<string | null>`
- Move `logEvent`
  - `parseInput`
  - and related domain functions verbatim from hook entry files into their respective lib files (imports adjusted to `../../scripts/...`)
- Reduce hook entry files (`hooks/preflight-shell.ts`
  - `hooks/check-subagent-return.ts`
  - `hooks/check-redundant-read.ts`
  - `hooks/record-read-content.ts`) to thin shims: env gate → read stdin → call core → write non-null stdout; exit semantics byte-identical
- Convert spawn-based tests in-process via `runHook` helper swap (import core
  - call directly
  - keep all assertions unchanged)
- Retain 1–2 spawn-based smoke tests per hook file to validate runtime-cont
- Out Of Scope:
  - - Behavioral changes to any hook (all side effects
  - stderr handling
  - exit codes must match current behavior)
- Modifications to `tests/hook-feature-gating.test.ts` (stays spawn-based as the bridge test)
- The loop repo's SLICE_TEMPLATE
- WP1
  - WP3
  - WP4 work (other workpackages; separate slices)
- Planned Files: -
- Next Step: Begin implementation

