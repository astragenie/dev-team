---
title: Journey-builder sub-skill for ux-validation
date: 2026-06-05
status: approved
author: lead
related_feats: []
---

# Journey-builder sub-skill for ux-validation

## Goal

Extend the existing `ux-validation` workflow skill to validate user-visible UI changes
end-to-end via an ordered journey — not just per-AC parallel checks. Journey scope is
bounded to the current slice's changes. Full-feature regression is a deferred phase.

## Architecture

Three new/changed artefacts:

### New: `skills/workflow/journey-builder/SKILL.md`

- **Tier:** `workflow`
- **Owner:** invoked by `ux-validation` as sub-step; also callable standalone for future regression
- **Input:** extracted AC list (`{id, text, category}[]`) + raw slice file content
- **Output:** ordered `scenario_chain[]` — `{step, verb, target, expect, ac_id}`

### New: `scripts/lib/ux-validation/journey-builder.mjs`

Single exported function:

```js
export function buildJourney(acs, sliceContent) → scenario_chain[]
```

Logic:
1. Scan `sliceContent` for `## User Journey` section.
2. If found → parse explicit steps (see Journey format below). Return result.
3. If absent → auto-derive from `acs` array using ordering rules (see below). Return result.
4. If result length < 2 → return `[]` (caller falls back to per-AC checks).

### Changed: `skills/workflow/ux-validation/SKILL.md`

Add **Step 2.5 — Build journey** between existing Step 2 (classify scenarios) and Step 3
(discover Playwright URL):

```
2.5 Build journey. Call buildJourney(acs, sliceContent). If result is [] (too short or
    no derivable flow), skip journey mode — run existing per-AC checks and exit normally.
    Otherwise store as scenario_chain and continue to Step 3.
```

Step 4 updated: pass `scenario_chain` to `buildQaInvocation` when present.

### Changed: `scripts/lib/ux-validation/qa-adapter.mjs`

`buildQaInvocation` gains optional `scenario_chain` param:
- When present: builds single chained multi-step `/qa` invocation
- When absent: existing per-AC behavior unchanged (backward compat)

---

## Journey format

### Explicit override (`## User Journey` in slice file)

```markdown
## User Journey

1. navigate to /dashboard
2. click "New Project" button
3. fill form: name="Test", type="web"
4. click "Create" → expect: project card appears in list
5. click project card → expect: project detail page loads
```

Parser rules:
- Each line: `N. verb target` or `N. verb target → expect: <text>`
- `expect` is optional; defaults to `"no error / visible"`
- Unparseable lines: skip + log as `parse_warning` in evidence, continue

### Auto-derive ordering rules (no explicit override)

ACs are sorted into steps using this priority:

1. **Navigation** — AC text contains `navigate`, `visit`, `open`, `go to`
2. **Input** — AC text contains `fill`, `type`, `upload`, `select`, `enter`
3. **Action** — AC text contains `click`, `submit`, `save`, `send`, `press`
4. **Assertion** — AC text contains `see`, `expect`, `verify`, `shows`, `displays`

Ties within a category: document order (AC-1 before AC-2 etc.).

---

## `scenario_chain` shape

```js
[
  { step: 1, verb: "navigate", target: "/dashboard",   expect: "page loads",    ac_id: "AC-1" },
  { step: 2, verb: "click",    target: "New Project",  expect: "modal opens",   ac_id: "AC-2" },
  { step: 3, verb: "fill",     target: "name=Test",    expect: "no error",      ac_id: "AC-3" },
  { step: 4, verb: "click",    target: "Create",       expect: "card appears",  ac_id: "AC-4" },
]
```

`ac_id` links per-step evidence back to the original AC in the validation-result artifact.

---

## Error handling + skip cases

| Condition | Action |
|---|---|
| No `## User Journey` + AC list empty | `validation_skipped --note no_journey_derivable` |
| All ACs classify as `non_ui_ac` | skip journey; fall back to existing per-AC checks |
| `buildJourney` returns `[]` (< 2 steps) | `passed_with_notes --note "journey too short; ran per-AC instead"` |
| `/qa` fails mid-chain at step N | record per-step pass/fail; continue remaining steps; mark `failed --note "failed at step N: <verb target>"` |
| Unparseable `## User Journey` lines | skip line; log `parse_warning` in evidence; continue |
| gstack `/qa` not available | `validation_skipped --note gstack_qa_not_available` |

Mid-chain failure behaviour: `/qa` does NOT abort on first step error. Evidence JSON records
`{step, status: pass|fail, screenshot, error?}` per step. Validation-result artifact lists
which steps passed and which failed.

---

## Tests

New file: `tests/ux-validation/journey-builder.test.mjs`

| # | Scenario | Expected |
|---|---|---|
| 1 | Explicit `## User Journey` present | Returns parsed `scenario_chain` in document order |
| 2 | Override takes precedence over ACs | Auto-derive skipped; explicit steps returned |
| 3 | Navigation AC sorts before action AC | Step 1 = navigate, step 2 = click |
| 4 | Auto-derive: tie-breaking by document order | AC-1 before AC-2 within same verb category |
| 5 | Empty AC list, no override | Returns `[]` |
| 6 | Unparseable journey line | Skipped; valid lines still parsed |
| 7 | All ACs are `non_ui_ac` | Returns `[]`; caller falls back to per-AC |
| 8 | Override with optional `expect` omitted | `expect` defaults to `"no error / visible"` |

Existing `tests/ux-validation/` suite unchanged — no regressions.

---

## Future: regression phase

`journey-builder` skill is designed to be called standalone. When the regression phase
lands, the orchestrator feeds it all slices' ACs for a feature and receives a merged
`scenario_chain` covering the full user journey. No changes to `journey-builder` required —
only the caller changes.

---

## Acceptance criteria

- [ ] AC-1: `skills/workflow/journey-builder/SKILL.md` exists with correct tier, triggers, input/output contract
- [ ] AC-2: `scripts/lib/ux-validation/journey-builder.mjs` exports `buildJourney(acs, sliceContent)`
- [ ] AC-3: Explicit `## User Journey` override parsed correctly per format spec
- [ ] AC-4: Auto-derive orders ACs by nav → input → action → assertion, ties by document order
- [ ] AC-5: `buildJourney` returns `[]` when < 2 steps derivable
- [ ] AC-6: `ux-validation` SKILL.md has Step 2.5 calling `journey-builder`
- [ ] AC-7: `qa-adapter.mjs` `buildQaInvocation` accepts `scenario_chain`; backward compat preserved
- [ ] AC-8: Mid-chain `/qa` failure records per-step evidence, does not abort
- [ ] AC-9: All 8 `journey-builder.test.mjs` tests pass
- [ ] AC-10: `node --test`, `npm run lint`, `npm run format:check`, `validate-skills.mjs` all clean
