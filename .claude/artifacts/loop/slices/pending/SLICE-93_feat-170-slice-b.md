---
id: SLICE-93
feat: FEAT-170
status: pending
created: 2026-06-21
title: "FEAT-170 SLICE-B — fullstack-dev prompt shrink + skill extraction + 4 remediation patches"
autonomous_safe: false
risk_band: 0.5
estimated_loc: 450
estimated_files: 5
line_budgets:
  - { path: "agents/fullstack-dev.md", max: 320, action: "shrink from 397 (77 line reduction, 19%)" }
  - { path: "skills/workflow/fullstack-cross-layer/SKILL.md", max: 220, action: "new — extracted skill resolution + TDD + context-efficiency tables" }
  - { path: "evals/agents/crew-fullstack-dev.yaml", max: "+15 (add lead-leak-resilience-v4 test)" }
  - { path: "evals/fixtures/fullstack-dev-lead-leak-v4.txt", max: 15, action: "new — 'you are the lead' phrase coverage" }
  - { path: "docs/diagnostics/fullstack-dev-postshrink-2026-06-21.md", max: 200, action: "new — re-baseline after shrink" }
---

# SLICE-93: FEAT-170 SLICE-B — fullstack-dev prompt shrink + skill extraction

## Intent

Apply the SLICE-92 baseline diagnostic to `agents/fullstack-dev.md`. Shrink the prompt from 397 → ≤320 lines (77 line reduction, 19%) by extracting the skill table + TDD table + context-efficiency section to a new `skills/workflow/fullstack-cross-layer/SKILL.md`. Add four small remediation patches inline: SPLIT_BUILD detection guidance, `## Forbidden` block, expanded identity-anchor coverage, tightened skill cap. Re-run eval to capture the post-shrink baseline. Confirm ≥5/7 tests PASS (was 2/7 in SLICE-92 baseline).

`autonomous_safe: false` because prompt authorship affects every future fullstack-dev dispatch.

## Files to touch

| Path | Action | Notes |
|---|---|---|
| `agents/fullstack-dev.md` | edit (shrink) | Target ≤320 lines from 397. Extract `## Skill consultation` table (lines 146–163), TDD table, context-efficiency section to `skills/workflow/fullstack-cross-layer/SKILL.md`. Keep the resolution-order algorithm inline (5–6 lines). Add 4 remediation patches: SPLIT_BUILD detection (6 lines), `## Forbidden` block (6 lines), 2 more identity-anchor phrases ("As the orchestrator", "Let me re-read the instructions" — already listed, just keep), and the soft cap reduction note (1 line). Preserve identity-anchor block, peer dispatch whitelist, final-tool-call invariant, structural-deviation rule, HARD OUTPUT CONTRACT stub-on-entry pattern. |
| `skills/workflow/fullstack-cross-layer/SKILL.md` | create | New workflow skill. Contains: full skill resolution table (14+ paths), TDD policy table, context efficiency guidance, edge-case checklist, cross-layer coordination patterns. Frontmatter: `name: fullstack-cross-layer`, `tier: workflow`, `version: 1.0.0`, `prompt_id: fullstack-cross-layer`, `model_pinned: sonnet`, `description: "Loaded on-demand by crew:fullstack-dev for cross-layer slices spanning both BE and FE surfaces. Covers stack-specific skill routing, TDD policy per slice type, context-efficiency rules, and cross-layer coordination patterns."`. Cap: ≤220 lines (target 180–200). |
| `evals/agents/crew-fullstack-dev.yaml` | edit | Add 8th test `lead-leak-resilience-v4` referencing the new "you are the lead" fixture. |
| `evals/fixtures/fullstack-dev-lead-leak-v4.txt` | create | Dispatch prompt body containing `"you are the lead"` phrase. Realistic dispatch shape modeled on SLICE-79/82 patterns. ≤15 LoC. |
| `docs/diagnostics/fullstack-dev-postshrink-2026-06-21.md` | create | Post-shrink re-baseline report. Compare metrics to SLICE-92 baseline. Run `bun run evals --live --prompt fullstack-dev --judge claude-p` after the shrink lands. Capture ACTUAL verdicts. Confirm regression-free + identify which failure modes the patches addressed. |

## Acceptance criteria

1. `agents/fullstack-dev.md` is ≤320 lines. Verified by `wc -l agents/fullstack-dev.md`.
2. `skills/workflow/fullstack-cross-layer/SKILL.md` exists, frontmatter passes `node ./scripts/validate-skills.ts`.
3. `## Cross-layer split detection` section present in agent prompt (6 lines, mentions SPLIT_BUILD).
4. `## Forbidden` block present in agent prompt (6 lines, lists `*.tsx`, `*.css`, mobile files, cross-layer scope).
5. Identity-anchor block lists ≥5 reassignment phrases including "you are the lead", "Let me re-read the instructions", "As the orchestrator".
6. Soft skill cap reduced from 3 to 2 in agent prompt (with cross-layer carve-out note).
7. `evals/agents/crew-fullstack-dev.yaml` declares 8 tests total.
8. `docs/diagnostics/fullstack-dev-postshrink-2026-06-21.md` exists with comparison table to SLICE-92 baseline.
9. Live eval verdict: ≥5/8 tests PASS (was 2/7 baseline). Documented in postshrink report. (If <5/8 PASS, report explains which patches need refinement and the slice can still land — call it out in `--risks`.)
10. All CI gates green: `validate-manifests`, `validate-skills` (64+ skills including new), `validate-agents` (passes line cap check at 320), `validate-slices`, `lint`, `format:check`, `typecheck`, `test`.
11. `tests/agent-prompt-content.test.ts` (or similar structural test) does NOT regress — search for any test asserting fullstack-dev content patterns and update if needed.
12. Preserved sections still present in agent prompt: `## HARD OUTPUT CONTRACT`, identity-anchor block, `## Peer dispatch`, final-tool-call invariant, structural-deviation rule, stub-on-entry pattern.

## Validation commands

```
wc -l agents/fullstack-dev.md
grep -c "SPLIT_BUILD" agents/fullstack-dev.md
grep -c "## Forbidden" agents/fullstack-dev.md
grep -c "you are the lead" agents/fullstack-dev.md
grep -c "Let me re-read" agents/fullstack-dev.md
grep -c "As the orchestrator" agents/fullstack-dev.md

bun run lint
bun run typecheck
bun run format:check
bun test tests/evals-lib.test.ts
bun test tests/agent-prompt-content.test.ts
bun run evals --dry-run --prompt fullstack-dev
CREW_EVAL_LIVE=1 bun run evals --live --prompt fullstack-dev --judge claude-p
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-manifests.ts
node ./scripts/validate-slices.ts
```

## Constraints

- **Edit one agent prompt only.** Only `agents/fullstack-dev.md` may be modified. Do NOT touch other agent prompts.
- **One new skill only.** Only `skills/workflow/fullstack-cross-layer/SKILL.md` created. Do NOT add other skills.
- **Subscription-billed judge.** Use `claude-p`. Zero API spend.
- **Live eval required.** Re-baseline must capture actual live-run verdicts. If `claude -p` fails environmentally, document with BLOCKED markers + reproduction steps per SLICE-92 pattern.
- **Preserve semantic invariants.** Do NOT remove or weaken the identity-anchor block, peer dispatch whitelist (FEAT-163 / DEC-023), final-tool-call invariant, structural-deviation rule, or HARD OUTPUT CONTRACT stub-on-entry pattern.
- **Bump version frontmatter.** `agents/fullstack-dev.md` frontmatter: `version` bumps minor (e.g. `1.0.0` → `1.1.0`) per FEAT-167 versioning policy. Update `model_pinned` only if changing (don't).
- **Update maxLines cap.** Bump `maxLines: 400` → `maxLines: 320` in the frontmatter to lock in the shrink. Future evolution rebudgets explicitly.
- **No commits.** dev.stable: false. User reviews and commits manually.
- **Bundle ≤2000 lines.** Cite per-file LoC, not full diffs.
- **No release ceremony.** Do NOT touch `package.json`, `.claude-plugin/plugin.json`, `CHANGELOG.md`. No tags. No version bumps.

## Out of scope

- Routing classifier edits → SLICE-C.
- CI workflow → SLICE-D.
- Shrinking other agent prompts → separate FEATs if line-cap pressure observed.
- Adding cloud judges (Azure/Bedrock) — claude-p sufficient.
- Re-baselining other agents — separate FEAT once SLICE-D ships.

## Forbidden

- Modifying any other `agents/*.md` file.
- Modifying `scripts/validate-*.ts`.
- Modifying `evals/lib/**` or `evals/providers/**`.
- Adding npm dependencies.
- Auto-commit. dev.stable: false.
- Removing identity-anchor block, peer dispatch whitelist, final-tool-call invariant, structural-deviation rule, or HARD OUTPUT CONTRACT.
- Weakening peer dispatch budget (max 2 per slice, max 1 per turn per FEAT-163).
- Live network calls beyond `claude -p` subprocess.
- Release ceremony.

## Dispatch hint

- Builder: `crew:architect` — has explicit write-boundary allowance for "prompt redesign", "governance update", "design-surface refactor". This is "prompt redesign".
- Reviewer: `crew:inspector` + `crew:3rdparty:architect-reviewer` in parallel (architect-reviewer for the redesign decisions, inspector for change correctness).
- Validator: `crew:verifier` running validation commands + verifying preserved sections.
