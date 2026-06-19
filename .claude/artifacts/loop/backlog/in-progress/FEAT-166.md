---
id: FEAT-166
status: in-progress
started_at: 2026-06-19
priority: P2
category: workflow
target_release: null
created: 2026-06-19
depends_on: []
slices: [SLICE-78]
derived_from: null
tags: [workflow, dispatcher, yaml-config, lead-orchestration, fan-out]
---

# FEAT-166: Declarative workflow YAML — configurable build strategies (regular / quick / spike)

## Description

Today the dispatch shape (builder → reviewer → validator with N parallelism)
is hard-coded across:
- `src/scripts/lib/slice-linker/dispatch.mts` (autonomous loop path)
- `agents/crew/lead.md` (interactive `/crew:build` path)
- per-skill prompt fragments

Changing it requires editing multiple agent prompts in lockstep. There
is no "ship light slice on quick workflow, ship critical slice on
regular workflow with 2 parallel reviewers".

This FEAT introduces a declarative workflow definition consumed by both
dispatch paths.

## Acceptance hints

### File

`.claude/workflows.yaml`:

```yaml
version: 1
default_workflow: regular

workflows:
  regular:
    description: Standard slice — builder + 2 parallel reviewers + validator
    phases:
      - role: builder
        agent: crew:builder
        emit: handoff
      - role: reviewer
        agent: crew:inspector
        parallel: 2
        trigger:
          on: handoff_written
          from: builder
        gate:
          policy: all_pass
          fail_action: route_to_fix
      - role: validator
        agent: crew:verifier
        gate:
          policy: blocking
        skip_when: changed_files matches "^docs/"

  quick:
    description: Light slice — combined builder + inspector-verifier
    phases:
      - role: builder
        agent: crew:fullstack-dev
      - role: reviewer_validator
        agent: crew:inspector-verifier
        parallel: 1

  spike:
    description: Throwaway exploration — no review/validate gates
    phases:
      - role: builder
        agent: crew:fullstack-dev

  release:
    description: Release slice — builder + 2 reviewers + validator + deployer
    phases:
      - role: builder
        agent: crew:builder
      - role: reviewer
        agent: crew:inspector
        parallel: 2
      - role: validator
        agent: crew:verifier
      - role: deployer
        agent: crew:release-engineer
        require_user_approval: true
```

### Slice frontmatter

```yaml
workflow: regular   # or quick / spike / release
# falls back to default_workflow when unset
```

### Components

- `scripts/lib/workflow-config.ts` — loader + Zod schema for
  `workflows.yaml`, resolves `default_workflow`, validates agent ↔
  peer-dispatch whitelist, supports `${env}` substitution.
- `src/scripts/lib/slice-linker/dispatch.mts` — replace hard-coded
  phase sequence with `expandWorkflow(slice.workflow)`. Preserve
  current `regular` behavior bit-for-bit (golden trace test).
- `agents/crew/lead.md` — read workflow at slice start; embed phase
  list into dispatch plan. Lead prompt stays ≤350 lines per
  `docs/governance.md`.
- `scripts/validate-workflows.ts` — new CI gate. Enforces phase order
  (builder → reviewer → validator → deployer), role enum, agent
  exists, parallelism cap (≤4), peer-dispatch whitelist consistency.
- `docs/standards/workflow-schema.md` — schema reference + examples.
- `docs/routing-table.md` — add "Workflow selection" row (lead checks
  slice frontmatter → falls back to default).

### Design constraints

- **Backward compatible.** Slices without `workflow:` field default
  to `regular`, which must match today's hard-coded behavior exactly.
- **No new runtime dep.** YAML parsed via `yaml` package already in
  `node_modules`. Schema via existing `zod`.
- **No env coupling.** Workflow choice is per-slice frontmatter or
  default — not CLI flag, not env var.
- **Validator is a CI gate.** Drift between `workflows.yaml` and
  agent peer-dispatch whitelists must fail CI.
- **Lead prompt size budget.** Workflow expansion logic lives in
  `scripts/lib/workflow-config.ts`, not lead prompt. Lead reads
  expanded result via JSON return from a helper invocation.

### Per-slice decomposition suggestion

- **SLICE-A** (autonomous_safe=false — dispatcher refactor):
  schema + loader + validator script + tests + `default_workflow:
  regular`. No behavior change for existing slices. Golden trace test.
- **SLICE-B** (autonomous_safe=false): add `quick` + `spike` + `release`
  workflows. Test slice frontmatter routing. Document.
- **SLICE-C** (autonomous_safe=true — lead prompt clarification):
  update lead.md to read workflow at slice start, document fallback.

### Out of scope

- Per-phase model override (already possible via agent frontmatter).
- Workflow versioning / migration tooling — `version: 1` field
  reserved for future use.
- Conditional phases beyond `skip_when` glob — full expression
  language deferred.

## Notes

- Sister FEATs: 165 (Langfuse+OTel) + 167 (Prompt ADR). See
  [[project-obs-evals-workflow-plan]] for full plan.
- Decision capture: `default_workflow: regular` is the safe default
  because today's behavior matches it; spike / quick are opt-in only.
- Open Q for SLICE-A: should `crew:fix` flow have its own workflow
  shape (`fix` workflow with reviewer-first)? Punt to SLICE-B.
