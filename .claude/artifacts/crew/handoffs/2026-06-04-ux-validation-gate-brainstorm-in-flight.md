# Handoff — UX Validation Gate Brainstorm (in-flight)

- **Date:** 2026-06-04
- **From:** lead (brainstorming via superpowers:brainstorming skill)
- **To:** lead (next session)
- **State:** mid-brainstorm — Architecture section presented, awaiting user "OK so far?" approval before Components section
- **Spec target path (not yet written):** `docs/superpowers/specs/2026-06-04-ux-validation-gate-design.md`

## Goal

Improve the validation gate for UX/React-badged FEAT items so that
Playwright runs automatically against acceptance criteria, evidence is
captured in a consistent shape, and the lead can pivot to `/crew:fix`
(or other targets per `docs/routing-table.md`) on failure.

## User Q&A captured (4 of N)

| # | Question | Answer |
|---|---|---|
| Q1 | Which FEAT tag combo triggers the gate? | Any of `surface:ui`, `concern:ux`, `concern:accessibility` (broadest UX net) |
| Q2 | Extend validator vs add qa-engineer agent? | **Extend validator + new `skills/workflow/ux-validation/SKILL.md`** (single agent, no boundary churn) |
| Q3 | Pivot contract shape on validation fail? | Raw evidence only (screenshot, console, network, diff vs baseline). Lead decides pivot per existing routing-table. No validator-side classification. |
| Q4 | Beyond Playwright AC pass/fail, which checks? | Accessibility scan (axe-core via gstack `/qa`) + Console error + network 404 scrape + Visual regression vs baseline. Skipped cross-viewport. |

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

### Architecture (presented, awaiting approval)

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

## Sections queued (not yet presented)

1. **Components** — skill structure (`SKILL.md` body shape), AC
   extractor, /qa adapter, evidence collector. **Open question for
   user:** visual regression baseline storage strategy. Three options
   noted in lead's pre-section thinking:
   - `.claude/artifacts/crew/validations/baselines/<slice-id>/...` —
     per-slice, fresh each slice. Catches no regressions across slices.
   - `.claude/artifacts/crew/baselines/<route>.png` — persistent
     per-route, crew-managed.
   - `tests/playwright/baselines/<scenario>.png` — consumer-repo
     owned, uses Playwright's native baseline mechanism. Recommended.
2. **Data flow** — slice frontmatter -> AC extract -> scenario
   translation -> /qa CLI invocation shape -> evidence collection
   payload -> validation-result artifact shape.
3. **Error handling / pivot contract** — raw evidence shape (per Q3),
   badge writing semantics, lead's pivot decision tree referenced
   inline.
4. **Testing** — how to test the skill itself. Likely a smoke FEAT
   tagged `surface:ui` that the skill exercises end-to-end against a
   fixture HTML page served from a local Python `http.server`.

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
