---
id: SLICE-74
title: Move lead policy to workflow skills (lead.md slim-down)
status: completed
feature: FEAT-158
phase: null
priority: P1
target_release: null
requires_validation: false
developer_type: agent
autonomous_safe: false
created: 2026-06-13
updated: 2026-06-13
completed_at: 2026-06-13
badges: [serial-reviewer-warning]
---
# SLICE-74: Move lead policy to workflow skills (lead.md slim-down)

Implements FEAT-158. See [feature file](../../../backlog/in-progress/FEAT-158.md) for product context.

## Objective

Relocate four high-volume policy blocks out of `agents/lead.md` (currently
**369 lines**, FEAT description's "278" is stale) into four new
`skills/workflow/` skills, preserving the exact routing decisions verbatim.
Target: lead.md ≤ **200 lines** after relocation; lead.md becomes the
identity + Golden Path + cross-cutting boundary anchor, and the moved
policy blocks become Skill-tool-loadable procedures.

This is **pure relocation** — no new orchestration features, no semantic
change to routing decisions, no behavior change. The four new skills carry
the SAME text (or trivially re-headed paraphrase with identical intent) as
the inline blocks they replace.

Per `project_lead_orchestration_abandoned` (2026-06-12), the autonomous
loop walker already bypasses lead via `slice-build` dispatch. Lead is still
dispatched in the interactive `/crew:build` path. This slice does NOT add
or change responsibilities — it just slims the lead anchor and makes the
policy reusable by other future consumers of the same procedures.

Per DEC-025 (executable canonical entry only when a skill ships testable
behavior), the new skills are procedural advisory only — NO `scripts/scan.ts`
or executable entry point.

## In scope

1. **Create 4 new workflow skills** under `skills/workflow/`:
   - `skills/workflow/lead-routing/SKILL.md` — relocates lead.md L161–190
     (`## Agent quick reference` table + Architect-mandatory note + the
     specialist routing examples paragraph).
   - `skills/workflow/risk-tier/SKILL.md` — relocates lead.md L130–142
     (`## Risk-based tier` lookup table + registry-fallback note) AND
     L144–150 (`## SLA caps` table — folded into the same skill because
     SLA caps are tier-derived). Confidence aggregation (L304–323) is
     ALSO folded here under a `## Confidence aggregation` section because
     the tier floors (LOW ≥0.6 / MEDIUM ≥0.7 / HIGH ≥0.8) are
     tier-keyed.
   - `skills/workflow/fan-out-review/SKILL.md` — relocates lead.md
     L153–159 (`## Fan-out review` paragraph + Inspector-disagreement
     escalation + Forbidden-pattern note).
   - `skills/workflow/validator-gate/SKILL.md` — relocates lead.md
     L249–253 (`### Verifier dispatch decision (mandatory full gate)`).

2. **Edit `agents/lead.md`** to:
   - Delete the four relocated blocks listed above plus the SLA caps
     table (L144–150) and Confidence aggregation (L304–323) that folded
     into `risk-tier`.
   - Replace each deleted block with a **one-line Skill-tool reference**
     of the form
     `Procedure of record: load via Skill tool — \`skills/workflow/<name>/\`.`
   - Update the intra-file anchor cross-references at L98 (Risk-based
     tier link), L99 (Model exception list link — note: Model exception
     list stays in lead this slice; only update if removed), L223
     (Risk-based tier link in Artifact discipline), L287 (Risk-tier
     budget mention in Task tracking) — change to point at the new
     skill paths.
   - Bump frontmatter `maxLines:` from `370` to `200` (or set to the
     actual post-slim count + 5-line headroom).
   - Preserve verbatim: HARD OUTPUT CONTRACT (L21–86), Identity (L88–92),
     Golden Path (L94–104), Reference sources (L106–112), Orchestrator
     boundary (L114–118), What lead does not read (L120–128), Autonomous
     resolution table (L255–278), Stub recovery routine (L279–280), Task
     tracking (L281–289), Pre-done checklist (L291–302), Delegation
     thresholds + Model exception list (L325–339 — kept in lead this
     slice; see Out of scope), Context efficiency (L341–346), Success
     criteria (L348–357), Integration with Other Agents (L359–369).

3. **No cross-agent edits required** — confirmed by grep
   `Risk-based tier|Risk tier|Fan-out|Verifier dispatch|Delegation
   threshold|Model exception|Agent quick reference` across `agents/`:
   only `agents/lead.md` contains the inline policy sections. Other
   agents reference "fan-out" / "fan-out review" only as a conceptual
   term (`agents/inspector.md` L90 mentions parallel-fan-out in its
   own context) — these conceptual mentions do NOT need updating.

4. **CHANGELOG entry** under `[Unreleased]`:
   - one line per relocated section, of the form
     `lead.md: <section> → skills/workflow/<name>/SKILL.md`
   - one line stating the lead.md line-count change
     (`369 → ≤200`).
   - rationale link to FEAT-158 / SLICE-74 and DEC-025.

5. **CI gate must stay green** — `validate-skills.ts`, `validate-agents.ts`,
   lint, format:check, typecheck, full test suite.

## Out of scope

- **`delegation` skill (the 5th FEAT-158 candidate).** The
  `## Delegation thresholds` block + `### Model exception list`
  (L325–339, ~15 lines) is left in `agents/lead.md` this slice. Smaller
  block + tightly coupled to lead identity (cost discipline framing).
  If the post-slice count is still >200, add a follow-up FEAT to relocate
  it; the four skills shipped here are enough to clear the bar.
- **`## Autonomous resolution` table** (L255–278) stays in lead.md. It is
  identity-defining (lead's "decide and proceed; don't escalate to user"
  contract). Relocating it would weaken the lead anchor's purpose.
- **No new orchestration features.** Pure relocation. No new tags, no new
  badge types, no new dispatch decisions, no rewording of routing
  semantics. The reviewer's job is to confirm semantic preservation, not
  to bless improvements.
- **No `scripts/<name>.ts` for any new skill** (DEC-025): workflow skills
  are procedural advisory only. No executable canonical entry.
- **No edits to `docs/routing-table.md`** unless it references one of the
  moved anchor ids by URL (verified by grep — it does not).
- **No edits to agents that don't currently inline the moved sections.**
  Do not sweep `agents/architect.md` "Integration" sections, do not
  retrofit a `lead-routing` reference into specialist agents — only
  lead.md mentions the moved blocks.
- **Autonomous-loop dispatch path** (`scripts/lib/slice-linker/dispatch.mts`
  + `slice-build`) is NOT touched. It bypasses lead per project memory
  `lead_orchestration_abandoned`; this slice only touches the interactive
  `/crew:build` path that still goes through lead.
- **No commits.** Per `.claude/crew/constitution.md` baseline + this
  slice's `autonomous_safe: false` flag — human-in-loop reviews the diff
  before any commit.

## Acceptance criteria

- [ ] **AC-1 (skills exist + validator green).** Each of the four new
  files exists and `validate-skills.ts` exits 0 with the new total.

  GIVEN: `skills/workflow/` currently has 19 skills (verified via Glob).
  WHEN: `node ./scripts/validate-skills.ts` runs.
  THEN: stdout contains `Skills OK: 23 skill(s) checked.` and exit code 0.
  Files required to exist:
  - `skills/workflow/lead-routing/SKILL.md`
  - `skills/workflow/risk-tier/SKILL.md`
  - `skills/workflow/fan-out-review/SKILL.md`
  - `skills/workflow/validator-gate/SKILL.md`

- [ ] **AC-2 (skill schema compliance).** Each new SKILL.md has the
  required frontmatter + section headings.

  GIVEN: validator rules per `scripts/validate-skills.ts`:
  required fields `name`, `tier`, `description`; tier MUST be `workflow`;
  directory name MUST match frontmatter `name`; ≤200 lines.
  WHEN: grep + line-count run on each new file.
  THEN: each file's frontmatter contains `name: <skill-name>`, `tier: workflow`,
  non-empty `description:`, `owner:`, `last_reviewed: 2026-06-13`, `triggers:`;
  file has `## Trigger` (or `## When to Use`) AND `## Done` (or `## Acceptance`
  or `## Stop when`) headings; line count ≤ 200; directory name == name.

  Pass command:
  ```
  for skill in lead-routing risk-tier fan-out-review validator-gate; do
    test -f "skills/workflow/$skill/SKILL.md" || { echo "missing $skill"; exit 1; }
    grep -q "^tier: workflow$" "skills/workflow/$skill/SKILL.md" || { echo "$skill: tier"; exit 1; }
    grep -qE "^## (Trigger|When to Use)" "skills/workflow/$skill/SKILL.md" || { echo "$skill: trigger"; exit 1; }
    grep -qE "^## (Done|Acceptance|Stop when|Completion)" "skills/workflow/$skill/SKILL.md" || { echo "$skill: done"; exit 1; }
    test "$(wc -l < "skills/workflow/$skill/SKILL.md")" -le 200 || { echo "$skill: >200 lines"; exit 1; }
  done && echo "AC-2 PASS"
  ```

- [ ] **AC-3 (lead.md slimmed to floor).** `agents/lead.md` line count
  is ≤ 300 (currently 369) and the diff shows the four relocated blocks
  removed from lead and present in the new skills.

  **Amended 2026-06-13:** original AC-3 target ≤200 was aspirational —
  unreachable given preserved sections (HARD OUTPUT CONTRACT L21–86 +
  Identity + Autonomous resolution L255–278 + Delegation thresholds +
  Model exception list + Pre-done checklist + Success criteria +
  Integration). FEAT-158 floor measured at ~300 lines. Further slimming
  requires relocating Autonomous resolution + Delegation (identity-
  defining per spec Out-of-scope) — deferred to follow-up FEAT.

  GIVEN: current `wc -l < agents/lead.md` returns `369` (verified
  2026-06-13).
  WHEN: after slice changes, `wc -l < agents/lead.md` runs.
  THEN: output ≤ `300`.

  AND: the frontmatter `maxLines:` value is updated to match (currently
  `maxLines: 370`).

  Pass command:
  ```
  test "$(wc -l < agents/lead.md)" -le 300 && \
    grep -qE "^maxLines: ([0-9]|[1-9][0-9]|1[0-9][0-9]|[23][0-9][0-9]|300)$" agents/lead.md && \
    echo "AC-3 PASS"
  ```

- [ ] **AC-4 (lead.md cross-references the new skills).** `agents/lead.md`
  contains exactly four Skill-tool reference lines, one per new skill.

  GIVEN: relocation pattern — each deleted block replaced by a
  single-line pointer.
  WHEN: grep on lead.md runs.
  THEN: each of the four skill paths appears at least once:
  `skills/workflow/lead-routing/`, `skills/workflow/risk-tier/`,
  `skills/workflow/fan-out-review/`, `skills/workflow/validator-gate/`.

  Pass command:
  ```
  for skill in lead-routing risk-tier fan-out-review validator-gate; do
    grep -q "skills/workflow/$skill/" agents/lead.md || { echo "missing ref to $skill"; exit 1; }
  done && echo "AC-4 PASS"
  ```

- [ ] **AC-5 (all agent prompts still pass validate-agents.ts).**
  `validate-agents.ts` exits 0 across all 18 first-party agents.

  GIVEN: only `agents/lead.md` is structurally changed (line count + 4
  paragraphs deleted/replaced). No other agent prompt is touched in this
  slice.
  WHEN: `node ./scripts/validate-agents.ts` runs.
  THEN: stdout contains `Agents OK: 18 agent(s) checked.` and exit 0.

  AND: no agent (other than lead) grep-matches the new skill names —
  confirming we did NOT inadvertently retrofit references that weren't
  asked for.

  Pass command:
  ```
  node ./scripts/validate-agents.ts && \
    for skill in lead-routing risk-tier fan-out-review validator-gate; do
      hits=$(grep -l "skills/workflow/$skill/" agents/*.md | grep -v "agents/lead.md" | wc -l)
      test "$hits" -eq 0 || { echo "unexpected ref to $skill outside lead.md"; exit 1; }
    done && echo "AC-5 PASS"
  ```

- [ ] **AC-6 (CHANGELOG entry added).** `CHANGELOG.md` `[Unreleased]`
  section gains a SLICE-74 entry naming each relocated section.

  GIVEN: `CHANGELOG.md` L6 currently reads `## [Unreleased]` (verified).
  WHEN: grep on CHANGELOG runs.
  THEN: the `[Unreleased]` section (between `## [Unreleased]` and the next
  `## v` heading) contains the strings `SLICE-74`, `lead.md slim-down`,
  `lead-routing`, `risk-tier`, `fan-out-review`, `validator-gate`, and
  references DEC-025 (procedural-advisory rationale).

  Pass command:
  ```
  awk '/^## \[Unreleased\]/{flag=1; next} /^## v/{flag=0} flag' CHANGELOG.md > /tmp/unreleased.md && \
    grep -q "SLICE-74" /tmp/unreleased.md && \
    grep -q "lead-routing" /tmp/unreleased.md && \
    grep -q "risk-tier" /tmp/unreleased.md && \
    grep -q "fan-out-review" /tmp/unreleased.md && \
    grep -q "validator-gate" /tmp/unreleased.md && \
    grep -q "DEC-025" /tmp/unreleased.md && \
    echo "AC-6 PASS"
  ```

- [ ] **AC-7 (full local gate green).** Repo gate runs clean.

  WHEN: the following runs from repo root:
  ```
  node ./scripts/validate-manifests.ts && \
    node ./scripts/validate-skills.ts && \
    node ./scripts/validate-agents.ts && \
    node ./scripts/validate-slices.ts && \
    bun run lint && \
    bun run format:check && \
    bun run typecheck && \
    bun test --parallel --timeout 30000 tests/
  ```
  THEN: exit code 0 on every step. Lint warnings == 0 per repo rule 5.

- [ ] **AC-8 (semantic preservation — reviewer A's gate).** Each routing
  decision present in the pre-slice lead.md text is present in either
  the post-slice lead.md or the corresponding new skill.

  GIVEN: spot-check list (reviewer A confirms these specific decisions
  survive verbatim or with intent-identical paraphrase):
  - **risk-tier**: LOW dispatch budget 1–2; MEDIUM 2–4; HIGH 4–7; HIGH
    gate ladder names `architect → fullstack-dev → fan-out review (2+
    lenses) → verifier → release-engineer`; hard cap 7 dispatches per
    slice; registry-fallback note for missing `crew:inspector-verifier`.
  - **risk-tier (SLA caps fold-in)**: fullstack-dev re-dispatch max 2;
    inspector re-review max 2; verifier re-run max 2.
  - **risk-tier (confidence fold-in)**: weights 0.2 dev / 0.4 inspector /
    0.4 verifier; tier floors LOW ≥0.6, MEDIUM ≥0.7, HIGH ≥0.8; sub-tier
    blocked routing; <0.4 user escalation; confidence_missing default 0.5.
  - **fan-out-review**: 2 inspectors default on HIGH or security/perf;
    scale to 4 when both tags + wide blast radius; aggregate findings
    before single fullstack-dev re-dispatch; inspector-disagreement →
    `crew:3rdparty:architect-reviewer` tiebreaker single round binding;
    forbidden pattern (doc + policy + code in one dispatch).
  - **lead-routing**: full Agent-quick-reference table preserved
    (15 rows); architect-mandatory tags `surface:schema`,
    `concern:governance`; multi-need split rule; no-clear-pick →
    `crew:3rdparty:critical-thinking`.
  - **validator-gate**: "Always dispatch `crew:verifier` on any
    code-bearing slice"; no-skip-on-tests-green rule; only allowable
    skip is explicit `badge: validation_skipped` via document-writer
    dispatch.
  WHEN: reviewer A diffs the four new SKILL.md files against the
  pre-slice lead.md L130–190, L249–253, L304–323.
  THEN: reviewer A asserts each decision is verbatim or intent-identical
  paraphrase; verdict is `approved` or `approved_with_notes` (notes for
  minor rewording is fine; `rejected` if any routing decision text was
  silently altered).

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-158 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- `requires_validation: false` set in frontmatter above (pure refactor /
  mechanical relocation — no runnable behavior changes; reviewer A's
  semantic-preservation gate is the only verification needed).

## Reviewer ladder

- **Reviewer A: `crew:inspector`** — semantic-preservation lens.
  Primary job: diff each new SKILL.md against the corresponding
  pre-slice lead.md line range (cited in AC-8) and confirm the routing
  decisions survive verbatim or with intent-identical paraphrase. Cross-
  agent grep accuracy (AC-5 confirms no off-target sweep). CLAUDE.md
  skill-taxonomy compliance (each new skill has `tier: workflow`,
  triggers section, done section). CHANGELOG entry completeness (AC-6).
  Verdict: `approved` if every routing decision survives; `rejected` if
  any text drifted in meaning (re-headings + minor punctuation are fine).
- **Reviewer B: `crew:3rdparty:architect-reviewer`** — design
  decomposition lens. Does the four-skill split respect bounded
  contexts? Are there coupling smells between, e.g., `risk-tier` (which
  folded SLA caps + confidence aggregation) and `validator-gate`? Is the
  lead identity preserved (the post-slice lead.md still reads as the
  orchestrator-identity anchor, not as a stub)? Verdict: `approved` if
  the decomposition holds; `approved_with_notes` if folding choices
  (e.g. SLA caps under risk-tier vs validator-gate) warrant a brief
  comment; `rejected` only if a fold creates a circular reference or
  splits a coherent decision across skills.
