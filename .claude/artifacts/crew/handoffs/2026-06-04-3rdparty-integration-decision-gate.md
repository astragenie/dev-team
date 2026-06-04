---
kind: handoff
created_at: 2026-06-04
updated_at: 2026-06-04
scope: 3rdparty-integration
status: feat-a-complete-feat-b-c-d-pending
gate: commit-strategy-and-sequence
chosen_option: 3-distribute-across-tiers
spec_path: docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md
feat_a_synthesis: .claude/artifacts/crew/runs/2026-06-04-feat-a-distribute-impl-final-synthesis.md
---
# Handoff — 3rd-party integration design (decision gate)

## Objective

Plan integration of 11 third-party skills (`skills/3rdparty/`) + 21 third-party agents (`agents/3rdparty/`) into the crew workflow per user-supplied role-to-resource mapping. Plan-only — user explicitly forbade implementation.

## Owner

Lead (current session). Decision required from user before spec write can proceed.

## Allowed scope

- Author design spec at `docs/superpowers/specs/2026-06-04-3rdparty-integration-design.md` once option chosen.
- Edits to `docs/routing-table.md`, `docs/architecture/architecture.md`, validator scripts are *planned* but not implemented.

## Forbidden scope

- No code changes.
- No new agent / skill files written (stubs are planned, not created).
- No CI fix yet (the breakage is captured in plan, not patched).

## Current state

- **3rdparty content on disk:** 11 skills + 21 agents downloaded and moved into `skills/3rdparty/` and `agents/3rdparty/`. Untracked.
- **CI broken:** `validate-skills.mjs` fails on `skills/3rdparty/` (missing `tier`, >200-line files, one duplicate from a stray `skills/3rdparty/.claude/skills/code-reviewer/` directory left over from the first install probe). `validate-agents.mjs` passes because it only scans top-level `agents/*.md`.
- **Brainstorm complete:** 3 options presented in chat (A: routing-table-only, B: inline-augment crew prompts, C: hybrid registry + adapters). Quality lift, perf cost, and risk graded for each.
- **Recommendation:** Option C (3–4 weeks, 5–7 slices). Option A as MVP if budget-constrained — A is a strict subset of C so A→C is incremental.
- **Decomposition sketch** (Option C path): 7 candidate FEATs. First one is the CI unblock prerequisite.

## What's done

- Inventoried `agents/`, `skills/`, `docs/`, `scripts/`.
- Read `routing-table.md` (45 rows) + first 40 lines of both validators.
- Confirmed validator failure mode + dup leak.
- Drafted and presented 3 options with pros/cons + +5–10% / +15–25% / +20–35% quality estimates and token-cost estimates.

## What's next (blocked on user)

**User has chosen direction:** hybrid leaning toward Option B (inline-augment crew prompts) + Option A elements (routing-table additions) + new role stubs (uxdesigner, architect, copywriter as first-party agents that delegate to external subagents).

**Refined plan presented in chat (turn 2 of brainstorm):**
- Skills layout: 4 placement options offered; lead recommends **Option 2 (rename `skills/3rdparty/` → `skills/external/`)**.
- Agents layout: same rename → `agents/external/`, with new stubs at `agents/` top level.
- Validator strategy: 3 options offered (exclude / relaxed-tier-only / full-advisory); lead recommends **option b (relaxed: require `tier: external`, no line cap)**.
- Effort estimate: ~8 hours, 2–3 slices, 1 FEAT for CI unblock + rename + validator patch, 1 FEAT for 3 stubs, 1 FEAT for crew prompt edits + routing-table additions.

**PIVOT 2026-06-04 turn 4:** user dropped Option 2 (rename to `external/`). Now wants **Option 3 — distribute 3rd-party skills across existing `skills/{universal,workflow,domain,meta}` tiers**, with permission to create new tier if needed.

**Distribution map proposed (chat turn 4):**

| Skill | Lines | → Target |
|---|---|---|
| brainstorming | 54 | universal |
| code-reviewer | 209 | workflow/reviewing-code/ |
| git-commit-helper | 209 | workflow/git-commit/ |
| systematic-debugging | 296 | workflow/systematic-debugging/ (real split) |
| senior-architect | 209 | domain/architecture-advisory/ |
| senior-backend | 209 | domain/backend-advisory/ |
| senior-frontend | 209 | domain/frontend-advisory/ |
| senior-fullstack | 209 | domain/fullstack-advisory/ |
| senior-security | 209 | domain/security-advisory/ |
| senior-prompt-engineer | 226 | domain/prompt-engineering/ (light split) |
| skill-creator | 485 | meta/skill-creator/ (major split) |

**Recommendation: no new tier.** All 11 fit existing 4 with one semantic stretch (`domain/` hosting advisory packs).

**Effort: ~15 hours, 4–5 slices, 2 FEATs.**

**Risks tabled (chat turn 4):** 8 risks. Top concerns: upstream fork (#1, mitigated by `source:` + `source_version:` frontmatter), content damage from splitting (#2), `code-reviewer` naming collision with `crew:reviewer` agent (#3).

**Agents handling:** propose **defer** — keep `agents/3rdparty/` as-is (validator currently invisible to it). Distribute later if specific agents earn first-party promotion.

**3 new role stubs (uxdesigner, architect, copywriter):** still in scope. Top-level `agents/` with ≤300 lines + Report contract.

**Q1–Q4 RESOLVED 2026-06-04 turn 5:** user accepted all four recommendations.

1. **Q1 — New tier?** NO. Use existing 4 tiers.
2. **Q2 — Agents handling?** DEFER. `agents/3rdparty/` stays as-is.
3. **Q3 — `senior-security`?** → `skills/domain/security-advisory/`.
4. **Q4 — `code-reviewer` skill?** → `skills/workflow/reviewing-code/`.

**Spec written + self-reviewed 2026-06-04 turn 5:** `docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md`. Self-review found and fixed one ambiguity (`model:` value corrected from full ID `claude-sonnet-4-6` to alias `sonnet` matching existing crew convention via `grep ^model: agents/*.md`).

**Spec contents:** Problem, goals (7), non-goals (5), full distribution map (11 skills → tiers), naming-collision resolutions, frontmatter contract (with `source:` + `source_version:` for drift visibility), split strategy per file (trim/light/real/major), routing-table additions (~12 rows), crew agent prompt edits (~15 lines per agent, lead.md still autonomous_safe: false), 3 new role stubs (uxdesigner, architect, copywriter) with delegation map, validator + CI strategy (no validator changes needed), architecture.md update (one paragraph), FEAT decomposition (A: CI-unblock + distribute, B: routing-table, C: crew prompt edits gated by human-in-loop, D: stubs), 10 risks with mitigations, acceptance criteria (8 items).

**Superseded earlier gates (Option 2 path) — no longer relevant:**
- ~~Q2 (Option 2) validator strategy for `skills/external/`~~ — moot, Option 2 abandoned
- ~~Q3 (Option 2) plugin packaging~~ — moot, Option 2 abandoned

**Spec APPROVED 2026-06-04 turn 6:** user said "go" → execution begun.

**FEAT-A COMPLETE 2026-06-04 turn 6:** atomic CI unblock + 11-skill distribution done. All 7 acceptance criteria passed (validate-skills + validate-agents exit 0; `skills/3rdparty/` removed; all 11 distributed with `source:` frontmatter, ≤200 lines; architecture.md advisory-pack paragraph added; source list moved to `docs/operations/3rdparty-source-list.md`). Full report: `.claude/artifacts/crew/runs/2026-06-04-feat-a-distribute-impl-final-synthesis.md`.

Notable FEAT-A details:
- Two `crew:builder` dispatches required (first paused mid-stream after ~5 skills).
- Drive-by edit to `agents/lead.md` (≤200 → ≤300 line cap text) accepted as stale-doc correctness fix.
- Builder trimmed senior-* skills more aggressively than lead's ≤150-line floor guidance (most landed 89–131 vs 209 originals). **Eyeball-review against upstream recommended before commit.**
- 28 advisory warnings (missing `triggers:` frontmatter, missing standard section headings) — non-blocking, deferred to polish slice.

**Verified 2026-06-04 turn 8:** agent line-cap is 300 across validator + all agent files + architecture.md + CHANGELOG + spec stub section. Safe to author FEAT-D stubs at ≤300.

**Outstanding FEATs (B, C, D — order not fixed):**

| FEAT | Scope | Effort | Risk | Gate |
|---|---|---|---|---|
| **FEAT-B** | ~12 routing-table.md rows wiring signals → distributed skills | 1.5h | Low | none |
| **FEAT-C** | Add "Skills you consult" bullet block to 6 crew agents (lead, builder, reviewer, validator, deployer, researcher) | 2h | Med | `autonomous_safe: false` — lead.md edit needs human-in-loop |
| **FEAT-D** | 3 new role stubs at top-level `agents/` (uxdesigner, architect, copywriter) | 2h | Low | none |

**Current gate (user must answer):**

1. **Q-A — Commit FEAT-A now, or bundle with B/C/D?**
   - Commit-now: clean atomic PR; locks in green CI state.
   - Bundle: faster end-to-end; bigger PR; harder to review.
2. **Q-B — Eyeball-review trim aggressiveness?** Recommend yes — `skill-creator` 485→109 is a 77% reduction; senior-* 209→126 is 40%.
3. **Q-C — Sequence?**
   - Option 1 (lead pick): commit-A → then sequential B → D → C.
   - Option 2: continue B/C/D as one WIP, bundle commit at end.
   - Option 3: parallel B + D, then C (fastest, more cost spike).

**Pre-session WIP (untouched):**
- `agents/3rdparty/` (21 agents) — out of scope per FEAT decomposition, deferred for future promotion case-by-case.
- `skills/agents-skils-comp.md` — disposition unknown; user to decide.

**Superseded earlier gates (Option 2 path) — no longer relevant:**
- ~~Q2 (Option 2) validator strategy for `skills/external/`~~ — moot, Option 2 abandoned
- ~~Q3 (Option 2) plugin packaging~~ — moot, Option 2 abandoned

**After user answers:**
1. Lead writes spec to `docs/superpowers/specs/2026-06-04-3rdparty-integration-design.md` reflecting chosen layout + validator strategy.
2. Lead runs spec self-review (placeholders, internal consistency, scope, ambiguity).
3. User reviews spec.
4. *(End of this scope — user said "just plan don't implement". Do not invoke `writing-plans` skill.)*

## Risks / open questions

- **CI is currently red.** Any new commit on this branch will fail `npm test` if `node ./scripts/validate-skills.mjs` is hit. Decide order-of-operations: fix CI first (small isolated commit) vs. fold CI fix into the chosen option's first FEAT.
- **Stray dup:** `skills/3rdparty/.claude/skills/code-reviewer/SKILL.md` should be removed before any commit regardless of option choice.
- **Naming collisions:** `agents/3rdparty/code-reviewer.md` overlaps semantically with first-party `agents/reviewer.md`. Routing-table cells need explicit precedence (see existing row 21 for the `crew:reviewer` exact-name rule).
- **Autonomous-loop gate:** Option B edits `agents/lead.md` → `autonomous_safe: false` per CLAUDE.md → requires human-in-loop on review. Option A and C avoid this.
- **Upstream drift:** Options A and C preserve upgrade path via npx re-fetch. Option B forks.

## References

- Chat-level brainstorm output (this turn).
- Prior synthesis: `.claude/artifacts/crew/runs/2026-06-04-3rdparty-bundle-final-synthesis.md`.
- Source mapping: `skills/3rd party.md` (user-supplied) + the full role table in the user's brainstorm prompt.
- Validators: `scripts/validate-skills.mjs`, `scripts/validate-agents.mjs`.
- Routing seed: `docs/routing-table.md`.

## Suggested next handoff

After user picks an option → "Spec drafted, awaiting user review at `docs/superpowers/specs/...`".
