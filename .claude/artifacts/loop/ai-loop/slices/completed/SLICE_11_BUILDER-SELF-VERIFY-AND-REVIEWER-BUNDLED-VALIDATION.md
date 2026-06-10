---
id: SLICE-11
feature: FEAT-030
title: Builder self-verify + reviewer-bundled validation
status: completed
priority: P0
autonomous_safe: false
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
github_issue: 40
github_url: "https://github.com/sergeymilashico/hero-crew/issues/40"
---
# SLICE-11: Builder self-verify + reviewer-bundled validation

- **Priority**: P0
- **Status**: Pending
- **Author**: herolegion
- **Created**: 2026-06-02
- **Parent Feature**: FEAT-030
- **autonomous_safe**: false — agent prompt edits require human-in-loop review

## Objective

Codify cost-discipline rule #3 into the builder + reviewer + lead agent
prompts and into the `write-review-result` CLI. Builder runs its own
lint+test+typecheck before handoff. Reviewer optionally emits a
validation-evidence note when the change is tests-already-green +
code-only + no user-visible surface. Lead skips `crew:validator`
dispatch when that note is present. Targets the 49-subagent-per-slice
cost driver visible in SLICE-08 reports.

## Why now

- Cost reports show 49 subagent dispatches on SLICE-08 (3.6% tool fail
  rate, 34 compactions). Cost-discipline rule #3 already documents the
  bundle-subagents pattern; agent prompts don't yet enforce it.
- Sequence-recommended after FEAT-033 (just shipped in v0.4.0).
  FEAT-029 deferred until user runs dogfood A/B.
- Pairs with FEAT-032 (artifact-path-only returns) for combined
  subagent + compaction wins. Independent of FEAT-029.

## In scope (8 files)

### Prompt edits (all additive, no rewrites of existing rules)

1. **`agents/builder.md`** — add `## Self-verify gate` section after the
   existing `## Report contract`. Section MUST:
   - require lint + tests + typecheck + repo-defined manifest/skill/slice
     validators to be run BEFORE writing the handoff
   - require the builder's handoff body to include a `Self-Verify Gates`
     section with one line per gate (command + exit code or pass/fail
     + one-sentence summary)
   - explain that self-verify complements but does not replace the
     reviewer's independent gate (reviewer re-runs anything fragile)
   - reference `.claude/loop.json` `stack.build` + `stack.test` arrays
     as the canonical gate command source for repos that use the loop
   
   Also update `## Review and validation dispatch` to add the bundled-
   validation path: dispatch `crew:validator` ONLY when behavior is
   user-visible OR reviewer note absent.

2. **`agents/reviewer.md`** — add `### Validation-evidence bundling
   (FEAT-030)` subsection inside `## Review artifact` (before the
   `write-review-result` CLI block). Section MUST:
   - state the three-condition test: tests-already-green AND code-only
     diff AND no runtime/UI/CLI surface affected
   - tell the reviewer to populate the new `--validation-evidence` flag
     with: test suite total + pass count, gate commands re-run, and a
     one-sentence verdict
   - state that when ANY condition fails, the reviewer MUST NOT emit
     the note — behavior-visible changes need an independent validator
     pass
   - explicitly cross-reference that the lead reads the note and skips
     `crew:validator`; the lead never skips validator when the note is
     absent
   
   Also update the `write-review-result` CLI block to include the new
   flag.

3. **`agents/lead.md`** — add `### Validator dispatch decision (FEAT-030)`
   subsection inside `## Review, validation, deployment`. Section MUST:
   - list dispatch triggers (behavior user-visible, runtime config
     changed, new artifact kinds/schema, missing test coverage, OR
     reviewer note absent)
   - list skip conditions (ALL three must hold: tests-already-green,
     code-only diff, reviewer emitted validation-evidence note)
   - require the skip to be recorded via `mark-badge validation_skipped`
     with `--note "reviewer emitted validation-evidence note"`
   - state that the note is the evidence and the skip is the decision —
     not the same thing

### CLI extension

4. **`scripts/crew.mjs`** — add `--validation-evidence <text>` flag to
   the `write-review-result` subcommand. Pass-through to the writer.
   Optional flag (default `null`).

5. **`scripts/lib/crew/writers.mjs`** (or wherever `write-review-result`
   lives — investigation first) — when `validationEvidence` is non-null
   and non-empty, render a `## Validation Evidence` body section
   between the existing `Test Adequacy` and `Risks` sections. Also
   include the evidence string in the artifact frontmatter under a
   new `validation_evidence: <text>` field for easy programmatic
   detection by the lead.

### Tests

6. **`tests/cli.test.mjs`** (or the appropriate writer test file —
   investigation first) — add 3 new tests:
   - `--validation-evidence "<text>"` round-trips: frontmatter has
     `validation_evidence: <text>` AND body has `## Validation Evidence`
     section with the text
   - flag omitted → no frontmatter field, no body section (backwards
     compat)
   - `--validation-evidence ""` (empty string) → treated as omitted

### Docs

7. **`docs/routing-table.md`** — add a new row pointing to the
   FEAT-030 rule:
   `| reviewer emitted validation-evidence note | lead | skip
   crew:validator dispatch + mark badge validation_skipped |`

8. **`CHANGELOG.md`** — add a v0.5.0 top section dated 2026-06-02 (or
   release date) under FEAT-030. Note this is a minor bump because
   review-semantics changed (validator-skip path is new behavior).

## Out of scope

- Any change to `agents/validator.md`. Validator behavior is unchanged
  when dispatched.
- Any change to `agents/researcher.md` or `agents/deployer.md`.
- Changes to FEAT-029 cost-hygiene hook files (`hooks/preflight-shell.mjs`,
  `hooks/check-redundant-read.mjs`, `hooks/record-read-content.mjs`,
  `scripts/lib/cost-hygiene/`, `scripts/lib/preflight/`).
- FEAT-031 (lead model-selection gate) — separate slice.
- FEAT-032 (artifact-path-only returns) — separate slice.
- A v0.5.0 release tag — version bump in this slice's commit only;
  tag + push are user-triggered per `CLAUDE.md` Release workflow.
- Rewrites of existing builder/reviewer/lead rules. All edits are
  additive sections; no existing language is rewritten.

## Acceptance criteria

Each criterion must be testable per `01-loop-control/EVIDENCE_RULES.md`.

- [ ] AC-1: `agents/builder.md` contains a `## Self-verify gate`
      section with the four bullets listed in "In scope" #1. Evidence:
      grep + read.
- [ ] AC-2: `agents/builder.md` `## Review and validation dispatch`
      section explicitly mentions the bundled-validation skip path.
      Evidence: grep for "reviewer note" or "validation-evidence" in
      that section.
- [ ] AC-3: `agents/reviewer.md` contains a `### Validation-evidence
      bundling (FEAT-030)` subsection with the three-condition test
      verbatim. Evidence: grep + read.
- [ ] AC-4: `agents/reviewer.md` `write-review-result` CLI block
      includes the `--validation-evidence` flag. Evidence: grep.
- [ ] AC-5: `agents/lead.md` contains a `### Validator dispatch
      decision (FEAT-030)` subsection inside the `## Review,
      validation, deployment` section. Evidence: grep + read.
- [ ] AC-6: `agents/lead.md` skip path requires `mark-badge
      validation_skipped` with `--note "reviewer emitted
      validation-evidence note"`. Evidence: grep for the literal note.
- [ ] AC-7: `scripts/crew.mjs` `write-review-result` subcommand
      accepts `--validation-evidence <text>` flag. Optional, default
      null. Evidence: source diff + a CLI test that passes the flag
      without erroring.
- [ ] AC-8: When `--validation-evidence "<text>"` is passed, the
      generated review-result artifact contains:
      (a) `validation_evidence: <text>` in YAML frontmatter
      (b) a `## Validation Evidence` body section with the text
      Evidence: test asserts both, structured diff vs no-flag baseline.
- [ ] AC-9: When `--validation-evidence` is omitted OR passed as `""`,
      the artifact has neither the frontmatter field nor the body
      section. Evidence: backwards-compat test.
- [ ] AC-10: `docs/routing-table.md` has a new row mapping the
      validation-evidence note to the lead's skip decision. Evidence:
      file diff.
- [ ] AC-11: `CHANGELOG.md` has a v0.5.0 entry under FEAT-030
      describing the new gate semantics + backwards-compat default.
      Evidence: file diff.
- [ ] AC-12: All 8 CI gates green:
      `npm ci` → `validate-manifests` → `validate-skills` →
      `validate-slices` → `npm run lint` (zero warnings) →
      `npm run format:check` → `npm run typecheck` → `node --test`
      (including new tests) → `node ./scripts/e2e-smoke.mjs`.
      Evidence: green local run.
- [ ] AC-13: Builder + lead agent prompt files stay ≤200 lines after
      the additive sections (per `CLAUDE.md` plugin shape rule: "The
      lead agent prompt is capped at ≤200 lines"). Evidence: wc -l
      check. Current sizes: lead 214 lines (already over — flag in
      handoff), builder 133, reviewer 177. If lead exceeds the cap
      further, reviewer must flag.

## Done When

- all acceptance criteria above are PASS with evidence
- build passes per `.claude/loop.json` `stack.build`
- tests pass per `.claude/loop.json` `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` field
  populated AND `Validation Evidence` section populated (this slice
  is a meta-test of its own rule)
- Crew `final-synthesis` artifact written
- entry appended to `../backlog/completed-slices.md`
- this slice file moved from `slices/pending/` → `slices/completed/`
- FEAT-030 moves from `docs/backlog/in-progress/` to `docs/backlog/done/`
- **User reviews the three agent prompt diffs in conversation BEFORE
  the commit lands** (per autonomous_safe: false repo policy)

## Reviewer ladder

- Reviewer A: code-bearing review — `scripts/crew.mjs` flag wiring,
  `scripts/lib/crew/writers.mjs` section rendering, tests. Confirm
  no existing CLI flag was renamed or repurposed. Confirm backwards
  compat: omitted flag = identical artifact to v0.4.0 baseline.
- Reviewer B: prompt review — agent prompt diffs MUST be presented
  to the user for sign-off before commit. autonomous_safe: false
  requires human-in-loop. Reviewer flags any unintended rewrite of
  existing rules (only additive sections allowed).

## Risks

- **Lead prompt is already at 214 lines, over the documented ≤200
  cap.** Adding +25 lines pushes to ~239. Mitigations:
  - Slimmer subsection (~10 lines instead of 25)
  - Move some of the existing lead content to a skill file under
    `skills/workflow/review-gates/`
  - Acknowledge cap violation in slice grade + open a follow-up to
    refactor lead.md down to ≤200
  Recommend the third path for this slice; refactor in a separate FEAT.
- **Convention vs CLI** — chose CLI flag (cleaner than parsing the
  artifact body for a magic string). Trade: requires `scripts/`
  change. Worth it for parse stability.
- **Reviewer judgment** — the three-condition test ("no user-visible
  surface") is fuzzy. Examples in the reviewer.md section help but
  edge cases remain. Mitigation: when in doubt, reviewer does NOT
  emit the note; the default is conservative.
- **Backwards compat** — existing repos with custom reviewers must
  not break. Default-omitted flag preserves v0.4.0 behavior exactly.
  Reviewers that don't update see no breakage.
- **Self-meta-test** — this slice's own review-result should populate
  the validation-evidence note (prompt-edit + CLI is code-only,
  tests-already-green when builder finishes, no user-visible surface
  changes). That's the canonical example of the new path.

## Open questions

- Where does `write-review-result` live in `scripts/lib/`? Investigation
  first task of slice (read-only grep on `write-review-result` in
  scripts/).
- Should the `validation_evidence` frontmatter field name use snake_case
  (matching existing fields like `test_summary`) or kebab-case? Default:
  snake_case for YAML consistency. Builder confirms convention by
  inspecting current frontmatter.
- Should the v0.5.0 bump happen in the same commit as the code, or a
  separate release-prep commit? Default: separate, mirroring v0.4.0
  pattern (`feat(...)` commit landed code; `chore(release)` bumped
  versions).
