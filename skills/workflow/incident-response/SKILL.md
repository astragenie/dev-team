---
name: incident-response
prompt_id: incident-response
version: 1.0.0
tier: workflow
description: Triage a live production incident — root-cause diagnosis via logs/metrics/traces, rollback decision tree (code vs config vs traffic), a common prod failure-mode catalogue, and a post-mortem template. Sibling of skills/workflow/release-recovery/ (release-ceremony mechanics); this skill covers runtime incident diagnosis and recovery decisions.
owner: astra
last_reviewed: 2026-07-07
triggers: ["production incident", "prod is down", "500s in prod", "rollback decision", "read logs for incident", "post-mortem", "incident diagnosis", "OOM", "slow query incident", "traffic spike", "data corruption incident"]
---

# Incident Response

## Trigger

Load when:
- `/crew:incident` dispatches `crew:researcher` (unknown root cause) or `crew:release-engineer` (rollback needed) per the triage table in `commands/incident.md`
- The operator reports live prod symptoms (500s, timeouts, elevated error rate, degraded latency) with no known cause yet
- A rollback-vs-fix-forward decision needs a structured tree, not a guess
- A post-mortem needs a consistent template

## Diagnosis triage table

Match the incident shape before picking a diagnostic path:

| Incident shape | What to do |
|---|---|
| Unknown root cause | Follow "Reading logs / metrics / traces" below; correlate the failing signature against the deploy timeline. Don't guess — you were routed here (via `crew:researcher`) specifically because causation isn't known yet. |
| Known root cause, code bug | Fix-forward is usually faster than rollback when the fix is scoped, reviewed, and low-risk. Otherwise use the rollback decision tree. |
| Rollback needed | Use the rollback decision tree below (code vs config vs traffic) to pick the fastest safe path, then hand off to `agents/release-engineer.md` → Rollback procedure. |
| Data issue (corruption, bad migration, wrong write) | Do NOT rely on a code/config rollback alone — reverting application code does not undo already-written bad data. Escalate to the user before any destructive data-repair operation. |

## Reading logs / metrics / traces

Declare these as tools-to-use during diagnosis. This skill does NOT wire data adapters or dashboards — that is consumer-repo MCP configuration, owned outside this skill.

| Signal | MCP tool | What to look for |
|---|---|---|
| Dashboards / alert history / SLO burn | `mcp__plugin_azure_azure__grafana` | which alert fired first, burn-rate panel shape, correlate against deploy markers |
| Logs (error rate, stack traces, request correlation) | `mcp__plugin_azure_azure__monitor` | spike start time vs deploy timestamp, error-message clustering, correlation id across services |
| App-level traces / dependency call latency | `mcp__plugin_azure_azure__applicationinsights` | slow dependency calls, exception telemetry, failed-request rate by operation |

Read in this order: dashboard (grafana) for scope → logs (monitor) for the failing signature → traces (applicationinsights) for the causal call chain. Stop as soon as the evidence points at one failure mode below with a clear "why" — do not keep reading signals past the point of a confident root cause.

## Rollback decision tree (code vs config vs traffic)

```
Is the regression caused by a code deploy?
├─ YES → is a reviewed fix-forward available and fast (<30 min)?
│         ├─ YES → fix-forward (skip rollback)
│         └─ NO  → CODE rollback: reverse deploy order prod → stage → dev
│                  (see agents/release-engineer.md → Rollback procedure)
├─ Is it a config / feature-flag change (no code deploy involved)?
│         → CONFIG rollback: revert the flag/config value directly —
│           usually faster and lower-risk than a code revert
└─ Is it a traffic / load pattern (spike, bad actor, retry storm)?
          → TRAFFIC mitigation: rate-limit, shed load, or fail over —
            do NOT revert code for a traffic-caused incident, it fixes nothing
```

## Common prod failure modes

| Failure mode | Signature | First move |
|---|---|---|
| Deploy regression | Symptom onset lines up with a deploy timestamp | Diff the deploy; fix-forward vs rollback per the tree above |
| OOM | Process restarts, gradual memory climb before crash | Check recent large-object/cache growth; check the latest deploy for a leak |
| Slow query | Elevated p95/p99 latency, DB connection-pool exhaustion | Check the slow-query log; check for a missing index after a schema change |
| Traffic spike | Elevated request volume correlates with degradation | Check rate limiting; scale out before touching any code |
| Dependency-upgrade break | Regression after a dependency bump, no app-code change | Diff the lockfile; consider pinning the dependency back |
| Data corruption | Wrong values in prod data, not explained by volume/latency | STOP — this is a data issue, not a code issue; escalate before any rollback |

## Post-mortem template

```
## Incident: <title>

### Timeline
- <UTC timestamp> — <event>
- <UTC timestamp> — <event>

### Contributing factors
- <factor>

### Action items
- [ ] <owner> — <action> — <due date>
```

## Done when

- Root cause is identified, OR explicitly marked "not yet determined" with a named next diagnostic step
- The rollback-vs-fix-forward decision is made and documented, citing the matched branch of the decision tree above
- If rollback: `agents/release-engineer.md` → Rollback procedure was followed (reverse order, rollback tag, incident-artifact evidence)
- If data issue: escalated to the user before any destructive data-repair action
- A post-mortem is drafted, or explicitly deferred with a stated reason

## When NOT to use this skill

- Broken release ceremony (tag/marketplace mismatch, no live data-plane incident) → use `skills/workflow/release-recovery/` instead
- Root cause is already known and a specialist-builder fix is in flight → no diagnosis phase needed, just dispatch the builder per `commands/incident.md`

## References

- `commands/incident.md` — `/crew:incident` dispatcher routing table
- `skills/workflow/release-recovery/` — release-ceremony recovery (sibling skill; broken tag / version drift / marketplace desync)
- `agents/release-engineer.md` — Rollback procedure section (reverse-order revert, rollback tag format)
