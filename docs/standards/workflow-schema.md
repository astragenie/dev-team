---
title: Workflow YAML Schema Reference
tier: standard
applies_to: [".claude/workflows.yaml"]
introduced_in: FEAT-166
---

# Workflow YAML Schema Reference

## Purpose

`.claude/workflows.yaml` declares the set of named dispatch strategies available
in a repo. The loader (`scripts/lib/workflow-config.ts`) reads the file, applies
`${env:VAR}` substitution, and validates it with Zod before the dispatcher
(`scripts/lib/slice-linker/dispatch.mts`) uses it to build an ordered phase plan.

Both the autonomous-loop path and the interactive `/crew:build` path consume this
file. A slice's `workflow:` frontmatter field selects which strategy to use;
absent field means `default_workflow` applies.

## Schema

All fields mirror the Zod schema exported from `scripts/lib/workflow-config.ts`.

### Top-level

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `1` (literal) | yes | Schema version. Only `1` accepted. |
| `default_workflow` | `string` | yes | Key of the workflow used when a slice has no `workflow:` field. Must exist in `workflows`. |
| `workflows` | `Record<string, WorkflowDefinition>` | yes | Map of named workflow definitions. Keys must match `/^[a-z][a-z0-9_-]*$/`. |

### WorkflowDefinition

| Field | Type | Required | Description |
|---|---|---|---|
| `description` | `string` | no | Human-readable summary. Supports `${env:VAR}` substitution. |
| `phases` | `WorkflowPhase[]` | yes | Ordered list of phases. At least 1 phase required. |

### WorkflowPhase

| Field | Type | Required | Description |
|---|---|---|---|
| `role` | `"builder" \| "reviewer" \| "reviewer_validator" \| "validator" \| "deployer"` | yes | Phase role. |
| `agent` | `string` | conditional | Agent ref (e.g. `crew:fullstack-dev`). Required unless `routing` or `parallel_dispatch` present. |
| `routing` | `RoutingSchema` | conditional | Tag-based builder routing. |
| `parallel_dispatch` | `ParallelDispatchSchema` | conditional | Parallel multi-agent fanout. |
| `parallel` | `int 1–4` | no | Parallelism count override for plain agent phases. |
| `aggregation` | `AggregationSchema` | no | Aggregation policy for `parallel_dispatch` phases. |
| `emit` | `"handoff"` | no | What artifact the phase produces. |
| `trigger` | `{ on: string; from: string }` | no | Phase trigger condition. |
| `gate` | `{ policy: "all_pass" \| "blocking" \| "advisory"; fail_action?: "route_to_fix" }` | no | Gate policy for the dispatcher. |
| `skip_when` | `string` | no | Expression evaluated against changed files (v1: `changed_files matches "<regex>"`). |
| `require_user_approval` | `boolean` | no | Deployer-phase hint: orchestrator must block on user input before invoking the agent. |

### RoutingSchema

| Field | Type | Required | Description |
|---|---|---|---|
| `tag_routes` | `Record<string, string \| { parallel_dispatch: ParallelDispatchSchema }>` | no | Maps slice tags to agent refs or parallel groups. |
| `default` | `string` | yes | Agent ref used when no tag matches. |

### ParallelDispatchSchema

| Field | Type | Required | Description |
|---|---|---|---|
| `group` | `string[]` (min 2) | yes | Ordered list of agent refs dispatched in one Agent message. |
| `policy` | `"wait_for_all"` | yes | Orchestrator waits for every artifact before continuing. |
| `halt_on` | `"any_FAIL"` | yes | Any FAIL result halts the slice. |

### AggregationSchema

| Field | Type | Description |
|---|---|---|
| `halt_on_any_FAIL` | `boolean` | Whether any FAIL in the group halts the slice. |
| `wait_for_all` | `boolean` | Whether the orchestrator waits for every artifact. |

## Built-in Workflows

| Name | Use case | Phase shape |
|---|---|---|
| `regular` | Standard slice — tag-routed builder + parallel reviewer+validator fanout | builder (tag-routed) → reviewer (3-way parallel_dispatch) |
| `quick` | Light slice — single combined inspector+verifier, no fanout | builder → reviewer_validator (1 agent) |
| `spike` | Throwaway exploration — no review/validate gates | builder only |
| `release` | Release slice — full quality chain + deployer with user approval | builder → reviewer (3-way) → validator → deployer (require_user_approval) |

## Slice Frontmatter

A slice file may declare:

```yaml
---
id: SLICE-NN
workflow: quick   # or regular / spike / release
# ... other fields
---
```

When `workflow:` is absent, `default_workflow` (currently `regular`) is used.

The field is validated by `scripts/validate-slices.ts`: if the value does not
match a key in `.claude/workflows.yaml`, the validator exits 1 with:

```
VALIDATE-SLICES error: <filename> workflow "<value>" not declared in .claude/workflows.yaml (available: <list>)
```

## `${env:VAR}` Substitution

The loader applies env substitution **after** YAML parse and **before** Zod
validation. Only string values whose **entire** value matches the marker form
are substituted. Keys are never substituted.

### Syntax

| Form | Behaviour |
|---|---|
| `${env:VAR_NAME}` | Replaced with `process.env.VAR_NAME`. Throws if unset. |
| `${env:VAR_NAME:-default}` | Replaced with `process.env.VAR_NAME` if set, else `default`. |

Variable names must match `/^[A-Z_][A-Z0-9_]*$/` (uppercase + underscore convention).

### Embedded interpolation — NOT supported in v1

The form `"prefix-${env:X}-suffix"` is **not** substituted and is treated as a
literal string. Only whole-value markers are supported.

### EnvSubstitutionError

`scripts/lib/workflow-config.ts` exports `EnvSubstitutionError` with a
`.variable: string` field identifying the unset variable:

```ts
import { EnvSubstitutionError } from "./scripts/lib/workflow-config.ts";

try {
  await loadWorkflowConfig(repoRoot);
} catch (err) {
  if (err instanceof EnvSubstitutionError) {
    console.error(`Missing env var: ${err.variable}`);
  }
}
```

### Workflow-name uniqueness

YAML map keys are inherently unique per the YAML 1.2 spec. Duplicate keys
produce last-write-wins behavior in the `yaml` package (the second value
silently overwrites the first). The `validate-workflows.ts` name-format check
does not separately enforce uniqueness; rely on YAML parser behavior.
Document any duplicate-key fixture tests accordingly.

## Validation Rules

`node ./scripts/validate-workflows.ts` (or with `--config <path>`) enforces:

| # | Check | Stderr format on failure |
|---|---|---|
| 1 | Zod schema | `VALIDATE-WORKFLOWS error: (fatal) (0) Workflow config shape error: ...` |
| 2 | Phase order: builder → reviewer/reviewer_validator → validator → deployer | `VALIDATE-WORKFLOWS error: <workflow> <idx> phase order violation: ...` |
| 3 | Parallelism cap: `parallel ≤ 4`; `parallel_dispatch.group` 2–8 | `VALIDATE-WORKFLOWS error: <workflow> <idx> parallelism cap exceeded: ...` |
| 4 | Agent existence: every `crew:*` ref resolves to `agents/<name>.md` | `VALIDATE-WORKFLOWS error: <workflow> <idx> <context>: agent "<ref>" not found` |
| 5 | Default workflow exists | `VALIDATE-WORKFLOWS error: (config) (default) default_workflow "<name>" not found in workflows` |
| 6 | Workflow-name format: `/^[a-z][a-z0-9_-]*$/` | `VALIDATE-WORKFLOWS error: (config) (name) workflow name "<key>" must match /^[a-z][a-z0-9_-]*$/` |
| 7 | `release` deployer user-approval: deployer phase must have `require_user_approval: true` | `VALIDATE-WORKFLOWS error: release <idx> deployer phase missing require_user_approval: true` |
| 8 | Circular workflow routing: cycles in `workflow:<name>` tag_route values | `VALIDATE-WORKFLOWS error: (config) (routing) cycle detected: <A> -> <B> -> ... -> <A>` |

Exit code 0 on success; stdout: `Workflows OK: <N> workflow(s) validated`.
Exit code 1 on any failure; one grep-able stderr line per error (DEC-024).

## Rationale

- **DEC-TBD-1 (cross-repo field parity):** field names in `ParallelDispatchSchema`
  and `AggregationSchema` mirror the loop plugin's `FanoutResult` type
  (`post-builder-fanout.mts`) so the loop plugin can vendor the hero-crew
  reference dispatcher by import path without re-keying.
- **`${env:}` prefix opt-in:** rejected bare `${VAR}` (collides with future
  template extensions) and `$VAR` (too greedy, collides with literal shell-style
  values). The `${env:` prefix is the explicit opt-in marker — non-matching
  strings pass through unchanged.
- **Embedded interpolation deferred:** whole-value-only substitution covers the
  common CI-secret-injection use case without the complexity of a string-template
  parser. Embedded support is a schema-bump addition for SLICE-C or later.
