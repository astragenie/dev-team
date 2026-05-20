# Implementation Commitments

This document tracks product decisions we have already made and still intend to implement, but not in the current slice.

It is not a general idea backlog.

Use it only for items that are:

- explicitly agreed
- high-confidence
- deferred for sequencing, not because they are speculative

If we say "yes, later" and mean it, it should be recorded here.

## How To Use This

For each committed-later item, capture:

- what it is
- why it is deferred
- what should unlock it
- what "done enough" looks like
- which design doc section it comes from

When starting a new product-development slice for Crew:

1. read [system-design.md](./system-design.md)
2. check this file for deferred commitments that may now be ripe
3. choose intentionally, instead of relying on memory

## Current Committed-Later Items

### 1. Deployer And Ship Loop

- Status: deferred, next major subsystem
- Why deferred:
  the core lead/review/validation foundation had to become real first
- Unlock:
  local validation and workflow gates are usable enough to extend into dev/prod movement
- Done enough:
  deployer agent exists, `/crew:ship` exists, deployment checks are artifacts, and the lead can move work through dev/prod with evidence and explicit approval gates
- Source:
  [system-design.md](./system-design.md), [validation-loop.md](./validation-loop.md)

### 2. Deployment Discovery To Durable Repo Guidance

- Status: deferred, should begin with deployer work
- Why deferred:
  repo deployment behavior is highly repo-specific and should not be hard-coded prematurely
- Unlock:
  once deployer starts inspecting real repos
- Done enough:
  Crew can:
  - inspect CI/CD, infra, and deploy scripts when deployment is unclear
  - distinguish build, publish, rollout, and verification
  - write durable repo deployment guidance after discovery
  - later prefer a stable repo environment/deployment config over repeated rediscovery
- Source:
  deployment discussion, [system-design.md](./system-design.md)

### 3. Repo Environment Configuration

- Status: deferred until real repos prove the shape
- Why deferred:
  we want to learn from live repos before freezing the config surface
- Unlock:
  after a few real validator/deployer runs expose recurring needs
- Done enough:
  a repo-local config exists for:
  - local run/test commands
  - dev/prod URLs
  - deploy commands or deployment notes
  - logs
  - metrics
  - alerts/incidents
  - telemetry/events
- Source:
  [system-design.md](./system-design.md), [product-roadmap.md](./product-roadmap.md)

### 4. Observability Surface Split

- Status: deferred but committed
- Why deferred:
  validator/deployer need it, but the core distinction should be captured before we automate against providers
- Unlock:
  when validator/deployer start using environment evidence in real repos
- Done enough:
  Crew treats these as distinct evidence sources:
  - service logs
  - service metrics
  - alerting / incidents
  - telemetry / product or domain events
- Source:
  deployment/validation discussion, [validation-loop.md](./validation-loop.md)

### 5. Subtask-Level Gate State

- Status: deferred
- Why deferred:
  current workflow state is run-level; subtask-level badges would be more correct but add complexity
- Unlock:
  once larger, chunked runs make run-level gating too coarse
- Done enough:
  review/validation/deployment badges can attach to bounded work chunks, not just the overall run
- Source:
  [system-design.md](./system-design.md)

### 6. Internal Namespace Migration

- Status: repo-local complete, global memory deferred
- What landed (May 2026):
  repo-local storage paths and scripts moved to `.claude/state/crew/`,
  `.claude/artifacts/crew/`, and `.claude/crew/`. The installer migrates
  legacy `engineering-os` paths on `/crew:adopt`, runtime modules read
  legacy paths as a fallback during the transition.
- What is still deferred:
  managed global memory at `~/.claude/engineering-os/`. Renaming it would
  break existing users' global `~/.claude/CLAUDE.md` imports, so it needs
  paired migration logic in `installGlobal` first.
- Done enough:
  global memory migrates without stranding existing users (back-compat
  shim or import rewrite in `installGlobal`).
- Source:
  rename work and [system-design.md](./system-design.md)

### 7. Greenfield Development Workflow Variant

- Status: deferred but committed
- Why deferred:
  the core build/fix/review/validate/ship loop must be stronger before we add a broader greenfield phase model
- Unlock:
  once the normal lead workflow is stable enough to support specialized variants
- Done enough:
  Crew has a distinct greenfield workflow shape that can guide:
  - ideation
  - scope narrowing
  - research
  - architecture
  - data modeling
  - scaffolding
  - first vertical slice delivery
- Source:
  greenfield discussion, [system-design.md](./system-design.md)

### 8. Initial Deployment Workflow Variant

- Status: deferred but committed
- Why deferred:
  routine validation and shipping foundations should exist first
- Unlock:
  once deployer and ship basics are usable
- Done enough:
  Crew has a distinct initial-deployment workflow that can guide:
  - deployment discovery
  - build vs rollout separation
  - initial resource and service identity
  - first post-deploy validation
  - first monitoring/evidence loop
- Source:
  initial deployment discussion, [system-design.md](./system-design.md)
