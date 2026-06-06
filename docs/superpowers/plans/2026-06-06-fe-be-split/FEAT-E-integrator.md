# FEAT-E: `crew:integrator` agent + `integration-smoke` workflow skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author `agents/integrator.md` — a lightweight verification agent that spins up the BE and FE locally, exercises one happy-path AC end-to-end against real wire, validates responses against the OpenAPI schema at runtime, and writes a PASS/FAIL artifact under `.claude/artifacts/crew/integrations/`. Author `skills/workflow/integration-smoke/SKILL.md` defining the procedure + per-stack run recipes + the env-var pre-flight contract. Document the new `.claude/loop.json` keys (`stack.run.{fe,be}`, `stack.integration.env_required`).

**Architecture:** Integrator is a small agent (sonnet, medium effort, ~150 lines). It reads its single workflow skill, runs the procedure, writes the artifact. The skill is the procedure of record. The agent's job is reasoning over flaky boots (env vars, port conflicts, migration drift) and producing useful drift notes — pure-script execution doesn't need an agent. Depends on FEAT-C + FEAT-D landing (builder-fe + builder-be must exist for the orchestrator to gate integrator on their self-verify PASS).

**Tech Stack:** Existing `validate-agents.mjs` + `validate-skills.mjs` patterns. New artifact directory `.claude/artifacts/crew/integrations/`. Optional Playwright (consumer-repo dependency).

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `agents/integrator.md` | NEW | Integrator agent prompt |
| `skills/workflow/integration-smoke/SKILL.md` | NEW | Procedure + per-stack run recipes + runtime validation guidance |
| `docs/standards/integration-artifact-schema.md` | NEW | What an integration artifact looks like |
| `docs/standards/loop-json-schema.md` | MODIFY (if exists; else NEW) | Document `stack.run.{fe,be}` + `stack.integration.env_required` |
| `tests/integrator-prompt.test.mjs` | NEW | Assert the agent prompt has the required sections |
| `tests/integration-smoke-skill.test.mjs` | NEW | Assert the skill has the required sections |
| `tests/agent-topology.test.mjs` | MODIFY | Include `integrator` in known-agent allowlist |
| `.claude/artifacts/crew/integrations/.gitkeep` | NEW | Reserve the artifact directory |

---

## Task 1: Failing prompt + skill content tests

**Files:**
- Create: `tests/integrator-prompt.test.mjs`
- Create: `tests/integration-smoke-skill.test.mjs`

- [ ] **Step 1: Write the failing integrator-prompt test**

Create `tests/integrator-prompt.test.mjs`:

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
const AGENT_PATH = path.join(REPO_ROOT, "agents", "integrator.md");

test("integrator.md exists with frontmatter name=integrator and color=purple", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /name:\s*integrator/);
  assert.match(md, /color:\s*purple/);
});

test("integrator.md mandates pre-flight env check and skip-and-block on missing vars", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /pre-flight/i);
  assert.match(md, /env_required/);
  assert.match(md, /help_request/);
});

test("integrator.md procedure references integration-smoke skill", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /skills\/workflow\/integration-smoke/);
});

test("integrator.md writes artifact under .claude/artifacts/crew/integrations/", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /\.claude\/artifacts\/crew\/integrations\//);
});

test("integrator.md validates responses against OpenAPI schema at runtime", async () => {
  const md = await fs.readFile(AGENT_PATH, "utf8");
  assert.match(md, /runtime/i);
  assert.match(md, /OpenAPI/);
  assert.match(md, /validate/i);
});
```

- [ ] **Step 2: Write the failing skill-content test**

Create `tests/integration-smoke-skill.test.mjs`:

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
const SKILL_PATH = path.join(
  REPO_ROOT,
  "skills",
  "workflow",
  "integration-smoke",
  "SKILL.md",
);

test("integration-smoke skill has correct frontmatter", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /name:\s*integration-smoke/);
  assert.match(md, /tier:\s*workflow/);
});

test("integration-smoke skill covers pre-flight, run, exercise, teardown, artifact", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /Pre-flight/i);
  assert.match(md, /Start BE/i);
  assert.match(md, /Start FE/i);
  assert.match(md, /Exercise/i);
  assert.match(md, /Tear down/i);
  assert.match(md, /Write the artifact/i);
});

test("integration-smoke skill names runtime OpenAPI validator", async () => {
  const md = await fs.readFile(SKILL_PATH, "utf8");
  assert.match(md, /openapi-response-validator|ajv/i);
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `node --test tests/integrator-prompt.test.mjs tests/integration-smoke-skill.test.mjs`
Expected: FAIL — files don't exist.

- [ ] **Step 4: Commit the tests**

```bash
git add tests/integrator-prompt.test.mjs tests/integration-smoke-skill.test.mjs
git commit -m "test(FEAT-E): failing content tests for integrator + integration-smoke"
```

---

## Task 2: Author `skills/workflow/integration-smoke/SKILL.md`

**Files:**
- Create: `skills/workflow/integration-smoke/SKILL.md`

- [ ] **Step 1: Author the skill**

Create `skills/workflow/integration-smoke/SKILL.md`:

```markdown
---
name: integration-smoke
tier: workflow
description: Procedure for live wire-up smoke test. Spin up BE, spin up FE, exercise one happy-path AC against real wire, validate responses against OpenAPI schema, tear down, write PASS/FAIL artifact.
owner: hero-crew
last_reviewed: 2026-06-06
triggers:
  - integrator agent dispatched after builder-fe + builder-be self-verify PASS in SPLIT_BUILD slice
---

# Integration smoke

## When to invoke

You are `crew:integrator`. The lead has dispatched you because `SPLIT_BUILD = true`, both builders self-verified, and the slice has a happy-path AC that needs live wire-up proof. Run this procedure, then write the artifact.

## Inputs (from dispatch prompt)

- OpenAPI YAML path
- contracts.md path
- builder-fe handoff path
- builder-be handoff path
- slice file path
- happy_path_ac: the one AC text to exercise live

## Procedure

### 1. Pre-flight

Read `.claude/loop.json` `stack.integration.env_required` (array of env var names). For each:

- Check `process.env[<var>]` is set. If missing, write a `help_request` badge with `note "env var <var> not set"` + a `--confidence low` handoff. STOP.

Check `stack.run.fe.port` and `stack.run.be.port` are free. On occupied port, write `help_request` + STOP.

Check the OpenAPI YAML's `info.version` matches what the builders consumed (both handoffs should cite the same version). On mismatch, write `help_request` with note `"version drift: <fe-version> vs <be-version>"`. STOP.

### 2. Start BE

Read `.claude/loop.json` `stack.run.be.command`. Fallback: package.json `scripts.start:be`, `dotnet run`, `python -m uvicorn`, `go run ./...`.

Spawn in background. Wait for health check (`stack.run.be.health_url`, default `http://localhost:<port>/health`) to return 200 within 30s (configurable via `stack.run.be.timeout_ms`).

On timeout, capture the last 50 lines of stdout/stderr, write a FAIL artifact, STOP.

### 3. Start FE

Read `stack.run.fe.command`. Fallback: package.json `scripts.start:fe`, `vite`, `next dev`.

Set `VITE_USE_MSW=false` (or the consumer-repo equivalent declared in `stack.run.fe.disable_mocks_env`). Spawn in background. Wait for ready signal: TCP port reachable + optional `stack.run.fe.ready_url` returns 200.

On timeout, capture logs, write FAIL artifact, STOP.

### 4. Exercise the happy-path AC

The AC names operations (via the UX spec's `## API touchpoints` or directly in the AC text). For each operation involved:

- **For `surface:ui` slices**: drive Playwright (or `@playwright/test`) headless against the FE URL. Use the operation's example payload as form input where applicable. Capture a DOM snapshot at the success state.
- **For `surface:api`-only slices**: execute the operation directly via `fetch` against the BE URL. Request body = operation's example payload.

For every HTTP response observed, run a runtime OpenAPI validator against the operation's schema:

- Node: `openapi-response-validator` package, OR `ajv` configured against `components.schemas` extracted from the YAML.
- Use the YAML parsed via the `yaml` library (already a dep).

Shape mismatch fails the smoke even if status code is correct. Record exact mismatch.

### 5. Tear down

Send SIGTERM to FE process; wait up to 5s; SIGKILL if still alive.
Send SIGTERM to BE process; wait up to 10s (DB connection close); SIGKILL.

If the BE depends on Docker services (declared in `stack.run.be.compose_file`), don't auto-`docker compose down` — that may belong to other test runs. Leave it. Note in the artifact.

### 6. Write the artifact

Path: `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`

Content:

\`\`\`markdown
# Integration smoke — SLICE-NN

## Outcome: PASS | FAIL

## Happy-path AC exercised
<verbatim AC text>

## Versions
- OpenAPI: <info.version from YAML>
- FE handoff: <path>
- BE handoff: <path>

## Evidence
- BE startup: <ms> to health-ready
- FE startup: <ms> to ready
- HTTP trace:
  - POST /things → 201 (45ms) ✓ schema valid
  - GET /things/<id> → 200 (12ms) ✓ schema valid
- UI snapshot: <relative path> (for surface:ui)
- BE log tail: <50 lines, fenced>

## Drift detected
- none | <description of FE expected vs BE returned, with field paths>

## Next
- pass: reviewer
- fail: /crew:fix --target integration --reason "<one-line>"
\`\`\`

## Done when

- Artifact written with PASS or FAIL
- Both processes torn down
- Either runtime-validator confirms all responses match schemas, OR drift documented with exact field paths
```

- [ ] **Step 2: Run the skill test**

Run: `node --test tests/integration-smoke-skill.test.mjs`
Expected: PASS (3/3 ok).

- [ ] **Step 3: Run validate:skills**

Run: `npm run validate:skills`
Expected: PASS — under 200-line cap. If overflow: factor per-stack run recipes into a sub-page.

- [ ] **Step 4: Commit**

```bash
git add skills/workflow/integration-smoke/SKILL.md tests/integration-smoke-skill.test.mjs
git commit -m "feat(FEAT-E): integration-smoke workflow skill"
```

---

## Task 3: Author `agents/integrator.md`

**Files:**
- Create: `agents/integrator.md`

- [ ] **Step 1: Write the agent file**

Create `agents/integrator.md`:

````markdown
---
name: integrator
description: Live wire-up smoke specialist. After builder-fe + builder-be PASS self-verify, spins up BE locally, points FE at it, exercises one happy-path AC end-to-end, validates responses against the OpenAPI schema at runtime, writes a PASS/FAIL artifact.
model: sonnet
effort: medium
maxTurns: 20
color: purple
---

## Custom instructions

Before starting, check for custom instructions in this order:
1. Global: `~/.claude/crew/integrator.md`
2. Repo: `.claude/crew/integrator.md`

Repo > global > defaults below.

---

You are the integrator agent.

Your job is ONE thing: prove the FE and BE that the builders just shipped actually interoperate live. You exercise ONE happy-path AC. You write ONE artifact. You do not run the full AC matrix — that's validator's job.

## Procedure of record

`skills/workflow/integration-smoke/SKILL.md` — read it before doing anything. The skill defines pre-flight, run commands, exercise patterns, runtime validation, teardown, and artifact format.

## Inputs (from dispatch prompt)

- OpenAPI YAML path
- contracts.md path
- builder-fe handoff path
- builder-be handoff path
- slice file path
- happy_path_ac: the one AC to exercise

## Output contract

ONE artifact at `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md` with `Outcome: PASS` or `Outcome: FAIL`. Format per the skill.

Return to the lead: artifact path + one-line PASS/FAIL summary. Do NOT inline the artifact body.

## Pre-flight contract

Before starting any process:

1. Read `.claude/loop.json` `stack.integration.env_required` (array of env var names). Check each is set. If any missing:
   - `mark-badge help_request --note "env var <name> not set"`
   - Write a `--confidence low` handoff describing what's missing.
   - STOP.
2. Check FE/BE ports declared in `stack.run.{fe,be}.port` are free. On occupied port: `mark-badge help_request --note "port <N> already bound"` + STOP.
3. Check builder-fe and builder-be handoffs both cite the same `info.version` from the OpenAPI YAML. On version drift: `mark-badge help_request --note "OpenAPI version drift: FE=<v1> BE=<v2>"` + STOP.

A failed pre-flight is NOT a smoke failure — it's a setup problem the lead must resolve before re-dispatch. Write an artifact only when you actually ran the smoke.

## Runtime validation

Every HTTP response observed during the smoke MUST be validated against the operation's response schema in the OpenAPI YAML, at runtime. Use one of:

- `openapi-response-validator` (preferred for Node)
- `ajv` configured against `components.schemas` extracted from the YAML

Shape mismatch is a FAIL even when status code is correct. Record the field path mismatch in the artifact's "Drift detected" section.

## Skip conditions

- Slice classification has `SPLIT_BUILD = false`. (Lead's orchestrator should not dispatch you in this case; if it does, return immediately with `Outcome: SKIP — SPLIT_BUILD false`.)
- Slice frontmatter has `skip: ["integrator"]`. Return `Outcome: SKIP — explicit override` + reference the slice frontmatter.

## Out of scope

- Full AC matrix coverage (validator owns)
- Cross-browser testing
- Performance / load
- Real production data (use OpenAPI `examples` only)

## Self-verify

Before writing the artifact:

- Confirm both processes are torn down (no leftover bound ports)
- Confirm artifact path matches `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`
- Confirm `Outcome:` line is present and equals PASS, FAIL, or SKIP

## Workflow badges

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge help_request --note "<setup problem>"
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge blocked --note "<external blocker>"
```

## Context ceiling

20 tool uses or 50k context tokens → mark `blocked` + write a `--confidence low` handoff. Lead investigates.

## Shell pre-check

Verify `pwd` (POSIX) / `Get-Location` + `Test-Path` (PowerShell) before chained Bash. On Windows, prefer PowerShell for cmdlet ops.

## Context efficiency

Skill is your procedure — read it once; do not re-read between steps. Don't Read the artifact you just wrote. Use Edit, not Write, for any iterative refinement.
````

- [ ] **Step 2: Run the agent test**

Run: `node --test tests/integrator-prompt.test.mjs`
Expected: PASS (5/5 ok).

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS — under 300-line cap.

- [ ] **Step 4: Commit**

```bash
git add agents/integrator.md
git commit -m "feat(FEAT-E): crew:integrator agent prompt"
```

---

## Task 4: Reserve the integrations artifact directory

**Files:**
- Create: `.claude/artifacts/crew/integrations/.gitkeep`

- [ ] **Step 1: Create the directory + placeholder**

```bash
mkdir -p .claude/artifacts/crew/integrations
touch .claude/artifacts/crew/integrations/.gitkeep
```

- [ ] **Step 2: Confirm policy**

Read `.gitignore` / CLAUDE.md. `.claude/artifacts/` is committed per the CLAUDE.md policy ("`.claude/artifacts/` is **committed** as durable cross-machine history"). Confirm no exclusion rule for `integrations/`. If one exists, remove it.

- [ ] **Step 3: Commit**

```bash
git add .claude/artifacts/crew/integrations/.gitkeep
git commit -m "chore(FEAT-E): reserve integrations artifact directory"
```

---

## Task 5: Document `.claude/loop.json` schema additions

**Files:**
- Create: `docs/standards/integration-artifact-schema.md`
- Modify or create: `docs/standards/loop-json-schema.md`

- [ ] **Step 1: Author the integration artifact schema doc**

Create `docs/standards/integration-artifact-schema.md`:

```markdown
# Integration artifact schema

Written by `crew:integrator` to `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`.

## Mandatory sections

| Section | Required content |
|---|---|
| `# Integration smoke — SLICE-NN` | Title with the SLICE id |
| `## Outcome: PASS \| FAIL \| SKIP` | Verbatim — reviewer's `Integration Conformance` reads this line |
| `## Happy-path AC exercised` | The full AC text the integrator was dispatched to exercise |
| `## Versions` | OpenAPI `info.version`, FE/BE handoff paths |
| `## Evidence` | BE/FE startup times, HTTP trace (status + ms + schema-valid flag), UI snapshot path if `surface:ui`, BE log tail |
| `## Drift detected` | `none` OR specific FE-expected-vs-BE-returned field paths |
| `## Next` | `pass: reviewer` OR `fail: /crew:fix --target integration --reason "<one-line>"` |

## SKIP cases

- `Outcome: SKIP — SPLIT_BUILD false` — integrator was dispatched in error; orchestrator bug
- `Outcome: SKIP — explicit override` — slice frontmatter `skip: ["integrator"]`

Other sections (Versions, Evidence, Drift, Next) may be empty for SKIP — only Outcome + the SKIP reason are required.
```

- [ ] **Step 2: Document loop.json keys**

Check whether `docs/standards/loop-json-schema.md` exists.

If it does: append a new section "Integration keys" with the content below.

If it doesn't: create the file with this content:

```markdown
# `.claude/loop.json` schema

Consumer repos declare workflow integration details in `.claude/loop.json`.

## Integration keys (FEAT-E)

\`\`\`json
{
  "stack": {
    "run": {
      "fe": {
        "command": "npm run dev",
        "port": 5173,
        "ready_url": "http://localhost:5173",
        "disable_mocks_env": "VITE_USE_MSW",
        "timeout_ms": 30000
      },
      "be": {
        "command": "dotnet run --project apps/api",
        "port": 5000,
        "health_url": "http://localhost:5000/health",
        "compose_file": null,
        "timeout_ms": 30000
      }
    },
    "integration": {
      "env_required": ["DATABASE_URL", "JWT_SIGNING_KEY"]
    }
  }
}
\`\`\`

| Key | Purpose |
|---|---|
| `stack.run.fe.command` | Process command for FE dev server. Integrator spawns this. Required when SPLIT_BUILD. |
| `stack.run.fe.port` | Port FE binds. Used for pre-flight free-port check. Required. |
| `stack.run.fe.ready_url` | URL integrator probes for FE readiness. Optional; TCP port check used otherwise. |
| `stack.run.fe.disable_mocks_env` | Env var the integrator sets to false to disable MSW. Optional; defaults to `VITE_USE_MSW`. |
| `stack.run.fe.timeout_ms` | Readiness timeout. Optional; defaults to 30000. |
| `stack.run.be.command` | Process command for BE. Required when SPLIT_BUILD. |
| `stack.run.be.port` | Port BE binds. Required. |
| `stack.run.be.health_url` | URL integrator probes for BE readiness. Required. |
| `stack.run.be.compose_file` | Docker compose file path if BE needs containerized services. Integrator does NOT auto-down. |
| `stack.run.be.timeout_ms` | Readiness timeout. Optional; defaults to 30000. |
| `stack.integration.env_required` | Array of env var names. Pre-flight fails if any are unset. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/standards/integration-artifact-schema.md docs/standards/loop-json-schema.md
git commit -m "docs(FEAT-E): integration artifact schema + loop.json integration keys"
```

---

## Task 6: Add `integrator` to agent topology test

**Files:**
- Modify: `tests/agent-topology.test.mjs`

- [ ] **Step 1: Add `integrator` to the known-agents allowlist**

Edit `tests/agent-topology.test.mjs` (same pattern as FEAT-C Task 3 / FEAT-D Task 3).

- [ ] **Step 2: Run the test**

Run: `node --test tests/agent-topology.test.mjs`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/agent-topology.test.mjs
git commit -m "test(FEAT-E): add integrator to agent-topology allowlist"
```

---

## Task 7: Final self-verify gate

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

- [ ] **Step 2: Write the FEAT-E handoff**

```bash
node ./scripts/crew.mjs write-handoff \
  --repo "$PWD" \
  --title "FEAT-E: crew:integrator agent + integration-smoke skill" \
  --from builder --to lead \
  --summary "Integrator agent + procedure skill shipped; loop.json schema documented; integrations artifact dir reserved" \
  --scope "FEAT-E only — integrator.md, integration-smoke SKILL.md, schema docs, topology test, artifact dir" \
  --deliverable "agents/integrator.md + skills/workflow/integration-smoke/SKILL.md + docs/standards/integration-artifact-schema.md + docs/standards/loop-json-schema.md" \
  --files "agents/integrator.md,skills/workflow/integration-smoke/SKILL.md,docs/standards/integration-artifact-schema.md,docs/standards/loop-json-schema.md,tests/integrator-prompt.test.mjs,tests/integration-smoke-skill.test.mjs,tests/agent-topology.test.mjs,.claude/artifacts/crew/integrations/.gitkeep" \
  --confidence high \
  --risks "Playwright is not vendored; consumer repos must provide it for surface:ui slices. integrator uses node:test+fetch for surface:api-only slices to avoid forcing Playwright as a hard dep." \
  --next "FEAT-F (orchestrate-slice wiring) — final FEAT, gates on FEAT-A..E all green"
```

- [ ] **Step 3: Commit handoff**

```bash
git add .claude/artifacts/crew/handoffs/
git commit -m "chore(FEAT-E): handoff artifact for FEAT-E completion"
```
