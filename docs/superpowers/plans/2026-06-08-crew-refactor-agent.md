# crew:refactor Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `crew:refactor` as a first-class crew agent that scans for stale refs, complexity cap violations, and consistency drift — fixes directly, writes a quality-sweep artifact for the reviewer gate.

**Architecture:** Single agent file (`agents/refactor.md`) at the same tier as `builder` and `reviewer`. Standalone slice workflow: lead dispatches → refactor scans + fixes → reviewer reads artifact + diff. No new TypeScript; the existing `validate-agents.ts` CI gate and `agent-topology.test.ts` topology test cover it structurally.

**Tech Stack:** Markdown agent prompt, Node ESM test suite (`node --test --experimental-strip-types`), TypeScript test file.

---

## File Map

| Action | File | What changes |
|---|---|---|
| Create | `agents/refactor.md` | New agent prompt |
| Modify | `tests/agent-topology.test.ts:17-29` | Add `"refactor"` to `EXPECTED_AGENTS` |
| Modify | `docs/routing-table.md` | Add standalone quality-sweep row |
| Modify | `README.md:11,278` | Update agent count 9→12; add `refactor` to list |
| Modify | `docs/governance.md:127` | Add `refactor` to `autonomous_safe: false` policy sentence |

---

## Task 1: Add `"refactor"` to agent topology test (write failing test first)

**Files:**
- Modify: `tests/agent-topology.test.ts:17-29`

- [ ] **Step 1: Open `tests/agent-topology.test.ts` and locate `EXPECTED_AGENTS`**

The set currently ends at line 28:
```typescript
const EXPECTED_AGENTS = new Set([
  "lead",
  "builder",
  "builder-fe",
  "builder-be",
  "reviewer",
  "validator",
  "deployer",
  "integrator",
  "researcher",
  "architect",
  "uxdesigner"
]);
```

- [ ] **Step 2: Add `"refactor"` to the set**

```typescript
const EXPECTED_AGENTS = new Set([
  "lead",
  "builder",
  "builder-fe",
  "builder-be",
  "reviewer",
  "validator",
  "deployer",
  "integrator",
  "researcher",
  "architect",
  "uxdesigner",
  "refactor"
]);
```

- [ ] **Step 3: Run the topology test to confirm it FAILS (agent file does not exist yet)**

```
node --test --experimental-strip-types tests/agent-topology.test.ts
```

Expected output contains:
```
Expected agent "refactor" is missing from agents/ root
```

---

## Task 2: Create `agents/refactor.md`

**Files:**
- Create: `agents/refactor.md`

- [ ] **Step 1: Create the file with this exact content**

```markdown
---
name: refactor
description: Code quality specialist — scans for stale refs, complexity cap violations, and consistency drift; fixes directly; writes a quality-sweep artifact for the reviewer gate.
model: sonnet
effort: high
maxTurns: 30
color: magenta
---

## Custom instructions

Before starting, check for custom instructions in this order:
1. Global: `~/.claude/crew/refactor.md`
2. Repo: `.claude/crew/refactor.md`

Repo > global > defaults below.

---

You are a refactor agent on a Claude Code engineering team.

Your job is to scan the repo for mechanical quality issues across three concern areas, fix them directly, and produce a quality-sweep artifact the reviewer can inspect.

You do NOT add features, redesign logic, or make architectural decisions. You rename, remove, align, and trim.

---

## Concern areas

**stale-ref** — Dead variable names, stale frontmatter descriptions, broken routing-table rows, outdated agent descriptions left behind after cuts or renames. Example: a variable named `COPYWRITER_PATH` after the copywriter agent was removed.

**complexity** — Agent prompts (`agents/*.md`) over 300 lines. Skills (`skills/**/*.md`) over 200 lines. Files with mixed responsibilities that can be trimmed without behavioral change.

**consistency** — Version fields out of sync across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`. Frontmatter fields missing or mismatched. Routing-table rows that reference removed agents or stale triggers.

---

## Workflow

### 1. SCOPE
Read the lead's dispatch instruction. If `--scope` is given, restrict scanning to that path. If `--concerns` is given, restrict to those concern areas. If neither is given, scan the full repo across all three concern areas.

### 2. SCAN
For each active concern area, run grep/glob patterns to build a raw findings list. Each finding must record: file path, line number, concern area, severity, and a one-line description.

Severity rules:
- **red** — governance violation: line cap breach, broken ref that would cause a runtime or routing failure, version mismatch across manifests
- **yellow** — hygiene: stale description, minor drift, cosmetic inconsistency
- **needs-human** — fix requires understanding intent, not just mechanical alignment; skip and log

### 3. TRIAGE
Group findings by severity. Confirm the findings list before fixing — do not silently expand scope.

**Hard stop:** If the total count of files that would be written exceeds 20, write a partial triage report, halt, and surface to the lead for scope re-approval before continuing.

### 4. FIX
Apply red findings first, then yellow. Skip `needs-human` findings — log them in the report with reason.

Per-finding limit: touch at most 3 files per individual finding to limit blast radius. If a finding would require touching more than 3 files, escalate it as `needs-human`.

Do not touch files that have no finding. No opportunistic cleanup.

### 5. REPORT
Write the quality-sweep artifact **before committing** to `.claude/artifacts/crew/quality/` using the naming pattern:

```
YYYYMMDDTHHMMSSZ-quality-sweep-<scope-slug>.md
```

The artifact must contain:
- Scope and concern areas swept
- Findings count by concern area and severity
- For each fix: file, before snippet, after snippet, reason
- For each skipped item: file, concern, reason skipped
- CI command to run for verification

After writing the artifact, commit changes, then report done.

---

## Guardrails

- Never redesign logic — only rename, remove, align, trim
- Never touch files with no finding
- Skip any fix requiring architectural judgment — log as `needs-human`
- Hard stop at >20 files affected — write partial report, halt, surface to lead
- If CI fails after fixes — log `ci-fail` in the artifact, stop; do not attempt auto-repair

---

## Skills you consult (per routing-table)

- Authoring a git commit message → `skills/workflow/git-commit/`
- Editing `agents/*.md` or `skills/**/*.md` → `skills/domain/prompt-engineering/`
- Ambiguous stale-ref root cause → `skills/workflow/systematic-debugging/`

---

## Output format

Your first response must state:
- scope and concern areas active
- what you will not touch
- estimated finding count if known

Your final response must confirm:
- artifact path written
- files changed (list)
- CI gate results
```

- [ ] **Step 2: Verify line count stays under 300**

```
(Get-Content agents/refactor.md).Count
```

Expected: under 300.

---

## Task 3: Verify topology test passes and validate-agents passes

**Files:** (none changed — running checks only)

- [ ] **Step 1: Run topology test**

```
node --test --experimental-strip-types tests/agent-topology.test.ts
```

Expected: `✓ agents/ root contains exactly the expected first-party agents`

- [ ] **Step 2: Run validate-agents**

```
node ./scripts/validate-agents.ts
```

Expected: exits 0, no warnings.

- [ ] **Step 3: Commit**

```bash
git add agents/refactor.md tests/agent-topology.test.ts
git commit -m "feat(crew:refactor): add refactor agent — stale-ref/complexity/consistency quality sweep"
```

---

## Task 4: Update `docs/routing-table.md`

**Files:**
- Modify: `docs/routing-table.md`

- [ ] **Step 1: Locate the "Code quality / simplification" row**

Current text (line ~17):
```
| **Code quality / simplification** (refactor, lint, complexity cuts) | reviewer + builder | Builder owns refactor; reviewer gates the changes. Tests must stay green. No behavioral change expected. |
```

- [ ] **Step 2: Add a new row immediately after it for the standalone quality sweep case**

Insert after the "Code quality / simplification" row:
```
| **Standalone quality sweep** (stale-ref cleanup, complexity cap enforcement, manifest consistency) | `crew:refactor` | Dispatch as a standalone slice. Agent scans repo (or scoped path), fixes directly, writes `.claude/artifacts/crew/quality/` artifact before committing. Reviewer gates the artifact + diff. Hard stop at >20 files affected. |
```

- [ ] **Step 3: Run validate-routing-table to confirm no breakage**

```
CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts
```

Expected: exits 0 or advisory only (this gate is `continue-on-error` in CI).

- [ ] **Step 4: Commit**

```bash
git add docs/routing-table.md
git commit -m "docs(routing-table): add crew:refactor standalone quality sweep row"
```

---

## Task 5: Update README.md and docs/governance.md

**Files:**
- Modify: `README.md:11,278`
- Modify: `docs/governance.md:127`

- [ ] **Step 1: Update agent count in README.md line 11**

Find:
```
Crew gives Claude Code a lead-centered workflow model with **9 first-party agents** across 3 tiers:
```

Replace with:
```
Crew gives Claude Code a lead-centered workflow model with **12 first-party agents** across 3 tiers:
```

- [ ] **Step 2: Update agent list in README.md line 278**

Find:
```
agents/          — 9 first-party agents: lead, builder, reviewer, researcher, validator, deployer, architect, uxdesigner, copywriter
```

Replace with:
```
agents/          — 12 first-party agents: lead, builder, builder-fe, builder-be, reviewer, validator, deployer, integrator, researcher, architect, uxdesigner, refactor
```

- [ ] **Step 3: Add `refactor` to `autonomous_safe: false` policy in docs/governance.md**

Find (line ~127):
```
All other agent prompts (`builder`, `reviewer`, `validator`, `deployer`, `researcher`) follow the same policy — they are also `autonomous_safe: false` because they define team trust boundaries (review independence, validation evidence, deployment gates).
```

Replace with:
```
All other agent prompts (`builder`, `reviewer`, `validator`, `deployer`, `researcher`, `refactor`) follow the same policy — they are also `autonomous_safe: false` because they define team trust boundaries (review independence, validation evidence, deployment gates).
```

- [ ] **Step 4: Run full test suite to confirm nothing broken**

```
node --test --experimental-strip-types
```

Expected: all tests pass (currently 446).

- [ ] **Step 5: Run lint and format check**

```
npm run lint && npm run format:check
```

Expected: zero warnings, no formatting diff.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/governance.md
git commit -m "docs: update agent count to 12, add refactor to governance autonomous_safe list"
```

---

## Task 6: Full CI verification

**Files:** (none changed — verification only)

- [ ] **Step 1: Run full CI suite**

```
node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && npm run lint && npm run format:check && npm run typecheck && node --test --experimental-strip-types
```

Expected: all gates exit 0, test count ≥ 446 (all pass).

- [ ] **Step 2: Confirm no new lint warnings**

Lint output must be empty (zero lines). Any warning is a blocker.

- [ ] **Step 3: Done — surface to reviewer**

Confirm artifact trail:
- `agents/refactor.md` created
- `tests/agent-topology.test.ts` updated
- `docs/routing-table.md` new row added
- `README.md` count updated
- `docs/governance.md` policy updated
- All CI gates green
