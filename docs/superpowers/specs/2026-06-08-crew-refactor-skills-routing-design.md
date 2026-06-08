# Design: crew:refactor Skills Routing Table

- Date: 2026-06-08
- Status: approved
- Author: lead (brainstorming session)

## Problem

`agents/refactor.md` has a minimal 3-entry "Skills you consult" section with no trigger-condition format. It is missing:

1. Stack-specific domain skills for consumer repos (TypeScript, React, C#, PostgreSQL, Python)
2. A safety-assessment gate (`reviewing-code`) before touching code-bearing files
3. A `skill-creator` reference for SKILL.md line-cap fixes
4. The trigger-condition format used by all other crew agents (builder.md pattern)

## Solution

Replace the 3-entry flat list with a 10-entry trigger-condition routing table matching builder.md's format exactly.

## Change

**File:** `agents/refactor.md` — "Skills you consult" section only.

**Replace:**
```markdown
## Skills you consult (per routing-table)

- Authoring a git commit message → `skills/workflow/git-commit/`
- Editing `agents/*.md` or `skills/**/*.md` → `skills/domain/prompt-engineering/`
- Ambiguous stale-ref root cause → `skills/workflow/systematic-debugging/`
```

**With:**
```markdown
## Skills you consult (per routing-table)

- Before fixing any `.ts`, `.tsx`, `.cs`, `.sql`, or `.py` file → `skills/workflow/reviewing-code/`
- `.ts` / `.tsx` edit → `skills/domain/typescript-pro/`
- React component / hooks (`*.tsx`, `*.jsx`) → `skills/domain/react-engineering/`
- `.cs` / .NET edit → `skills/domain/dotnet/`
- SQL / migration file → `skills/domain/database-architecture/`
- `.py` edit → `skills/domain/python-pro/`
- `agents/*.md` or `skills/**/*.md` edit → `skills/domain/prompt-engineering/`
- Editing a `SKILL.md` specifically → `skills/meta/skill-creator/`
- Authoring a git commit message → `skills/workflow/git-commit/`
- Ambiguous stale-ref root cause → `skills/workflow/systematic-debugging/`
```

## What Does Not Change

- Agent frontmatter (name, model, effort, maxTurns, color)
- Concern areas (stale-ref, complexity, consistency)
- Workflow (SCOPE → SCAN → TRIAGE → FIX → REPORT)
- Guardrails (hard stop >20 files, needs-human, ci-fail)
- Report contract

## Success Criteria

1. `agents/refactor.md` "Skills you consult" section contains exactly the 10 entries above
2. `node ./scripts/validate-agents.ts` exits 0 (line cap + frontmatter still valid)
3. `node --test --experimental-strip-types` — 446+ tests pass
4. `npm run lint` — zero warnings
