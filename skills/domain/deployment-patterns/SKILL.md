---
name: deployment-patterns
tier: domain
description: Deployment strategy patterns — DORA targets, blue-green/canary/progressive delivery, pipeline optimization, release orchestration, and rollback design.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["blue-green", "canary", "progressive delivery", "rolling update", "feature flag", "rollback", "DORA", "deployment frequency", "lead time", "MTTR", "change failure rate", "pipeline optimization", "release orchestration", "shadow deployment", "deployment strategy"]
---

## When to use

Consult when designing or reviewing a deployment strategy, optimizing an existing pipeline for velocity or safety, planning a release with rollback requirements, or evaluating DORA metrics gaps.

For Azure/Terraform/IaC specifics → `skills/domain/devops-engineering/`. For Docker → `skills/domain/docker-expert/`. For cloud infra topology → `skills/domain/cloud-architecture/`.

## DORA targets

| Metric | Elite threshold | How to measure |
|---|---|---|
| Deployment frequency | > 10/day | Deploys to prod per day |
| Lead time for changes | < 1 hour | Commit → prod |
| MTTR | < 30 minutes | Incident detected → restored |
| Change failure rate | < 5% | Deploys causing incident / rollback |

If any metric is below elite, identify which pipeline phase is the bottleneck before adding more automation.

## Deployment strategies

### Blue-green

Two identical environments (blue = live, green = new). Switch traffic at load balancer after green passes health checks.

- **Rollback**: flip traffic back to blue — instant, no re-deploy
- **Database**: schema must be backward-compatible with both versions simultaneously
- **Session handling**: sticky sessions or shared session store required during cutover
- **DNS TTL**: lower TTL before cutover; restore after stable

### Canary

Route a small traffic slice (1–5%) to new version; expand incrementally on metric success.

- Metric gates before each expansion: error rate, p99 latency, business KPI
- Automated rollback trigger if any gate fails
- User segmentation optional (internal users, specific regions first)
- Full rollout only after sustained metric parity at each stage

### Rolling update

Replace instances one batch at a time. Simpler than blue-green but no instant rollback.

- Batch size: 10–25% of fleet per wave
- Health check must pass before next batch
- Minimum healthy instances enforced throughout
- Use when blue-green infra cost is not justified

### Shadow deployment

Route a copy of production traffic to new version without serving responses to users. Safe for testing high-risk changes with real load.

- Response from shadow is discarded; only logs/metrics are compared
- No user impact on shadow failure
- Useful for DB query plan validation, latency profiling

### Progressive delivery

Combines canary + feature flags + automated analysis.

- Feature flags decouple deploy from release — ship dark, enable per cohort
- Automated analysis compares metric distributions (not just thresholds)
- Kill switch disables feature instantly without re-deploy
- Clean up flags within one sprint of full rollout to avoid tech debt

### Rollback automation

- Every deploy must have a defined rollback procedure before it starts
- Rollback trigger conditions defined up front (error rate, latency, business metric)
- Rollback tested in staging before production use
- Post-rollback: preserve the failed artifact for root cause analysis

## Pipeline optimization

| Technique | Impact | When to apply |
|---|---|---|
| Build caching (layer cache, dependency cache) | High | Any build > 2 min |
| Parallel test execution | High | Test suite > 5 min |
| Artifact promotion (build once, deploy many) | High | Multi-env pipelines |
| Incremental builds (affected-only) | Medium | Monorepos |
| Network optimization (regional mirrors, CDN for deps) | Medium | Slow dependency installs |
| Resource right-sizing (CPU/memory per job) | Medium | Cost-sensitive pipelines |

**Build once, deploy many**: produce a single immutable artifact (container image, zip) in CI. Promote that artifact through environments — never rebuild per environment. Rebuilding risks environment-specific bugs.

## Release orchestration

- **Deployment windows**: define maintenance windows for high-risk changes; avoid peak traffic hours
- **Dependency coordination**: map service deploy order when breaking changes span multiple services
- **Smoke tests**: automated post-deploy check of critical paths (health endpoint, key user flow)
- **Success criteria**: define what "deployed successfully" means before starting — not just "pod is running"
- **Communication**: automated Slack/Teams notification at deploy start, completion, and on rollback
- **Post-deploy verification**: run within 15 minutes of deploy; include synthetic transactions where possible

## Done / Acceptance

Deployment strategy is complete when:
- Rollback procedure defined and tested before first production use
- DORA baseline measured; at least deployment frequency and MTTR tracked
- Deployment strategy chosen matches risk profile (blue-green for zero-tolerance downtime, canary for gradual confidence, rolling for cost-sensitive)
- Smoke tests run automatically post-deploy
- Rollback trigger conditions documented and automated where feasible
