---
id: SLICE-14
feature: FEAT-035
title: Agent prompt quality bar + cap raise + lean-agent enrichment
status: completed
priority: P1
autonomous_safe: false
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
github_issue: 50
github_url: "https://github.com/sergeymilashico/hero-crew/issues/50"
---
# SLICE-14: Agent prompt quality bar + cap raise + lean-agent enrichment

- **Priority**: P1
- **Status**: Pending
- **Parent Feature**: FEAT-035
- **autonomous_safe**: false — three agent prompt edits + new CI gate

## Objective

Raise the agent prompt soft cap from ≤200 to ≤300 lines, codify the
new cap into a `scripts/validate-agents.mjs` CI validator, and enrich
the three lean agent prompts (`researcher`, `deployer`, `validator`)
with context-efficiency, shell pre-check, CLI-block, and depth-control
guidance the heavy agents already have.

## In scope (10 steps)

1. **`scripts/validate-agents.mjs`** (new) — mirror
   `scripts/validate-skills.mjs:25`. Enforce ≤300 lines, required
   frontmatter (`name`, `description`, `model`), required body
   sections (identity intro + `## Report contract`).
2. **`docs/governance.md`** — replace `≤ 200 lines` with `≤ 300 lines`
   in the Agent prompt size bar section.
3. **`CLAUDE.md`** — update the "lead agent prompt is capped at ≤200
   lines" line.
4. **`docs/architecture/architecture.md`** — update all ≤200
   references to ≤300.
5. **`.github/workflows/test.yml`** — wire `validate-agents.mjs` into
   CI between `validate-skills` and `validate-slices`. CLAUDE.md CI
   gate list updates to 9 gates.
6. **`agents/researcher.md`** — add Context efficiency section
   (Grep-before-Read, scoped reads, batch reads, front-load reads in
   first 1-2 turns, no re-Read), Repo layout on start, and Research
   depth threshold (when "good enough" beats exhaustive).
7. **`agents/deployer.md`** — add Deployment-check artifact CLI
   block (mirror reviewer's review-artifact pattern using
   `write-deployment-check`), Shell pre-check (`pwd` /
   `Get-Location`, env-var shape), Context efficiency, Rollback
   discipline (what to do on mid-flight failure), Handoff before
   stop.
8. **`agents/validator.md`** — add Context efficiency, Shell
   pre-check, Validation depth control (smallest meaningful check
   first; when to expand; when to stop), gstack `/qa` integration
   note (per routing-table row "Web UI behavior changed"),
   Repo layout on start.
9. **`tests/validate-agents.test.mjs`** (new) — node-test cases:
   passes on a well-formed agent file, fails on missing frontmatter,
   fails on missing required section, fails on >300 lines.
10. **`CHANGELOG.md`** — v0.6.0 entry for FEAT-035.

## Out of scope

- Slimming `lead.md` to fit any cap. Acknowledged 222-line situation
  remains. Cap raise to 300 puts it under the new limit.
- Editing builder/reviewer prompts (they already have the rules
  being added to the lean agents).
- FEAT-031 (Sonnet-default model gate). Separate slice.
- FEAT-034 complexity refactor follow-ups.
- A v0.6.0 release tag. Bumped + tagged in a separate
  `chore(release)` commit after slice closes.

## Acceptance criteria

- [ ] AC-1: `scripts/validate-agents.mjs` exists and exits 0 on the
      current 6 agent files (after edits). Evidence: run command
      locally; exit code 0.
- [ ] AC-2: validator rejects synthetic agent files violating each
      check (missing frontmatter, missing section, >300 lines).
      Evidence: tests in `tests/validate-agents.test.mjs`.
- [ ] AC-3: `docs/governance.md` says `≤ 300 lines` in the Agent
      prompt size bar section.
- [ ] AC-4: `CLAUDE.md` `≤200` reference updated to `≤300`.
- [ ] AC-5: `docs/architecture/architecture.md` ≤200 references
      updated to ≤300.
- [ ] AC-6: `.github/workflows/test.yml` includes
      `node ./scripts/validate-agents.mjs` step. CLAUDE.md CI gate
      list reflects the 9 gates.
- [ ] AC-7: `agents/researcher.md` post-edit:
      - has `## Context efficiency` section
      - has `## Repo layout on start` section
      - has research-depth guidance in identity / rules
      - stays ≤300 lines
- [ ] AC-8: `agents/deployer.md` post-edit:
      - has `## Deployment check artifact` CLI block calling
        `write-deployment-check`
      - has `## Shell pre-check` section
      - has `## Context efficiency` section
      - has rollback discipline in rules or its own section
      - has `## Handoff before stop` section
      - stays ≤300 lines
- [ ] AC-9: `agents/validator.md` post-edit:
      - has `## Context efficiency` section
      - has `## Shell pre-check` section
      - has validation-depth guidance
      - mentions gstack `/qa` integration for UI scenarios
      - has `## Repo layout on start` section
      - stays ≤300 lines
- [ ] AC-10: All 9 CI gates green (8 existing + new validate-agents).
      `node --test` count grows by the new validate-agents tests.
- [ ] AC-11: User reviews 3 prompt diffs (researcher / deployer /
      validator) before commit per `autonomous_safe: false`.
- [ ] AC-12: CHANGELOG v0.6.0 FEAT-035 entry present.

## Done When

- all ACs PASS with evidence
- Self-Verify Gates section in handoff (FEAT-030 rule)
- Crew review-result written with `--validation-evidence` when
  conditions hold (FEAT-030 path; prompt edits are not code-only so
  the bundled-validation skip likely does NOT apply — validator
  dispatch may be required, defer to reviewer judgment)
- final-synthesis + ceremony artifacts written
- slice file moves pending → completed
- FEAT-035 moves in-progress → done

## Reviewer ladder

- Reviewer A: code/CI review — `scripts/validate-agents.mjs` shape,
  test coverage, CI workflow wiring, governance/CLAUDE.md/architecture
  doc consistency.
- Reviewer B: prompt review — three agent prompt diffs read for
  additive-only discipline (no existing rules rewritten), section
  ordering consistency with builder/reviewer pattern, cross-references
  to skills/routing-table accurate.

## Risks

- **Prompt drift between agents** — adding context-efficiency to
  three agents creates four copies (with builder). Future updates
  must touch all four. Mitigation: comment in each section "mirror
  of builder.md ## Context efficiency"; consider extracting to a
  skill in a future slice.
- **CI gate count drift** — CLAUDE.md says "8 CI gates"; this slice
  makes it 9. Update CLAUDE.md text to match exactly.
- **Lead.md still over old cap** — 222 lines still mattered when cap
  was 200; under new cap of 300, no violation. Acknowledged.
