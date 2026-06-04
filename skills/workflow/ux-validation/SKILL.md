---
name: ux-validation
tier: workflow
description: Auto-triggered by crew:validator when slice tags include surface:ui, concern:ux, or concern:accessibility. Drives Playwright via gstack:/qa, axe-core accessibility scan, console+404 scrape, and visual regression diff. Returns raw evidence; lead pivots per routing-table.
triggers: ["surface:ui", "concern:ux", "concern:accessibility", "validation phase UI"]
owner: validator
last_reviewed: 2026-06-04
---

# UX Validation Gate

Use when crew:validator is dispatched on a slice whose FEAT
frontmatter `tags:` array intersects with `{surface:ui, concern:ux,
concern:accessibility}`. Otherwise the standard validator flow
applies — this skill is silent.

The skill orchestrates a single Playwright run via gstack `/qa` and
returns raw evidence in four check categories. It does not interpret
results or recommend a pivot target. The lead reads the validation
result + `ux-evidence.json` and pivots per
`docs/routing-table.md` rows 84, 95, 39, 45.

## When to Use

Detect at validator slice-start:

1. Read `tags:` from the slice's linked FEAT frontmatter.
2. If the intersection with `{surface:ui, concern:ux,
   concern:accessibility}` is empty → exit; standard validator flow
   runs.
3. Otherwise → continue with this skill.

## Procedure

1. **Extract acceptance criteria.** Call
   `extractACs(sliceFileContent)` from
   `scripts/lib/ux-validation/`. If the returned array is empty,
   write `validation_skipped --note no_acceptance_criteria_in_slice`
   and exit. Authoring bug — lead routes to slice author.

2. **Classify + translate scenarios.** For each AC, call
   `classifyScenario(ac.text)`. ACs returning `non_ui_ac` are kept
   for evidence but excluded from `/qa` scenarios. Build the scenario
   list as `{id, verb, target, expect}` shapes (derive `target` /
   `expect` from AC text via the verb position; when ambiguous,
   pass the raw AC text as both `target` and `expect`).

3. **Discover the consumer-repo Playwright URL.** Call
   `discoverPlaywrightConfig(repoPath)`. If `null`, write
   `validation_skipped --note playwright_not_configured` and exit.
   Soft skip — no failure.

4. **Build + run `/qa` invocation.** Call
   `buildQaInvocation({url, scenarios, baselineDir, outputPath})`
   with:
   - `url`: from step 3
   - `scenarios`: from step 2 (UI ACs only)
   - `baselineDir`: `tests/playwright/baselines/`
   - `outputPath`:
     `.claude/artifacts/crew/validations/<timestamp>-ux-evidence.json`

   Execute via Bash. `/qa` writes the evidence JSON to `outputPath`.

5. **Compute verdict.** Read the evidence JSON. Call
   `computeVerdict(evidence)` from
   `scripts/lib/ux-validation/`. Result is one of `passed`,
   `passed_with_notes`, `failed`.

6. **Write validation-result.** Call:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-result \
     --repo "$PWD" \
     --title "UX validation gate: <slice-id>" \
     --decision <verdict> \
     --environment local \
     --goal "<from slice objective>" \
     --summary "<one-line>" \
     --evidence "<relative path to ux-evidence.json>" \
     --files "<changed UI files from slice>" \
     --risks "<residual or none>" \
     --next "lead routes per docs/routing-table.md"
   ```

   The body should NOT interpret results. List counts only:
   screenshots captured, a11y violations by severity, console
   errors, network failures, visual diffs over tolerance.

7. **Mark badge.**
   - `passed` or `passed_with_notes` → `mark-badge --badge
     validation_passed` (add `--note "<count> minor issues"` for
     notes case).
   - `failed` → `mark-badge --badge validation_failed --note
     "<short failure summary>"`.

8. **Return to lead.** Hand back the validation-result artifact path
   + 1-sentence headline. Lead reads + decides pivot.

## Skip + error cases

| Condition | Action |
|---|---|
| Tag intersection empty | Exit silently; standard validator runs |
| AC extractor returns `[]` | `validation_skipped --note no_acceptance_criteria_in_slice` |
| Playwright config not discovered | `validation_skipped --note playwright_not_configured` |
| `/qa` skill not available | `validation_skipped --note "gstack:/qa not available — install gstack plugin"` |
| `/qa` exits non-zero | `validation_failed --note qa_timeout` (or actual error) |
| `/qa` writes no output file | `validation_failed --note qa_no_output` |

## Pivot signal (lead reads, NOT skill)

The skill returns raw evidence. Pivot decision lives in
`docs/routing-table.md`. Per-category mapping:

| Failure category | Pivot |
|---|---|
| `ac_results[*].status == fail` | row 84 → `/crew:fix` |
| `a11y.violations[*]` serious/critical | row 84 + `concern:accessibility` skill set |
| `console.errors[*]` | row 95 → `gstack:/investigate` |
| `visual.diffs[*]` over tolerance | row 84 → `/crew:fix` + frontend-advisory |
| `network.failures[*]` | row 84 → `/crew:fix` |
| Multiple categories | lead splits per Pre-dispatch decomposition rule |

## Done

Skill exits successfully when one of these terminal states is reached:

- **passed:** validation-result written with `decision: passed`, badge `validation_passed` marked, control returned to lead.
- **passed_with_notes:** validation-result written with `decision: passed_with_notes`, badge `validation_passed` marked with note count, control returned to lead.
- **failed:** validation-result written with `decision: failed`, badge `validation_failed` marked with short failure summary, control returned to lead (who pivots per the routing-table mapping above).
- **skipped:** any condition from the Skip + error cases table — badge `validation_skipped` marked with the documented note, control returned to lead.

The skill never amends prior validation artifacts and never recommends a pivot target. Done means evidence + verdict + badge are all written and the lead has the artifact path.
