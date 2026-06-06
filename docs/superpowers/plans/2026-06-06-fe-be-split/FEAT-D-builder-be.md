# FEAT-D: `crew:builder-be` agent + per-stack OpenAPI codegen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `agents/builder-be.md` — a backend implementation specialist supporting any server stack (C#/.NET, Node, Python, Go) routed by FEAT `stack:*` tag. Extend `skills/domain/contract-codegen/SKILL.md` with BE recipes (NSwag/Kiota for C#, datamodel-code-generator + fastapi-code-generator for Python, oapi-codegen for Go, openapi-typescript-codegen for Node). Update `docs/routing-table.md`.

**Architecture:** Mirrors FEAT-C agent shape but BE side: scope is server code + DB migrations + BE tests; forbidden list mirrors FE; skill routing picks per-stack tool by FEAT `stack:*` tag. The contract-codegen skill grows to cover BE recipes — each recipe defines (a) install command, (b) generation command, (c) generated artifact path, (d) what gets committed. Depends on FEAT-A. Independent of FEAT-B/C.

**Tech Stack:** Existing `validate-agents.mjs` pattern, `tests/agent-prompt-content.test.mjs` style, markdown skill authoring.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `agents/builder-be.md` | NEW | Backend builder agent prompt (any stack) |
| `skills/domain/contract-codegen/SKILL.md` | MODIFY | Append BE recipes section (C#/Python/Go/Node) |
| `docs/routing-table.md` | MODIFY | Add row for BE-only dispatch to `crew:builder-be` |
| `tests/builder-be-prompt.test.mjs` | NEW | Assert the agent prompt has the required sections |
| `tests/agent-topology.test.mjs` | MODIFY | Include `builder-be` in the known-agent allowlist |

---

## Task 1: Write failing agent-prompt content tests

**Files:**
- Create: `tests/builder-be-prompt.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/builder-be-prompt.test.mjs`:

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
const AGENT_PATH = path.join(REPO_ROOT, "agents", "builder-be.md");

test("builder-be.md exists and has frontmatter name=builder-be", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /^---/);
  assert.match(md, /name:\s*builder-be/);
});

test("builder-be.md declares server + DB scope and forbids FE code", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /Owned scope/);
  assert.match(md, /api\//);
  assert.match(md, /Forbidden/);
  assert.match(md, /\*\.tsx/);
  assert.match(md, /UX spec files/i);
});

test("builder-be.md routes per-stack skills via FEAT stack tag", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /stack:csharp/);
  assert.match(md, /stack:python/);
  assert.match(md, /stack:node/);
  assert.match(md, /stack:go/);
});

test("builder-be.md mandates OpenAPI codegen as FIRST step", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /contract-codegen/);
  assert.match(md, /FIRST step/i);
});

test("builder-be.md mandates drift handling via help_request", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /help_request/);
  assert.match(md, /do not invent/i);
});

test("builder-be.md self-verify includes per-stack test runners", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /dotnet test|pytest|go test|npm run test:be/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/builder-be-prompt.test.mjs`
Expected: FAIL — `ENOENT: builder-be.md`.

- [ ] **Step 3: Commit the test**

```bash
git add tests/builder-be-prompt.test.mjs
git commit -m "test(FEAT-D): failing prompt-content tests for builder-be"
```

---

## Task 2: Author the `agents/builder-be.md` prompt

**Files:**
- Create: `agents/builder-be.md`

- [ ] **Step 1: Write the agent file**

Create `agents/builder-be.md`:

````markdown
---
name: builder-be
description: Backend implementation specialist — server code, DB schema, BE tests for any backend stack (C#/.NET, Node, Python, Go) routed by FEAT stack:* tag. Consumes OpenAPI YAML via per-stack codegen.
model: sonnet
effort: high
maxTurns: 40
color: orange
---

## Custom instructions

Before starting, check for custom instructions in this order:
1. Global: `~/.claude/crew/builder-be.md`
2. Repo: `.claude/crew/builder-be.md`

Repo > global > defaults below.

---

You are a backend builder agent.

Your job is to implement the BE side of a SPLIT_BUILD slice — server code, DB migrations, BE tests — bounded by the lead's scope and the FEAT's OpenAPI YAML. Your stack is picked from the FEAT's `stack:*` tag.

## Owned scope

- Server code under `api/`, `server/`, `services/`, `backend/`, `apps/*/api/`, language-rooted dirs (`src/Server.*`, etc.)
- DB migrations, SQL files, EF migrations, Alembic files, `prisma/schema.prisma` (when BE-only)
- BE test files
- BE-only config: `appsettings.json`, `Dockerfile.api`, server `.csproj`, `pyproject.toml`, `go.mod`
- Generated native types/stubs from OpenAPI codegen (committed)

## Forbidden

- FE code (`*.tsx`, `*.css`, `vite.config.*`, `tailwind.config.*`, `src/api/**`, `src/mocks/**`)
- UX spec files (`*-ux-*.md`)
- OpenAPI YAML — read-only, surface drift via help_request
- Derived `*-contracts.ts` — read-only (FE consumes; BE generates its own native types)
- `*-contracts.md` — read-only

If you discover a needed cross-cutting change, surface it to the lead and stop.

## Skills you consult (per routing-table)

- Backend code change → `skills/domain/backend-advisory/`
- Schema design / migration / database performance → `skills/domain/database-architecture/`
- Regenerating native types/stubs from the OpenAPI YAML → `skills/domain/contract-codegen/` (BE recipes). **Run this as your FIRST step before any feature work.**
- Per-stack routing (FEAT `stack:*` tag):
  - `stack:csharp` → `skills/domain/csharp-pro/` (NEW skill in this FEAT; first slice authors it)
  - `stack:node` → `skills/domain/typescript-pro/` (backend variant — server-side TS patterns)
  - `stack:python` → `skills/domain/python-pro/`
  - `stack:go` → `skills/domain/go-pro/` (gated on demand — not authored in v0.16.0)
- Bug root cause / intermittent failure → `skills/workflow/systematic-debugging/`
- Authoring a git commit message → `skills/workflow/git-commit/`

## TDD policy

Procedure of record: superpowers `test-driven-development` skill.

| When the task is… | TDD required? |
|---|---|
| Net-new endpoint / handler / service | **Yes** — failing integration or unit test first |
| New DB migration changing schema | **Yes** — migration test + rollback test |
| Bug fix with no regression test | **Yes** — failing reproducer first |
| Refactor with existing coverage | **No** |
| Config-only / observability tweak | **No** |

When TDD is skipped on net-new behavior, say so explicitly with the reason.

## Contract drift handling

If the implementation requires a shape, route, status code, or auth scheme NOT present in the OpenAPI YAML:

1. STOP.
2. `mark-badge help_request --note "contract drift: <detail>"`
3. Write a `--confidence low` handoff describing the missing surface.
4. Do not invent inline. Architect revises YAML; BE re-dispatch follows.

## Start acknowledgement

Your start acknowledgement must include:

- what I own (BE paths + DB)
- what I will not change (FE, contracts)
- what I need from others (OpenAPI YAML, contracts.md)
- what I will deliver (handlers, migrations, tests, regenerated stubs)
- whether TDD applies (and if not, why)
- OpenAPI YAML codegen target: `<path of generated native types/stubs>`
- contracts.md sections consumed: Decision rationale, Data Contracts
- Stack detected: `<csharp|node|python|go>`
- Codegen tool selected: `<NSwag | Kiota | datamodel-code-generator+fastapi-code-generator | oapi-codegen | openapi-typescript-codegen>`

## Self-verify gate

Before writing the handoff, run all of these in order. Each must exit 0.

- Per-stack codegen regenerates clean (no diff against committed generated output)
- Repo lint / format / typecheck (where stack supports — e.g. `dotnet build`, `mypy`, `ruff check`, `go vet`)
- Stack-native test runner:
  - C# → `dotnet test`
  - Node → `npm run test:be`
  - Python → `pytest`
  - Go → `go test ./...`
- Migration dry-run when DB schema changes:
  - C# → `dotnet ef migrations script --idempotent`
  - Python (Alembic) → `alembic upgrade head --sql`
  - Go (`golang-migrate`) → `migrate up -dry-run` (or equivalent)
- Plugin-side validators (manifests / skills / agents / slices / contracts / ux-spec) — only those that exist in the repo

Your handoff body MUST include a `## Self-Verify Gates` section listing one line per gate: command + exit code + one-sentence summary.

## Report contract

Use the lead's `size` hint:

- `size: light` — return structured completion message inline (no `write-handoff` artifact).
- `size: standard` (default) — REQUIRES `write-handoff`.

Write your completion via:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff \
  --repo "$PWD" \
  --title "<short title>" \
  --from builder-be --to lead \
  --summary "<one-sentence headline>" \
  --scope "<what was in scope>" \
  --deliverable "<what shipped>" \
  --files "<comma-separated changed files>" \
  --confidence "<high|medium|low>" \
  --risks "<residual risks or 'none'>" \
  --next "<suggested next handoff or 'none'>"
```

Return to the lead ONLY the resulting path + 1–3 sentence headline.

## Workflow badges

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge help_request --note "contract drift: <detail>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge blocked --note "<reason>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge escalated_to_human --note "<reason>"
```

Emit badge BEFORE writing the handoff.

## Context ceiling

40 tool uses or 80k context tokens → mark `blocked` with `context_ceiling_reached`, write `--confidence low` handoff, do NOT attempt inline recovery.

## Shell pre-check

Before chained Bash with `cd` / path-touching, verify with `pwd` (POSIX) or `Get-Location` + `Test-Path` (PowerShell).

## Context efficiency

- No re-Read after Edit/Write.
- Scoped reads after Grep.
- Prefer Edit over Write for modifications.
- Batch edits to the same file in one turn.
- Resume from handoff: check for `## Repo Layout` section first.
````

- [ ] **Step 2: Run the prompt-content tests**

Run: `node --test tests/builder-be-prompt.test.mjs`
Expected: PASS (6/6 ok).

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS. 300-line cap enforced.

- [ ] **Step 4: Commit**

```bash
git add agents/builder-be.md
git commit -m "feat(FEAT-D): crew:builder-be agent prompt (any stack)"
```

---

## Task 3: Add `builder-be` to agent topology test

**Files:**
- Modify: `tests/agent-topology.test.mjs`

- [ ] **Step 1: Add `builder-be` to the allowlist**

Edit `tests/agent-topology.test.mjs` — locate the known-agents constant and add `"builder-be"` (same pattern used for `builder-fe` in FEAT-C Task 3).

- [ ] **Step 2: Run the test**

Run: `node --test tests/agent-topology.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/agent-topology.test.mjs
git commit -m "test(FEAT-D): add builder-be to agent-topology allowlist"
```

---

## Task 4: Extend `contract-codegen` skill with BE recipes

**Files:**
- Modify: `skills/domain/contract-codegen/SKILL.md`

- [ ] **Step 1: Open the skill file** (created by FEAT-C)

Find the section `## BE recipes` with the placeholder `See FEAT-D`. Replace it with the recipes below.

- [ ] **Step 2: Replace with full BE recipes**

Replace:

```markdown
## BE recipes

See FEAT-D — this section is added in that FEAT's slice 1.
```

With:

```markdown
## BE recipes

### C# / .NET — NSwag

Install (dev):

\`\`\`bash
dotnet tool install -g NSwag.ConsoleCore
\`\`\`

Generate DTOs + server interface:

\`\`\`bash
nswag openapi2cscontroller \
  /input:.claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  /output:apps/api/Generated/FeatNNN.cs \
  /namespace:Api.Generated.FeatNNN \
  /controllerStyle:partial
\`\`\`

Commit `apps/api/Generated/FeatNNN.cs`. CI hashes regenerated output vs committed.

### C# / .NET — Kiota (alternative)

\`\`\`bash
kiota generate \
  --openapi .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --language CSharp \
  --output apps/api/Generated/FeatNNN \
  --namespace-name Api.Generated.FeatNNN
\`\`\`

Pick NSwag OR Kiota per FEAT (declare in `.claude/loop.json` `stack.codegen.be`). Don't mix.

### Python — datamodel-code-generator + fastapi-code-generator

Install:

\`\`\`bash
pip install datamodel-code-generator fastapi-code-generator
\`\`\`

Generate Pydantic models:

\`\`\`bash
datamodel-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat_nnn/models.py \
  --input-file-type openapi \
  --output-model-type pydantic_v2.BaseModel
\`\`\`

Generate FastAPI route stubs:

\`\`\`bash
fastapi-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat_nnn/
\`\`\`

Commit `apps/api/generated/feat_nnn/`.

### Go — oapi-codegen

Install:

\`\`\`bash
go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
\`\`\`

Generate server stubs + types:

\`\`\`bash
oapi-codegen \
  -config .claude/artifacts/crew/designs/FEAT-NNN-oapi-codegen.yaml \
  .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml > apps/api/generated/feat_nnn.go
\`\`\`

Where the config file is:

\`\`\`yaml
package: featnnn
output-options:
  client-type-name: Client
generate:
  models: true
  std-http-server: true
\`\`\`

### Node — openapi-typescript-codegen

Install:

\`\`\`bash
npm install --save-dev openapi-typescript-codegen
\`\`\`

Generate:

\`\`\`bash
npx openapi-typescript-codegen \
  --input .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml \
  --output apps/api/generated/feat-nnn/ \
  --client fetch
\`\`\`

## Codegen-tool selection per consumer repo

Each consumer repo declares its codegen tool per stack in `.claude/loop.json`:

\`\`\`json
{
  "stack": {
    "codegen": {
      "be": {
        "csharp": "nswag",     // or "kiota"
        "python": "datamodel-code-generator+fastapi-code-generator",
        "go": "oapi-codegen",
        "node": "openapi-typescript-codegen"
      },
      "fe": {
        "client": "orval",
        "mocks": "openapi-msw"
      }
    }
  }
}
\`\`\`

Builder reads this config in its first step. Missing entry for the FEAT's stack → `mark-badge help_request --note "codegen tool not declared for stack:<X>"`.
```

- [ ] **Step 3: Run validate:skills**

Run: `npm run validate:skills`
Expected: PASS. The skill is now larger but should stay under the 200-line cap. If it overflows: factor each stack into a sub-page in the same directory and reference it from the main `SKILL.md`. Stay under cap.

- [ ] **Step 4: Commit**

```bash
git add skills/domain/contract-codegen/SKILL.md
git commit -m "feat(FEAT-D): contract-codegen BE recipes (C#/Python/Go/Node)"
```

---

## Task 5: Update `docs/routing-table.md`

**Files:**
- Modify: `docs/routing-table.md`

- [ ] **Step 1: Add the BE-only row**

After the FE rows added in FEAT-C, add:

```markdown
| `tags include (surface:api or surface:schema or any backend stack:*) AND NOT (surface:ui or stack:react)` | dispatch `crew:builder-be` only |
```

- [ ] **Step 2: Run validate:routing-table**

Run: `npm run validate:routing-table`
Expected: PASS (advisory warnings tolerated per CI config).

- [ ] **Step 3: Commit**

```bash
git add docs/routing-table.md
git commit -m "docs(FEAT-D): routing-table row for BE-only dispatch"
```

---

## Task 6: Final self-verify gate

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

- [ ] **Step 2: Write the FEAT-D handoff**

```bash
node ./scripts/crew.mjs write-handoff \
  --repo "$PWD" \
  --title "FEAT-D: crew:builder-be agent + per-stack codegen" \
  --from builder --to lead \
  --summary "BE specialist agent shipped; contract-codegen now covers C#/Python/Go/Node recipes; routing-table covers BE-only dispatch" \
  --scope "FEAT-D only — builder-be.md, contract-codegen BE half, routing-table, topology test" \
  --deliverable "agents/builder-be.md + contract-codegen BE recipes + routing-table row + tests" \
  --files "agents/builder-be.md,skills/domain/contract-codegen/SKILL.md,docs/routing-table.md,tests/builder-be-prompt.test.mjs,tests/agent-topology.test.mjs" \
  --confidence high \
  --risks "csharp-pro / python-pro / go-pro skills not authored in this FEAT — slice 1 of any FEAT that uses them must include skill authorship" \
  --next "FEAT-E (integrator) can proceed now that builder-fe + builder-be both exist"
```

- [ ] **Step 3: Commit handoff**

```bash
git add .claude/artifacts/crew/handoffs/
git commit -m "chore(FEAT-D): handoff artifact for FEAT-D completion"
```
