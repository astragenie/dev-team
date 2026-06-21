---
name: engineering-standards
prompt_id: engineering-standards
version: 1.0.0
tier: universal
model_pinned: sonnet
description: Repo-portable engineering standards covering definition-of-done, code quality, minimal change policy, testing, API design, error handling, observability, and DevOps deployment. Vendored from C:/work/mega/kb/08-engineering/ so builders can consult the canonical standards without a hardcoded path. Loaded by any agent that ships product code.
owner: astragenie
last_reviewed: 2026-06-21
triggers: ["definition of done", "code quality", "minimal change", "testing standards", "api design", "error handling", "observability", "devops", "deployment standards", "production readiness"]
---

# Engineering Standards

Canonical engineering bar for any product code the team ships. Source of truth was `C:/work/mega/kb/08-engineering/` — vendored here as `references/` so builders can load it portably regardless of which machine the agent runs on.

## Trigger

Load when:

- Slice introduces a NEW public surface (function / endpoint / artifact kind / CLI subcommand)
- Slice changes how errors are emitted, how things are logged, how observability is wired
- Builder needs to confirm test scope / production-readiness bar before declaring DONE
- Reviewer is gating against repo standards

Skip when the slice is a single-line typo fix, a docs-only change, or a mechanical rename. The standards apply to product code, not chore commits.

## How to consult

Read the specific reference for the concern at hand. Don't load all 8 at once.

| Concern | Reference file |
|---|---|
| Is this slice "done"? Does it satisfy the launch bar? | `references/05-definition-of-done.md` |
| Should I refactor this opportunistically? How big is too big? | `references/06-code-quality-standards.md` + `references/07-minimal-change-policy.md` |
| What tests do I owe for net-new behavior? Unit vs integration vs e2e? | `references/08-testing-standards.md` |
| API contract design (REST shape, status codes, pagination, versioning) | `references/09-api-design-standards.md` |
| How should errors propagate? When throw vs return? Where do logs go? | `references/10-error-handling-standards.md` |
| What spans / metrics / structured logs does this endpoint need? | `references/11-observability-standards.md` |
| Deployment + DevOps gates the change must satisfy | `references/19-devops-deployment-standards.md` |

## When to apply (decision tree)

```
New public surface?
  ├─ YES → consult definition-of-done + api-design + testing + observability
  └─ NO  → just minimal-change + the concern-specific standard
```

```
Error handling changed?
  ├─ THROW path     → error-handling + observability (every throw is a span event)
  ├─ RETURN typed   → error-handling (typed Result pattern)
  └─ SILENT swallow → REFUSE per durability-discipline; see anti-patterns
```

```
Deployment-impacting?
  ├─ YES → devops-deployment + observability (every deploy is a deploy event)
  └─ NO  → skip devops-deployment for this slice
```

## What this skill does NOT do

- It does NOT replace the durability-discipline skill (band-aid refusal). That's a separate concern; load both when both apply.
- It does NOT carry stack-specific recipes — those live in `skills/domain/typescript-pro/`, `skills/domain/dotnet/*`, etc.
- It does NOT carry plugin-internals guidance — those live in `plugin-dev:*` skills.

## Done / Acceptance

You've consulted this skill correctly when:

- The specific reference file you loaded matches the concern you're solving (no scatter loading).
- Your follow-up Risks line cites which standard you applied (e.g. `Risks: applied error-handling §3 (typed Result pattern); no observability work in scope`).
- You did NOT vendor the standard's text inline in your code — the reference exists; cite it, don't paraphrase.

## Maintenance

- `last_reviewed` field on this skill = last sync date with the kb source. Bump when copying updated files from `kb/08-engineering/`.
- Cross-check: `references/*.md` here should match `kb/08-engineering/*.md` byte-for-byte. Drift between them = real bug.
- Future: a CI job that diff-checks the references against the kb source, gated by a `KB_ENGINEERING_ROOT` env var. Not yet wired.
