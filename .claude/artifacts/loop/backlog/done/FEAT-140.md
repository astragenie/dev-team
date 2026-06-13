---
id: FEAT-140
status: done
priority: P1
category: security
target_release: null
created: 2026-06-10
updated: 2026-06-13
depends_on: []
slices: [SLICE-69]
derived_from: null
pm_customer_impact: 0.8
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.85
pm_technical_risk: 0.55
pm_dependency_depth: 0.25
composite_score: 0.705
autonomous_safe: false
triage_notes: "via=pm retriage 2026-06-10 | Targets the ONLY current weak grade dim per snapshot: security avg 0.79 (last 5 grades) — below 0.80 bar. Bumped to P1 (was P2) because (a) weak-dim trigger fires and (b) security regression class is high-blast-radius. AC must include criteria targeting observability of security checks (logs/metrics on the scan path) per weak-dim rule. Risk band 0.55: new domain skill ≤200 lines + 2 routing rows + reviewer prompt edit; secrets-scan false-positive risk; reviewer-integration prompt design nontrivial. autonomous_safe=false: skill+agent prompt authorship per CLAUDE.md governance + security category always human-in-loop. Pre-mortem: (1) two weeks later — secrets-scan tuned too loose (every PR red) or too tight (real leak slips). (2) Rollback = git revert one PR; reviewer prompt drift is local file change. (3) Test gap: no existing test exercises reviewer skill invocation chains — AC needs an integration smoke with a planted fake-secret fixture. Cost analog: FEAT-138 SLICE-63 (skill+CI) $102/12min in mega — but that's aggregate including unrelated work; isolated effort 0.45 holds."
started_at: 2026-06-11
slices_complete: [SLICE-69]
completed_at: 2026-06-13
---
# FEAT-140: Pre-merge security sweep — secrets scan + supply-chain audit routing

## Description

Targets grade dimension security (avg 0.77). Crew has the `security-advisory`
domain skill and a "/cso" narrative reference, but no autonomous pre-merge
trigger — security review only happens when someone thinks to ask for it.

Add an automatic security sweep that fires when a diff touches dependency
manifests, lockfiles, auth/crypto-adjacent code, or CI workflow files:

1. **Secrets scan** — API keys, DB credentials, certificates, auth tokens,
   config leaks; report file:line.
2. **Supply-chain audit** — lockfile integrity, install-script/hook scanning,
   typosquatting and dependency-confusion checks, severity-tiered findings
   (CRITICAL/HIGH/MEDIUM/LOW) with ecosystem-native remediation commands
   (`npm audit`, `pip-audit`, `cargo audit`, `govulncheck`).

## Deliverables

- New domain skill `skills/domain/security-sweep/` (≤200 lines) covering both scans.
- Routing-table rows: "dependency/lockfile change" and "auth-touching diff" → reviewer invokes security-sweep.
- Reviewer prompt: trigger condition + evidence expectation in the review artifact.

Source patterns: claude-code-templates `security/secrets-scanner.md`,
`security/dependency-audit.md`, `analysis/supply-chain-audit.md`.
