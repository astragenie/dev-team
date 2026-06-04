---
kind: handoff
created_at: 2026-06-04
scope: 3rdparty-agent-skill-extraction
status: awaiting-user-decision
gate: option-selection-track1-track2
related_handoff: .claude/artifacts/crew/handoffs/2026-06-04-3rdparty-integration-decision-gate.md
session_synthesis: .claude/artifacts/crew/runs/2026-06-04-session-end-synthesis.md
---
# Handoff — 3rd-party agent skill-extraction (decision gate)

## Objective

Plan extraction of substantive guidance from `agents/3rdparty/` (21 vendored agents) into `skills/` taxonomy, addressing two user-defined tracks:

- **Track 1:** overlap cases (code-reviewer, devops-engineer, devops-troubleshooter, research-coordinator) + the 10 already-delegated-via-stub agents (architects, UX, copywriter)
- **Track 2:** specialist-builder cases (python-pro, typescript-pro, c-sharp-pro, ai-engineer) — explicit ask to convert to skills + wire via routing-table for builder

## Owner

Lead. Plan-only — user said `/plan` not `/build`. Decision required before spec write.

## Context audit complete

Line counts measured on all 18 agents under consideration. Notable:

- **Large agents requiring split (>500 lines):** devops-engineer (884), expert-react-frontend-engineer (739), database-architect (682), ui-ux-designer (471)
- **Mid-size (200–300):** python-pro (256), typescript-pro (275), ai-engineer (285), code-reviewer (175), cloud-architect (275), frontend-developer (255), api-documenter (275)
- **Thin (<100):** c-sharp-pro (38), devops-troubleshooter (32), backend-architect (51), markdown-syntax-formatter (56), research-coordinator (93)

## Three options presented (chat turn 2026-06-04 turn N+1)

### Option 1 — Track 2 only (minimal)
- Extract 4 language-pro agents → `skills/domain/{python,typescript,csharp,ai-engineering}-pro/`
- Routing-table + builder.md edits
- **Effort: 3–5h, 1 FEAT.**
- Quality lift: +3–7% on builder language tasks.

### Option 2 — Tracks 1+2 substantive (recommended)
- Track 2 + 8 Track 1 extractions (devops-engineer, research-coordinator, database-architect, cloud-architect, ui-ux-designer, expert-react-frontend-engineer, api-documenter, diagram-architect)
- Augment existing `reviewing-code` skill with language-specific checklists from code-reviewer agent
- Cross-reference architecture-advisory ↔ new database/cloud skills
- Skip: backend-architect (51), api-architect (109), devops-troubleshooter (32), markdown-syntax-formatter (56), c-sharp-pro (38 — optional), frontend-developer (255 — merge into React skill)
- ~15 new routing-table rows; touches builder/reviewer/deployer/researcher/architect/uxdesigner/copywriter agent prompts
- **Effort: 12–19h, 5 slices, 2–3 FEATs.**
- Quality lift: +10–15% on next graded slice.

### Option 3 — Tracks 1+2 + exhaustive audit
- Option 2 + audit every <100 line agent for skill potential
- **Effort: 18–25h, 6–7 slices.**
- Quality lift: +12–17% — marginal extra.

## Lead recommendation: Option 2

Hits cost/value spot. Track 2 fixes the clear architecture violation ("no specialist builders"). Track 1 harvests the high-value 600+ line agents that have substantive content not yet in any crew skill. Skips thin agents where extraction effort exceeds content yield.

## Five open Qs (user must answer before spec write)

1. **Drop c-sharp-pro extraction?** (38 lines, mostly identity) — lean: skip, add later if C# work picks up.
2. **devops-troubleshooter (32 lines): fold into devops-engineering skill?** — lean: yes, single skill with subsections.
3. **frontend-developer (255 lines): separate skill OR merge into react-engineering?** — lean: merge.
4. **Slice ordering: Track 2 first OR biggest-impact (devops-engineer) first?** — lean: Track 2 first (smaller, proves pattern).
5. **Sub-subdir under `skills/domain/`?** (e.g. `skills/domain/languages/`, `skills/domain/infra/`) — lean: keep flat for now.

User can answer "all leans" to accept lead recommendations and proceed.

## What's next

**After user picks option + answers Qs:**
1. Lead writes spec to `docs/superpowers/specs/2026-06-04-3rdparty-agent-skill-extraction-design.md`.
2. Self-review (placeholders, internal consistency, scope, ambiguity).
3. User reviews spec.
4. Per "just plan" pattern: stop at spec, do not invoke `writing-plans`. Implementation waits for explicit greenlight.

## Risks captured in chat

| Risk | Severity |
|---|---|
| 600+ line agents need multi-file splits — risk of content damage | High |
| `skills/domain/` grows 7 → ~15 dirs | Med |
| Routing-table grows 57 → ~72 rows | Low |
| Content style mismatch (agent prompts vs skill style) | Med |
| Builder trim-aggressiveness (observed in FEAT-A: skill-creator 485→109) | High |
| Duplicate content with existing external-plugin skills | Low |
| Builder block could grow past readable bullet count | Med |

## Current uncommitted state

- `?? .claude/artifacts/crew/runs/2026-06-04-session-end-synthesis.md` — session-end synthesis written this session, untracked WIP.
- `?? skills/agents-skils-comp.md` — pre-session typo'd filename, untouched.
- 2 unpushed commits on `main`: `e68b3a5` (heading fix), `a5a2ebc` (fix artifacts).

## References

- Vendored agents: `agents/3rdparty/` (committed `5ea93fd`)
- FEAT-A distributed skills: `skills/{universal,workflow,domain,meta}/` (committed `0d32858`)
- Prior decision-arc handoff: `.claude/artifacts/crew/handoffs/2026-06-04-3rdparty-integration-decision-gate.md`
- Session-end synthesis: `.claude/artifacts/crew/runs/2026-06-04-session-end-synthesis.md`
- Architecture rule: `docs/architecture/architecture.md` line 22 — "No specialist builders. Specializations are skills."
