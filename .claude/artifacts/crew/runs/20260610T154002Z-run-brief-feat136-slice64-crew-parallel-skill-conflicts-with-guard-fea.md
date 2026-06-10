---
feature: FEAT-136
---
# Run Brief: FEAT136 SLICE64: /crew:parallel skill conflicts with guard-feat-dispatch hook

- Created: 2026-06-10T15:40:02.244Z
- Goal: `commands/parallel.md` step 7 tells the orchestrator to dispatch `agents/parallel-runner.md`, but consuming repos' `guard-feat-dispatch.mjs` PreToolUse hook blocks `crew:parallel-runner` on FEAT work (not in the ceremony-specialist allowlist). Apply **Path A** (FEAT-136 preferred): rewrite step 7 to dispatch `crew:lead` per worktree directly in one parallel Agent block, embedding the per-worktree slice ceremony in the skill body. WS2 pilot slice: full-tier ladder with concurrent reviewer+validat
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - - `commands/parallel.md` step 7 rewrite (Path A: per-worktree `crew:lead` dispatch
  - no parallel-runner)
- README + skill description updates reflecting Path A
- Documented decision on the fate of `agents/parallel-runner.md`
- Dry-run smoke evidence for the rewritten dispatch path
- Out Of Scope:
  - - Hook allowlist changes (Path B / FEAT-137 territory)
- Changes to `loop dispatch prepare/finalize` CLI surfaces
- Planned Files: -
- Next Step: Begin implementation

