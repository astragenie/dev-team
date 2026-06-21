# DevOps Deployment Standards

What must be true before a change can ship to a deployed environment.

## Infrastructure as code

- All cloud + cluster resources defined in IaC (Bicep / Terraform / Pulumi). Manual portal edits = drift = follow-up FEAT to codify.
- IaC PRs reviewed independently of application PRs.
- IaC + app version pinned together — no "latest" tags in production.

## Environment configuration

- All config via env vars or a secret manager — never hardcoded.
- Required env vars documented in the service README + listed in CI as the deploy gate.
- Missing required env var = service refuses to start with a clear error (fail-fast, no defaults that hide misconfiguration).

## Secret registration

- Secrets stored in a secure provider (Azure Key Vault / AWS Secrets Manager / 1Password Connect).
- Rotation policy documented per secret (90-day default).
- Service identity (managed identity / IAM role) reads secrets at runtime — no secrets in container images or env files.
- Secret-scanner runs on every PR and the CI gate; commits containing secrets are rejected.

## Health + readiness

- `/health` (liveness), `/ready` (readiness), `/metrics` (scrape) on every service.
- Orchestrator (k8s / Container Apps / App Service) wired to use these probes.
- Smoke test exercises all three after deploy; non-200 = rollback.

## Migration deployment

- Migrations run as a separate step BEFORE the new app version starts.
- Expand-contract: add column nullable → backfill → switch code → drop old column. NEVER drop + code-switch same release.
- Long migrations are chunked + idempotent + resumable. Document expected runtime in the release notes.
- Migration failure = halt the deploy; do not run the new app against the old schema.

## Smoke tests post-deploy

- One happy-path request per critical endpoint.
- Health + ready + metrics checks.
- Failure = automatic rollback to the previous revision.

## Rollback

- Every deploy MUST be revert-able to the prior revision in one command.
- Rollback path documented in `.claude/crew/deployment.md`.
- Test rollback in dev/staging before production deploy.
- Forward-fix is acceptable ONLY when rollback would lose data (rare; document the choice).

## Promotion gates

- Dev: automatic on merge to main.
- Staging: automatic on green CI + green dev smoke.
- Production: explicit user approval per the deployer constitution rule. NEVER unattended.

## Anti-patterns

- `kubectl apply` from a laptop in production.
- Hardcoded secrets in env files or container images.
- Single-step migrations that drop + switch in one release.
- Deploy without a rollback plan.
- Skipping smoke tests "because it's a small change."
- Tag pushes from the autonomous loop. Tags + production deploys are user-triggered only.

## Cross-reference

- Migration shape detail: builder skills (`backend-dev`, `fullstack-dev`) carry `## Migration safety`.
- Release ceremony: `.claude/crew/deployment.md`.
