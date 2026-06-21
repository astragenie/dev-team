---
id: FEAT-181
status: triaged
priority: P2
category: quality
target_release: null
created: 2026-06-21
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.55
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.65
pm_technical_risk: 0.25
pm_dependency_depth: 0.15
composite_score: 0.59
autonomous_safe: true
tags: [badges, workflow-state, validator, cli, single-source-of-truth, drift-prevention]
triage_notes: "Derived 2026-06-21 from FEAT-180 session — adding `specialist_recommended` badge required updating 3 separate locations (CLI help string in scripts/crew.ts, BADGE_HANDLERS map in scripts/lib/workflow-state.ts, and the badge taxonomy table in agents/fullstack-dev.md) with no validator enforcing alignment. Drift between the three locations would silently fail (badge accepted by CLI but no handler → no state write → no dispatcher reaction). No catalog doc exists; devs find badges by grep. autonomous_safe=true because the work is read-only consolidation + a new CI validator + a docs/standards markdown — no agent prompt changes, no runtime behavior changes, no migration risk."
---

# FEAT-181: Badge catalog as single source of truth — eliminate workflow-state badge drift

## Description

The workflow-state badge system has three independent locations carrying the badge name list, with no validator enforcing alignment:

1. **`scripts/lib/workflow-state.ts`** — `BADGE_HANDLERS` map. Each entry resolves a badge name to `{ selector, status, custom? }` and is the runtime authority for what writing the badge does.
2. **`scripts/crew.ts`** — `mark-badge` CLI help text (line ~278). Hand-maintained string listing accepted badge names + a backward-compat alias note.
3. **Agent prompts** — each builder/release/inspector prompt carries a badge taxonomy table or invocation example, and the lead drift lint test's whitelist enumerates badge name patterns (`escalated_to_lead`, `escalated_to_dispatcher`, `specialist_recommended`).

Adding a new badge requires updating all three. If a contributor forgets to update one:

- CLI accepts a badge name that has no handler → silent no-op, no state write, no dispatcher reaction.
- BADGE_HANDLERS gains an entry that the CLI rejects → agents can't emit it without bypassing the CLI.
- Agent prompts cite a badge that doesn't exist in either layer → typed but useless.

There is also no catalog doc explaining for each badge:
- When it's emitted (which situation by which agent)
- Who reads it (brief-me / wake-up / orchestrate-slice / lead / validators)
- What the reader does about it (route to specialist, halt slice, surface in summary)

Result: devs grep the codebase to discover badges, and reaction logic is scattered across N consumers with no shared contract.

## Acceptance hints

### Catalog document

`docs/standards/badges.md`:

```markdown
# Workflow Badge Catalog

Each row documents the badge name, when it's emitted, who reads it, and what reaction the reader takes.

| Badge | When emitted by | Read by | Reaction |
|---|---|---|---|
| `review_required` | (auto) gate transitions when code change lands | brief-me, orchestrate-slice | Display "review pending"; block slice complete until review_passed |
| `review_passed` | crew:inspector after PASS review | brief-me, dev.stable commit gate | Unlocks autonomous commit when dev.stable: true |
| ... |
| `blocked` | Any agent hitting external blocker | brief-me, orchestrate-slice, lead | Halt slice; surface note in summary; lead re-routes on next cycle |
| `specialist_recommended` | Builder (FEAT-180) detecting work belongs to different specialist | lead | Read note `<specialist>: <why>`; dispatch named specialist on fresh slice |
| `escalated_to_dispatcher` | Builder hitting qualitatively-harder-than-dispatched task | lead | Read note; decompose / re-route / re-scope |
| `escalated_to_lead` | (backward-compat alias for escalated_to_dispatcher) | same | same |
```

### Programmatic source of truth

`scripts/lib/badge-catalog.ts`:

```ts
export interface BadgeDefinition {
  name: string;
  emittedBy: string;          // "any builder" | "crew:inspector" | "(auto)"
  readers: string[];          // ["brief-me", "lead", "orchestrate-slice"]
  reaction: string;           // one-sentence what readers do
  gateSelector: (run: WorkflowRun) => [object, string]; // selector for state write
  gateStatus: GateStatus;
  custom?: boolean;
  aliasOf?: string;           // when this is a backward-compat alias
  deprecated?: boolean;
}

export const BADGE_CATALOG: Record<string, BadgeDefinition> = {
  // ... ~20 entries covering today's badges + the new ones
};
```

Then refactor:

- `scripts/lib/workflow-state.ts` `BADGE_HANDLERS` is computed from `BADGE_CATALOG` (drop manual map).
- `scripts/crew.ts` mark-badge CLI help text is generated from `Object.keys(BADGE_CATALOG)` (drop manual string).

### Validator (new CI gate)

`scripts/validate-badges.ts`:

- Parse `docs/standards/badges.md` table → set of badge names.
- Compare against `Object.keys(BADGE_CATALOG)` → must match exactly.
- Parse `mark-badge` help text → must match.
- Grep agent prompts for `mark-badge --badge <name>` invocations → every cited badge must exist in catalog. Conversely, every catalog entry with `readers: ["builder"]` (or similar) must appear in at least one builder prompt's taxonomy.
- Run in CI as one of the manifest-validate gates.

### CLI surface

`scripts/crew.ts` `badges` subcommand:

```bash
node scripts/crew.ts badges               # prints catalog table
node scripts/crew.ts badges --json        # machine-readable
node scripts/crew.ts badges <badge-name>  # detail view: when emitted, readers, reaction
```

### Migration

- All three locations (BADGE_HANDLERS, CLI help string, agent prompts) keep working during the transition; the refactor is internal.
- Backward-compat aliases (`escalated_to_lead` → `escalated_to_dispatcher`) stay in catalog with `aliasOf` field; both resolve to the same state write.
- Tests in `tests/cli-workflow.test.ts` + `tests/agent-prompt-content.test.ts` continue to pass.

### Out of scope

- Rewriting agent prompts to use catalog-driven invocations (deferred — prompts can hand-author the badge name string forever; catalog only ensures it exists).
- Multi-tenant badge namespaces.
- Persisted badge history (badge surfaces are point-in-time state, not events).

## Notes

- Trigger: 2026-06-21 session adding `specialist_recommended` badge required touching 3 files + GateStatus union with no validator catching drift.
- Related FEATs: FEAT-180 (builder rewrite that introduced specialist_recommended), FEAT-155 / FEAT-157 (other workflow-state hardening).
- Estimated 1 slice (~300 LoC: catalog + refactor + validator + tests). autonomous_safe.
