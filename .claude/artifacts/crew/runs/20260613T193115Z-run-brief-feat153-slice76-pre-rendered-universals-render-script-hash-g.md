---
feature: FEAT-153
status: active
---
# Run Brief: FEAT153 SLICE76: Pre-rendered universals render script + hash gate + verifier pilot inject

- Created: 2026-06-13T19:31:15.075Z
- Tier: full
- Goal: Ship the `scripts/render-universal-skills.ts` build-time CLI that emits a deterministic ≤35-line "essentials" block extracted from three external universal skills (`superpowers:using-superpowers`, `superpowers:verification-before-completion`, `loop:loop-discipline`), inlines that block into ONE pilot agent prompt under a hash-marked anchor, and wires a hash-drift gate into `scripts/validate-agents.ts` so CI fails when the source skills change without re-rendering. The remaining 16 agent injectio
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - ### 1. New file: `scripts/render-universal-skills.ts` (Bun TS CLI
  - ≤200 lines)

Bun TS CLI following the `skills/workflow/test-quality/scripts/analyze.ts` style anchor (DEC-027 default-mode pattern
  - narrow `unknown`
  - no `process.exit` from library functions
  - `await main().catch()` at module bottom).

**Exports (importable):**

- `renderUniversals(opts: { sources: SourcePaths }): { body: string; hash: string }`
  - `SourcePaths = { usingSuperpowers: string; verificationBeforeCompletion: string; loopDiscipline: string }` (absolute paths to three SKILL.md files)
  - `body`: ≤ 35 lines of Markdown
  - deterministic across runs given identical sources.
  - `hash`: SHA-256 hex digest (lowercase
  - 64 chars) computed over the canonical concatenation of source contents joined by `"\n---SKILL-BOUNDARY--
- Out Of Scope:
  - - **Re-shipping Part 1.** Skill cap = 3 already lives in primary agent prompts per FEAT-153 body (architect / reviewer / validator carry `max 3 per <phase>`; inspector.md line 70-72 confirms). Do NOT touch the skill-table sections.
- **Authoring new skill files.** Per DEC-025
  - this slice's canonical entry IS the executable script (`scripts/render-universal-skills.ts`). No `skills/**/SKILL.md` crea
- Planned Files: -
- Next Step: Begin implementation

