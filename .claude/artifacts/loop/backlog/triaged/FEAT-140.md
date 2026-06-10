---
id: FEAT-140
status: triaged
priority: P2
category: security
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.8
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.82
pm_technical_risk: 0.55
pm_dependency_depth: 0.25
composite_score: 0.7185
autonomous_safe: false
triage_notes: via=pm | Strong impact (automated security gate); moderate effort (1 domain skill + routing rows); skill authorship => human review
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
