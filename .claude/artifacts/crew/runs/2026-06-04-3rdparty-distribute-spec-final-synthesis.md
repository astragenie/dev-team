---
kind: final-synthesis
slice: null
feature: null
phase: planning
grade: null
decisions: []
created_at: 2026-06-04
scope: 3rdparty-integration-design-plan
spec_path: docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md
handoff_path: .claude/artifacts/crew/handoffs/2026-06-04-3rdparty-integration-decision-gate.md
---
# Final synthesis — 3rd-party integration design (planning phase)

**Type:** planning / spec-write (no slice, no FEAT, no code). User invoked `/superpowers:brainstorming` with explicit "just plan don't implement" directive.

## What shipped

- Design spec: `docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md` (~250 lines).
- Updated handoff: `.claude/artifacts/crew/handoffs/2026-06-04-3rdparty-integration-decision-gate.md` (tracks the full decision arc across 5 turns).
- This synthesis.

## Options evaluated

Three implementation options presented in turn 1 of brainstorm:

| Option | Shape | Quality lift | Token cost | Risk | Effort |
|---|---|---|---|---|---|
| **A — Routing-table-only** | Add routing-table rows + 3 thin stub agents + validator exclude on `3rdparty/`. No crew-prompt edits. | +5–10% | neutral | Low | 2–4 hours, 1 FEAT |
| **B — Inline-augment crew prompts** | Edit 6 crew agent prompts with "consult X" lines + 3 stubs + curate top 3–5 skills into compliant first-party form. | +15–25% | +10–20% tokens | Medium (touches lead.md → `autonomous_safe: false`) | 1–2 weeks, 3–4 slices |
| **C — Hybrid registry + adapters** | Keep 3rdparty as-is + `docs/3rdparty-registry.md` + extended validators (`external: true` opt-in) + sync script + stubs that delegate. | +20–35% | +5–15% tokens | Medium-high | 3–4 weeks, 5–7 slices |

User initially leaned hybrid (B + A elements) in turn 2, then **pivoted to Option 3 (distribute into existing tiers)** in turn 4. Option 3 is a separate strategy from A/B/C above — it forces first-party compliance for the 11 skills by placing them in `skills/{universal,workflow,domain,meta}/`. Trade: loses upstream upgrade path; gains full discoverability, validator coverage, and tier-mental-model fit.

## Why Option 3 chosen over A / B / C

- **A** preserves upgradability but leaves 11 skills off-taxonomy and undiscoverable except via routing-table. User wanted skills "incorporated" not "referenced".
- **B** curates aggressively (keeps top 3–5, drops rest). User wanted all 11 usable.
- **C** is the highest-ceiling but heaviest engineering investment (registry + validator extensions + sync script). User chose simpler path.
- **Option 3** does the rename-and-comply work once up front: all 11 skills become first-class crew skills with full validator coverage, full tier-mental-model fit, and routing-table coverage. Cost: forks upstream (mitigated by `source:` + `source_version:` frontmatter for drift visibility).

## Decisions resolved (recorded in handoff)

| ID | Question | Answer |
|---|---|---|
| Q1 | New tier needed? | NO. Existing 4 tiers absorb all 11 with `domain/` semantically stretched to host advisory packs. |
| Q2 | 21 agents — distribute now? | DEFER. Keep `agents/3rdparty/` intact (validator already invisible to it). Promote to first-party later case-by-case. |
| Q3 | `senior-security` placement? | `skills/domain/security-advisory/` (parallels other senior-* in `domain/`). |
| Q4 | `code-reviewer` skill placement? | `skills/workflow/reviewing-code/` — renamed action-gerund to disambiguate from `crew:reviewer` agent. |

## Distribution map (final)

1 universal, 3 workflow, 6 domain, 1 meta = 11 distributed. See spec for full table with source paths, line counts, split strategies.

## FEAT decomposition

- **FEAT-A** — CI unblock + skill distribution (atomic, single PR, ~6–10 hours).
- **FEAT-B** — Routing-table additions (~12 rows, 1.5 hours).
- **FEAT-C** — Crew agent prompt edits (`autonomous_safe: false` due to lead.md edit, ~2 hours, human-in-loop required).
- **FEAT-D** — Three new role stubs (uxdesigner, architect, copywriter at top-level `agents/`, ~2 hours).
- Total: ~15 hours engineering, 4 slices, 2–3 FEATs.

## Key risks captured in spec

10 risks tabled. Top three:
1. **Upstream drift (High)** — mitigated by `source:` frontmatter + quarterly audit.
2. **Content damage from splitting (Medium)** — light trims first, reference-extract reserved for genuinely over-cap files.
3. **Naming collision** `code-reviewer` skill ↔ `crew:reviewer` agent (Medium) — resolved by renaming to `reviewing-code`.

## Self-review findings

- Placeholder scan: clean (no TBD/TODO).
- Internal consistency: distribution map ↔ split strategy ↔ routing ↔ stubs ↔ acceptance criteria all aligned.
- One ambiguity fixed inline: `model:` value corrected from `claude-sonnet-4-6` (full ID) to `sonnet` (alias) matching existing crew convention (`grep ^model: agents/*.md` returned 5× sonnet, 1× opus).
- Scope: 4 FEATs is at the upper bound of "single plan" but FEAT-A is the only mandatory bundle; B/C/D land independently after A.

## Continuity hooks

- Next session: user reviews spec at `docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md`. Outcomes: approve (stop, future session implements) / request changes (revise + re-review) / reprioritize (revise scope).
- If implementation greenlit later: start with FEAT-A. Single PR, single commit boundary. Cannot be partial — partial leaves `skills/3rdparty/` half-emptied and CI stays red.
- CLAUDE.md notes lead-prompt edits are `autonomous_safe: false`. FEAT-C must plan for human-in-loop review.
- Untracked WIP from session: `skills/3rdparty/`, `agents/3rdparty/`, this synthesis, the handoff, and the spec itself. Not committed per user's "just plan" directive.

## References

- Spec: `docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md`
- Handoff: `.claude/artifacts/crew/handoffs/2026-06-04-3rdparty-integration-decision-gate.md`
- Prior synthesis (download phase): `.claude/artifacts/crew/runs/2026-06-04-3rdparty-bundle-final-synthesis.md`
- Source mapping: `skills/3rd party.md` + user-supplied role table in brainstorm prompt
- Validators: `scripts/validate-skills.mjs`, `scripts/validate-agents.mjs`
- Routing seed: `docs/routing-table.md`
- Architecture: `docs/architecture/architecture.md` (sections "Skill tiers" + "External plugin skills as routed dependencies")
