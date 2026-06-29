---
id: FEAT-182
status: triaged
priority: P2
category: capability
target_release: null
created: 2026-06-22
triaged: 2026-06-29
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.65
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.70
pm_technical_risk: 0.55
pm_dependency_depth: 0.10
composite_score: 0.51
autonomous_safe: false
tags: [incident-response, release-recovery, sre, observability, dispatcher, skill]
triage_notes: |
  Triaged 2026-06-29 by runner:pm. Composite 0.51 → P2 holds.

  DEMAND ASSESSMENT
  - Who wants this? Repo operator (the user). Surfaced from two real release incidents in one session (v0.43.0 + v0.44.1) where Bash `cmd | tail && cmd2` masked exit codes and shipped broken-tag releases. Cited inline in the FEAT body (lines 23, 29). Not hypothetical.
  - Evidence: same broken-release bug hit twice in one day per FEAT body line 29 ("Same broken-release bug hit twice in one day"). Pattern is concrete: pipefail missing + cmd2 ran on cmd1 failure.
  - Current workaround: ad-hoc orchestration in main thread — user remembers crew:researcher vs crew:investigator vs crew:release-engineer and dispatches manually. Workaround is tolerable but loses the playbook each time.
  - Frequency: 2x in one session for release-recovery; prod-incident path has no observed trigger yet but is structurally absent. Mid frequency, not edge case.

  SCOPE CHALLENGE
  - Smallest deliverable that delivers value: `commands/incident.md` dispatcher + `skills/workflow/release-recovery/SKILL.md` ONLY (drop incident-response skill to a follow-up). Release-recovery is the proven pain. Incident-response is anticipatory.
  - What I would cut if halved: defer skills/workflow/incident-response/SKILL.md AND the agents/release-engineer.md "Rollback procedure" extension. Ship the dispatcher + release-recovery skill + smoke tests as v0.47.0. Open FEAT-NNN for the prod-incident half once a real prod incident gives requirements.
  - Overlap check: confirmed no existing `commands/incident.md`, no `skills/workflow/release-recovery/` or `skills/workflow/incident-response/`. `agents/release-engineer.md` exists but covers happy-path tagging, not rollback. No overlap with FEAT-181 (badge catalog) — they ship orthogonal pieces and can land in either order, though FEAT-181-first reduces drift when wiring the 3 new badges.
  - AC clarity: ACs (lines 124–130) are concrete (file paths + validators + 2 named smoke tests). Pass the AC quality checklist on the deliverable shape but the smoke tests cover only 2 of 6+ TRIAGE branches in the dispatcher diagram (line 47). Recommend the slice author add 4–6 more routing assertions OR explicitly accept partial branch coverage in the spec.

  RISK RADAR
  - technical_risk band: 0.5–0.6. New pattern in repo (no existing /crew:incident), single command + 2 skills + 10-line agent extension. No public contract change for the dispatcher itself. BUT the incident-response skill calls out MCP tools (mcp__plugin_azure_azure__*) that may not exist in consumer repos → cross-plugin contract surface lifts the band. Rollback decisions touch production paths.
  - Pre-mortem 1 (failure in 2 weeks): most likely cause = dispatcher routing table in commands/incident.md mis-routes — picks crew:release-engineer rollback when the actual fix was a code patch, or vice versa. Smoke tests cover 2 of 6+ branches.
  - Pre-mortem 2 (broke the loop, rollback cost): revert-only (no migration) for the dispatcher + 2 skills. IF the 3 new badges (incident_resolved, incident_blocked, rollback_executed) are wired into BADGE_HANDLERS during this slice, paired revert is needed.
  - Pre-mortem 3 (coverage gap): nothing today validates dispatcher routing — only validate-manifests.ts checks command file existence. The slice MUST add a routing test that asserts each TRIAGE branch dispatches the named agent.
  - Grade weak dimensions: most recent grade (SLICE-108) is a template-only stub with all-zero scores, not load-bearing. Prior real grades (SLICE-77–87) cluster ≥0.80 across dimensions per loop-snapshot evidence — no weak dimension forces an extra AC.
  - Effort calibration: closest analog is FEAT-159 SLICE-84 ($456 aggregate / 31min) which added a workflow skill + state plumbing. FEAT-182 is more skill-content-heavy and less code-heavy. Likely 1-2 slices in the $200–$500 aggregate range. Effort 0.55 confirmed.

  WHY P2 (NOT P1, NOT P3)
  - Not P1: workaround (ad-hoc main-thread orchestration) is tolerable; user can pipefail-fix the release script in 5 minutes without this dispatcher. Two incidents in one day is real pressure but not blocking.
  - Not P3: alignment with the dispatcher-concept rule (constitution.md:17, DEC-022) is high; pattern is repo-native; both new skills slot cleanly into skills/workflow/ next to dispatcher-orchestration + dispatcher-routing.
  - P2 honest: real pain + clear scope + non-trivial effort + cross-plugin MCP surface.

  AUTONOMOUS_SAFE: false confirmed
  - Touches production-incident routing + rollback decisions.
  - Adds a new dispatcher command (lead-adjacent prompt surface — matches the autonomous_safe=false carve-out in CLAUDE.md backlog-discipline for "lead prompt edits, skill authorship").
  - Cross-plugin MCP tool references need consumer-repo awareness on review.

  DECOMPOSITION NOTE
  - effort_estimate 0.55 maps to ~5 Fibonacci points (mid-range, single-wave). Decomposition NOT required at triage time; if a downstream sizing pass lands ≥8 points, dispatcher will invoke /runner:pm-decompose to split (likely: SLICE-A = command + release-recovery skill + 2 badges + smoke; SLICE-B = incident-response skill + agent extension + remaining badge + remaining smokes). Per intake instructions, no proposed_slices block written here.
---

# FEAT-182: Incident response + release recovery — dispatcher + skills

## Description

We have `release-engineer` for deployment + tag pushes, but no agent or workflow owns:

1. **Prod incident response** — diagnose a live failure (5xx spike, slow query, deploy regression, OOM, dependency upgrade break), route to the right specialist (researcher for unknown RCA, investigator for code location, builder for code fix, release-engineer for rollback), validate the fix in dev → staging → prod, write a post-mortem.

2. **Release ceremony recovery** — recover from broken-tag releases (today's v0.43.0 + v0.44.1 incidents where the release commit pushed without the underlying refactor due to a Bash exit-code masking bug — `cmd | tail && cmd2` ran cmd2 even when cmd1 failed). Patterns: no-ff merge to bring missing refactor in, version bump forward (never delete tags per HARD RULE), CHANGELOG audit-trail entry, paired marketplace bump.

Both gaps surfaced repeatedly this session. Doing them ad-hoc in the main thread works but loses the playbook for next time.

## Motivation

- Same broken-release bug hit twice in one day (v0.43.0 + v0.44.1) — codified pattern would prevent the third
- Prod incident response currently has no entry point — user has to remember `crew:researcher` vs `crew:investigator` vs `crew:release-engineer` and orchestrate them manually
- Existing agents are good at their pieces; what's missing is the **dispatcher** that routes between them

## Non-goals

- Don't extend `release-engineer` to do RCA / observability / code fixing — scope explosion + overlaps researcher/investigator/builder/verifier
- Don't create a new `incident-responder` god agent — same overlap problem
- Don't roll observability data adapters into the skill — declare which MCP tools to use, but data wiring is consumer-config

## Approach (dispatcher pattern, mirrors `/crew:build` / `/crew:fix` / `/crew:ship`)

### New `commands/incident.md` — `/crew:incident` dispatcher

```
/crew:incident
   ↓ workspace verify + wake-up brief
   ↓ collect symptom (user-supplied OR auto: tail recent logs / metrics)
   ↓
TRIAGE → pick branch:
   • Unknown root cause           → crew:researcher loads skills/workflow/incident-response/
                                     (persistent finding with confidence + evidence)
   • Code locations needed        → crew:investigator (cheap haiku locator)
   • Root cause known, fix needed → specialist builder per FEAT-tag routing (same table as /crew:build)
   • Rollback needed              → crew:release-engineer (rollback procedure)
   ↓ builder PASS or rollback PASS
   ↓ parallel inspectors (A+B same as /crew:fix)
   ↓ both approved
crew:verifier (with environment=staging or prod-readonly overlay)
   ↓ PASS
mark-badge incident_resolved
   ↓ optional: dispatch crew:document-writer for post-mortem
```

### New `skills/workflow/incident-response/SKILL.md` (~150 lines)

Loaded inline by `/crew:incident` dispatcher OR by `crew:researcher` when investigating prod issues. Covers:

- Triage decision table (unknown cause / known cause / rollback / data issue)
- Log / metric / trace reading patterns — calls out MCP tools to use:
  - `mcp__plugin_azure_azure__monitor`
  - `mcp__plugin_azure_azure__applicationinsights`
  - `mcp__plugin_azure_azure__grafana`
- Rollback decision tree (when to revert code vs config vs traffic shift)
- Common prod failure modes (deploy regression, OOM, slow query, traffic spike, dep upgrade break, data corruption)
- Post-mortem template (timeline, contributing factors, action items)

### New `skills/workflow/release-recovery/SKILL.md` (~100 lines)

Separate, smaller skill for broken-tag / failed-release-ceremony recovery. Covers:

- Broken-release detection (`git log` vs version file mismatch, tag-vs-HEAD content drift, marketplace-vs-tag drift)
- Recovery sequence (no-ff merge, version bump forward, new tag, CHANGELOG audit-trail entry)
- HARD RULE: NEVER delete broken tags — document as audit trail instead
- Bash `set -o pipefail` mandatory in release ceremony scripts (memory rule `feedback-pipefail-release-script`)
- Marketplace paired-bump recovery (when registry got the bump but plugin didn't, or vice versa)

### Minor `agents/release-engineer.md` extension (~10 lines)

Add "Rollback procedure" section:
- Reverse-order revert (prod → stage → dev)
- Tag the rollback commit `v<X.Y.Z>-rollback-<timestamp>`
- Document in incident artifact
- Cite skills/workflow/release-recovery/ for broken-tag recovery patterns

### New badges

- `incident_resolved` (set by `/crew:incident` on full pass)
- `incident_blocked` (on retry exhaustion or rollback decision needs user)
- `rollback_executed` (set by release-engineer when reverting)

## Why autonomous_safe: false

- Affects production environments (prod read-only verification, rollback decisions)
- Adds two new skills + one new command + agent extension — wide surface
- Cross-repo: incident skill references MCP tools that may not exist in consumer repos
- Needs human-in-loop review on the dispatcher prompt (similar to lead-prompt edits being autonomous_safe: false)

## Test plan

1. New `commands/incident.md` validated by `node ./scripts/validate-manifests.ts`
2. New skills validated by `node ./scripts/validate-skills.ts` (≤200 lines each, required headings)
3. `agents/release-engineer.md` extension validated by `node ./scripts/validate-agents.ts` (line cap)
4. Smoke test: dispatch `/crew:incident` with a fake symptom, confirm it routes to researcher (not investigator) for "Why is the dashboard returning 500s?"
5. Smoke test: dispatch `/crew:incident` with "rollback v0.46.0 due to regression" — confirm it routes to release-engineer with rollback procedure

## Out of scope (deferred to follow-up FEATs)

- Wiring real observability data adapters (MCP integration is configuration, not skill content)
- Auto-detection of incident from CI signals / monitor alerts (push-based incident trigger)
- Multi-environment promotion pipeline beyond dev/stage/prod (canary, feature flags)
- Post-mortem aggregation into a knowledge base / decision DB

## Acceptance criteria

- `commands/incident.md` ships + lints clean
- `skills/workflow/incident-response/SKILL.md` ships + validates
- `skills/workflow/release-recovery/SKILL.md` ships + validates
- `agents/release-engineer.md` extension ships within line cap
- `CHANGELOG.md` entry under `[Unreleased]`
- Smoke tests above pass
- Cut as v0.47.0 minor (new dispatcher command + new skills + new badges)

## Risks

- Skill content may drift from actual production patterns over time — set `last_reviewed` frontmatter and add reminder in skill validator
- Dispatcher logic in `commands/incident.md` could grow complex — keep routing decisions short, defer detail to the skill
- Rollback procedure varies by stack (TS plugin vs C# service vs FE app) — skill stays generic; stack-specific rollback in deployment.md per repo
