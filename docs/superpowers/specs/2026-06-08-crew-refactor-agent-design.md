# Design: crew:refactor Agent

- Date: 2026-06-08
- Status: approved
- Author: lead (brainstorming session)

## Problem

Recurring review rejections and grade collapses trace to three mechanical quality gaps that no existing crew agent owns:

1. **Stale refs** — after cuts/renames/migrations, dead variable names, broken routing-table rows, and outdated frontmatter accumulate (root cause of SLICE-47 reject: `COPYWRITER_PATH` stale, frontmatter description not updated).
2. **Complexity creep** — agent prompts and skills drift past governance caps (>300 lines for agents, >200 for skills) with no enforcement pass.
3. **Consistency drift** — version fields across `package.json` / `plugin.json` / `marketplace.json` diverge; routing-table rows go stale (root cause of SLICE-46 reject: `plugin.json` not bumped).

## Solution

A first-class crew agent (`crew:refactor`) that runs as a standalone slice, scans the repo for all three concern areas, fixes directly, and writes an artifact for the reviewer gate.

## Architecture

`crew:refactor` sits at the same tier as `builder`, `reviewer`, `validator`. Not 3rdparty. Standalone phase — lead dispatches it independently of feature work.

**Workflow position:**
```
lead → crew:refactor (scan + fix) → crew:reviewer (quality-sweep artifact + diff)
```

**Invocation:**
```
crew:refactor --scope "<path hint>" --concerns <stale-ref,complexity,consistency>
```
Omit `--scope` and `--concerns` for full-repo sweep across all three areas.

**Model:** `sonnet` — mechanical scanning work, not architecture reasoning.

## Concern Areas

| Area | What it fixes |
|---|---|
| `stale-ref` | Dead variable names, stale frontmatter descriptions, broken routing-table rows, outdated agent descriptions after cuts/renames |
| `complexity` | Agent prompts >300 lines, skills >200 lines, mixed-responsibility files |
| `consistency` | Version sync across `package.json` / `plugin.json` / `marketplace.json`, frontmatter field completeness, routing-table alignment |

## Data Flow

```
1. SCAN   — grep/glob all three concern areas
            produce raw findings list (file:line, concern type, severity)

2. TRIAGE — bucket findings:
            🔴 red   = governance violation (cap breach, broken ref, version mismatch)
            🟡 yellow = hygiene (stale description, minor drift)
            needs-human = requires architectural judgment → skip, log

3. FIX    — apply red findings first, then yellow
            max 3 files changed per finding to limit blast radius
            skip needs-human items, log reason

4. REPORT — write quality-sweep artifact before committing:
            - findings count by concern area + severity
            - each fix: file, before snippet, after snippet, reason
            - skipped items with reason
            - CI command to run for verification
```

**Output artifact path:**
```
.claude/artifacts/crew/quality/YYYYMMDDTHHMMSSZ-quality-sweep-<scope-slug>.md
```

## Guardrails

- Never redesigns logic — only renames, removes, aligns, trims
- Never touches files outside detected findings (no opportunistic cleanup)
- If a fix requires understanding intent → `needs-human` in report, skip
- **Hard stop: >20 files affected** — writes partial report, halts, flags to lead for scope re-approval before continuing
- Does not attempt CI auto-repair on failure — logs `ci-fail` and stops (builder's job)
- Does not claim files via crew claim system (claims whatever it touches implicitly)

## Agent File

**Path:** `agents/refactor.md`

**Frontmatter:**
```yaml
---
name: refactor
description: Code quality specialist — scans for stale refs, complexity violations, and consistency drift; fixes directly; writes quality-sweep artifact for reviewer.
model: sonnet
effort: high
maxTurns: 30
color: yellow
---
```

**Skills consulted:**
- `skills/domain/prompt-engineering/` — for agent/skill `.md` edits
- `skills/workflow/git-commit/` — commit message authoring
- `skills/workflow/systematic-debugging/` — if a stale ref root cause is ambiguous

## Routing Table

New row in `docs/routing-table.md`:

| Trigger | Agent |
|---|---|
| Standalone quality sweep slice; stale-ref / complexity / consistency concerns | `crew:refactor` |

## Testing

- `tests/agent-topology.test.ts` — add `refactor` to `EXPECTED_AGENTS`
- `node ./scripts/validate-agents.ts` — covers frontmatter + line cap
- No TypeScript behavior tests — agent is prompt content; existing 446-test suite is the regression contract

## Out of Scope

- Feature implementation (builder's job)
- Architectural redesign (architect's job)
- Security audit (CSO / security-review skill)
- Performance profiling of runtime code (no runtime in this plugin)

## Success Criteria

1. `crew:refactor` can be dispatched by lead for a standalone quality slice
2. Quality-sweep artifact written before any commits
3. Reviewer can read artifact + diff and make a pass/fail decision
4. `agent-topology.test.ts` passes with `refactor` in `EXPECTED_AGENTS`
5. `validate-agents.ts` passes (frontmatter + line cap compliance)
6. Hard stop triggers correctly when >20 files would be affected
