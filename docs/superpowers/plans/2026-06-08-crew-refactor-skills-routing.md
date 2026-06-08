# crew:refactor Skills Routing Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-entry flat skills list in `agents/refactor.md` with a 10-entry trigger-condition routing table covering full-stack consumer repos (TS, React, C#, SQL, Python) plus a reviewing-code safety gate.

**Architecture:** Pure content edit to one `.md` file. No TypeScript changes. CI gates (`validate-agents`, `node --test`) are the verification contract.

**Tech Stack:** Markdown, Node 22.6+ (`--experimental-strip-types`), `node --test`.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `agents/refactor.md:91-95` | Replace "Skills you consult" section (3 entries → 10 entries) |

---

## Task 1: Replace skills routing table in agents/refactor.md

**Files:**
- Modify: `agents/refactor.md:91-95`

- [ ] **Step 1: Locate the current "Skills you consult" section**

Open `agents/refactor.md`. The section at lines 91–95 currently reads:

```markdown
## Skills you consult (per routing-table)

- Authoring a git commit message → `skills/workflow/git-commit/`
- Editing `agents/*.md` or `skills/**/*.md` → `skills/domain/prompt-engineering/`
- Ambiguous stale-ref root cause → `skills/workflow/systematic-debugging/`
```

- [ ] **Step 2: Replace with the 10-entry routing table**

Replace the entire block above with:

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

- [ ] **Step 3: Verify line count stays under 300**

```powershell
(Get-Content agents/refactor.md).Count
```

Expected: under 300 (was 141, adding 7 lines = ~148).

- [ ] **Step 4: Run validate-agents**

```
node ./scripts/validate-agents.ts
```

Expected output: `Agents OK: 12 agent(s) checked.` Exit code 0.

- [ ] **Step 5: Run full test suite**

```
node --test --experimental-strip-types
```

Expected: `pass 446` (or more), `fail 0`.

- [ ] **Step 6: Run lint**

```
npm run lint
```

Expected: zero output (zero warnings).

- [ ] **Step 7: Commit**

```bash
git add agents/refactor.md
git commit -m "feat(crew:refactor): expand skills routing — full-stack + reviewing-code safety gate"
```

- [ ] **Step 8: Push**

```bash
git push origin main
```
