---
description: Preferred short entry point for responding to a live incident or recovering from a broken release in the current repo.
---

# Incident — Dispatcher Workflow

You are the dispatcher for `/crew:incident`. The dispatcher routes between
researcher, investigator, specialist builder, and release-engineer
based on the incident shape — known cause vs unknown, code-level vs
release-ceremony, fix-forward vs rollback.

For what counts as "substantial" below, see the canonical definition in
`constitution.md` (`What "Substantial" Means`).

## Triage decision table

Match the incident shape against this table before any dispatch:

| Incident shape | Right dispatch |
|---|---|
| Unknown root cause, multi-file causal reasoning, needs persistent evidence trail ("Why does the dashboard return 500s after deploy?") | `crew:researcher` with `skills/workflow/release-recovery/` loaded |
| Code locations needed, no causation reasoning ("Which handlers touch the user-service table?") | `crew:investigator` (haiku locator, cheap, no handoff) |
| Root cause known, fix needed (regression in commit `<sha>`, off-by-one, null guard removed) | Specialist builder per FEAT-tag routing (same table as `/crew:build`) |
| Rollback needed (broken-tag release, post-deploy regression observed in dev / stage / prod) | `crew:release-engineer` with rollback procedure from `skills/workflow/release-recovery/` |
| Broken release ceremony (version bumped but underlying code missing, marketplace bumped but plugin tag didn't ship) | `crew:release-engineer` with release-recovery skill — covers no-ff merge / version-forward / paired-marketplace patterns |

**Important — do NOT use `crew:investigator` for root cause analysis.**
Investigator is haiku + maxTurns: 12 + no-handoff. It dies at the cap and
cannot deliver root-cause artifacts with confidence + evidence. Use
`crew:researcher` for causation.

## Phase order

```
/crew:incident
   ↓ workspace verify + wake-up brief
   ↓ collect symptom (user-supplied OR auto: tail recent logs / git log / metrics MCP)
   ↓
TRIAGE → pick branch (table above):
   • Unknown root cause           → crew:researcher (skills/workflow/release-recovery/)
                                     writes persistent finding with confidence + evidence
   • Code locations needed        → crew:investigator
                                     dies with turn, no handoff
   • Root cause known, fix needed → specialist builder (FEAT-tag routing)
                                     writes handoff
   • Rollback needed              → crew:release-engineer
                                     applies release-recovery patterns
   ↓ builder PASS or rollback PASS
   ↓ parallel inspectors (A + B same as /crew:fix)
   ↓ both approved (or A skipped + B approved)
crew:verifier (environment=staging or prod-readonly overlay)
   ↓ PASS
mark-badge incident_resolved
   ↓ if rollback executed instead of fix-forward: mark-badge rollback_executed
   ↓ optional: dispatch crew:document-writer for post-mortem
```

No fix_complete badge — the incident pipeline emits `incident_resolved`
(full pass) or `rollback_executed` (release-engineer reverted). Both
land in the `incident` gate slot.

## Auto-fix retry loop (when Inspector rejects)

Symmetric with `/crew:fix` and `/crew:ship`. When either Inspector A or
Inspector B returns `rejected`:

1. Read both review-result artifacts for the aggregated FAIL findings.
2. Re-dispatch the same specialist builder (or release-engineer for rollback path) with findings as fix scope.
3. Increment retry counter.
4. Re-run the parallel inspector fan-out.
5. Retry < N (default 2 from `.claude/crew/deployment.md` `fix.retry_limit`)? Loop. Else halt.

On N exhausted:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge blocked \
  --note "<aggregated FAIL summary>"
```

Escalate to user with both artifact paths + findings.

## Builder routing table (fix-forward branch)

Same table as `/crew:build` and `/crew:fix`:

| FEAT tag                                            | Specialist          |
|-----------------------------------------------------|---------------------|
| stack:typescript + surface:ui                       | crew:frontend-dev   |
| stack:typescript + surface:backend                  | crew:backend-dev    |
| stack:typescript + surface:cross-layer              | crew:fullstack-dev  |
| stack:typescript + surface:plugin                   | crew:aiplugin-dev   |
| stack:csharp                                        | crew:backend-dev    |
| no clear tag                                        | crew:fullstack-dev  |

## Workflow

1. Verify the current workspace path:
   - `pwd`
2. Read the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. Confirm the returned `repoPath` matches `$PWD`. If not, stop and correct repo context before proceeding.
4. Classify the incident against the triage table above. State the chosen branch explicitly.
5. Apply skills:
   - For release-ceremony recovery (broken tag / version mismatch / marketplace drift): load `skills/workflow/release-recovery/` before dispatch.
   - For prod incident (RCA / log reading / metric correlation / rollback decision): the incident-response skill ships in SLICE-B; for SLICE-A, route to `crew:researcher` with the release-recovery skill if release-ceremony-adjacent, or to specialist builder if code-level cause is known.
6. Dispatch per triage branch:
   - **Unknown root cause**: `crew:researcher` with finding artifact required.
   - **Code locations needed**: `crew:investigator` (no artifact).
   - **Root cause known, fix needed**: specialist builder from routing table.
   - **Rollback needed**: `crew:release-engineer` with release-recovery skill loaded.
7. After builder / release-engineer returns PASS, write a handoff artifact if substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" --from <builder|release-engineer> --to dispatcher --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "inspector fan-out"`
8. Fan out two inspectors in a **single Agent-tool message** (parallel dispatch), same routing as `/crew:fix`:
   - **Inspector A** — stack-specific reviewer (skip if no stack match).
   - **Inspector B** — `crew:inspector` with lens from FEAT concern tag (default: `correctness`).
9. After both inspector artifacts land, write a review result for each.
10. If either inspector returns `rejected`, run the auto-fix retry loop above.
11. After both approve (or A skipped + B approved), run verifier with environment overlay:
    - `crew:verifier` with `--environment staging` or `--environment prod-readonly`.
12. If verifier PASS:
    - Fix-forward path: `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge incident_resolved`
    - Rollback path: `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge rollback_executed`
13. Optional post-mortem: dispatch `crew:document-writer` to author `.claude/artifacts/crew/incidents/<timestamp>-postmortem.md` covering timeline, contributing factors, action items.
14. End with synthesis for the user:
    - confirmed incident shape (which triage branch)
    - root cause (or "not yet determined" for in-flight)
    - what changed (fix or rollback)
    - residual risk
    - follow-ups (post-mortem, FEATs to file, monitoring to add)

## Notes

- Production promotion is NEVER unlocked by this dispatcher. Rollback path stops at staging-verify; prod rollback requires explicit user approval per deployer rules.
- `incident_blocked` badge ships in SLICE-B alongside the incident-response skill. SLICE-A surfaces blockers through the generic `blocked` badge.
- Skill content `skills/workflow/release-recovery/` is the authoritative reference for broken-tag / marketplace-drift / version-forward patterns. The dispatcher is intentionally thin — routing only, details live in the skill.
