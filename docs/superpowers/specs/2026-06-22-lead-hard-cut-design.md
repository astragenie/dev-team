# Hard Cut: Remove `lead` Agent — Design

**Date:** 2026-06-22
**Author:** dispatched session
**Status:** draft pending user review

## Goal

Remove `lead` as an agent role. Replace with `dispatcher` (a concept, not an agent) throughout the active codebase. Make `/crew:build` the explicit dispatcher for build work.

## Motivation

User removed `agents/lead.md` in main. Active codebase still has 50+ references that assume `lead` is a callable agent. References must be cut or rewritten before the next build can dispatch correctly. Peer-dispatch (FEAT-163) already made the "lead is the only caller" assumption wrong; lead removal closes that gap.

## Non-goals

- Migrating lead behavior into a new agent (no replacement agent)
- Building a `build.yaml` skeleton (future agent/workflow separation FEAT)
- Adding a `crew:build` skill (current command stays)
- Rewriting `.claude/artifacts/` history (durable audit trail)
- Touching auto-memory (drifts naturally)

## Architecture after the cut

```
OLD: user → /crew:build → "Act as the lead" → main thread dispatches crew:lead → lead dispatches builder
NEW: user → /crew:build → main thread reads inline routing → dispatches specialist builder direct
```

The slash command IS the dispatcher. No agent in between. Main thread reads `commands/build.md`, picks the specialist by FEAT tag, dispatches via Agent tool, then runs review/validate gates per existing workflow.

## Scope

### Files deleted

- `agents/lead.md` (sync from main where user already deleted)
- `agents/3rdparty/backup/lead.md`
- `evals/agents/crew-lead.yaml`

### Files rewritten — `lead` → `dispatcher` (or removed where redundant)

- All `agents/*.md` active prompts. Inspector's existing `orchestrator` refs also normalized to `dispatcher` for single-noun convention.
- All `commands/*.md`. `commands/build.md` gets a structural rewrite — preamble swaps "Act as the lead" for explicit router prose with the inline routing table.
- All `skills/**/SKILL.md` workflow + domain skills.
- `docs/routing-table.md`, `docs/architecture/*.md`, `docs/standards/*.md`, `CHANGELOG.md`.
- Tests: `tests/agent-prompt-content.test.ts`, `tests/validate-agents.test.ts`.
- Scripts: `scripts/validate-agents.ts`.

### Files untouched

- `.claude/artifacts/**` (audit trail)
- Memory under `C:\Users\serge\.claude\projects\...` (drifts naturally)
- Backlog entries already marked done (`.claude/artifacts/loop/backlog/done/*`)

## `commands/build.md` rewrite

Replace the existing "Act as the lead for a bounded feature delivery run" preamble with:

```
You are the dispatcher for /crew:build. Pick the specialist builder by FEAT tag, dispatch via the Agent tool, then run the review and validate gates per the routing-table.

Routing table (inline):
| FEAT tag                                            | Specialist          |
|-----------------------------------------------------|---------------------|
| stack:typescript + surface:ui                       | crew:frontend-dev   |
| stack:typescript + surface:backend                  | crew:backend-dev    |
| stack:typescript + surface:cross-layer              | crew:fullstack-dev  |
| stack:typescript + surface:plugin                   | crew:aiplugin-dev   |
| stack:csharp                                        | crew:backend-dev    |
| no clear tag                                        | crew:fullstack-dev  |

After the builder returns PASS:
1. Dispatch crew:inspector for review.
2. If the change is runnable, dispatch crew:verifier for behavior validation.
3. Run /crew:ship gates only on explicit user approval.
```

The rest of `commands/build.md` (workspace verify, wake-up brief read, frame step, handoff discipline) stays — those are dispatcher mechanics, not lead-as-agent assumptions.

## Validator gates

### `scripts/validate-agents.ts`

Add a body-text check that fails any active agent containing `\blead\b` or `crew:lead`. Apply to all files in `agents/*.md` (not `agents/3rdparty/` which is third-party stock).

```ts
const NO_LEAD_REF_REQUIRED = new Set([
  "architect",
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "aiplugin-dev",
  "inspector",
  "inspector-verifier",
  "verifier",
  "integrator",
  "release-engineer",
  "document-writer",
  "refactor",
  "researcher",
  "investigator",
  "qa-expert",
  "performance-engineer",
  "uxdesigner",
  "parallel-runner"
]);

function checkNoLeadRef(text, fm, label, errors) {
  if (!NO_LEAD_REF_REQUIRED.has(fm.name)) return;
  // Strip frontmatter
  const body = text.replace(/^---[\s\S]*?---\n/, "");
  const matches = body.match(/\bthe lead\b|\bto the lead\b|\bby the lead\b|\bcrew:lead\b/gi);
  if (matches?.length) {
    errors.push(`${label}: must not reference 'lead' agent. Found: ${[...new Set(matches)].join(", ")}`);
  }
}
```

### `tests/agent-prompt-content.test.ts`

Replace inspector's existing single `no 'lead' caller assumption` test with a parametrized loop over all agents in `NO_LEAD_REF_REQUIRED`.

## Failure mode handling

When validator catches a residual `lead` reference (e.g. in a new agent prompt added later), the error message names the agent + the matched phrases. Fix is mechanical — replace each match per the table. No new agent added without passing this gate.

## Test plan

1. `node ./scripts/validate-agents.ts` — must pass with new check active
2. `bun test tests/agent-prompt-content.test.ts` — parametrized no-lead test passes for all agents
3. `bun run lint` — zero warnings
4. `bun run test` — full suite green
5. `node ./scripts/e2e-smoke.ts` — `/crew:build` smoke against a temp sample repo successfully dispatches a specialist without referencing lead

## Risks

| Risk | Mitigation |
|---|---|
| Skill prompts in `skills/**/SKILL.md` reference `lead-orchestration` skill or `crew:lead` agent — chains break | Grep first, rewrite or delete dead skills before validator turns on |
| Third-party `agents/3rdparty/*` (architect-reviewer, code-reviewer, etc.) may reference lead in their own prompts | Exclude `agents/3rdparty/*` from `NO_LEAD_REF_REQUIRED` set — those are imported from external plugins |
| `commands/orchestrate-slice.md` is the most complex command — biggest rewrite | Treat as separate slice; ship `commands/build.md` first, validate, then orchestrate-slice |
| Docs in `docs/architecture/architecture.md` reference lead as part of the canonical 6-role team | Update docs in the same slice as agents to keep narrative consistent |

## Out-of-scope follow-ups

- `build.yaml` skeleton + agent/workflow YAML separation
- `crew:build` migrated from command to first-class skill
- Auto-memory cleanup pass for stale `lead` refs

## Acceptance criteria

- `agents/lead.md`, `agents/3rdparty/backup/lead.md`, `evals/agents/crew-lead.yaml` deleted
- All active agents pass `NO_LEAD_REF_REQUIRED` validator
- `/crew:build` dispatches a specialist builder without naming `lead`
- `bun run test` + `node ./scripts/validate-agents.ts` green
- CHANGELOG entry: `### Removed — lead agent (hard cut)`
