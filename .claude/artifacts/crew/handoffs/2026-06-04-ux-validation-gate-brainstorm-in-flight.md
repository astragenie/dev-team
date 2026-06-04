# Handoff — UX Validation Gate Brainstorm (in-flight)

- **Date:** 2026-06-04
- **From:** lead (brainstorming via superpowers:brainstorming skill)
- **To:** lead (next session)
- **State:** mid-brainstorm — Architecture + Components approved; Data flow section presented, awaiting "OK?" approval before Error handling section
- **Spec target path (not yet written):** `docs/superpowers/specs/2026-06-04-ux-validation-gate-design.md`

## Goal

Improve the validation gate for UX/React-badged FEAT items so that
Playwright runs automatically against acceptance criteria, evidence is
captured in a consistent shape, and the lead can pivot to `/crew:fix`
(or other targets per `docs/routing-table.md`) on failure.

## User Q&A captured (5 of N)

| # | Question | Answer |
|---|---|---|
| Q1 | Which FEAT tag combo triggers the gate? | Any of `surface:ui`, `concern:ux`, `concern:accessibility` (broadest UX net) |
| Q2 | Extend validator vs add qa-engineer agent? | **Extend validator + new `skills/workflow/ux-validation/SKILL.md`** (single agent, no boundary churn) |
| Q3 | Pivot contract shape on validation fail? | Raw evidence only (screenshot, console, network, diff vs baseline). Lead decides pivot per existing routing-table. No validator-side classification. |
| Q4 | Beyond Playwright AC pass/fail, which checks? | Accessibility scan (axe-core via gstack `/qa`) + Console error + network 404 scrape + Visual regression vs baseline. Skipped cross-viewport. |
| Q5 | Where do visual regression baselines live? | `tests/playwright/baselines/` in consumer repo. Native Playwright `toHaveScreenshot()` mechanism. Updates via `npx playwright test --update-snapshots`. Reviewed in PR like any code change. |

## Approach selected

**Approach A** — single workflow-tier skill at
`skills/workflow/ux-validation/SKILL.md`. Validator auto-loads on tag
match. Dispatches gstack `/qa` for Playwright execution. Collects
evidence in 4-check shape. Writes validation-result via existing
`crew.mjs write-validation-result` CLI. Marks badge
`validation_passed` or `validation_failed`. Lead reads result and
routes pivot per existing routing-table rows.

Approaches B (workflow + domain skill split) and C (inline validator
prompt extension) were considered and rejected — A is smallest blast
radius and fits skill taxonomy.

## Sections presented so far

### Architecture (APPROVED)

Flow chart already drafted in conversation transcript:

```
Slice frontmatter tag in {surface:ui, concern:ux, concern:accessibility}
  -> Lead routes per FEAT tag-to-agent mapping
  -> mark-badge validation_expected
  -> crew:validator subagent auto-loads workflow/ux-validation/
  -> Skill: extract ACs -> translate to scenarios -> dispatch /qa
     -> collect 4-check evidence -> write validation-result
  -> Verdict: passed -> badge validation_passed -> continue
     Verdict: failed -> badge validation_failed
                     -> lead reads result + routes pivot per
                        docs/routing-table.md (crew:fix / /investigate
                        / /cso / gstack:/benchmark)
```

Tag auto-load rule to add to `agents/validator.md::Skills you consult`:

```
- surface:ui | concern:ux | concern:accessibility -> skills/workflow/ux-validation/
```

No new rows in `docs/routing-table.md` — lead pivot routing already
covered by existing rows (84: Web UI behavior changed -> validator
via gstack /qa; 39: reviewer feedback; 95: bug root cause unclear).

### Components (APPROVED)

Skill file: `skills/workflow/ux-validation/SKILL.md` with frontmatter
`name: ux-validation`, `tier: workflow`, `triggers: ["surface:ui",
"concern:ux", "concern:accessibility", "validation phase UI"]`.

Body sections (≤200 lines):
1. When to invoke (tag match + validation phase).
2. AC extractor (parse slice `## Acceptance criteria` block).
3. Scenario translator (verb-keyword classification → /qa scenario string;
   `non_ui_ac` flag for ACs without UI verbs).
4. `/qa` adapter (CLI invocation with `--scenarios`, `--accessibility-scan`,
   `--capture-console`, `--capture-network`, `--visual-baseline
   tests/playwright/baselines/`).
5. Evidence collector (4-check payload shape — ac_results, a11y, console,
   network, visual).
6. Verdict + artifact (failed | passed_with_notes | passed thresholds).
7. Mark badge (`validation_passed` | `validation_failed`).
8. Skip conditions (`playwright_not_configured` soft skip).
9. Pivot signal (raw evidence only per Q3 — no pivot recommendation).

### Data flow (PRESENTED — awaiting approval)

Full transcript-resident sequence:

- **Trigger:** validator reads slice `tags:`; load skill if intersection
  with `{surface:ui, concern:ux, concern:accessibility}` non-empty.
- **AC extract:** grep `## Acceptance criteria` → parse `- [ ] AC-N:
  <text>`.
- **Scenario translate:** verb classification → `{interaction,
  visibility, navigation, input, non_ui_ac}` → emit `<verb> <target> |
  expect <outcome>` strings.
- **/qa invoke:** CLI call with discovered URL (from
  `playwright.config.*` or `package.json` scripts) + scenarios JSON +
  4-check flags + output path to
  `.claude/artifacts/crew/validations/<stamp>-ux-evidence.json`.
- **Evidence payload:** strict JSON shape — `ac_results[]`, `a11y
  {violations[], passes_count}`, `console {errors[], warnings[]}`,
  `network {failures[]}`, `visual {diffs[]}`.
- **Verdict computation:**
  - `failed`: any AC fail OR a11y severity in `{serious, critical}` OR
    console.errors non-empty OR visual diff.pct > tolerance.
  - `passed_with_notes`: a11y `{minor, moderate}` OR console.warnings
    OR network.failures.
  - `passed`: none of above.
- **Artifact:** `crew.mjs write-validation-result` with `--evidence
  <json path>`. No schema change to existing CLI.
- **Badge:** `crew.mjs mark-badge --badge validation_passed |
  validation_failed`.
- **Lead pivot read:** lead reads validation-result + evidence JSON,
  pivots per existing routing-table rows. Validator does NOT recommend
  pivot target (per Q3).
- **Skip path:** detect missing playwright config → soft skip,
  `validation_skipped --note playwright_not_configured`.

## Sections queued (not yet presented)

1. **Error handling / pivot contract** — raw evidence shape detail
   (per Q3), badge writing semantics, lead's pivot decision tree
   referenced inline (mapping evidence categories to routing-table
   rows for crew:fix / /investigate / /cso / /benchmark).
2. **Testing** — how to test the skill itself. Likely a smoke FEAT
   tagged `surface:ui` that the skill exercises end-to-end against a
   fixture HTML page served from a local Python `http.server`. Also
   unit tests for the AC extractor + scenario translator.

## What's done after approval flow

5. Write spec to
   `docs/superpowers/specs/2026-06-04-ux-validation-gate-design.md`.
6. Spec self-review (placeholder scan, internal consistency,
   ambiguity check).
7. User reviews written spec.
8. Invoke `superpowers:writing-plans` to produce implementation plan.

## Open dependencies / blockers

- **gstack `/qa` skill is the execution engine.** Skill behavior
  depends on `/qa` accepting AC scenarios and surfacing 4-check
  output (Playwright pass/fail + axe + console+404 + visual diff).
  Need to confirm `/qa`'s actual CLI surface during the Components
  section. If `/qa` does not natively expose visual-diff or axe
  results in a stable payload, the skill needs to invoke them
  separately or the scope shrinks.
- **Validator turn budget.** Today: sonnet, low effort, maxTurns 20.
  4-check load + AC extraction + scenario translation + evidence
  write may bump the run past 20 turns. May need to raise maxTurns
  or split into a sub-dispatch.
- **Consumer-repo Playwright config.** Skill assumes the consumer
  repo has Playwright installed and a dev server URL discoverable
  via convention (e.g., `playwright.config.ts` or `package.json`
  scripts). Need a fallback when the convention is absent — likely
  surface as a soft skip with note `playwright_not_configured`.

## Risks / open questions

- Visual regression baseline flake (font rendering, animation
  timing, OS pixel-snap differences) may produce false failures.
  Mitigation: tolerance threshold + animation freeze convention in
  `/qa`. Validate during Components section.
- Lead pivot routing trusts validator's evidence shape. If evidence
  is noisy, lead pivots wrong target. Address in Error handling
  section by tightening the validation-result schema.
- Skill taxonomy says `workflow/` skills are invoked per phase. This
  one is phase (validation) + tag-conditional. Confirm with
  architecture doc that conditional-load is in policy or note as
  precedent.

## TodoWrite state

Task #5 ("Present design in sections, get approval per section") is
`in_progress`. Tasks #6-#9 (write spec, self-review, user review,
transition to writing-plans) are `pending`. Tasks #1-#4 are
`completed`.

## Next handoff suggestion

Resume in a fresh session by:

1. Read this handoff first.
2. Re-confirm Q1-Q4 answers with the user (or skip if user signals
   "continue from where we left off").
3. Re-present the Architecture section diagram for re-approval (it
   may have rolled out of context) — or skip if user explicitly
   approves it.
4. Move to the Components section, surface the visual baseline
   storage choice via AskUserQuestion, then continue down the queue.
