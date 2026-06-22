# Plugin Performance & Stability — 4-FEAT Improvement Plan

**Date:** 2026-06-05
**Author:** herolegion
**Status:** approved

**Goal:** Address the 10 weak points identified from grades (SLICE-08–15), recent reviews,
and file analysis. Packaged as 4 bounded FEATs that can be triaged, deferred, and
implemented independently.

**Evidence base:**
- Grades SLICE-08 through SLICE-15 (lowest scores: architecture_quality 0.75, test_confidence 0.70)
- 3 `eslint-disable-next-line complexity` suppressions in `crew.mjs` + `artifacts.mjs` (SLICE-13 debt)
- `collect.mjs` 955L, `cost-advisor.mjs` 874L, `session-cost.mjs` 844L, `workflow-state.mjs` 794L
- SLICE-13: builder hit context ceiling at 50 tool uses / 91k tokens — lead recovered 30% inline
- SLICE-15: `test_confidence: 0.70` — prompt-driven changes have zero automated coverage
- SLICE-10/12: `observability: 0.80` — hooks log best-effort only; no brief-me health surface
- Session review (2026-06-05): ux-validation SKILL.md Step 4 was stale post-qa-adapter change

---

## FEAT-A — Complexity Debt Reduction

**Weak points addressed:** large files (#1), eslint-disable suppressions (#2)

### Problem

Three functions in `crew.mjs` and `artifacts.mjs` carry acknowledged complexity debt from
SLICE-13 (`maybeEmitCostReport`, `cost-slice` branch, `renderCostReportFrontmatter`).
Each is suppressed with `eslint-disable-next-line complexity` tagged for extraction.

Five library files exceed 700 lines (`collect.mjs` 955, `cost-advisor.mjs` 874,
`session-cost.mjs` 844, `workflow-state.mjs` 794, `artifacts.mjs` 743). Files this size
are hard to hold in subagent context — a documented cause of the SLICE-13 builder ceiling.

### Solution

**Phase 1 — Extract suppressed functions:**
- `maybeEmitCostReport` in `crew.mjs` (~line 407): extract branch logic into
  `scripts/lib/cost-hygiene/emit-cost-report.mjs`
- `renderCostReportFrontmatter` in `artifacts.mjs` (~line 294): extract into
  `scripts/lib/cost-hygiene/render-frontmatter.mjs`
- Remove all 3 `eslint-disable-next-line complexity` suppressions
- Complexity score returns to clean (≤15 per function)

**Phase 2 — Split oversized modules:**
- `collect.mjs` (955L): split into `collect-workflow.mjs` (badge/handoff/review sections)
  and `collect-cost.mjs` (cost aggregation, cost-advisor invocation)
- `cost-advisor.mjs` (874L): extract threshold logic into `cost-advisor-thresholds.mjs`
- `session-cost.mjs` (844L): extract report rendering into `session-cost-render.mjs`
- `workflow-state.mjs` (794L): extract badge read/write helpers into `workflow-state-badges.mjs`

### Constraints
- All exports remain backward-compatible (re-export from original filename if needed)
- `node --test` must pass before and after each extraction
- No logic changes — pure structural refactor
- `validate-manifests.mjs` + `validate-agents.mjs` must remain green

### Acceptance criteria
- AC-1: Zero `eslint-disable-next-line complexity` suppressions remain in `crew.mjs` and `artifacts.mjs`
- AC-2: ESLint complexity passes on all 3 previously-suppressed functions without suppression
- AC-3: `collect.mjs` < 600L; `cost-advisor.mjs` < 500L; `session-cost.mjs` < 500L; `workflow-state.mjs` < 500L
- AC-4: All existing tests pass (no behavior change); `npm run lint` zero warnings
- AC-5: `scripts/lib/cost-hygiene/` contains the extracted helpers as named exports

**Size:** standard | **autonomous_safe:** true

---

## FEAT-B — Observability & Artifact Trail

**Weak points addressed:** hook observability (#3), incomplete syntheses (#4), docs drift (#5)

### Problem

**Hook health (observability 0.80):** `check-redundant-read.mjs`, `record-read-content.mjs`,
`preflight-shell.mjs`, and `check-subagent-return.mjs` write to `events.jsonl` on a
best-effort basis but there is no health summary in `brief-me`. Hooks that silently error
or exit early produce no visible signal.

**Incomplete syntheses:** SLICE-10, 11, 12, 13 final-synthesis artifacts all contain
`Grade missing — synthesis is incomplete` and placeholder handoff paths
(`<timestamp>-slice-N-complete.md`). `brief-me` surfaces the synthesis contents;
stale placeholders corrupt the loop context.

**Docs drift:** `ux-validation/SKILL.md` fell out of sync with `qa-adapter.mjs` after
FEAT-041 (caught by reviewer, fixed in this session). No automated check detects when a
skill doc's `## Implementation` reference mismatches the actual library export.

### Solution

**Hook health in brief-me:**
- `crew.mjs wake-up` reads `events.jsonl` tail (last 100 events) and counts hook
  errors/exits in the last 24h
- `brief-me` output gains a `## Hook health` section: lists each hook, last-fired
  timestamp, error count (0 = green; >0 = yellow with count)
- Hook scripts: wrap top-level in `try/catch` → emit structured `{ type: "hook_error", hook, error }` to events.jsonl instead of silent process.exit

**Fix incomplete syntheses:**
- Retroactively fill `Grade missing` placeholder in SLICE-10/11/12/13 syntheses by
  linking to the corresponding grade files
- Replace placeholder handoff paths with actual artifact paths from `.claude/artifacts/crew/`
- Add a `validate-syntheses.mjs` script that errors on any synthesis containing
  `Grade missing` or `<timestamp>` literals (CI gate, advisory)

**Skill doc API consistency check:**
- Extend `validate-skills.mjs`: when a skill's `## Implementation` section references
  a `.mjs` file + function name, verify the file exists and exports that function name
- Warn (not error) on mismatch — advisory gate, not blocking

### Acceptance criteria
- AC-1: `crew.mjs wake-up` output includes `hookHealth` field listing per-hook error counts
- AC-2: `brief-me` text output includes `## Hook health` section (green when all 0)
- AC-3: All 4 hook scripts have top-level try/catch emitting `hook_error` events
- AC-4: SLICE-10/11/12/13 synthesis artifacts have no `Grade missing` or `<timestamp>` placeholders
- AC-5: `validate-skills.mjs` warns when `## Implementation` names a function not found in the referenced file
- AC-6: `npm run lint` zero warnings; `node --test` passes

**Size:** standard | **autonomous_safe:** false (brief-me output change touches user-facing surface)

---

## FEAT-C — Prompt & Doc Change Test Coverage

**Weak points addressed:** prompt behavior untestable (#6), no integration harness (#7), thin edge-case coverage (#8)

### Problem

**SLICE-15 test_confidence: 0.70:** Prompt additions to `agents/builder.md`,
`agents/reviewer.md`, etc. have zero automated tests. The only coverage is the
structural shape check (line count, required sections). A prompt section that names
the wrong skill, uses a stale flag, or drops a required gate keyword passes all
current tests silently.

**Skill doc API consistency (above in FEAT-B)** covers the library-signature gap.
This FEAT targets the agent-prompt semantic layer.

**Edge-case thin coverage pattern:** classify-scenario over-match was caught by
reviewer (this session); the root cause was no negative test for compound-word
false positives. The pattern recurs across verb-matching logic.

### Solution

**Agent prompt keyword tests:**
- Extend `tests/validate-agents.test.mjs` (or new `tests/agent-prompt-content.test.mjs`)
  with per-agent required-keyword assertions:
  - `builder.md`: must contain `crew:builder`, `--validation-evidence`, `DONE_WITH_CONCERNS`, `scenario_chain` (if ux-validation referenced)
  - `reviewer.md`: must contain `Test Adequacy`, `crew:reviewer`, `needs_fix`
  - `validator.md`: must contain `validation_skipped`, `crew:validator`
  - `deployer.md`: must contain `dev.readyfordev` (or current badge name), `crew:deployer`
  - `lead.md`: must contain `crew:build`, `mark-badge`, `write-handoff`
- Tests read the file and assert `text.includes(keyword)` — same pattern as `architect-feature.test.mjs`

**Negative test discipline for matching logic:**
- Any function using regex verb/keyword matching must have at least one negative test for a plausible false-positive (compound word, suffix, prefix)
- Add to `tests/validate-agents.test.mjs` a lint check: if a test file imports a `*-matcher.mjs` or `classify-*.mjs` module, assert at least one `non_match` / `non_ui_ac` / `null` return test exists

**Skill frontmatter completeness:**
- Extend `validate-skills.mjs`: warn if `last_reviewed` is absent (currently a recommended field, not enforced)

### Acceptance criteria
- AC-1: `tests/agent-prompt-content.test.mjs` exists with ≥5 keyword assertions per agent file (5 agents × 5 keywords = ≥25 tests)
- AC-2: All new tests pass on current agent files; failure message names the missing keyword and file
- AC-3: `validate-skills.mjs` warns when `last_reviewed` is absent from a skill's frontmatter
- AC-4: `classify-scenario.mjs` test suite includes ≥2 negative (non-match) cases per verb set (interaction/visibility/navigation/input) — already partially done; complete the set
- AC-5: `node --test` 100% pass; `npm run lint` zero warnings

**Size:** light | **autonomous_safe:** true

---

## FEAT-D — Builder Dispatch Reliability

**Weak points addressed:** builder context ceiling (#9), model selection enforcement (#10)

### Problem

**SLICE-13 context ceiling:** builder hit 50 tool uses + 91k tokens mid-implementation.
Lead recovered the remaining 30% inline. No pre-dispatch estimate predicted this; no
recovery protocol defined what to do when builder signals ceiling.

**SLICE-15 model selection (production_readiness 0.80):** Sonnet-default guidance in
`(removed v0.41)` is a soft recommendation with no measurable enforcement. The
`modelMix` field in cost reports is the intended compliance signal but nothing surfaces
a warning when a slice dispatches Opus for a Sonnet-appropriate task.

### Solution

**Pre-dispatch scope estimate:**
- `crew.mjs` gains a `scope-estimate` sub-command: given a list of files + line counts,
  returns a complexity tier (`light` / `standard` / `heavy`) based on:
  - Total lines-in-scope (light: <300, standard: 300–800, heavy: >800)
  - File count (light: 1–2, standard: 3–5, heavy: 6+)
  - Presence of `eslint-disable` or complexity warnings in scope
- Lead prompt references `scope-estimate` in the dispatch section:
  "Run `scope-estimate` on the builder's file list before dispatching. `light` → Sonnet; `heavy` → Opus."

**Context-ceiling recovery protocol:**
- `agents/builder.md` gains a `## Context ceiling` section (≤8 lines within 300-line cap):
  "If you hit 40 tool uses or 80k context tokens before completing all ACs, emit
  status `DONE_WITH_CONCERNS` with concern `context_ceiling_reached: true` and list
  completed vs remaining ACs. Do NOT attempt recovery inline."
- `(removed v0.41)` gains a matching recovery rule:
  "On `context_ceiling_reached`: split remaining ACs into a new bounded task and
  dispatch a fresh builder. Do not recover inline."

**Cost-report model compliance signal:**
- `brief-me` `## Cost` section gains a `modelCompliance` line:
  "Sonnet dispatches: N/M (N% compliant)" derived from `modelMix` in the latest
  aggregate cost report
- Non-compliant threshold: if Sonnet% < 60% across last 5 slices, brief-me flags it

### Acceptance criteria
- AC-1: `node scripts/crew.mjs scope-estimate --files <list>` returns `{ tier: "light"|"standard"|"heavy", reason: string }`
- AC-2: `agents/builder.md` contains `context_ceiling_reached` and `DONE_WITH_CONCERNS` in a `## Context ceiling` section; file stays ≤300 lines
- AC-3: `(removed v0.41)` contains the ceiling recovery rule referencing `scope-estimate`; file stays ≤300 lines
- AC-4: `brief-me` output includes `modelCompliance` field in the cost section
- AC-5: `scope-estimate` has ≥6 unit tests covering light/standard/heavy tier boundaries and the eslint-disable escalation rule
- AC-6: `validate-agents.mjs` still passes (all agents ≤300 lines)

**Size:** standard | **autonomous_safe:** false (agent prompt edits require human review)

---

## Priority & Sequencing

| FEAT | Priority | autonomous_safe | Recommended order |
|------|----------|-----------------|-------------------|
| FEAT-C | P1 | true | 1st — pure tests, no risk, closes gap immediately |
| FEAT-A | P1 | true | 2nd — structural refactor, no behavior change |
| FEAT-B | P1 | false | 3rd — brief-me output change needs review |
| FEAT-D | P2 | false | 4th — agent prompt + new CLI command |

## Out of scope

- FEAT-029 (cost-hygiene default-on) — blocked on user A/B dogfood; tracked separately
- FEAT-037 (severity signals) — P2, tracked separately
- Routing table monthly review — governance task, not a FEAT
- e2e-smoke harness for prompt semantics — too costly to build now; FEAT-C structural tests are the pragmatic proxy
