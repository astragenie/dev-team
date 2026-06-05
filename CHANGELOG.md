# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

## v0.14.1 — 2026-06-05 — loop@0.8.3

### Marketplace

`loop` bumped to `v0.8.3` — ceremony cleanup, SLICE-46 artifacts committed, tag aligned.

Full test suite: 376/376 pass.

---

## v0.14.0 — 2026-06-05 — scope-estimate + model compliance + observability + complexity extraction + loop@0.8.2

### Features

**`scope-estimate` sub-command (FEAT-046 Tasks 1–2)**

`node crew.mjs scope-estimate [--size light|standard|heavy] [--repo <path>]` — new
CLI sub-command backed by `scripts/lib/scope-estimate.mjs`. The pure classifier maps
token-budget signals to a `light / standard / heavy` tier used by the builder dispatch
protocol to pre-calibrate context ceiling expectations before a slice starts.

**Model compliance field in `brief-me` (FEAT-046 Task 5)**

`buildBriefingReport` now returns a `modelCompliance` field: `{ sonnetPct, compliant,
sliceCount }`. `compliant` is `true` when Sonnet accounts for ≥ 60% of cost across
recent slices. Surfaces the Sonnet-default discipline rule at a glance without requiring
manual cost-report inspection.

**Hook health observability in `brief-me` (FEAT-045)**

All 4 hook scripts (`check-redundant-read`, `record-read-content`, `preflight-shell`,
`check-subagent-return`) now emit structured `{ type: "hook_error", hook, error, ts }`
events to `.claude/logs/events.jsonl` via `hooks/hook-error.mjs`. A new
`collectHookHealth` function in `scripts/lib/briefing/collect.mjs` reads the last 100
events and counts per-hook errors in a 24-hour window. `buildWakeUpBrief` includes a
`hookHealth` field; `buildBriefingReport` surfaces a `## Hook health` section (green
when clean, per-hook error counts when not). `formatHookHealthSection` is exported for
testing.

**`validate-syntheses.mjs` CI gate (FEAT-045)**

`scripts/validate-syntheses.mjs` scans `final-synthesis` artifacts for `Grade missing`
or `<timestamp>` placeholders and errors on any match. Added to CI as an advisory gate
(`continue-on-error: true`). 14 synthesis artifacts with stale placeholders were
fixed in the same release.

### Refactors

**Complexity debt extraction (FEAT-044)**

Removed all 3 `eslint-disable-next-line complexity` suppressions from `crew.mjs` and
`artifacts.mjs` by extracting into `scripts/lib/cost-hygiene/`:
- `emit-cost-report.mjs` — `maybeEmitCostReport` (formerly suppressed at crew.mjs:407)
- `cost-slice-handler.mjs` — cost-slice command handler (formerly suppressed at crew.mjs:804)
- `render-frontmatter.mjs` — `renderCostReportFrontmatter` (formerly suppressed at artifacts.mjs:294)

Four oversized modules split below AC-3 thresholds:
- `collect.mjs` 955 → 530 L (extracted to `collect-cost-parser.mjs`)
- `cost-advisor.mjs` 874 → 485 L (extracted to `cost-advisor-grades.mjs` + `cost-advisor-rules.mjs`)
- `session-cost.mjs` 844 → 461 L (extracted to `session-cost-scanner.mjs`)
- `workflow-state.mjs` 794 → 461 L (extracted to `workflow-state-gates.mjs`)

### Bug fix

**`brief-me` redundant `collectHookHealth` call eliminated**

`buildBriefingReport` was calling `collectHookHealth(repoPath)` in its own `Promise.all`
even though `buildWakeUpBrief` already collected it. Now reads `wakeUpBrief.hookHealth`
directly — one fewer `events.jsonl` read per `brief-me` invocation.

### Marketplace

`loop` bumped to `v0.8.2` — architect classification tags for slices and features
(FEAT-048); post-builder confidence update in `slice complete` (FEAT-046); module
splits for `loop-installer.mts` and `auto-walker.mts` (FEAT-044/045).

Full test suite: 376/376 pass.

---

## v0.13.2 — 2026-06-05 — classify-scenario safety fix + loop@0.7.7

### Bug fix

`classify-scenario.mjs` — word-boundary safety restored. The v0.12.0 stem-prefix
fix (`\bverb` without trailing `\b`) caused over-matching on compound words
("showcase", "clickable", "presses"). Fix: explicit inflected forms added to each
verb set (`navigates`, `clicks`, `fills`, etc.), trailing `\b` restored. 7 new
regression tests (4 inflected-form positives, 3 over-match negatives).

### Marketplace

`loop` bumped to `v0.7.7` — wires `/crew:orchestrate-slice` as default dispatch
instruction when installed `crew ≥ 0.11.0` (FEAT-047).

Full test suite: 318/318 pass.

---

## v0.13.1 — 2026-06-05 — architect-feature doc fixes

### Fixes

- `commands/architect-feature.md`: revision subsection now uses `## Feature Revision — <date>`
  prefix to avoid naming collision with orchestrate-slice's `## Revision — SLICE-NN` sections.
- `commands/architect-feature.md`: Step 3 tag write-back warning path clarified to `exit 0`
  after continuing to Step 4.
- `tests/architect-feature.test.mjs`: +2 tests — re-run idempotency (Feature Revision prefix)
  and `--auto-start` clean exit when no pending slice. 10/10 pass. Full suite: 316/316.

---

## v0.13.0 — 2026-06-05 — architect-feature pipeline command

### New command: /crew:architect-feature

`commands/architect-feature.md` — researcher+architect pipeline that runs once per FEAT
before slice 1. Produces a feature-level contracts artifact
(`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`) and infers `surface:*`,
`stack:*`, and `concern:*` tags written back to FEAT frontmatter additively.

**Steps:** locate FEAT → researcher context pass → architect contracts artifact → tag
inference → tag write-back → optional `--auto-start` transition to first pending slice.

Contracts artifact follows the schema defined in `agents/architect.md`: TypeScript
Interfaces, API Contracts, Event Schemas, Data Contracts. Immutable-first-write:
re-running appends under a new run header rather than overwriting.

### Tests

`tests/architect-feature.test.mjs` — 8 structural tests covering command existence,
frontmatter, agent references, tag write-back shape, `--auto-start` flag, and error
handling.

Full test suite: 314/314 pass.

---

## v0.12.0 — 2026-06-05 — journey-builder sub-skill for ux-validation end-to-end journeys

### New workflow sub-skill: journey-builder

`skills/workflow/journey-builder/SKILL.md` — invoked by `ux-validation` at Step 2.5.
Derives an ordered `scenario_chain` from a slice's `## User Journey` section (explicit
override) or auto-derives from the AC list ordered navigation → input → interaction →
visibility. Returns `[]` when fewer than 2 steps are derivable so downstream `/qa`
invocation is skipped safely.

### Pure helpers

- `scripts/lib/ux-validation/journey-builder.mjs` — exports `buildJourney(acs, sliceContent)`.
  Parses numbered `## User Journey` lists and classifies/sorts AC-derived steps.
- `scripts/lib/ux-validation/qa-adapter.mjs` — `buildQaInvocation` now accepts
  `scenario_chain`; backward compatible (param optional).

### ux-validation wiring

`skills/workflow/ux-validation/SKILL.md` gains Step 2.5 calling `journey-builder` before
dispatching `/qa`, feeding the derived chain to the invocation.

### Bug fix

`classify-scenario.mjs` — verb regex changed from exact word-boundary (`\bverb\b`) to
stem-prefix match (`\bverb`) so inflected forms ("navigates", "clicks", "types") classify
correctly alongside base forms.

### Tests

- `tests/journey-builder.test.mjs` — 8 tests covering explicit override parsing,
  auto-derive ordering, and the `< 2 steps → []` guard.

Full test suite: 306/306 pass.

### Closed backlog

- FEAT-041: journey-builder sub-skill for ux-validation ✓

## v0.11.0 — 2026-06-05 — /crew:orchestrate-slice command + architect contract schema

### New command: /crew:orchestrate-slice

`commands/orchestrate-slice.md` — tag-driven specialist dispatch ladder. Run after
`/loop:slice start --id SLICE-NN`. Classifies the slice at Step 0 using frontmatter
overrides (`needs_contract`, `needs_ux`, `skip:`) and tag heuristics, prints a one-line
classification summary, then conditionally dispatches:

- **Step 1** — `crew:architect` (contract artifact, immutable-first-write) — skip when `NEEDS_CONTRACT = false`
- **Step 2** — `crew:uxdesigner` (UX spec, reads contract) — skip when `NEEDS_UX = false`
- **Step 3** — `crew:builder` (implementation, reads contract + UX spec)
- **Step 4** — `crew:reviewer` (requires `Contract Conformance: PASS/FAIL` section when contract exists; halts on `needs_fix`)
- **Step 5** — `crew:validator` — skip when `BEHAVIOR_CHANGED = false`
- **Step 6** — `crew:copywriter` — skip when `RELEASE_CONTENT = false`
- **Step 7** — `loop:document-writer` (or copywriter fallback) — skip when `DOCS_NEEDED = false`
- **Step 8** — `write-final-synthesis`

Every dispatch is visible in the main thread. No hidden subagent lead.

### Architect contract schema

`agents/architect.md` gains `## Contract artifact schema` — defines the
immutable-first-write rule for per-FEAT contract artifacts written to
`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`. Four required sections:
TypeScript Interfaces / API Contracts / Event Schemas / Data Contracts. Downstream
agents (builder, reviewer) read this file before starting work; reviewer checks
conformance.

### Agent prompt improvements (FEAT-038 + FEAT-039)

All five specialist agents (`builder`, `deployer`, `researcher`, `reviewer`, `validator`)
gain a `## Workflow badges` section with `blocked`, `escalated_to_human`, and
`validation_skipped` badge emit patterns. `builder`, `reviewer`, and `validator` gain
a FEAT tag schema cross-check hint pointing to `docs/standards/feat-tag-schema.md`.

### Tests

7 new structural tests in `tests/orchestrate-slice.test.mjs` covering command file shape,
frontmatter, Steps 0–8 presence, required agent references, and architect schema section.

Full test suite: 294/294 pass.

### Closed backlog

- FEAT-038: Workflow badge awareness in specialist agents ✓
- FEAT-039: Tag-aware skill loading hints in builder/reviewer/validator ✓
- FEAT-040: /crew:orchestrate-slice command ✓

## v0.10.0 — 2026-06-04 — UX validation gate auto-triggered on UX/React tags + loop pin step 1

### New workflow skill: ux-validation

`skills/workflow/ux-validation/SKILL.md` — auto-triggered by `crew:validator` when a slice's FEAT frontmatter `tags:` array intersects with `{surface:ui, concern:ux, concern:accessibility}`. The skill orchestrates a single gstack `/qa` Playwright run with four checks (acceptance-criteria pass/fail + axe-core accessibility scan + console+404 scrape + visual regression vs consumer-repo `tests/playwright/baselines/`) and returns raw evidence. Validator stays read-only — `/qa` writes the evidence JSON to `.claude/artifacts/crew/validations/<stamp>-ux-evidence.json`. The lead reads the validation result and pivots per the existing routing-table; the skill never recommends a pivot target.

Triggered states per the Skip + error cases table: tag intersection empty → silent exit; missing acceptance criteria → `validation_skipped`; no Playwright config → soft `validation_skipped`; `/qa` not available or non-zero exit → documented failure modes.

### Pure helpers (TDD-tested)

- `scripts/lib/ux-validation/extract-acs.mjs` — parse slice `## Acceptance criteria` block → `[{id, text}]`.
- `scripts/lib/ux-validation/classify-scenario.mjs` — verb-keyword classification → `interaction | visibility | navigation | input | non_ui_ac`.
- `scripts/lib/ux-validation/verdict.mjs` — apply pass/fail thresholds to evidence payload (failed > passed_with_notes > passed precedence).
- `scripts/lib/ux-validation/discover-playwright.mjs` — locate consumer-repo Playwright config + base URL (config file → `package.json` script port heuristic).
- `scripts/lib/ux-validation/qa-adapter.mjs` — assemble `/qa` CLI invocation with all four check flags.
- `scripts/lib/ux-validation/index.mjs` — public re-export surface.

### Validator agent wiring

`agents/validator.md` — one new auto-load row in `### Skills you consult`:

```
- UX/React behavior (slice tags include `surface:ui`, `concern:ux`, or `concern:accessibility`) → `skills/workflow/ux-validation/`
```

Validator stays read-only (`disallowedTools: Write, Edit` unchanged); turn budget unchanged.

### Tests + CI

- `tests/ux-validation.test.mjs` — 28 unit tests across the 5 pure helpers (TDD-driven).
- `tests/ux-validation-integration.test.mjs` — 3 integration tests asserting evidence parsing, verdict computation, and `/qa` invocation flag completeness against mocked evidence.
- `scripts/e2e-smoke-ux.mjs` — end-to-end smoke against a fixture HTML page served via `python -m http.server`. Asserts verdict computation returns `failed` with all four evidence categories populated when the fixture is intentionally broken (404 on logo, missing alt, console.warn).
- `tests/fixtures/ux-gate-smoke/` — fixture page, FEAT-SMOKE slice, baselines placeholder.
- `package.json` — new `e2e:smoke:ux` npm script.
- `.github/workflows/test.yml` — new CI step running `npm run e2e:smoke:ux`.

Full test suite: 285/285 pass (+31 new).

### Consumer-repo conventions

The skill assumes the consumer repo has Playwright installed and either a `playwright.config.{ts,js,mts}` file with `baseURL` set, or a `playwright` script in `package.json` plus a `dev`/`start` script whose port is discoverable via `-p <port>` or `--port <port>`. When absent, the skill soft-skips with note `playwright_not_configured` rather than failing the validation gate.

Visual regression baselines live in the **consumer repo** at `tests/playwright/baselines/` and use Playwright's native `toHaveScreenshot()` mechanism. Baselines are reviewed in PR like any code change; updates flow through `npx playwright test --update-snapshots`. Crew owns no baseline storage.

### Marketplace pin step 1: loop 0.5.6 → 0.7.1

`.claude-plugin/marketplace.json` — `plugins[name=loop].version` bumped from `0.5.6` to `0.7.1` as the first step of a stepwise bump to `0.7.2` (loop v0.7.2 released today; pin to 0.7.2 deferred pending validation per the user's stepwise preference). Loop v0.7.2 lands Option A from the dispatch-gap analysis: autonomous slice dispatch now routes through `crew:lead` instead of collapsing the lead workflow onto `crew:builder`.

### Open follow-ups

- Real `/qa` invocation (currently simulated in integration test and e2e smoke) — requires confirming gstack `/qa`'s actual CLI flag surface against the gstack plugin. Defer to a follow-up FEAT.
- Marketplace pin step 2: bump loop pin to `0.7.2` after Option A grade-trend validation lands.

## v0.9.0 — 2026-06-04 — turn-reduction workflow, FEAT tag-schema, 3 new orchestrator skills, Pass-2 routing validator

### Dispatch + decomposition rules

- **Pre-dispatch decomposition rule** added to `agents/lead.md`. Mandates per-file role-concern audit before any single-agent dispatch; ≥2 substantive groups → parallel role-bundled dispatch via `superpowers:dispatching-parallel-agents`. Closes the builder cap-hit pattern (5 of 14 dispatches paused near 48–55 tool uses in v0.8.0 work).
- **Inline-handle rule** added to `agents/lead.md`. Single-line policy edits (routing-table additions, CHANGELOG entries, manifest version bumps, skills-you-consult bullets, frontmatter field bumps, README pinned-release callouts) are lead-inline scope — no builder dispatch.
- **Architect-mandatory routing** in lead's tag-mapping: `surface:schema`, `surface:docs` (policy/governance), `concern:governance` MUST route to architect, never builder. Shifts authoring load off builder's turn budget.
- **`agents/architect.md` model upgraded** sonnet → opus to match ADR / system-design quality bar.

### FEAT tag-schema interface contract

- `docs/standards/feat-tag-schema.md` — new spec defining `tags: []` array on FEAT frontmatter. Three namespaces: `stack:*` (12 values), `surface:*` (7), `concern:*` (9). Namespace-prefixed flat array form. Producer (loop) + consumer (crew) contracts documented.
- `agents/lead.md` gains `### Tag-to-agent mapping` table — 12-row pattern matching tags → primary crew agent → skills to auto-load.
- Decoupling rationale: loop emits abstract tags; crew owns mapping. Swap orchestrator → re-author crew's mapping only.

### Three new orchestrator-flavor skills

- `skills/workflow/context-curation/` (86 lines) — per-agent context briefings, Quick/Full/Archived size budgets, pre-compaction snapshot methodology. Sourced from `aitmpl/development-tools/context-manager`.
- `skills/workflow/spec-decomposition/` (126 lines) — 6-step WBS framework (Goal → WBS → Dependencies → Parallelism → Effort/Complexity → Risk Register), 8/80-hour rule, Required Initial Inputs. Sourced from `aitmpl/ai-specialists/task-decomposition-expert`.
- `skills/workflow/slice-sizing/` (72 lines) — 8/80-hour atomic action rule + builder turn-budget evidence + decomposition triggers (>40 turns, ≥2 concerns, >5 files, multi-stack).

### Pass-2 routing-table validator

- `scripts/validate-routing-table.mjs` extended with second pass that cross-checks routing-table rows against agent `### Skills you consult` blocks. Catches drift between routing-table additions and stale agent prompts.
- 5 new edge-case fixtures + tests under `tests/fixtures/validate-routing-table/` (empty-block, refs-collapse, multi-role, missing-agent, malformed-row).
- 12 drift patches applied during validator rollout — builder/deployer/architect/uxdesigner/copywriter blocks gained the co-cite citations that routing-table already specified.

### Other polish

- 29 advisory warnings on FEAT-A distributed skills (missing `triggers:` frontmatter + section headings) closed. `validate-skills.mjs` now reports zero warnings.
- `agents/3rdparty/code-reviewer.md` per-language checklists harvested into `skills/workflow/reviewing-code/references/{typescript,python,rust,go,sql}-checklist.md`.
- Removed terraform external-plugin row references (`terraform-code-generation:*`, `terraform-module-generation:*`) from routing-table — those plugins are not crew marketplace dependencies and were failing the new Pass-1 ID resolution.
- `tests/agent-topology.test.mjs` pins exactly 9 expected agents at top-level `agents/`.

### Skill / agent counts

- Skills: 34 → 37 (added context-curation, spec-decomposition, slice-sizing).
- Agents: 9 (unchanged) — lead, builder, reviewer, validator, deployer, researcher, architect, uxdesigner, copywriter.

### Fixes

- `agents/researcher.md` model frontmatter typo corrected (`opud` → `opus`). Would have prevented researcher dispatch at runtime.

## v0.8.0 — 2026-06-04 — 9-agent topology, 34 skills, routing-table H3 grouping, release polish

### New agents + skill taxonomy (FEAT-A, FEAT-B, FEAT-C, FEAT-D)

- **FEAT-A:** Distributed 11 third-party skills into the four-tier taxonomy (`universal/`, `workflow/`, `domain/`, `meta/`). All 11 skills carry `triggers:`, `When to use`, and `Done/Acceptance` sections — closes 29 advisory warnings.
- **FEAT-B:** Routing-table wiring — new rows added for architect, uxdesigner, copywriter, plus backend/frontend/fullstack advisory, Python, TypeScript, React, AI engineering, CI/CD, IaC, database architecture, cloud architecture, UX methodology, API documentation, diagram methodology, multi-source research, and systematic debugging. Pass-2 cross-check validator added (`validate-routing-table.mjs`) with 5 edge-case fixtures; terraform external-plugin rows removed.
- **FEAT-C:** Three new first-party role stubs (`agents/architect.md`, `agents/uxdesigner.md`, `agents/copywriter.md`). Each stub delegates to vendored 3rdparty specialists via the Agent tool.
- **FEAT-D:** `### Skills you consult` blocks wired onto all 9 first-party agents so the routing-table Pass-2 cross-check validates end-to-end.

### 3rdparty agent vendor + Slices 1–5

- Vendored 21 third-party agents under `agents/3rdparty/` for delegation by architect, uxdesigner, and copywriter stubs.
- Slices 1–5: extracted 11 additional skills from 3rdparty agent bodies into proper `skills/domain/` and `skills/workflow/` directories (`language-pro`, `devops-engineering`, `database-architecture`, `cloud-architecture`, `ux-methodology`, `react-engineering`, `api-documentation`, `diagram-methodology`, `research-coordination`, `systematic-debugging`, `reviewing-code` per-language tiers).

### Release polish (v0.8.0 bundle)

- README updated: 9 agents, 34 skills, tier structure, new specialist role descriptions, project structure block, pinned release bumped to v0.8.0.
- `docs/governance.md`: `autonomous_safe: false` policy declared for architect/uxdesigner/copywriter prompts (same bar as lead).
- `.claude/crew/workflow.md`: architect, uxdesigner, copywriter phases added to Preferred Sequence (conditional phases 5, 6, 10); non-code deliverable review gate added to Default Gate Policy.
- `docs/routing-table.md`: H3 category headers added (9 groups) for scanability across 62+ rows; row content unchanged; Pass-1 + Pass-2 validators both pass.
- `agents/lead.md`: 5-line dispatch decision rule — ADR/diagram/schema → architect; UI flow/component → uxdesigner; docs/release notes → copywriter; impl → builder; investigation → researcher.
- Agent topology test added (`tests/agent-topology.test.mjs`) — pins exactly 9 first-party agents; fails on unexpected additions or removals.
- Version bump: `package.json` + `marketplace.json` → `0.8.0`.

## v0.7.1 — 2026-06-03 — Dedupe overlapping cost reports in brief-me rollup (FEAT-036)

### Cost rollup deduplication

`/crew:brief-me` was triple-counting the same fleet window when the recency list contained multiple aggregate snapshots of the same `(windowStart, windowEnd)` plus per-project slice subsets of those windows. The `sumUsdRecent` figure for a $3,995 run was showing $13,774 — arithmetically correct but semantically wrong.

- **fix(collect):** `scripts/lib/briefing/collect.mjs` — `collectRecentCosts` now calls `dedupeForRollup()` before computing `sumUsdRecent`, `avgUsdRecent`, and `modelBurn`. Within each `(windowStart, windowEnd)` bucket the latest aggregate snapshot is preferred; if no aggregate exists the latest slice/legacy report is used; older readings of the same scope+window are discarded from the sum. Slice rows whose window is fully contained inside a surviving aggregate row's window are omitted from the rollup (their cost is already counted inside the aggregate). Raw `recent[]` array is unchanged — all reports remain for per-row table rendering.
- **feat(collect):** new `costs.dedupedCount` field exposes how many of the `totalReports` rows actually contributed to the sum, enabling the brief to render "$X across N distinct windows (Y reports filtered as overlapping)".
- **fix(briefing):** `scripts/lib/briefing.mjs` — `summary.costReports` now uses `costs.dedupedCount` (was `costs.totalReports`) so the brief summary reflects deduplicated count.
- **tests:** `tests/briefing-cost-rollup-dedupe.test.mjs` — 8 new TDD scenarios covering all 5 AC cases: all-aggregate same window, aggregate + nested slice, disjoint historical (no false dedupe), mixed overlapping + disjoint, and `modelBurn` dedupe.

## v0.7.0 — 2026-06-02 — Sonnet-default model-selection gate (FEAT-031)

### Cost-discipline rule #1 codified into lead prompt

Last P0 of the perf-stabilization arc. Recent cost reports across 8 slices: `claude-opus-4-7` $1,821 / 3 slices vs `claude-sonnet-4-6` $277 / 5 slices — Opus paying ~6.6× sonnet per slice for work that, by post-hoc inspection, was mechanical. This release codifies the existing `feedback_cost_discipline.md` rule #1 into the lead agent prompt and a new standards doc.

- **feat(lead):** `agents/lead.md` — new `### Model-selection gate at slice start (FEAT-031)` subsection inside `## Delegation thresholds (cost discipline)`. At slice start, recommend **Sonnet** by default; recommend **Opus** only when ONE of three conditions holds: ambiguous architecture, hard refactor (≥3 files cross-cutting), or design choice required. Surface recommendation in the run-brief so the user can override. Measurement signal: `cost-report.modelMix` slice-over-slice.
- **docs(standards):** new `docs/standards/model-selection.md` — full rule rationale, 5-dimension slice-shape scoring (files / test signatures / ACs / architecture / scope), how to surface the recommendation, how to override, measurement targets (Opus message share ≤30% across trailing-5 mechanical slices).
- **docs(routing-table):** new row `Slice opens (subagent dispatch ahead)` → lead applies model-selection gate per the standards doc.
- **Note:** the rule governs SUBAGENT model choice, not the lead's own model. Lead frontmatter stays on Opus for framing, synthesis, user communication, and judgment calls.

## v0.6.0 — 2026-06-02 — Agent prompt quality bar + cap raise (FEAT-035)

### Agent prompt size bar raised from ≤200 to ≤300, now CI-enforced

- **feat(validator):** new `scripts/validate-agents.mjs` enforces a ≤300-line cap per agent file plus required frontmatter (`name`, `description`, `model`), required body sections (identity intro + `## Report contract` for teammate roles; lead is exempt from Report contract), filename↔frontmatter-name match, and no-duplicate-names. Wired into `.github/workflows/test.yml` between `validate-skills` and `validate-slices`. CI gate count grows from 8 to 9.
- **docs(governance):** `docs/governance.md` Agent prompt size bar raised from ≤200 to ≤300 with rationale + cap-history block. `CLAUDE.md` + `docs/architecture/architecture.md` ≤200 references updated to ≤300 (skill cap stays ≤200 per `validate-skills.mjs`).

### Lean-agent enrichments

Three agent prompts were sitting at 74–100 lines, missing context-efficiency / shell-pre-check / depth-control guidance that builder + reviewer already had. All additive — no existing rules rewritten.

- **feat(researcher):** `agents/researcher.md` 74 → 116 lines. New `## Research depth threshold` (when good-enough beats exhaustive). New `## Context efficiency` (Grep-before-Read, scoped reads, batch grep/read, front-load reads, no-re-Read-of-unchanged).
- **feat(deployer):** `agents/deployer.md` 82 → 152 lines. New `## Deployment check artifact` CLI block calling `write-deployment-check`. New `## Handoff before stop`. New `## Shell pre-check` (heaviest shell user of any role). New `## CI gate verification before push`. New `## Rollback discipline` (capture evidence, decide roll-back vs escalate, confirm environment, write failed deployment-check). New `## Context efficiency` block.
- **feat(validator):** `agents/validator.md` 100 → 153 lines. New `## Validation depth control` (smallest-meaningful-check first, when to stop). New `## Web UI scenarios — use gstack /qa` note per routing-table row. New `## Shell pre-check`. New `## Repo layout on start`. Expanded `## Context efficiency` block.

### Test suite

- `tests/validate-agents.test.mjs`: 10 tests covering the validator (well-formed pass, missing frontmatter field, missing-frontmatter-block, filename mismatch, missing `## Report contract` section, lead exemption, missing identity intro, 300-line cap, duplicate names, missing agents dir).

## v0.5.0 — 2026-06-02 — Builder self-verify + reviewer-bundled validation (FEAT-030)

### Review semantics change (backwards compatible default)

- **feat(builder):** `agents/builder.md` — new `## Self-verify gate` section requires builders to run lint + format:check + typecheck + full test suite + repo-defined validators before writing the handoff. Handoff body must include a `## Self-Verify Gates` section with one line per gate (command + exit code + summary). Self-verify complements but does not replace the reviewer's independent gate. For loop-using repos, `.claude/loop.json` `stack.build` + `stack.test` arrays are the canonical gate source.
- **feat(builder):** `agents/builder.md` — `## Review and validation dispatch` updated: dispatches `crew:validator` only when behavior is user-visible OR reviewer's review-result lacks a `Validation Evidence` section. Tests-already-green + code-only diffs with reviewer-bundled note do not require a separate validator dispatch.
- **feat(reviewer):** `agents/reviewer.md` — new `### Validation-evidence bundling (FEAT-030)` subsection in `## Review artifact`. When tests-already-green AND code-only diff AND no runtime/UI/CLI surface affected, reviewer populates `--validation-evidence` with test totals + gate commands + one-sentence verdict. When any condition fails, the note is NOT emitted. Cross-reference: lead reads the note and skips `crew:validator`; lead never skips validator when note is absent.
- **feat(reviewer):** `agents/reviewer.md` — `write-review-result` CLI block updated with new `--validation-evidence` flag (between `--test-summary` and `--risks`).
- **feat(lead):** `agents/lead.md` — new `### Validator dispatch decision (FEAT-030)` subsection in `## Review, validation, deployment`. Lists dispatch triggers and skip conditions (ALL three required: tests-already-green + code-only + reviewer note present). Skip recorded via `mark-badge validation_skipped --note "reviewer emitted validation-evidence note"`.
- **feat(cli):** `scripts/crew.mjs` — `write-review-result` subcommand accepts optional `--validation-evidence <text>` flag (default null). Pass-through to artifact writer.
- **feat(artifacts):** `scripts/lib/artifacts.mjs` — review-result renderer: when `validationEvidence` is non-null and non-empty, emits `validation_evidence: <text>` in YAML frontmatter AND a `## Validation Evidence` body section between `Test Adequacy` and `Risks`. When null or empty: omit both (backwards compatible with v0.4.0 baseline).
- **docs:** `docs/routing-table.md` — new row: reviewer-emitted validation-evidence note → lead skips `crew:validator` + records `validation_skipped` badge.

### Test suite

- `tests/cli.test.mjs`: +3 tests for `--validation-evidence` round-trip
  1. flag with text → frontmatter has `validation_evidence:` AND body has `## Validation Evidence`
  2. flag omitted → no frontmatter field, no body section (backwards compat)
  3. flag passed as empty string `""` → treated as omitted

### Subagent-return cost-discipline enforcement (FEAT-032)

- **feat(subagent-return):** new PostToolUse matcher on the `Agent` tool wires `hooks/check-subagent-return.mjs`. When a subagent's return body exceeds the byte threshold (default 512) AND contains no `.claude/artifacts/crew/*/...md` artifact path, emits a soft-warn `systemMessage` citing cost-discipline rule #2. Never blocks. Opt-out: `CREW_SUBAGENT_INLINE_THRESHOLD=0`. Tune: `CREW_SUBAGENT_INLINE_THRESHOLD=<bytes>`.
- **feat(subagent-return):** `scripts/lib/subagent-return/check.mjs` — pure check library (`parseThreshold`, `hasArtifactPath`, `checkSubagentReturn`). Path regex matches POSIX + Windows separators and all `.claude/artifacts/crew/*/` subdirs (handoffs, reviews, validations, deployments, runs, cost, cost-insights, agents).
- tests/subagent-return.test.mjs: comprehensive coverage of threshold edges, path detection, opt-out, exception safety, and cross-platform separators.

### Cost-report disambiguation (FEAT-034)

- **feat(cost-report):** cost-report emission splits into two labelled variants. `cost-report-slice-<title>.md` carries per-session data (`aggregate_all: false`, `source_count: 1`). `cost-report-aggregate-<title>.md` carries the multi-source rollup (`aggregate_all: true`, `source_count: N`). Single-source sessions emit only the slice variant; multi-source detections also emit the aggregate variant. Legacy `cost-report-<title>.md` artifacts on disk continue to parse via the unchanged read path.
- **feat(briefing):** `scripts/lib/briefing/collect.mjs` — `collectCostHealth` prefers the `cost-report-slice-` variant via a new `nameFilter` parameter on `buildCostAdvisor`; falls back to any cost report when no slice variant exists (backward compat). New exported `collectCostAggregate` returns the latest `cost-report-aggregate-` grade or null when no aggregate variant exists.
- **feat(briefing):** `scripts/lib/briefing.mjs` — brief-me JSON output exposes a new top-level `costAggregate` field next to `costHealth`. Removes the false-positive "F" grade caused by aggregating reread counts across sibling worktrees + sessions; the per-slice signal is now the honest baseline.
- tests/briefing-cost-health.test.mjs: 6 new tests (per-slice-only world, both-variants world, legacy-only fallback, costAggregate population, grade-not-F-with-clean-slice, costAggregate null in legacy-only).
- tests/cost-report-emission.test.mjs: 8 new tests covering single-source emission writes only slice, multi-source emission writes both variants, filename pattern matches, frontmatter `aggregate_all` per variant, legacy `cost-report` kind still works.

## v0.4.0 — 2026-06-02 — Tool-failure preflight hook (FEAT-033)

### Preflight checks for Bash + PowerShell (default-ON)

- **feat(preflight):** new `PreToolUse` matchers for `Bash` and `PowerShell` in `hooks/hooks.json` wire a default-ON preflight hook. Opt-out via `CREW_TOOL_PREFLIGHT=0`.
- **feat(preflight):** `hooks/preflight-shell.mjs` — PreToolUse. Reads command string from stdin, delegates to pure check library, emits `{ decision: "approve", systemMessage: "<warnings>" }` on detected failure mode. Never blocks (`decision: "block"` is never used). Always exits 0.
- **feat(preflight):** `scripts/lib/preflight/checks.mjs` — four v1 checks:
  1. **env-var shape mismatch**: warns when Bash command uses `$env:NAME` or PowerShell uses bare `$NAME` instead of `$env:NAME`.
  2. **chained-cd missing path**: scans for `cd <path> &&`, `cd <path>;`, and `Set-Location <path>` patterns, resolves against `cwd`, warns on ENOENT.
  3. **unquoted Windows path with space**: detects `[A-Za-z]:\\` paths with an embedded space not wrapped in quotes.
  4. **unterminated here-doc**: detects `<<EOF` / `<<'EOF'` without a closing `EOF` on its own line.
- Opt-out: `CREW_TOOL_PREFLIGHT=0` disables the hook (mirrors `CREW_COST_HYGIENE` convention). Default is ON — no env var required.

### Test suite

- New `tests/preflight-shell.test.mjs`: 28 tests covering all 14 ACs — env-var false-positive guards (`${HOME}`, `$()`, `$1`, `$env:NAME`), PowerShell automatic-variable deny-list (`$_`, `$HOME`, `$LASTEXITCODE`, `$NULL`, `$TRUE`, `$FALSE`, mixed-case `$PSVersionTable`, `$MyInvocation`, `$PSScriptRoot`), silence on clean commands, opt-out gate, exception resilience, and `decision: "approve"` shape guarantee.

## v0.3.11 — 2026-05-28 — Cost-hygiene reread hook

### Cost prevention (default-off, env-var-gated)

- **feat(cost-hygiene):** new `PreToolUse` + `PostToolUse` Read matchers in `hooks/hooks.json` wire a pair of env-var-gated hooks (`CREW_COST_HYGIENE=1`).
- **feat(cost-hygiene):** `hooks/check-redundant-read.mjs` — PreToolUse. On reread of a path with unchanged mtime, injects a `<system-reminder>` block quoting the prior file content into the assistant's context so the model uses it instead of issuing a redundant Read. Never blocks; always exits 0.
- **feat(cost-hygiene):** `hooks/record-read-content.mjs` — PostToolUse. Captures the Read tool result content into session state for the next reread to quote.
- **feat(cost-hygiene):** `scripts/lib/cost-hygiene/decide.mjs` — pure decision module. Q7 mtime-edit exception: warns only when file unchanged since last Read.
- **feat(cost-hygiene):** `scripts/lib/cost-hygiene/state.mjs` — per-session JSON at `.claude/state/cost-hygiene/<session_id>.json`. Per-file 50KB cap, per-session 2MB cap with LRU eviction. Atomic write via `.tmp.<pid>` + rename. Stale temp cleanup on load. Corrupt-JSON tolerance.

### Test suite

- 133 total tests (+21 from baseline 112): 6 `cost-hygiene-decide`, 10 `cost-hygiene-state`, 5 `cost-hygiene-hook` (integration via subprocess spawn).

### Quality gates

- **chore(format):** apply prettier to 9 drift-accumulated files. `npm run format:check` is now clean.
- **fix(types):** SLICE-08 AC5 zero-tolerance — last 2 residual `{any}` occurrences in `scripts/` replaced with typed alternatives (`@type {{ name?: string; version?: string }}` + `FleetItem` typedef).

### Known limitations

- Plugin ships **default-off**. Set `CREW_COST_HYGIENE=1` to enable. Promotion to default-on follows dogfood measurement.
- `evictLRU` may leave `total_bytes > 2MB` when a single protected entry alone exceeds the cap (cosmetic accounting only; cannot affect decisions or persist incorrect data).

## v0.3.10 — 2026-05-28 — Type safety (noImplicitAny)

### Quality Gates

- **feat(typecheck):** enable `noImplicitAny: true` in `tsconfig.json` — 654 → 0 TypeScript errors (SLICE-08 / FEAT-004).
- **feat(typecheck):** JSDoc `@param`/`@returns` annotations added to all 22 `scripts/**/*.mjs` files — `ArtifactFields`, `CostBreakdown`, `ScanCtx`, `Flags` typedefs; boundary guards use `{unknown}` not `{any}`.
- **ci:** `npm run typecheck` is now a meaningful gate — implicit-any regressions caught at commit time.

## v0.3.9 — 2026-05-28 — Agent color badges

### UI

- **feat(agents):** add `color` field to all 6 crew agent frontmatter files — `lead=blue`, `builder=green`, `reviewer=orange`, `validator=yellow`, `deployer=red`, `researcher=cyan`. Agents now display distinct colored badges in Claude Code UI.

## v0.3.8 — 2026-05-27 — Performance + observability + quality gates

### Bugfixes

- **fix(artifacts):** remove double-cost filename prefix — `cost-report-cost-...` → `cost-report-...` (FEAT-002).
- **fix(artifacts):** reorder frontmatter to phase → feature → slice across all render functions (FEAT-003).
- **fix(agent-report):** add phase/feature/slice identification to body, diagnostic note for missing events (loop repo).

### Performance

- **perf(cli):** convert 14 static imports to per-command lazy `import()` — ~100-200ms faster startup.
- **perf(agents):** context efficiency rules in lead (dispatch budget ≤3, compaction awareness, read discipline, model routing), builder (scoped reads, Edit preference, batch edits), reviewer (git-diff-primary, no-re-Read).

### Observability (Phase 4)

- **feat(cost-advisor):** `computeGrade(target)` — composite A-F letter grade from compaction count, subagent dispatches, re-reads, tool failure rate, cache hit %. 15 TDD tests.
- **feat(cost-advisor):** `detectTrends(reports)` — regression detectors for compaction-drift, subagent-creep, cost-regression across last 3 reports. 14 TDD tests.
- **feat(cost-advisor):** compaction-cascade rule — HIGH severity when compactions >10 AND dispatches >5.
- **feat(briefing):** `costHealth` field in brief-me output — grade + top concern from latest cost report. 10 TDD tests.

### Quality Gates

- **feat(agents):** deployer pre-push `plugin-dev:plugin-validator` gate for plugin repos.
- **feat(agents):** reviewer `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` upgraded from optional to required dispatch.

### Test suite

- 112 total tests (39 new across `cost-advisor-grade`, `cost-advisor-trends`, `briefing-cost-health`).

## v0.3.7 — 2026-05-26 — Global namespace rename: engineering-os → crew

### Installer

- Global memory path renamed from `~/.claude/engineering-os/` to `~/.claude/crew/`, matching the plugin brand and repo-local convention.
- `installGlobal()` auto-migrates existing `~/.claude/engineering-os/` files and rewrites `CLAUDE.md` `@`-imports on next run.
- `.claude/engineering-os/lead.md` moved to `.claude/crew/lead.md`.

### Agent prompts

- All 6 agent prompts (`lead`, `builder`, `reviewer`, `validator`, `researcher`, `deployer`) updated: custom instruction paths now reference `~/.claude/crew/<role>.md` and `.claude/crew/<role>.md`.
- `deployer.md` deployment guidance path corrected to `.claude/crew/deployment.md`.

### Commands

- `install.md`, `audit-repo.md` updated to reference `~/.claude/crew/`.
- `adopt.md` expanded legacy-path context to include `~/.claude/engineering-os/` globals.

### Docs

- `README.md` — all user-facing path references updated.
- `docs/architecture/system-design.md` — updated to reflect completed rename.

### Tests

- New test: `installGlobal migrates legacy ~/.claude/engineering-os/ to ~/.claude/crew/`.
- Existing global-install assertions updated. 73/73 tests pass.

## v0.3.6 — 2026-05-24 — Rich artifact flags for all agents

_(No changelog entry was written for v0.3.6. See commit `00f5f7a` for details.)_

## v0.3.5 — 2026-05-24 — Agent codification + CI hardening + cost discipline

### Agent prompts

- `write-handoff --repo-context` injects pre-discovered repo layout (scripts/, agents/, skills/, tests/, npm scripts) into handoff artifacts so subagents skip 3-5 layout-discovery turns (FEAT-022 D4).
- `agents/reviewer.md` gains "Efficiency rules" section: grep-before-Read (D2, target Read:Grep ≤ 1:1) and batch-AC-verification (D3, single Bash call per AC set) (FEAT-022 D2+D3).
- `agents/builder.md` TDD policy strengthened: forward-references FEAT-023 `--test-summary` gate so builder knows reviewer will require test coverage evidence.
- `agents/builder.md` + `agents/researcher.md` gain "Handoff before stop" section: completion, pause, blocker, context-end all require `write-handoff` before returning. Addresses two observed subagent mid-task pauses this session.
- `agents/lead.md` gains "Delegation thresholds" section: 3+ unfamiliar-file reads → dispatch researcher; 5+ sequential Bash gates → bundle into builder; mechanical edits across >2 files → builder. Addresses opus overuse (97% of $ in recent slices).

### CI gates

- New `scripts/validate-slices.mjs` hard gate scans `docs/ai-loop/slices/pending/**/*.md` for AC-placeholder bullets (literal dots, angle-bracket template, empty post-colon). Exit 1 with file:line diagnostics. Companion to FEAT-024 (loop-side enforcement).
- `write-review-result --decision` now validates against allow-list (`approved | approved_with_notes | rejected`). Unknown values exit 2 with stderr listing valid options.

### Skills

- 4 skills (writing-claude-md, writing-task-handoffs, review-gates, using-crew) gain Trigger + Done headings. `validate-skills.mjs` warnings 8 → 0.

### Types

- JSDoc `@type {Dirent[]}` cast on `buildRepoLayoutBlock` skills/ branch clears recurring LSP red diagnostics on `.isDirectory()` / `.name` access.

### Docs + backlog

- `.claude/crew/deployment.md` created — durable deployment guidance extracted from CLAUDE.md release workflow.
- FEAT-022 closed (D2+D3+D4 shipped, D1 dropped per operator decision: prompt-only, no PreToolUse hook).
- FEAT-023 closed (shipped in v0.3.4).
- CLAUDE.md CI gates list updated from 8 → 9 entries (includes `validate-slices.mjs`).

### Tests

- 8 new test scenarios: 7 for `validate-slices.mjs` (3 placeholder shapes + concrete-AC pass + completed-skip + empty-pending + missing-dir) + 1 for unknown `--decision` (allow-list gate).

## v0.3.4 — 2026-05-24 — Hard-gate `test_adequacy` in `write-review-result` (FEAT-023)

### Why

A downstream `loop` customer reported four compounding quality failures: TDD prose-only enforcement, slice files shipping with literal `AC-N: ...` placeholders, review artifacts rendering `Test Adequacy: -` on every run (the field was in the renderer but no CLI flag set it), and marathon-mode auto-closing on "build + review passed" without inspecting test-adequacy signal. This release closes the hero-crew half of that report. The loop half is tracked under FEAT-024.

### CLI gate

- `write-review-result` gains `--test-summary`, `--test-summary-skip-reason`, and `--non-code` flags. When `--decision=approved` or `--decision=approved_with_notes`, the CLI exits 2 with a clear stderr message if none of the three flags are set. `--decision=rejected` bypasses the gate (rejection itself is the signal).
- Renderer adds `Test Adequacy Skip Reason` and `Non-Code Review: yes` lines when the matching flag is set. The pre-existing `Test Adequacy: -` rendering for absent `--test-summary` is preserved for backward compatibility, but the gate makes it impossible on approved code-bearing reviews.

### Agent + template

- `agents/reviewer.md` FEAT-011 TDD gate gains a "Test Adequacy field — populate or refuse" section documenting the new CLI contract.
- `docs/ai-loop/00-entry/SLICE_TEMPLATE.md` Acceptance Criteria + Done When rewritten: placeholders now state "Replace every `...` with concrete, verifiable language before the slice opens — placeholder bullets fail the slice-start linter." New default test-coverage AC bullet. Done When requires populated `Test Adequacy` (or explicit skip / non-code) in the review artifact.
- `docs/routing-table.md` gains a "TDD / test-adequacy enforcement on review" row pointing at the reviewer agent + CLI gate.

### Tests

- 6 new scenarios in `tests/crew-write-review-result.test.mjs` cover: refuse on `approved`, refuse on `approved_with_notes`, `--non-code` exit 0 + `Non-Code Review: yes` rendered, `--test-summary` exit 0 + field rendered, `--test-summary-skip-reason` exit 0 + reason rendered, `rejected` bypass.
- Pre-existing `tests/cli.test.mjs` updated to pass `--non-code` where it previously wrote an approved code-bearing artifact without test flags. Assertions were not weakened.

### Backlog

- `docs/backlog/pending/FEAT-023.md` (this release) and `FEAT-024.md` (cross-repo loop coordination ticket for AC placeholder linter, slice template test AC, ladder + marathon test-adequacy gates) added.
- FEAT-024 introduces a new `cross_repo` frontmatter key. Schema documentation for that key is deferred.

## v0.3.3 — 2026-05-24 — `--feature` / `--phase` + cost-advise `--title`

### CLI flags

- New `--feature` and `--phase` flags on every artifact-writer command
  (`write-run-brief`, `write-handoff`, `write-review-result`,
  `write-validation-plan`, `write-validation-result`,
  `write-deployment-check`, `write-final-synthesis`, `cost-slice`,
  `cost-advise`). When set, both values are embedded in the YAML
  frontmatter of the resulting artifact, so downstream tools
  (LoopObserver, dashboards) can filter / group without parsing the
  body.
- New `--title` flag on `cost-advise`. Overrides the slug source for
  the cost-advise filename. Lets callers pass `PHASE3 FEAT021 SLICE36`
  so the filename matches the rest of the artifact surface
  (`<TS>-cost-advise-phase3-feat021-slice36.md`).

### Frontmatter

- Simple-renderer artifact kinds (`run-brief`, `handoff`,
  `review-result`, `validation-plan`, `validation-result`,
  `deployment-check`, `final-synthesis`) gain an optional YAML
  frontmatter block when `--feature` or `--phase` is set. Block is
  `---\nfeature: ...\nphase: "..."\n---`. When neither is set, body is
  byte-identical to v0.3.2 (backward compatible).
- `cost-report` and `cost-advise` already had structured frontmatter;
  `feature:` and `phase:` keys are folded in inline.

### Tests

- 4 new cases in `tests/cli.test.mjs` cover `--feature` / `--phase`
  frontmatter emission, backward-compat (no frontmatter without flags),
  `cost-advise --title` slug, `cost-slice` frontmatter keys.

### Internal

- `writeCostAdviseArtifact` refactored into `buildCostAdviseSlug` +
  `buildOptionalFrontmatter` helpers; cost-advise emit inside
  `maybeEmitCostReport` extracted into `emitCostAdvise`. Eslint
  complexity warnings resolved.

## v0.3.2 — 2026-05-24 — Skills library + routing + cost discipline + linter

### Skills

- **New** `skills/domain/terraform-ops-traps/` — operational failure
  patterns for Terraform provisioners, multi-env isolation, and
  zero-to-deployment reliability. Vendored from
  `daymade/claude-code-skills` (MIT, © 2025 daymade); trimmed from 234
  lines to 135 and split into `references/{provisioner-traps,
  multi-env-isolation, zero-to-deploy}.md` so the on-load body fits
  this repo's ≤200-line skill quality bar.
- **New** `skills/workflow/commit/` — conventional commit + emoji
  format with split-commit guidance. Vendored from
  `evmts/tevm-monorepo` (MIT, © 2023 evmts contributors); reduced
  emoji list, replaced pnpm pre-commit gate with this repo's
  `npm run lint && npm test && validate-manifests/skills`.
- **New** `skills/workflow/fix-pr/` — fetch and address unresolved PR
  review comments with proper threading + commit-per-fix discipline.
  Authored fresh; cites `gh` CLI workflow for this repo.

All three pass `validate-skills.mjs` (tier in enum, ≤200 lines,
required headings present). Total: 12 skills (was 9).

### Routing (FEAT-019)

- 6 new rows in `docs/routing-table.md` covering Microsoft SDK code,
  Microsoft tech concepts, builder edits of `agents/` + `skills/`,
  Terraform HCL (`terraform-code-generation:*` + `crew:terraform-ops-traps`),
  Terraform modules/Stacks (`terraform-module-generation:*`), Terraform
  state import. Plus context7 row extension to name reviewer as consumer.
- `CLAUDE.md` "Skill taxonomy" callout pointing at external-plugin
  skill wiring.
- `docs/architecture/architecture.md` "Skill tiers" subsection
  "External plugin skills as routed dependencies" documenting the
  routing-by-row pattern + single-point-of-rename design.

### Cost discipline (FEAT-018)

- All 5 agent prompts gain identical "Report contract" section:
  agents write completion reports via `write-handoff` CLI, return
  only path + 1-3 sentence headline to lead. Inline returns
  re-inflate lead context.
- `agents/builder.md` + `.claude/engineering-os/lead.md` gain shell
  pre-check rule (pwd / Test-Path before chained cd) + PS-vs-bash
  cheatsheet.
- `agents/{builder,reviewer,validator}.md` gain "no re-Read after
  Edit/Write" rule.
- `commands/{build,fix}.md` gain "read agent reports from path"
  reminder.
- New routing-table row "Subagent completion report".

### Routing-table linter (FEAT-021)

- New `scripts/validate-routing-table.mjs` validates every
  `<plugin>:<skill>` reference in routing-table resolves against
  installed plugin cache + local `skills/`/`commands/`/`agents/`.
- Supports `<!-- routing-lint:ignore -->` opt-out for forward pointers.
- Env-gated by `CREW_VALIDATE_ROUTING_TABLE=1`; skips silently
  otherwise so contributors without plugin cache can still run tests.
- CI gate added as advisory (`continue-on-error: true`); promote to
  hard-fail when plugin cache is reliably present.
- `npm run validate:routing-table` script entry.
- 4 test scenarios via temp-dir fixtures.

### Agents

- `builder` maxTurns bumped 30 → 40.
- `reviewer` maxTurns bumped 25 → 35.
- Per operator policy: if pauses recur at these caps, investigate
  workflow root cause via trigger-gated FEAT-022 (do not bump further).

### Backlog

- FEAT-018, FEAT-019, FEAT-020, FEAT-021 → done.
- FEAT-022 filed (P3, trigger-gated subagent-pause investigation).
- FEAT-019 SLICE-B (agent-prompt addendums) deferred — routing layer
  alone proved sufficient; revisit if missing routing causes problems.

### Marketplace pin

- crew bumped to 0.3.2.
- loop bumped to 0.3.2 (depends on loop FEAT-020 multi-slice support).

## v0.3.1 — 2026-05-23 — Marketplace polish + agent model tuning

### Marketplace

- `crew` plugin source switched from local `./` to structured `github`
  form (`source: "github", repo: "sergeymilashico/hero-crew"`) — symmetric
  with the `loop` entry and resolvable from any consumer install.
- `loop` plugin source corrected from raw string URL → structured `github`
  form so the marketplace loader can resolve it.
- Owner + author rebrand consolidated to `astra` across `marketplace.json`
  and both plugins' `plugin.json`.

### Agents

- `builder` model `opus` → `sonnet`; `lead` effort `high` → `medium`.
  Reduces per-slice cost on bounded implementation work without observed
  quality regression. Revert by editing `agents/builder.md` and
  `agents/lead.md` if regression is observed.

### Notes

- No consumer-repo migration required.
- Marketplace pins bumped: `crew@0.3.1`, `loop@0.3.1`.

## v0.3.0 — 2026-05-23 — Astra rebrand

### Breaking

- Marketplace renamed `crew-dev` → `astra`. New install path:
  `/plugin marketplace add sergeymilashico/hero-crew` then
  `/plugin install crew@astra`.
- Companion plugin renamed `autonomous-loop` → `loop`. Install:
  `/plugin install loop@astra`. Companion slash command namespace
  `/autonomous-loop:*` → `/loop:*` (handled in the companion repo
  release; `loop@0.3.0` ships a one-time migrator that renames
  `.claude/autonomous-loop.json` → `.claude/loop.json` and rewrites
  CLAUDE.md markers on first `/loop:install`).

### Migration

- Existing installs of `crew@crew-dev` and `autonomous-loop@crew-dev`
  must be uninstalled and re-installed under the new marketplace name.
  See `docs/process/rebrand-migration.md` for the exact command
  sequence.
- Consumer-repo state for the companion plugin auto-migrates on first
  `/loop:install`; no manual file rewrites required.

### Notes

- `crew` plugin itself has no consumer-repo state rename — only the
  install path changes.
- Marketplace manifest is the source of truth for plugin pins; both
  `crew` and `loop` pinned at `0.3.0` here.
- Hardcoded cache-path fallbacks in `scripts/lib/briefing/collect.mjs`
  walk the new `astra/loop/<version>/` cache first, then fall back to
  the legacy `autonomous-loop-dev/autonomous-loop/<version>/` shape so
  briefings keep working during the transition.

## v0.2.0 — 2026-05-22 — Phase 1 (Engineering OS) complete

Closes the Phase-1 backlog defined in `docs/architecture/architecture.md`.
Nine of eleven FEATs shipped; the remaining two (FEAT-005, FEAT-009)
are correctly deferred behind explicit "when X observed" triggers.

### Skill taxonomy (FEAT-001, FEAT-007)

- `skills/` split into four tiers: `universal/`, `workflow/`,
  `domain/`, `meta/`. Existing crew skills relocated; tier field
  added to frontmatter.
- New `scripts/validate-skills.mjs` enforces the quality bar
  (required: name, tier, description; recommended: owner,
  last_reviewed, triggers; hard caps: ≤200 lines, directory matches
  name, no duplicate names, tier in enum). Wired into CI between
  validate-manifests and lint. Local: `npm run validate:skills`.
- All 4 existing skills brought up to spec.

### Routing (FEAT-002)

- Authoritative `docs/routing-table.md` (14 rows derived from real
  history). Lead consults at session start.
- Production-promotion row explicitly requires human approval — no
  automation.
- FEAT-008: brief-me surfaces a reminder when the routing-table
  mtime exceeds 30 days. Encourages a monthly review.

### Workflow state (FEAT-006)

- New `blocked` + `escalated_to_human` workflow badges with
  `--note <reason>` and `--blocked-by <artifact-id>` flags.
- `write-final-synthesis` refuses to run while escalated unless
  `--force`.
- `brief-me` + `summarizeWorkflowState` surface both as pending
  badges. AL plugin (v0.1.21) consumes these signals end-to-end.

### Lead, builder, reviewer prompts (FEAT-003, FEAT-011)

- `agents/lead.md` rewritten — 196 → 169 lines (under 200-line cap).
  New "Composition formula" + "Where to load specifics" sections
  point at the durable docs/skills rather than restating discipline
  inline.
- `agents/builder.md` (FEAT-011) gains a TDD policy table:
  required on net-new behavior + bug reproducers; optional on
  refactors of tested code; skipping silently is a review finding.
  Procedure of record: superpowers `test-driven-development` skill.
- `agents/reviewer.md` (FEAT-011) gains a TDD gate section that
  enforces failing-test-first on net-new behavior.

### Docs (FEAT-004, FEAT-010)

- `docs/architecture/architecture.md` polished: Phase 1 status
  table, autonomous-loop sync line, tooling-gates section.
- New `docs/governance.md`: skill ownership, agent prompt size bar,
  routing-table review cadence, artifact retention, lessons →
  standards pipeline, three-test rule for specialist-agent
  admission, defer-by-default.
- `docs/` directory namespaced into `architecture/`, `process/`,
  `history/`, `standards/`, `backlog/` to match Astragenie.Standards
  shape. 19 flat doc files moved via `git mv`; all internal refs
  rewritten.

### Tooling (cross-cutting)

- `tsconfig.json` added with `checkJs: true` / `noEmit`; `npm run
  typecheck` wired into CI between format:check and tests. JSDoc
  annotations added on session-cost, cost-advisor, crew.mjs entry
  points to satisfy tsc.
- `superpowers` plugin verified enabled in `~/.claude/settings.json`
  for global TDD + systematic-debugging + verification-before-
  completion skill discovery.

### Companion plugin sync

| Capability                                   | crew   | autonomous-loop |
|----------------------------------------------|--------|-----------------|
| blocked + escalated_to_human (writer)        | ≥0.2.0 | —               |
| Honors crew gates in slice flow (reader)     | —      | ≥0.1.21         |
| Iteration cap + cost-alert + snapshot loop   | —      | ≥0.1.20         |

Pin both together; older AL against newer crew silently misses the
new gate signals.

### Tests + gates

- 41/41 tests pass (35 → 41, six added across FEAT-006 + FEAT-008).
- typecheck + lint + format + validate-skills + validate-manifests
  + e2e-smoke all clean on every push.

### Backlog after Phase 1

Closed: FEAT-001 / FEAT-002 / FEAT-003 / FEAT-004 / FEAT-006 /
FEAT-007 / FEAT-008 / FEAT-010 / FEAT-011.

Intentionally deferred:

- **FEAT-005** (dotnet/csharp-conventions domain skill) — build when
  the first .cs work appears.
- **FEAT-009** (artifact index file) — build when artifact-tree
  grep exceeds ~2s.

## v0.1.26 — 2026-05-22

### Removed
- **Commit bridge feature removed in its entirety.** The bridge was an
  opt-in `PostToolUse` hook that minted Crew artifacts from commits
  matching a preset pattern; in practice it was never adopted beyond
  exploration. Deletion reclaims ~700 lines (lib + tests + commands +
  docs) and one PostToolUse-hook surface for downstream repos to worry
  about.
  - `scripts/lib/bridge-installer.mjs` (463 lines)
  - `scripts/lib/plugin-identity.mjs` (sole consumer was the bridge)
  - `tests/bridge-installer.test.mjs` (14 tests)
  - `commands/install-commit-bridge.md` + `commands/install-wiggin-bridge.md`
  - CLI subcommands: `install-commit-bridge`,
    `backfill-commit-bridge`, `list-bridge-presets`,
    `install-wiggin-bridge`, `backfill-wiggin-bridge`
  - README Install section "optional follow-up" block
  - `commands/adopt.md` step 12 bridge probe
  - `docs/process/adoption-checklist.md` bridge sections
  - `installer/welcome.mjs` optional bridge hint
- Companion `autonomous-loop/skills/loop-discipline/SKILL.md` lost its
  one-line reference to the bridge as well.

### Migration
Repos with a bridge already installed will keep the generated
`.claude/hooks/commit_bridge.sh` + `PostToolUse` settings entry — no
runtime breakage. The CLI commands for re-installing or reconfiguring
the bridge are simply gone. Manual cleanup: delete
`.claude/hooks/commit_bridge.sh` and the matching `PostToolUse` entry
in `.claude/settings.json` if you want to remove the hook entirely.

### Notes
- Tests: 35/35 pass (down from 49 — the 14 missing tests are the
  bridge suite that no longer exists).

## v0.1.25 — 2026-05-22

### Changed
Final lint-cleanup pass. **Lint warning count: 8 → 0.**

- `validate-manifests.mjs::validateManifests` 16 → off list. Extracted
  `isMissing`, `checkRequiredFields`, `checkVersions`,
  `checkOwnMarketplaceEntry`, `checkMarketplaceEntries`.
- `briefing/collect.mjs::parseHeaderFields` 18 → off list via
  `parseRunTitle`, `parseUsd`, `parseDurationMs` helpers.
- `artifacts.mjs::renderCostReportHeader` 16 → off list via
  `formatCount` helper.
- `briefing/render.mjs::buildBlockedOrMissing` 18 → off list. Static
  `PENDING_BADGE_MESSAGES` + `MISSING_WRITE_MESSAGES` maps + extracted
  `collectGateFailureMessages` + `collectRepoStateMessages`.
- `briefing/render.mjs::recommendedNextStep` 19 → off list. Same
  pattern — `NEXT_STEP_FROM_PENDING` / `NEXT_STEP_FROM_MISSING` maps,
  `GATE_NEXT_STEP_SPECS` + `collectGateFailureNextStep`,
  `repoStateNextStep` probe helper.
- `wakeup.mjs::buildWakeUpBrief` 124 lines → off list. Summary block
  extracted into `buildWakeUpSummary`.
- `session-cost.mjs::computeSessionCost` 22 / 146 lines → off list.
  Extracted `priceByModel`, `computeSourceBreakdown`, `buildModelMix`,
  `computeSizeStats`, `collectFileReReadEntries`, `buildToolUsage`.

### Notes
- Lint output is now clean. All 49 tests pass.

## v0.1.24 — 2026-05-22

### Changed
- **`briefing/collect.mjs::parseCostReportText`** complexity 34 → split
  into `parseHeaderFields`, `parseTokenFields`, `parseDiagnosticFields`,
  `parseOutcomeFields`, `bodyNum`. Composer reads top-down.
- **`artifacts.mjs::renderCostReportFrontmatter`** complexity 27 → 16
  via `[predicate, line-builder][]` table with lazy interpolation.
- **`artifacts.mjs::renderCostReportHeader`** complexity 22 → 16 via
  small `formatDuration`/`formatTokens`/`formatCacheHit`/`formatUsd`/
  `formatBool` helpers.
- **`session-cost.mjs::autoDetectSourceProject`** + `listActiveProjectDirs`
  both 18-25 → off list. Extracted shared helpers
  `listJsonlInDir`, `listProjectDirEntries`,
  `countInWindowAssistantTurns`. Caller bodies now ~10 lines each.
- **`session-cost.mjs::handleAssistantTurn`** complexity 23 → off list.
  Split into `recordTokenUsage` + `recordToolUse` + `TOOL_COUNTERS`
  table dispatch for Skill/Agent counters.
- **`workflow-state.mjs::hasPendingGates`** complexity 18 → off list.
  Predicates moved into `PENDING_GATE_CHECKS` array.
- **`workflow-state.mjs::hasCompletedPhaseEvidence`** complexity 19 →
  off list. Field accessors moved into `GATE_STATUS_GETTERS` +
  `PHASE_ARTIFACT_GETTERS` arrays.
- **`workflow-state.mjs::summarizeMissingArtifactWritesForRun`**
  complexity 23 → off list. Gate-to-artifact mapping moved into
  `MISSING_WRITE_SPECS` table with `gate(g)` / `artifact(a)` /
  `code` fields.

### Notes
- Lint warning count: 15 → 8. All remaining within 5 of threshold;
  further cuts have diminishing returns.
- All 49 tests pass.

## v0.1.23 — 2026-05-22

### Changed
- **`session-cost.mjs::computeSessionCost`** — 235 lines / complexity 85
  cut to 133 lines / complexity 22.
  - `scanSessions` extracted: drives the per-session JSONL loop and
    returns the full accumulator bundle (totals, byModel, tool stats,
    file reads, conversation counters, perSourceState).
  - `handleAssistantTurn` + `handleUserTurn` extracted: the assistant
    branch handles usage / tool-use; the user branch handles
    tool_result sizing, compaction signals, and user message shape.
  - `resolveScanSources` extracted: encapsulates the three-mode source
    selection (aggregateAll / explicit / repo-derived with auto-detect
    fallback).
  - `sessionsHaveInWindowAssistantTurns` extracted: short-circuit
    activity probe used by the auto-detect fallback path.
- **`cost-advisor.mjs::summarizeReport`** — complexity 27 cut by
  extracting `summarizeToolStats` + `computeExplorationRatio` +
  `toolCount` helpers. summarizeReport now reads as a flat data shape.

### Notes
- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.22 — 2026-05-22

### Changed
- **artifacts.mjs `render` complexity 79 → split.** `resolveArtifactConfig`
  now dispatches off a `SIMPLE_RENDERERS` table (7 entries) and the heavy
  cost-report renderer is split into 9 named helpers
  (`renderCostReportFrontmatter`, `renderCostReportHeader`,
  `renderCostReportOutcome`, `renderCostReportTokens`,
  `renderCostReportModelMix`, `renderCostReportConversation`,
  `renderCostReportToolUsage`, `renderCostReportToolResultSizes`,
  `renderCostReportFileReReads`, `renderCostReportByModel`).
- **`briefing/render.mjs`** — `buildBlockedOrMissing` (complexity 41 → 18)
  and `recommendedNextStep` (38 → 20) refactored to `[condition, message]`
  rule tables. Messages that need runtime data go through thunks so
  expressions are only evaluated when the condition fires.
- **`briefing/collect.mjs::collectRecentCosts`** (193 lines, complexity 64)
  split into focused helpers: `parseFrontmatterBlock`, `parseModelMix`,
  `parseToolUsage`, `computeDominantModel`, `deriveFlags`,
  `parseCostReportText`, `listCostReportFilesByMtime`. Orchestrator now
  fits in ~25 lines.
- **`workflow-state.mjs::registerWorkflowArtifact`** (complexity 28) →
  per-kind dispatch via `ARTIFACT_HANDLERS` table.
- **`workflow-state.mjs::summarizeWorkflowState`** (complexity 18) →
  pending-badge specs in `PENDING_BADGE_SPECS` table; `collectPendingBadges`
  helper.

### Notes
- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.21 — 2026-05-22

### Changed
- **installer.mjs full split (Tier #10)**: extracted 5 more cohesive
  submodules from the residual installer.mjs. Now 11 files total under
  `scripts/lib/installer/`, each ≤ 110 lines and single-concern:
  - `claude-md.mjs` (67) — CLAUDE.md create / legacy-marker upgrade /
    idempotent re-run / append-on-no-marker.
  - `gitignore.mjs` (38) — `# crew:start`/`# crew:end` block create or
    in-place replace.
  - `harness-files.mjs` (90) — README + hook script refresh + state
    seed-if-missing + artifact / log directory tree.
  - `repo-guides.mjs` (28) — `.claude/crew/constitution.md` +
    `workflow.md` + `protocol.md` write.
  - `welcome.mjs` (30) — post-install message shape, pure data.
  - `audit.mjs` (24) — read-only repo + global presence check.
  - `global.mjs` (110) — `inspectGlobalInstall` + `installGlobal` +
    `GLOBAL_IMPORT_LINES` + `globalPaths`.
- `scripts/lib/installer.mjs` is now 72 lines (was 397; was 1040 before
  the Tier B-5 splits started). Just the public API:
  `bootstrapRepo`, `initRepo` + re-exports for `auditRepo` and
  `installGlobal`.
- Public surface unchanged. All 49 tests pass.

## v0.1.20 — 2026-05-22

### Changed
- **`scripts/lib/workflow-state.mjs`** — reduced complexity in five
  hot functions:
  - `hasCompletedPhaseEvidence`: 37 → 19. Extracted
    `isGateResolved(status)` + `RESOLVED_GATE_STATUSES` set;
    artifact-shape check pulled out.
  - `hasMeaningfulProgress` (25) and `isSubstantialRunHint` (24):
    artifact / gate predicates extracted into
    `hasReviewOrValidationArtifact`, `hasSubstantialArtifact`,
    `hasSubstantialGate`, `hasSubstantialMode`.
  - `summarizeMissingArtifactWritesForRun`: 43 → 23. Status checks
    folded into a `[cond, code][]` table; named `isDecided(status)`
    helper makes the intent (pass/fail, not pending or skipped)
    explicit.
  - `applyBadge`: 18 → 1. Replaced 16-branch `if`-chain with a
    `BADGE_TABLE` registry mapping badge name → `(run) => [parent, key]`
    selector + target status. Adding a new badge is now one entry.
- **`scripts/validate-manifests.mjs`**: exports `validateManifests()`
  for in-process testing. Entry-point check uses `process.exitCode`
  instead of `process.exit(1)` so `await import` doesn't kill the
  caller.
- **`scripts/lib/wakeup.mjs`**: dropped dead `resolvedSprintPath`
  computation (lint `no-unused-vars`).
- **`scripts/lib/workflow-state.mjs`**: dropped dead
  `workflowStateExists()`.
- **`scripts/lib/cost-advisor.mjs`**: dropped unused `base` parameter
  in `cache-busted` rule trigger.

### Added
- **`docs/standards/code-conventions.md`**: per-repo coding conventions adapted
  from `Astragenie.Standards/typescript/coding-conventions.md` for
  plain ESM. Anchors the lint rules to their reasoning.

### Notes
- Lint warning count: 20 → 17.
- All 49 tests pass.

## v0.1.19 — 2026-05-22

### Changed
- **briefing.mjs split (Tier B-7)**: 821-line module split along the
  natural data / render boundary.
  - `scripts/lib/briefing/collect.mjs` (515 lines): pure I/O —
    `collectGitActivity`, `collectRelevantArtifacts`,
    `collectRecentCosts`, `fetchAutonomousLoopBrief`.
  - `scripts/lib/briefing/render.mjs` (299 lines): pure data → string
    — `buildRetrievalGuide`, `buildCurrentObjective`,
    `buildBlockedOrMissing`, `buildImportantReminders`,
    `recommendedNextStep`, `buildSecondaryOptions`.
  - `scripts/lib/briefing.mjs` (88 lines, was 821): thin orchestrator.
  Public API `buildBriefingReport` unchanged.
- **marketplace**: autonomous-loop entry bumped to v0.1.15 to pick up
  the slice-linker + phase-gate splits shipped there.

Tests: 49/49 pass.

## v0.1.18 — 2026-05-22

### Changed
- **installer.mjs split (Tier B-5)**: the 1040-line mega-module is now
  399 lines. Extracted four cohesive submodules under
  `scripts/lib/installer/`:
  - `templates.mjs` (504 lines) — all string templates and constants.
  - `util.mjs` (42 lines) — filesystem + JSON helpers.
  - `settings.mjs` (61 lines) — `.claude/settings.json` hook-merge logic
    (`isCrewHook`, `mergeHooks`, `updateSettings`).
  - `legacy-migration.mjs` (89 lines) — the one-shot
    `engineering-os` → `crew` namespace migrator.
- Public API unchanged: `bootstrapRepo`, `initRepo`, `installGlobal`,
  `auditRepo` still export from `scripts/lib/installer.mjs`. All 49
  tests pass without modification.

## v0.1.17 — 2026-05-22

### Changed
- **Tooling**: ESLint 9 (flat config) + Prettier 3 added. CI now runs
  `npm ci`, `validate-manifests`, `lint`, `format:check`, `node --test`,
  `e2e-smoke` as separate gates. devDependencies pinned via
  `package-lock.json`.
- **Code style swept**: prettier --write across `scripts/**/*.mjs` and
  `tests/**/*.mjs`; no semantic changes.
- **CLI registry refactor** (`scripts/crew.mjs`):
  - 58 hand-written `if (value === "--foo") { ... }` flag branches
    collapsed into a single `FLAG_SPEC` table.
  - 30-branch command `else if` chain collapsed into a `COMMANDS`
    registry of `(ctx) => Promise<result>` handlers.
  - File size: 767 → 560 lines (-207). Same flags, same outputs,
    same error messages. Adding a new command/flag is now one entry.

### Fixed
- `scripts/lib/cost-advisor.mjs`: empty `catch {}` blocks now carry
  intent comments (ESLint `no-empty`).

## v0.1.16 — 2026-05-22

### Added
- `scripts/validate-manifests.mjs`: lightweight CI gate verifying
  `plugin.json` / `marketplace.json` / `package.json` required fields,
  semver parseability, and version-drift between the three files.
  Catches the class of regression that `marketplace.json` version drift
  already caused once.
- CI: validate-manifests step runs before tests on every push/PR.
- README: test / release / license badges.
- `/crew:adopt`: explicit step 12 instructs the lead to inspect repo
  commit conventions and recommend `/crew:install-commit-bridge` when
  a matching preset applies. Stays opt-in; never auto-installs.

### Notes (not changed)
- `.gitignore` install block intentionally does NOT ignore
  `.claude/artifacts/` — artifacts are the durable record per the
  constitution and should be committed in target repos.
- Hooks audit: `log_event.sh` and the generated `commit_bridge.sh`
  are fail-closed at the shell layer (`set -euo pipefail`),
  fail-open at the JS layer (best-effort, never blocks tool output),
  use `execFileSync` (no shell) with `escapeForJsLiteral` on all
  template substitutions. No injection surface. Minor follow-up:
  `log_event.sh` has no payload-dir rotation.
- No `package-lock.json` added: zero runtime deps (Node built-ins only).

## v0.1.15 — 2026-05-22

### Changed
- README: removed stale "legacy compatibility aliases" section that
  listed five `/crew:*` commands which no longer exist (`build-feature`,
  `investigate-bug`, `bootstrap-repo`, `init-repo`, `install-global`).
- README: added optional follow-up step recommending
  `/crew:install-commit-bridge`, replacing the dead-alias block with
  real, discoverable guidance.
- `installer.mjs::buildWelcome`: returns an `optional` array with a
  one-line hint pointing at `/crew:install-commit-bridge` after `init`
  or `bootstrap`. Bridge remains opt-in; install flow is unchanged.

## v0.1.14 — 2026-05-21

### Changed
- Plugin and marketplace `author`/`owner` updated to `shishkosv` to match
  repo owner and the companion `autonomous-loop` plugin.

### Fixed
- README local-development clone URL pointed to the legacy
  `alex-radaev/engineering-os` repo; corrected to
  `sergeymilashico/hero-crew`.
- `docs/history/reference-repo-plan.md` replaced hard-coded
  `/Users/aradaev/Desktop/Projects/` paths with `<reference-repos-dir>`
  placeholders.

## v0.1.13 — 2026-05-21

### Fixed
- `bootstrapRepo` / `init` now seed `.gitignore` with a marker-bracketed
  `# crew:start`/`# crew:end` block. User lines outside the block are
  preserved; the block is replaced in place on re-install. Closes the
  e2e-smoke regression and lets the CI step run as a blocking gate.

### Infrastructure
- `e2e-smoke` promoted from `continue-on-error` to blocking in CI.

## v0.1.12 — 2026-05-21

First tagged release after accumulated 0.1.0 → 0.1.12 work.

### Fixed
- `write-final-synthesis` no longer hides top-level `path` under a `synthesis`
  key when a cost-report is also emitted. Restores the documented JSON shape
  for downstream callers and tests.
- `marketplace.json` version drift: autonomous-loop entry bumped to 0.1.12 to
  match its `plugin.json`.

### Added — accumulated since 0.1.0
- Per-slice Claude session cost tracking and `cost-advise` recommender.
- `brief-me` cost diagnostics: combined cache R/W + I/O in millions, dominant
  model, preformatted I/O and Cache R/W strings, richer `autonomousLoop`
  block, cost-diagnostics table for flagged slices.
- Tool-failure flag threshold raised to `> 3`.

### Infrastructure
- CI: `node --test` + `e2e-smoke` on push/PR (GitHub Actions).
- `.gitignore` covers `node_modules/`, `.claude/logs|state|artifacts/`,
  `.claude.backup.*`, `*.tmp`.
- Docs: removed hard-coded absolute paths in favor of `<path-to-this-repo>`
  placeholders.
- README documents marketplace install commands.
