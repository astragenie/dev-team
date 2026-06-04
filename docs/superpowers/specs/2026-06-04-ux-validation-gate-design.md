---
title: UX Validation Gate — Design Spec
date: 2026-06-04
status: draft
owner: lead
type: design
target_skill: skills/workflow/ux-validation/SKILL.md
linked_handoff: .claude/artifacts/crew/handoffs/2026-06-04-ux-validation-gate-brainstorm-in-flight.md
---

# UX Validation Gate — Design Spec

## Problem

The validator phase today references gstack `/qa` for browser-rendered
behavior via `docs/routing-table.md` row 84 ("Web UI behavior changed").
Routing is reactive: it depends on the lead noticing that a slice
changed UI. UX/React-bearing FEATs can therefore reach merge without
real browser validation when the lead misses the cue.

We need an auto-triggered, structured UX validation gate that:

- Fires automatically on slices tagged for UX work
- Runs Playwright against acceptance criteria
- Collects accessibility, console, network, and visual-regression
  evidence in a single pass
- Returns raw evidence so the lead can pivot to the right next step
  (`/crew:fix`, `/investigate`, `/cso`, `gstack:/benchmark`,
  escalation) per the existing routing-table

## Trigger

The gate fires when the slice's FEAT frontmatter `tags:` array
intersects with any of:

- `surface:ui`
- `concern:ux`
- `concern:accessibility`

Tag definitions live in `docs/standards/feat-tag-schema.md`. No new
tag values are introduced.

Validator detects the trigger at slice start by reading
`slice.frontmatter.tags`. When the intersection is non-empty, the
validator auto-loads `skills/workflow/ux-validation/SKILL.md`. When
empty, the existing validator flow runs unchanged.

## Approach

**Single workflow-tier skill** at `skills/workflow/ux-validation/`.
Validator stays read-only (no new agent, no expanded tool grant).
Skill encodes the gate procedure: AC extraction, scenario
translation, gstack `/qa` dispatch, evidence collection, verdict
computation, artifact write, badge mark.

Two alternatives were considered and rejected:

- **B — workflow + domain skill split.** Cleaner reuse but doubles
  skill surface for marginal benefit while consumer-side Playwright
  patterns are immature.
- **C — inline validator prompt extension.** Cheapest install but
  violates the 300-line agent prompt cap and buries logic in agent
  prose.

## Architecture

```
Slice frontmatter tag ∈ {surface:ui, concern:ux, concern:accessibility}
    │
    ▼
Lead routes per FEAT tag-to-agent mapping
    │
    │ mark-badge validation_expected
    ▼
crew:validator subagent
    │
    │ auto-load skills/workflow/ux-validation/
    ▼
skills/workflow/ux-validation/SKILL.md
    1. extract ACs from slice file
    2. translate each AC into a /qa scenario
    3. dispatch gstack:/qa with 4-check flags
    4. collect evidence into ux-evidence.json
    5. compute verdict
    6. write validation-result via crew.mjs
    7. mark-badge validation_passed | validation_failed
    │
    ▼
Verdict
    │
    ├── passed             → continue
    └── failed             → lead reads result + raw evidence
                             pivots per docs/routing-table.md rows
                             (84 → /crew:fix, 95 → /investigate, etc.)
```

The validator agent gets one new entry in its `Skills you consult`
block:

```
- surface:ui | concern:ux | concern:accessibility →
  skills/workflow/ux-validation/
```

No new rows in `docs/routing-table.md`. Lead pivot routing already
covered by rows 84 (Web UI behavior changed), 95 (bug root cause
unclear), 39 (reviewer feedback), 45 (security-sensitive).

## Components

### Skill file

`skills/workflow/ux-validation/SKILL.md` with frontmatter:

```yaml
---
name: ux-validation
tier: workflow
description: Auto-triggered by crew:validator when slice tags include surface:ui, concern:ux, or concern:accessibility. Drives Playwright via gstack:/qa, axe-core accessibility scan, console+404 scrape, and visual regression diff. Returns raw evidence; lead pivots per routing-table.
triggers: ["surface:ui", "concern:ux", "concern:accessibility", "validation phase UI"]
---
```

Body sections (≤200 lines per quality bar):

1. **When to invoke** — tag-match condition and phase (validation
   only).
2. **AC extractor** — read slice file `## Acceptance criteria` block;
   parse `- [ ] AC-N: <text>` lines; return `[{id, text}]`.
3. **Scenario translator** — verb-keyword classification:
   - `{click, tap, press, submit}` → `interaction`
   - `{see, render, display, show}` → `visibility`
   - `{navigate, go to, route}` → `navigation`
   - `{type, fill, enter}` → `input`
   - none of above → `non_ui_ac` (skip from gate, note in evidence)
4. **`/qa` adapter** — CLI invocation with:
   - `--scenarios <json>`
   - `--accessibility-scan`
   - `--capture-console`
   - `--capture-network`
   - `--visual-baseline tests/playwright/baselines/`
   - `--output <artifacts path>`

   `/qa` (running as a subprocess) writes the evidence JSON to the
   `--output` path. The validator never writes the file directly —
   it only references the path in the subsequent
   `write-validation-result` call. This preserves the validator's
   read-only contract (`disallowedTools: Write, Edit` in
   `agents/validator.md`).
5. **Evidence collector** — assemble 4-check payload (schema below).
6. **Verdict + artifact** — apply verdict thresholds; write
   validation-result via `crew.mjs write-validation-result`.
7. **Mark badge** — `validation_passed` or `validation_failed`.
8. **Skip conditions** — `playwright_not_configured` soft skip with
   note.
9. **Pivot signal** — raw evidence only. No pivot recommendation.

### Pure helpers (extracted for unit testing)

Live under `scripts/lib/ux-validation/`:

- `extractACs(sliceContent: string): {id: string, text: string}[]`
- `classifyScenario(acText: string): "interaction" | "visibility" | "navigation" | "input" | "non_ui_ac"`
- `computeVerdict(evidence: EvidencePayload): "passed" | "passed_with_notes" | "failed"`
- `discoverPlaywrightConfig(repoPath: string): {url: string} | null`

### Visual regression baselines

Baselines live in **consumer repo** at
`tests/playwright/baselines/`. The gate uses Playwright's native
`toHaveScreenshot()` mechanism. Baselines are reviewed in PR like
any code change. Updates flow through
`npx playwright test --update-snapshots`. Crew owns no baseline
storage; the gate only reads + diffs against what's already there.

## Data flow

### Trigger detection

```
1. Read slice frontmatter `tags:` array
2. If tags ∩ {surface:ui, concern:ux, concern:accessibility} ≠ ∅
   → load skills/workflow/ux-validation/SKILL.md
3. Else → standard validator flow (current behavior unchanged)
```

### AC extraction

```
slice file → grep `## Acceptance criteria` block
           → parse `- [ ] AC-N: <text>` lines
           → output: [{id: "AC-1", text: "..."}]
```

### Scenario translation

```
for each AC:
  classify text by verb set (see Components/Scenario translator)
  emit /qa scenario string: `<verb> <target> | expect <outcome>`
```

### /qa invocation

```bash
gstack:/qa \
  --url <discovered from playwright.config.* or package.json scripts> \
  --scenarios "<json array>" \
  --accessibility-scan \
  --capture-console \
  --capture-network \
  --visual-baseline tests/playwright/baselines/ \
  --output .claude/artifacts/crew/validations/<stamp>-ux-evidence.json
```

### Evidence payload

```json
{
  "url": "http://localhost:3000",
  "ac_results": [
    {
      "id": "AC-1",
      "status": "pass",
      "evidence": { "screenshot": "...", "console_excerpt": "" }
    },
    {
      "id": "AC-2",
      "status": "fail",
      "evidence": {
        "screenshot": "...",
        "error": "selector not found: button[type=submit]"
      }
    }
  ],
  "a11y": {
    "violations": [
      { "rule": "color-contrast", "nodes": ["..."], "severity": "serious" }
    ],
    "passes_count": 47
  },
  "console": {
    "errors": ["TypeError: ..."],
    "warnings": ["React: ..."]
  },
  "network": {
    "failures": [{ "url": "/static/missing.png", "status": 404 }]
  },
  "visual": {
    "diffs": [
      {
        "route": "/login",
        "pct": 2.4,
        "tolerance": 0.5,
        "baseline": "...",
        "current": "..."
      }
    ]
  }
}
```

### Verdict computation

```
failed if ANY of:
  - any AC status == "fail"
  - any a11y violation severity in {serious, critical}
  - console.errors.length > 0
  - any visual diff.pct > diff.tolerance

passed_with_notes if ANY of:
  - a11y violations severity in {minor, moderate}
  - console.warnings.length > 0
  - network.failures.length > 0

passed otherwise
```

### Artifact write

```bash
crew.mjs write-validation-result \
  --decision <passed|passed_with_notes|failed> \
  --environment local \
  --evidence <relative path to ux-evidence.json> \
  --summary "<one-line verdict>" \
  --risks <residual> \
  --next <follow-up or "lead routes per docs/routing-table.md">
```

No schema change to existing `write-validation-result` CLI.

### Badge mark

```bash
crew.mjs mark-badge --badge validation_passed | validation_failed
```

### Lead pivot read

Lead reads the validation-result `.md` plus the linked
`ux-evidence.json` and pivots per the existing routing-table.
Validator does NOT recommend a pivot target.

## Error handling

### Validation-result body shape (no interpretation)

The `.md` body contains only:

```
## Verdict
<passed | passed_with_notes | failed>

## Summary
<one-line>

## Evidence
- ux-evidence.json: <relative path>
- screenshots: <count>
- a11y violations: <count by severity>
- console errors: <count>
- network failures: <count>
- visual diffs over tolerance: <count>

## Risks
<from --risks flag>

## Next
<from --next flag — typically "lead routes per docs/routing-table.md" on fail>
```

### Badge writing rules

| Outcome | Badge | Note |
|---|---|---|
| `passed` | `validation_passed` | — |
| `passed_with_notes` | `validation_passed` | `<count> minor issues; see evidence` |
| `failed` | `validation_failed` | `<count> AC fail; <count> a11y serious; <count> console err; <count> visual diff` |
| skip (no playwright) | `validation_skipped` | `playwright_not_configured` |
| skill error (gate crashed) | `validation_skipped` | `ux-gate skill error: <message>` |

### Lead pivot decision tree (advisory, lives in routing-table)

| Failure dominant category | Pivot |
|---|---|
| `ac_results[*].status == fail` | routing-table row 84 → `/crew:fix` |
| `a11y.violations[*]` serious/critical | row 84 + co-cite `concern:accessibility` skill set |
| `console.errors[*]` runtime exception | row 95 → `gstack:/investigate` |
| `visual.diffs[*]` over tolerance | row 84 → `/crew:fix` + frontend-advisory |
| `network.failures[*]` 404 on asset | row 84 → `/crew:fix` (build/deploy issue) |
| Multiple categories simultaneously | lead splits per Pre-dispatch decomposition rule |

### Gate self-failure modes

1. `/qa` skill not installed → `validation_skipped --note
   "gstack:/qa not available — install gstack plugin"`.
2. `/qa` timeout (default 60s) → `validation_failed --note
   "qa_timeout"`. Lead pivots to `/investigate`.
3. AC extractor finds 0 ACs in slice file → `validation_skipped
   --note "no_acceptance_criteria_in_slice"`. Authoring bug; lead
   routes to slice author.
4. Baseline missing for a route → /qa generates baseline + writes
   `passed_with_notes --note "baseline_created_for <route>"`.
   Reviewer commits baseline alongside slice code.

### Circuit breaker

Out of scope for this skill. Loop's autonomous mode already has
`priorAttempts` via `/loop:pr-fix`. Per-slice retry cap on UX-gate
failures is a follow-up FEAT in the loop repo, not in this skill's
initial scope.

## Testing

### Unit tests

`tests/ux-validation.test.mjs` (Node `--test` runner per repo
convention).

| Function | Test surface |
|---|---|
| `extractACs(sliceContent)` | empty body → `[]`; well-formed → `[{id, text}]`; missing header → `[]`; nested checkboxes ignored |
| `classifyScenario(acText)` | each verb set → expected category; ambiguous → `non_ui_ac`; typos → `non_ui_ac` fallback |
| `computeVerdict(evidence)` | each fail-threshold row → expected verdict; empty → `passed`; boundary cases on a11y severity, console errors, visual tolerance |
| `discoverPlaywrightConfig(repoPath)` | `playwright.config.ts` → URL; `package.json` scripts → URL; neither → `null` |

### Integration test

`tests/ux-validation-integration.test.mjs`. `/qa` invocation mocked
via test-injection seam (same pattern as `dispatchFn` / `drainFn` in
loop's slice-linker). Skill receives a fake `/qa` returning canned
evidence. Asserts:

- Evidence collector parses payload correctly
- Verdict matches expected threshold
- Validation-result artifact written with expected fields
- Badge marked correctly

### End-to-end smoke

`scripts/e2e-smoke-ux.mjs` (or extend `scripts/e2e-smoke.mjs`):

1. Spin up `python -m http.server 8765` against
   `tests/fixtures/ux-gate-smoke/`.
2. Fixture `index.html`: one button, one image (404 by design), one
   a11y violation (image without `alt`), one `console.warn`.
3. `FEAT-SMOKE.md` tagged `surface:ui, concern:ux,
   concern:accessibility` with 2 ACs (AC-1 button click PASS;
   AC-2 image displays — FAIL via 404).
4. Dispatch crew:validator with fixture slice path.
5. Assert verdict == `failed` and all 4 evidence categories
   populated.
6. Tear down http.server.

Runs in CI via existing `npm run e2e:smoke` job.

### Skill quality bar

`scripts/validate-skills.mjs` (existing) enforces name + tier +
description + tier-in-enum + ≤200 lines. No new CI gate needed.

### Smoke fixture's own visual baseline

`tests/fixtures/ux-gate-smoke/baselines/index.png` committed.
Subsequent smoke runs assert pixel match — catches accidental skill
regression that changes evidence ordering or capture behavior.

## Open dependencies

- **gstack `/qa` CLI surface.** The skill assumes `/qa` accepts
  `--scenarios`, `--accessibility-scan`, `--capture-console`,
  `--capture-network`, `--visual-baseline`, `--output` flags. If
  `/qa`'s actual surface differs, the adapter section needs revision
  during implementation. Verify before writing the implementation
  plan.
- **Validator turn budget.** Today: sonnet, low effort, maxTurns 20.
  Four-check load plus AC extraction plus scenario translation plus
  evidence write may exceed 20 turns. If observed, raise the cap to
  30 in `agents/validator.md` frontmatter or split into a
  sub-dispatch.
- **Consumer-repo Playwright config discovery.** The skill assumes
  `playwright.config.{ts,js,mts}` OR a `playwright` script in
  `package.json` is present. When absent, the soft-skip path fires.
  No additional discovery heuristics in v1.

## Risks

- Visual regression baseline flake (font rendering, animation
  timing, OS pixel-snap differences) may produce false failures.
  Mitigation: Playwright tolerance threshold plus animation-freeze
  convention in `/qa`. Tune during smoke implementation.
- Lead pivot routing trusts the validator's evidence shape. If
  evidence is noisy, the lead pivots to the wrong target.
  Mitigation: strict JSON schema in `ux-evidence.json` plus the
  Error handling section's dominant-category mapping table.
- Skill taxonomy says `workflow/` skills are invoked per phase. This
  skill is phase (validation) plus tag-conditional. Confirm with
  `docs/architecture/architecture.md` that conditional-load is in
  policy. If not, note as taxonomy precedent in the implementation
  plan.

## Out of scope

- Cross-viewport responsive check (skipped per Q4).
- Validator-side classification or pivot recommendation (rejected
  per Q3).
- Per-slice retry circuit breaker (deferred to follow-up FEAT in
  loop repo).
- Visual baseline storage in crew artifact tree (rejected per Q5 —
  baselines live in consumer repo).
- A separate `qa-engineer` subagent (rejected per Q2).
