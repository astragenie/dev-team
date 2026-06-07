---
description: Preferred short entry point for moving work through merge, deployment, and post-deploy evidence gates.
---

# Ship In The Lead Workflow

This is the preferred short entry point for moving reviewed work through dev and production with evidence.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Before substantial shipping work:

- `pwd`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
- explicitly verify the returned `repoPath` matches the current working directory before trusting the brief

Expected shape:

1. verify the repo and read bounded wake-up context
2. retrieve existing repo deployment guidance before planning an environment transition
3. if deployment guidance is missing or stale, inspect CI/CD, infra, and deployment files and write durable repo deployment guidance
4. if repo files are not enough to produce actionable deploy steps, treat the guidance as incomplete:
   - resolve live infrastructure identifiers when feasible
   - distinguish repo-derived guidance from live-verified guidance
   - record what is still missing if live resolution is not possible
5. frame the current shipping stage:
   - local work complete?
   - review complete?
   - validation complete?
   - PR ready or merged?
   - dev or prod target?
6. identify what evidence already exists and what gate is still missing
7. use the deployer when environment transition or deployment confirmation is needed
8. write deployment checks immediately as environment evidence is gathered
9. after a successful deploy or live environment check, update deployment guidance with the concrete identifiers you discovered
10. require post-deploy validation when behavior can be exercised meaningfully
11. require explicit user approval before risky production promotion
12. return evidence, residual risk, and the next responsible step

Use deployment checks and workflow state to keep the shipping path legible:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge dev_deploy_expected`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge prod_deploy_expected`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" discover-deployment --repo "$PWD"`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-guidance --repo "$PWD" --title "<short title>" ...`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-deployment-check --repo "$PWD" --title "<short title>" ...`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge dev_skipped --note "<reason>"`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge prod_skipped --note "<reason>"`

Repo deployment guidance should preserve what the repo itself teaches us about shipping:

- build path
- deploy path
- environments
- logs / metrics / alerts / telemetry surfaces
- CI/CD and infra clue files

Repo deployment guidance should also distinguish how trustworthy it is:

- `repo-derived` when it only reflects what repo files reveal
- `partial` when some live identifiers are known but important pieces are still unresolved
- `live-verified` when concrete deploy identifiers have been confirmed from the actual platform

If repo files hide identifiers behind secrets or opaque CI/CD config, do not stop at a repo-only summary when live resolution is feasible.

Deployment checks should capture concrete deployment identity when available:

- target environment
- resource or service name
- service URL
- revision, image, or release identifier
