---
name: journey-builder
prompt_id: journey-builder
version: 1.0.0
tier: workflow
description: Builds an ordered scenario_chain for ux-validation journey mode. Checks slice file for ## User Journey override; falls back to sorting ACs by verb category (nav → input → action → assertion). Returns [] when < 2 steps derivable. Reusable for future full-feature regression by feeding multiple slices' ACs.
triggers: ["ux-validation Step 2.5", "surface:ui regression", "end-to-end journey validation"]
owner: validator
last_reviewed: 2026-06-05
source_version: "0.10.0"
---

# Journey Builder

> **⚠️ DISABLED downstream** — the gstack `/qa` execution path this
> skill feeds is currently disabled (unstable cross-repo Playwright).
> See `skills/workflow/ux-validation/SKILL.md`. Building a
> `scenario_chain` is harmless, but it will not be executed until the
> upstream gate is re-enabled.

Sub-skill invoked by `ux-validation` at Step 2.5. Produces an ordered
`scenario_chain` for a single-slice end-to-end journey run via gstack `/qa`.

## When to use

Invoked by `ux-validation` when `surface:ui`, `concern:ux`, or
`concern:accessibility` is in the slice's FEAT tags AND the validator
wants journey-mode evidence instead of per-AC parallel checks.

Call directly for future regression testing by passing all slices' ACs
for a feature.

## Input

```js
buildJourney(acs, sliceContent)
```

- `acs` — `Array<{id: string, text: string}>` from `extractACs(sliceContent)`
- `sliceContent` — full raw text of the slice file

## Output

`ScenarioStep[]`:

```js
[{ step: 1, verb: "navigate", target: "/dashboard", expect: "no error / visible", ac_id: "AC-1" }]
```

Returns `[]` when fewer than 2 steps can be derived (caller falls back to per-AC mode).

## Override format — `## User Journey` in slice file

```markdown
## User Journey

1. navigate to /dashboard
2. click "New Project" button
3. fill form: name=Test → expect: form validates
4. click "Create" → expect: project card appears
```

Rules:
- Each line: `N. verb target` or `N. verb target → expect: <text>`
- `expect` optional; defaults to `no error / visible`
- Unparseable lines silently skipped
- Section ends at next `##` header

## Auto-derive ordering (no override)

ACs sorted by verb category: `navigation (0) → input (1) → interaction (2) → visibility (3)`
Ties broken by document order. Non-UI ACs excluded.

## Implementation

`scripts/lib/ux-validation/journey-builder.mjs` — `buildJourney(acs, sliceContent)`

## Done

Skill exits when `buildJourney` returns a value:
- `scenario_chain` with ≥ 2 steps → caller proceeds with journey mode
- `[]` → caller falls back to per-AC checks
