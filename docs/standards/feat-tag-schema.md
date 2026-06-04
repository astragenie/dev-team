---
title: FEAT Tag Schema — Interface Contract
version: 1.0.0
status: active
created: 2026-06-04
owner: architect
---

# FEAT Tag Schema — Interface Contract

## Purpose

Decouple the loop plugin's triage emitter from the crew plugin's agent-dispatch
consumer. The loop observes FEAT content and emits abstract, namespaced tags.
The crew lead reads those tags and maps them to crew agents + skill auto-loads.
Swapping the orchestrator means re-authoring the mapping table here — the loop
source stays untouched.

This document is the canonical definition of the tag schema. Any producer
(today: `loop:pm-triage`) and any consumer (today: `crew:lead`) MUST agree on
the enum values in this file as the contract surface.

---

## Schema

Tags are expressed as a YAML array in FEAT frontmatter:

```yaml
tags: [stack:typescript, surface:cli, concern:observability]
```

- Tags are a flat array of namespace-prefixed strings.
- Each tag MUST match one of the enum values defined below OR be added to this
  schema before use (see Versioning).
- Tags are advisory: no CI gate enforces their presence or correctness on
  existing FEATs.
- Multi-namespace combinations are the common case — a single FEAT frequently
  has one tag per namespace.
- Order within the array is not significant.

### Namespace: `stack:*`

The primary language or framework the FEAT touches.

| Value | Meaning |
|---|---|
| `stack:typescript` | TypeScript / Node.js (`.ts`, `.mts`, `.mjs`, `.js`) |
| `stack:python` | Python (`.py`, `pyproject.toml`) |
| `stack:c-sharp` | C# / .NET (`.cs`, `.csproj`, `.sln`) |
| `stack:react` | React component / hook work (implies `stack:typescript`) |
| `stack:vue` | Vue component work |
| `stack:go` | Go (`.go`, `go.mod`) |
| `stack:rust` | Rust (`.rs`, `Cargo.toml`) |
| `stack:ai` | AI/ML model integration, embeddings, inference pipelines |
| `stack:llm` | Prompt engineering, agent authoring, system-prompt work |
| `stack:terraform` | Terraform HCL / modules (`.tf`, `terraform.tfvars`) |
| `stack:bicep` | Azure Bicep / ARM templates (`.bicep`, `azuredeploy.json`) |
| `stack:none` | FEAT has no code — pure docs, policy, or governance work |

### Namespace: `surface:*`

The user-visible artifact category the FEAT produces or modifies.

| Value | Meaning |
|---|---|
| `surface:api` | HTTP/gRPC/GraphQL endpoint contract, OpenAPI spec, AsyncAPI spec |
| `surface:ui` | Browser or native UI component, screen flow, visual design |
| `surface:docs` | README, CHANGELOG, conceptual docs, ADRs, release notes |
| `surface:infra` | Cloud topology, IaC provisioning, network/IAM/storage design |
| `surface:cli` | Command-line interface — new command, flag, or output format |
| `surface:schema` | Data model, database schema, migration, config schema, YAML contract |
| `surface:none` | Internal refactor with no new user-visible artifact |

### Namespace: `concern:*`

The primary cross-cutting engineering concern driving the FEAT.

| Value | Meaning |
|---|---|
| `concern:ux` | User experience — interaction flow, information architecture |
| `concern:accessibility` | WCAG / keyboard / ARIA / screen-reader compliance |
| `concern:security` | Auth, secrets handling, OWASP vulnerabilities, STRIDE threats |
| `concern:performance` | Latency, throughput, cost-per-call, resource consumption |
| `concern:observability` | Logging, metrics, tracing, alerting, cost telemetry |
| `concern:governance` | Policy, workflow rules, quality-gate enforcement, compliance records |
| `concern:compliance` | Regulatory requirements, audit trails, data residency |
| `concern:refactor` | Internal code quality improvement, no behavioral change |
| `concern:none` | No dominant cross-cutting concern |

---

## Producer contract — how `loop:pm-triage` should compute tags

When triaging a FEAT, the producer (currently `loop:pm-triage`) SHOULD compute
tags using the following heuristic. Tags are advisory; the producer MUST NOT
fail triage when tag inference is ambiguous.

1. **`stack:*`** — inspect the FEAT description and linked spec content:
   - Glob patterns in acceptance criteria (e.g. `*.ts`, `*.cs`, `*.tf`)
     are the strongest signal.
   - Technology nouns: "TypeScript", "Python", "C#", "Terraform", "React",
     "prompt", "agent", "LLM", "embedding" → map to the matching `stack:*` tag.
   - If no code changes are described, emit `stack:none`.

2. **`surface:*`** — scan acceptance criteria for artifact nouns:
   - "endpoint", "route", "OpenAPI", "contract" → `surface:api`
   - "component", "screen", "UI", "page" → `surface:ui`
   - "README", "CHANGELOG", "doc", "ADR", "release notes" → `surface:docs`
   - "terraform", "bicep", "infra", "IaC", "network", "IAM" → `surface:infra`
   - "command", "flag", "CLI", "output format" → `surface:cli`
   - "schema", "migration", "model", "frontmatter", "config schema" → `surface:schema`
   - If the FEAT is a pure internal refactor → `surface:none`

3. **`concern:*`** — scan description and notes for cross-cutting keywords:
   - "cost", "tokens", "latency", "throughput" → `concern:performance`
   - "log", "metric", "trace", "alert", "telemetry", "brief-me" → `concern:observability`
   - "auth", "secret", "OWASP", "STRIDE", "vulnerability" → `concern:security`
   - "policy", "gate", "governance", "enforcement", "compliance record" → `concern:governance`
   - "WCAG", "aria", "keyboard", "screen reader", "accessibility" → `concern:accessibility`
   - "refactor", "clean up", "dedup", "internal quality" → `concern:refactor`
   - No dominant keyword → `concern:none`

Emit one tag per namespace at minimum. Emit multiple tags only when the FEAT
clearly spans two concerns at similar weight (e.g. a security-observability
cross-cutter). Over-tagging reduces the signal; when in doubt, pick the
dominant concern.

---

## Consumer contract — how `crew:lead` reads tags

The lead reads the `tags:` array at slice start and uses the tag-to-agent
mapping in `agents/lead.md` ("Tag-to-agent mapping" section) to decide:

- **Primary agent** — who owns the implementation slice.
- **Skills to auto-load** — domain skills the agent should invoke on dispatch.
- **Split signal** — if tags span ≥2 distinct primary agent roles, apply the
  Pre-dispatch decomposition rule and run parallel dispatches.

When no `tags:` field is present (loop has not yet adopted the schema), the
lead falls back to the file-by-file Pre-dispatch decomposition rule in
`agents/lead.md`.

Tags are cited in the dispatch handoff so the assignee knows which skill to
load without re-reading the full FEAT.

---

## Versioning

- This schema lives in this document.
- Adding a new enum value to any namespace is **non-breaking** — consumers
  that do not recognize the value treat it as `stack:none` / `surface:none` /
  `concern:none` for mapping purposes.
- Renaming or removing an existing value requires a deprecation path:
  1. Add the new value alongside the old one.
  2. Communicate the change to all known producers (currently `loop:pm-triage`
     maintainer at `sergeymilashico/loop`).
  3. Remove the old value in a subsequent schema version bump.
- Schema version lives in this file's frontmatter (`version:`). Bump minor
  for additions; bump major for removals or renames after deprecation.

---

## Worked examples

### Example 1 — FEAT-001: Skills directory reorganization

```yaml
tags: [stack:none, surface:schema, concern:governance]
```

Rationale: no language code changed; the deliverable was a directory structure
and frontmatter `tier` field (schema surface); the driver was taxonomy
governance policy.

Primary agent: **architect** (schema + governance concern).
Skills auto-loaded: `architecture-advisory`.

---

### Example 2 — FEAT-035: Agent prompt cap raise + lean-agent enrichment

```yaml
tags: [stack:typescript, surface:schema, concern:governance]
```

Rationale: the new `validate-agents.mjs` script is TypeScript; the agent
prompts are config-schema artifacts; the driver is the quality-gate governance
policy (cap enforcement, CI gate).

Primary agent: **builder** for the validator script + **architect** for the
prompt policy rule. Split per Pre-dispatch decomposition rule.
Skills auto-loaded: `typescript-pro` (builder); `architecture-advisory` (architect).

---

### Example 3 — FEAT-031: Sonnet-default for mechanical slices

```yaml
tags: [stack:llm, surface:docs, concern:performance]
```

Rationale: the slice authors agent-prompt text (LLM-facing content); the
visible artifact is a docs change to `agents/lead.md`; the driver is cost/
performance optimization (Opus → Sonnet model selection).

Primary agent: **architect** (agents/lead.md is a policy/doc file, not code).
Skills auto-loaded: `architecture-advisory`, `prompt-engineering`.

---

### Example 4 — FEAT-036: Dedupe overlapping cost reports in brief-me

```yaml
tags: [stack:typescript, surface:cli, concern:observability]
```

Rationale: the fix is in `scripts/lib/briefing/collect.mjs` (TypeScript/Node);
the user-visible surface is the `brief-me` CLI output; the driver is fixing
misleading observability / cost telemetry output.

Primary agent: **builder** (code-only refactor with tests).
Skills auto-loaded: `typescript-pro`.

---

## Advisory validator extension (deferred)

A future `validate-feats.mjs` script could warn (not fail) when a FEAT in
`docs/backlog/triaged/` or `docs/backlog/in-progress/` contains a `tags:`
field with an unrecognized enum value. Tags on existing `done/` FEATs are
never checked — retroactive tagging is a separate opt-in slice.

Implementation deferred because: (a) FEAT files are not currently validated
for frontmatter beyond basic shape; (b) advisory-only warnings can be wired
into `validate-slices.mjs` extension or a new script once the schema stabilizes
across two or more triaged FEATs. See Versioning section for addition rules.
