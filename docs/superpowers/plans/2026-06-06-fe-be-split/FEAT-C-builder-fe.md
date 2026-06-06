# FEAT-C: `crew:builder-fe` agent + FE-only routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `agents/builder-fe.md` — a React + TypeScript frontend implementation specialist that consumes the FEAT's OpenAPI YAML + UX spec, regenerates `orval` clients and `openapi-msw` handlers from the spec, and ships FE diffs/tests. Update `docs/routing-table.md` so the lead can route FE-only or FE-side-of-split work to the new agent. Lay down the FE half of `skills/domain/contract-codegen/` (BE half lands in FEAT-D).

**Architecture:** Inherits the base `agents/builder.md` discipline (TDD, handoff, ceiling). Diffs are scope (FE paths only), forbidden list (no server code), skill routing (react-engineering + typescript-pro + frontend-advisory + contract-codegen FE recipes), start-acknowledgement schema (OpenAPI path + UX spec path + generated artifact paths), and self-verify additions (orval + openapi-msw regen clean + a11y when tagged). Depends on FEAT-A (OpenAPI canonical). Independent of FEAT-B.

**Tech Stack:** Existing `validate-agents.mjs` pattern, agent-prompt-content tests (`tests/agent-prompt-content.test.mjs`), markdown skill authoring.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `agents/builder-fe.md` | NEW | Frontend builder agent prompt |
| `skills/domain/contract-codegen/SKILL.md` | NEW (FE half — BE half added by FEAT-D) | Per-stack codegen recipes; in FEAT-C only orval + openapi-msw FE recipes |
| `skills/domain/frontend-advisory/SKILL.md` | MODIFY | Add reference to contract-codegen as the upstream input source |
| `docs/routing-table.md` | MODIFY | Add row for FE-only dispatch to `crew:builder-fe` |
| `tests/builder-fe-prompt.test.mjs` | NEW | Assert the agent prompt has the required sections |
| `tests/fixtures/orval/orval.config.ts` | NEW | Reference orval config template for consumer repos |
| `tests/agent-topology.test.mjs` | MODIFY | Include `builder-fe` in the known-agent allowlist |

---

## Task 1: Write a failing agent-prompt content test

**Files:**
- Create: `tests/builder-fe-prompt.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/builder-fe-prompt.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const AGENT_PATH = path.join(REPO_ROOT, "agents", "builder-fe.md");

test("builder-fe.md exists and has frontmatter name=builder-fe", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /^---/);
  assert.match(md, /name:\s*builder-fe/);
});

test("builder-fe.md declares React + TS scope and forbids server code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /Owned scope/);
  assert.match(md, /\*\.tsx/);
  assert.match(md, /Forbidden/);
  assert.match(md, /\*\.cs/);
  assert.match(md, /server code/i);
});

test("builder-fe.md routes contract-codegen skill for orval + openapi-msw", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /skills\/domain\/contract-codegen/);
  assert.match(md, /orval/);
  assert.match(md, /openapi-msw/);
});

test("builder-fe.md mandates OpenAPI YAML + UX spec consumption", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /OpenAPI YAML path consumed/);
  assert.match(md, /UX spec path consumed/);
});

test("builder-fe.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /help_request/);
  assert.match(md, /do not invent/i);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/builder-fe-prompt.test.mjs`
Expected: FAIL — `ENOENT: no such file or directory ... builder-fe.md`.

- [ ] **Step 3: Commit the test**

```bash
git add tests/builder-fe-prompt.test.mjs
git commit -m "test(FEAT-C): failing prompt-content tests for builder-fe"
```

---

## Task 2: Author the `agents/builder-fe.md` prompt

**Files:**
- Create: `agents/builder-fe.md`

- [ ] **Step 1: Write the agent file**

Create `agents/builder-fe.md`:

````markdown
---
name: builder-fe
description: Frontend implementation specialist — React + TS code, FE tests, a11y. Consumes OpenAPI YAML + UX spec; regenerates orval clients and openapi-msw handlers from the spec.
model: sonnet
effort: high
maxTurns: 40
color: cyan
---

## Custom instructions

Before starting, check for custom instructions in this order:
1. Global: `~/.claude/crew/builder-fe.md`
2. Repo: `.claude/crew/builder-fe.md`

Repo > global > defaults below.

---

You are a frontend builder agent.

Your job is to implement the FE side of a SPLIT_BUILD slice — React + TypeScript code, FE tests, accessibility — bounded by the lead's scope and the FEAT's OpenAPI YAML.

## Owned scope

- `*.tsx`, `*.ts` under `src/`, `app/`, `web/`, `frontend/`, `packages/ui*/`, `apps/*/web/`
- `*.css`, `*.module.css`, `*.scss`
- FE test files (`*.test.tsx`, `*.spec.ts` colocated with components)
- Generated orval clients and openapi-msw handlers under `src/api/**` and `src/mocks/**` (committed regenerated output)
- Fixture files (`tests/fixtures/**`)
- FE-only config: `vite.config.*`, frontend `tsconfig.json`, `tailwind.config.*`, `orval.config.ts`

## Forbidden

- Server code: `*.cs`, `*.py`, `*.go`, server `*.ts` under `api/`, `server/`, `services/`, `backend/`
- DB migrations, SQL files, EF migrations, Alembic files, `prisma/schema.prisma`
- OpenAPI YAML (`*-contracts.openapi.yaml`) — read-only, surface drift via help_request
- Derived `*-contracts.ts` — read-only (regenerated by validate-contracts; editing it fails CI's drift gate)
- `*-contracts.md` — read-only

If you discover a needed cross-cutting change, surface it to the lead and stop.

## Skills you consult (per routing-table)

- React component / hooks / state management → `skills/domain/react-engineering/`
- TS code change → `skills/domain/typescript-pro/`
- Frontend code change → `skills/domain/frontend-advisory/`
- Regenerating orval clients + openapi-msw handlers from the OpenAPI YAML → `skills/domain/contract-codegen/` (FE recipes)
- FEAT `concern:accessibility` → `skills/domain/a11y-advisory/` (when present)
- FEAT `concern:ux` → re-read the UX spec before designing
- Authoring a git commit message → `skills/workflow/git-commit/`

## TDD policy

Procedure of record: superpowers `test-driven-development` skill.

| When the task is… | TDD required? |
|---|---|
| Net-new component / hook / page | **Yes** — failing component test first (Vitest + Testing Library) |
| Bug fix with no regression test | **Yes** — failing reproducer first |
| Refactor with existing coverage | **No** — existing suite is the contract |
| Style-only / Tailwind tweak | **No** — visual regression covered by storybook/Chromatic if present |

When TDD is skipped on net-new behavior, say so explicitly in the completion report with the reason.

## Contract drift handling

If the implementation requires a shape, route, or status code NOT present in the OpenAPI YAML:

1. STOP.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge help_request --note "contract drift: <what is missing>"`.
3. Write a `--confidence low` handoff via `write-handoff` describing the missing surface.
4. Do not invent the shape inline. The architect agent revises the YAML; FE re-dispatch follows.

## Start acknowledgement

Your start acknowledgement must include:

- what I own (FE paths in scope)
- what I will not change (forbidden list)
- what I need from others (UX spec, OpenAPI YAML)
- what I will deliver (components, tests, regenerated client/mocks)
- whether TDD applies (and if not, why)
- OpenAPI YAML path consumed: `<path>`
- UX spec path consumed: `<path or "none">`
- Generated artifacts: `src/api/<feat>.ts` (orval), `src/mocks/<feat>.ts` (openapi-msw)
- Mock strategy: openapi-msw from YAML examples

## Self-verify gate

Before writing the handoff, run all of these in order. Each must exit 0.

- Orval + openapi-msw regenerate clean (no diff in `src/api/`, `src/mocks/` against committed output)
- `npm run lint` — zero warnings
- `npm run format:check` — if it fails, run `npm run format` then re-check
- `npm run typecheck`
- `npm run test:fe` or `vitest run --project fe`
- a11y check when `concern:accessibility` tagged (axe-core via Vitest or `@axe-core/playwright`)
- Repo-defined validators that exist in the repo (manifests / skills / agents / slices / contracts / ux-spec)

Your handoff body MUST include a `## Self-Verify Gates` section listing one line per gate: command + exit code or PASS/FAIL + one-sentence summary.

## Report contract

Use the lead's `size` hint:

- `size: light` — return structured completion message inline (no `write-handoff` artifact).
- `size: standard` (default) — REQUIRES `write-handoff`.

Write your completion via:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff \
  --repo "$PWD" \
  --title "<short title>" \
  --from builder-fe --to lead \
  --summary "<one-sentence headline>" \
  --scope "<what was in scope>" \
  --deliverable "<what shipped>" \
  --files "<comma-separated changed files>" \
  --confidence "<high|medium|low>" \
  --risks "<residual risks or 'none'>" \
  --next "<suggested next handoff or 'none'>"
```

Return to the lead ONLY the resulting path + 1–3 sentence headline. Do NOT inline the full report body.

## Workflow badges

```bash
# Contract drift
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge help_request --note "contract drift: <detail>"

# External blocker
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge blocked --note "<reason>"

# Escalate
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge escalated_to_human --note "<reason>"
```

Emit badge BEFORE writing the handoff.

## Context ceiling

40 tool uses or 80k context tokens → mark `blocked` with `context_ceiling_reached`, write a `--confidence low` handoff, do NOT attempt inline recovery. Lead splits remaining ACs.

## Shell pre-check

Before chained Bash with `cd` / path-touching, verify with `pwd` (POSIX) or `Get-Location` + `Test-Path` (PowerShell). On Windows, prefer PowerShell for cmdlet operations.

## Context efficiency

- No re-Read after successful Edit/Write.
- Scoped reads after Grep: use `offset` + `limit`.
- Prefer Edit over Write for modifications.
- Batch edits to the same file in one turn — do NOT interleave Read calls.
- Resume from handoff: check for `## Repo Layout` section before exploring.
````

- [ ] **Step 2: Run the prompt-content tests**

Run: `node --test tests/builder-fe-prompt.test.mjs`
Expected: PASS (5/5 ok).

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS. The 300-line cap is enforced; if the file exceeds, factor sections into a skill and reference it.

- [ ] **Step 4: Commit**

```bash
git add agents/builder-fe.md
git commit -m "feat(FEAT-C): crew:builder-fe agent prompt"
```

---

## Task 3: Add `builder-fe` to agent topology test

**Files:**
- Modify: `tests/agent-topology.test.mjs`

- [ ] **Step 1: Read the topology test**

Run: `cat tests/agent-topology.test.mjs | head -40`

The file likely declares an allowlist or enumerates known agents. Identify it.

- [ ] **Step 2: Add `builder-fe` to the allowlist**

If the test enumerates a constant like `KNOWN_AGENTS = new Set([...])`, add `"builder-fe"`. If it uses a different shape, follow the existing pattern.

- [ ] **Step 3: Run the test**

Run: `node --test tests/agent-topology.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/agent-topology.test.mjs
git commit -m "test(FEAT-C): add builder-fe to agent-topology allowlist"
```

---

## Task 4: Scaffold `skills/domain/contract-codegen/SKILL.md` (FE half)

**Files:**
- Create: `skills/domain/contract-codegen/SKILL.md`

- [ ] **Step 1: Author the skill (FE-only content for now)**

Create `skills/domain/contract-codegen/SKILL.md`:

```markdown
---
name: contract-codegen
tier: domain
description: Per-stack codegen recipes for FE clients/mocks and BE stubs/types from a FEAT's OpenAPI YAML. Run as the first step before any feature work.
owner: hero-crew
last_reviewed: 2026-06-06
triggers:
  - builder-fe consumes a new or revised contracts.openapi.yaml
  - builder-be consumes a new or revised contracts.openapi.yaml
---

# Contract codegen (per-stack recipes)

## When to invoke

You are `crew:builder-fe` or `crew:builder-be` and the slice has a FEAT-scoped `contracts.openapi.yaml`. Run codegen as your FIRST step. Treat the YAML as read-only.

## FE recipes

### orval (typed client)

Config lives at `orval.config.ts` (repo-root). Reference template:

\`\`\`ts
import { defineConfig } from "orval";

export default defineConfig({
  feat: {
    input: ".claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml",
    output: {
      target: "src/api/feat-NNN.ts",
      client: "fetch", // or "react-query" / "swr"
      mode: "single",
    },
  },
});
\`\`\`

Run:

\`\`\`bash
npx orval --config orval.config.ts
\`\`\`

Commit the generated `src/api/feat-NNN.ts`. CI hashes the regenerated output against the committed copy; mismatch fails.

### openapi-msw (MSW handlers from examples)

Config lives at `src/mocks/feat-NNN.ts` (handler module). Reference template:

\`\`\`ts
import { http, HttpResponse } from "msw";
import spec from "../../.claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml";
// note: vite-plugin-yaml or a similar yaml-as-module loader required

export const featNNNHandlers = [
  // openapi-msw or msw-auto-mock can emit these programmatically;
  // see https://github.com/iyegoroff/openapi-msw for the supported config.
];
\`\`\`

Where to invoke during dev:

\`\`\`ts
// src/mocks/browser.ts
import { setupWorker } from "msw/browser";
import { featNNNHandlers } from "./feat-NNN";
export const worker = setupWorker(...featNNNHandlers);
\`\`\`

Commit the regenerated handlers. CI hashes the regenerated output against the committed copy.

## BE recipes

See FEAT-D — this section is added in that FEAT's slice 1.

## Done when

- All codegen commands exit 0
- No diff in generated artifacts vs committed copy (FE: `src/api/`, `src/mocks/`; BE: per-stack — covered by FEAT-D)
- Generated artifacts compile / typecheck
```

- [ ] **Step 2: Run validate:skills**

Run: `npm run validate:skills`
Expected: PASS. Skill is under 200-line cap.

- [ ] **Step 3: Commit**

```bash
git add skills/domain/contract-codegen/SKILL.md
git commit -m "feat(FEAT-C): contract-codegen skill (FE half: orval + openapi-msw)"
```

---

## Task 5: Light polish on `skills/domain/frontend-advisory/SKILL.md`

**Files:**
- Modify: `skills/domain/frontend-advisory/SKILL.md`

- [ ] **Step 1: Read the current frontend-advisory skill**

Run: `cat skills/domain/frontend-advisory/SKILL.md` (or use Read tool).

- [ ] **Step 2: Add a cross-reference to contract-codegen**

Append a new short section (3–5 lines) near the top:

```markdown
## Input source

Frontend work in a SPLIT_BUILD slice consumes the FEAT's OpenAPI YAML as the source of truth for wire shapes. Use `skills/domain/contract-codegen/` (FE recipes) to regenerate orval clients and openapi-msw handlers before any feature work. The derived `*-contracts.ts` is for type imports only; do not edit it.
```

- [ ] **Step 3: Run validate:skills**

Run: `npm run validate:skills`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills/domain/frontend-advisory/SKILL.md
git commit -m "docs(FEAT-C): frontend-advisory references contract-codegen input source"
```

---

## Task 6: Update `docs/routing-table.md`

**Files:**
- Modify: `docs/routing-table.md`

- [ ] **Step 1: Locate the routing-table rows for builder dispatch**

Open `docs/routing-table.md`. Find the row(s) covering "implementation work / builder dispatch".

- [ ] **Step 2: Add the new FE-only row**

Add a new row (keep the existing row for fullstack/single-stack builder; don't remove it):

```markdown
| `tags include surface:ui or stack:react AND (tags include surface:api/schema OR stack:csharp/node/python/go)` | dispatch `crew:builder-fe` for FE diff + `crew:builder-be` for BE diff in parallel (orchestrate-slice Step 2+3); integrator gates afterward |
| `tags include surface:ui or stack:react AND NOT (any backend stack tag)` | dispatch `crew:builder-fe` only |
```

- [ ] **Step 3: Run validate:routing-table**

Run: `npm run validate:routing-table`
Expected: PASS (or advisory warnings, since the workflow marks routing-table validation as `continue-on-error` in CI).

- [ ] **Step 4: Commit**

```bash
git add docs/routing-table.md
git commit -m "docs(FEAT-C): routing-table row for FE-only dispatch + split-build"
```

---

## Task 7: Reference orval config fixture

**Files:**
- Create: `tests/fixtures/orval/orval.config.ts`

- [ ] **Step 1: Author the fixture**

Create `tests/fixtures/orval/orval.config.ts`:

```typescript
import { defineConfig } from "orval";

// Reference template — consumer repos copy this to their root.
export default defineConfig({
  featDemo: {
    input: "tests/fixtures/openapi/valid-feat.openapi.yaml",
    output: {
      target: "tests/fixtures/orval/feat-demo.client.ts",
      client: "fetch",
      mode: "single",
    },
  },
});
```

- [ ] **Step 2: Ensure lint ignores the fixture dir (already done in FEAT-A Task 5)**

If not yet covered, add `tests/fixtures/orval/**` to `eslint.config.mjs` ignores.

- [ ] **Step 3: Commit**

```bash
git add tests/fixtures/orval/orval.config.ts
git commit -m "test(FEAT-C): orval reference config fixture"
```

---

## Task 8: Final self-verify gate

**Files:** none

- [ ] **Step 1: Run all repo gates**

```bash
npm run lint
npm run format:check
npm run typecheck
node --test
npm run validate:manifests
npm run validate:skills
npm run validate:agents
npm run validate:routing-table
npm run validate:slices
npm run validate:contracts -- tests/fixtures/openapi/valid-feat.openapi.yaml
npm run validate:ux-spec -- tests/fixtures/ux-specs/valid-ux-spec.md
```

All must exit 0.

- [ ] **Step 2: Write the FEAT-C handoff**

```bash
node ./scripts/crew.mjs write-handoff \
  --repo "$PWD" \
  --title "FEAT-C: crew:builder-fe agent + FE codegen recipes" \
  --from builder --to lead \
  --summary "FE specialist agent shipped; contract-codegen skill defines orval + openapi-msw FE recipes; routing-table covers FE-only and split dispatch" \
  --scope "FEAT-C only — builder-fe.md, contract-codegen FE half, frontend-advisory polish, routing-table, topology test, orval fixture" \
  --deliverable "agents/builder-fe.md + skills/domain/contract-codegen/SKILL.md (FE half) + frontend-advisory polish + routing-table row + tests/builder-fe-prompt.test.mjs + tests/fixtures/orval/orval.config.ts" \
  --files "agents/builder-fe.md,skills/domain/contract-codegen/SKILL.md,skills/domain/frontend-advisory/SKILL.md,docs/routing-table.md,tests/builder-fe-prompt.test.mjs,tests/agent-topology.test.mjs,tests/fixtures/orval/orval.config.ts" \
  --confidence high \
  --risks "BE half of contract-codegen still empty; FEAT-D extends it" \
  --next "FEAT-D (builder-be) can proceed in parallel; FEAT-E gates on both"
```

- [ ] **Step 3: Commit handoff**

```bash
git add .claude/artifacts/crew/handoffs/
git commit -m "chore(FEAT-C): handoff artifact for FEAT-C completion"
```
