---
name: devops-engineering
prompt_id: devops-engineering
version: 1.0.0
tier: domain
description: CI/CD pipelines, IaC (Terraform/Helm/Ansible), container orchestration, monitoring, incident response, and security baselines for production infrastructure.
source: aitmpl/development-team/devops-engineer
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
additional_sources: aitmpl/development-team/devops-troubleshooter
triggers: [".github/workflows/*.yml", "azure-pipelines.yml", "Jenkinsfile", "Dockerfile", "docker-compose.yml", "*.tf", "*.tfvars", "helm-chart", "kubernetes", "k8s", "ansible", "bicep", "pipeline", "deployment", "monitoring", "incident"]
---

# DevOps Engineering

Guidance for CI/CD, infrastructure-as-code, container orchestration, observability, deployment strategies, and incident response.

## When to use

Consult this skill when:
- Authoring or reviewing CI/CD pipelines (GitHub Actions, GitLab CI, Azure DevOps, Jenkins)
- Writing or modifying IaC (Terraform, Bicep, Helm, Ansible)
- Designing or debugging container workloads (Docker, Kubernetes)
- Setting up monitoring, alerting, or observability stacks
- Responding to production incidents or deployment failures
- Implementing security scanning, compliance checks, or secrets hygiene
- Choosing a deployment strategy (blue-green, canary, rolling)

## Core principles

- **Infrastructure as Code first** — every resource versioned and reproducible; no manual console changes in prod.
- **Progressive deployment** — prefer blue-green or canary over big-bang releases; always have a rollback plan.
- **Security by design** — scan images, secrets, IaC, and dependencies as pipeline gates, not afterthoughts.
- **Observability everywhere** — metrics, logs, and traces wired before a service goes to production.
- **Environment parity** — dev/staging/prod should differ only in scale and secrets, not configuration shape.
- **Fail fast in CI** — move security and integration checks left; discover failures on PRs, not in prod.
- **Document automation** — every runbook and script is code; treat it as such (review, version, test).

## Subtopics

Detailed guidance lives in the `references/` directory. Load a reference file when the work matches its scope:

| Reference | Load when |
|---|---|
| [references/ci-cd.md](references/ci-cd.md) | Building or debugging CI/CD pipelines (GitHub Actions, GitLab CI, Azure DevOps, Jenkins, artifact registries, deployment stages) |
| [references/iac.md](references/iac.md) | Authoring or reviewing Terraform, Helm charts, Ansible playbooks, Bicep; state management, variable isolation |
| [references/observability.md](references/observability.md) | Prometheus/Grafana stack, alerting rules, distributed tracing, log aggregation (ELK/Datadog) |
| [references/troubleshooting.md](references/troubleshooting.md) | Production incident response, log/metric correlation, container debugging, deployment rollbacks, postmortems |
| [references/orchestration.md](references/orchestration.md) | Kubernetes deployments, HPA, Helm chart patterns, pod security, network policies, rolling vs blue-green in k8s |

Each reference file is self-contained — no prior context from this SKILL.md is required to use it.

## Cross-references

- Terraform HCL specifics → also consult `skills/domain/terraform-ops-traps/` for provisioner timing traps, multi-env isolation, and TLS/ACME failures not covered here.
- Security-sensitive changes (RBAC, secrets, token management) → co-cite `skills/domain/security-advisory/`.

## Done / Acceptance

A DevOps change is ready when:
- CI pipeline runs green end-to-end on a feature branch before merge
- IaC passes `terraform validate` / `helm lint` / equivalent linter
- Container images pass vulnerability scan (no HIGH/CRITICAL CVEs unmitigated)
- Deployment strategy is documented with rollback steps
- Monitoring alerts exist for the changed service (error rate, latency, availability)
- Secrets are never hardcoded; all credentials flow through vault or env injection
- Runbook updated if incident-response procedures changed
