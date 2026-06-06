# FEAT-B: Uxdesigner emits `## API touchpoints` (with CI cross-check) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every UX spec produced by `crew:uxdesigner` to include an `## API touchpoints` section that lists each user action's OpenAPI `operationId`. Add a CI gate that parses the section and verifies every referenced `operationId` exists in the FEAT's `contracts.openapi.yaml`.

**Architecture:** Update `agents/uxdesigner.md` so the agent's output contract mandates the section. Update `commands/orchestrate-slice.md` Step 2 dispatch prompt to demand the section with a clear example. Add `scripts/validate-ux-spec.mjs` that reads a UX spec markdown + the FEAT YAML it references and fails on missing operationIds. Add CI step + golden fixtures. Depends on FEAT-A landing first (the YAML format exists).

**Tech Stack:** Node 22 (ESM, `node:test`), `yaml` library (already added by FEAT-A), existing validators pattern.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `scripts/validate-ux-spec.mjs` | NEW | CI gate — parse UX spec, cross-check operationIds against YAML |
| `tests/validate-ux-spec.test.mjs` | NEW | Node-test coverage for the new validator |
| `tests/fixtures/ux-specs/valid-ux-spec.md` | NEW | Golden UX spec referencing operationIds present in FEAT-A's fixture YAML |
| `tests/fixtures/ux-specs/missing-operationid.md` | NEW | Negative fixture |
| `agents/uxdesigner.md` | MODIFY | Add mandatory section to output contract |
| `commands/orchestrate-slice.md` | MODIFY | Step 2 prompt mandates `## API touchpoints` |
| `.github/workflows/test.yml` | MODIFY | Add `validate:ux-spec` step |
| `package.json` | MODIFY | Add `validate:ux-spec` script |

---

## Task 1: Scaffold `validate-ux-spec.mjs` with a failing parse test

**Files:**
- Create: `tests/validate-ux-spec.test.mjs`
- Create: `scripts/validate-ux-spec.mjs`
- Create: `tests/fixtures/ux-specs/valid-ux-spec.md`

- [ ] **Step 1: Write the golden UX spec fixture**

Create `tests/fixtures/ux-specs/valid-ux-spec.md`:

```markdown
---
slice: SLICE-99
feat: FEAT-DEMO
contracts: tests/fixtures/openapi/valid-feat.openapi.yaml
---

# UX Spec — SLICE-99

## Interaction flows

User opens the page, clicks Save, sees a confirmation.

## Component hierarchy

- Page
  - SaveButton
  - ConfirmationToast

## State transitions

- loading → success → reset

## Copy and labels

- Button: "Save"
- Toast: "Saved!"

## A11y

- Save button has visible focus ring
- Toast is announced via `aria-live="polite"`

## API touchpoints

- "User clicks Save" → operationId `createThing`
```

- [ ] **Step 2: Write the failing test**

Create `tests/validate-ux-spec.test.mjs`:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateUxSpec } from "../scripts/validate-ux-spec.mjs";

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "ux-specs",
);
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

test("validateUxSpec accepts a well-formed spec with valid operationIds", async () => {
  const result = await validateUxSpec({
    specPath: path.join(FIXTURE_DIR, "valid-ux-spec.md"),
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.touchpoints.map((t) => t.operationId), ["createThing"]);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/validate-ux-spec.test.mjs`
Expected: FAIL with import error (script doesn't exist yet).

- [ ] **Step 4: Write minimal `validate-ux-spec.mjs`**

Create `scripts/validate-ux-spec.mjs`:

```javascript
#!/usr/bin/env node

// UX spec validator. Verifies every operationId referenced in `## API touchpoints`
// exists in the FEAT's contracts.openapi.yaml.
//
// Errors (fail CI):
//   - `## API touchpoints` section missing
//   - operationId referenced but not present in YAML
//   - `contracts:` frontmatter pointing to a non-existent YAML

import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * @param {object} opts
 * @param {string} opts.specPath
 * @param {string} opts.repoRoot
 */
export async function validateUxSpec(opts) {
  const errors = [];
  const md = await fs.readFile(opts.specPath, "utf8");
  const fm = parseFrontmatter(md);
  if (!fm || !fm.contracts) {
    errors.push("frontmatter missing `contracts:` pointing to the FEAT YAML");
    return { ok: false, errors, touchpoints: [] };
  }
  const yamlPath = path.resolve(opts.repoRoot, fm.contracts);
  let yamlDoc;
  try {
    yamlDoc = parseYaml(await fs.readFile(yamlPath, "utf8"));
  } catch (e) {
    errors.push(`contracts YAML not readable at ${yamlPath}: ${e.message}`);
    return { ok: false, errors, touchpoints: [] };
  }
  const touchpoints = parseTouchpoints(md);
  if (touchpoints.length === 0) {
    errors.push("`## API touchpoints` section missing or empty");
  }
  const declaredOps = collectOperationIds(yamlDoc);
  for (const t of touchpoints) {
    if (!declaredOps.has(t.operationId)) {
      errors.push(
        `operationId "${t.operationId}" referenced by UX action "${t.action}" not found in ${fm.contracts}`,
      );
    }
  }
  return { ok: errors.length === 0, errors, touchpoints };
}

/** @param {string} md */
function parseFrontmatter(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  /** @type {Record<string,string>} */
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

/** @param {string} md */
function parseTouchpoints(md) {
  const section = md.split(/^##\s+API touchpoints\s*$/m)[1];
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  /** @type {{action:string, operationId:string}[]} */
  const out = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) break;
    const m = line.match(/^-\s+"([^"]+)"\s+→\s+operationId\s+`([^`]+)`/);
    if (m) out.push({ action: m[1], operationId: m[2] });
  }
  return out;
}

/** @param {any} doc */
function collectOperationIds(doc) {
  /** @type {Set<string>} */
  const ids = new Set();
  if (!doc?.paths) return ids;
  for (const pathItem of Object.values(doc.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const op of Object.values(pathItem)) {
      if (op && typeof op === "object" && "operationId" in op && typeof op.operationId === "string") {
        ids.add(op.operationId);
      }
    }
  }
  return ids;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("usage: validate-ux-spec.mjs <spec-md-path>");
    process.exit(2);
  }
  const result = await validateUxSpec({ specPath, repoRoot: process.cwd() });
  if (!result.ok) {
    for (const e of result.errors) console.error("ERR:", e);
    process.exit(1);
  }
  console.log(`OK — ${result.touchpoints.length} touchpoint(s)`);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/validate-ux-spec.test.mjs`
Expected: PASS (1/1 ok).

- [ ] **Step 6: Commit**

```bash
git add tests/validate-ux-spec.test.mjs scripts/validate-ux-spec.mjs tests/fixtures/ux-specs/valid-ux-spec.md
git commit -m "feat(FEAT-B): scaffold validate-ux-spec with parse + cross-check"
```

---

## Task 2: Negative-fixture test — missing operationId

**Files:**
- Create: `tests/fixtures/ux-specs/missing-operationid.md`
- Modify: `tests/validate-ux-spec.test.mjs`

- [ ] **Step 1: Author the negative fixture**

Create `tests/fixtures/ux-specs/missing-operationid.md`:

```markdown
---
slice: SLICE-99
feat: FEAT-DEMO
contracts: tests/fixtures/openapi/valid-feat.openapi.yaml
---

# UX Spec — SLICE-99 (broken)

## API touchpoints

- "User clicks Save" → operationId `nonExistentOp`
```

- [ ] **Step 2: Write the failing test**

Append to `tests/validate-ux-spec.test.mjs`:

```javascript
test("validateUxSpec fails when operationId is not in the YAML", async () => {
  const result = await validateUxSpec({
    specPath: path.join(FIXTURE_DIR, "missing-operationid.md"),
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /nonExistentOp/.test(e)),
    "expected error mentioning missing operationId",
  );
});

test("validateUxSpec fails when `## API touchpoints` section is absent", async () => {
  const tmpPath = path.join(FIXTURE_DIR, "no-touchpoints.md");
  await (await import("node:fs/promises")).writeFile(
    tmpPath,
    "---\ncontracts: tests/fixtures/openapi/valid-feat.openapi.yaml\n---\n\n# UX Spec\n\nno touchpoints section here.\n",
    "utf8",
  );
  const result = await validateUxSpec({
    specPath: tmpPath,
    repoRoot: REPO_ROOT,
  });
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => /API touchpoints/.test(e)),
    "expected error mentioning missing section",
  );
  await (await import("node:fs/promises")).unlink(tmpPath);
});
```

- [ ] **Step 3: Run the tests**

Run: `node --test tests/validate-ux-spec.test.mjs`
Expected: PASS (3/3 ok — Task 1 logic already covers these failure modes).

If FAIL: the parsing logic in Task 1 missed an edge case. Inspect the error output, fix in `parseTouchpoints` or top-level guard, re-run until green.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/ux-specs/missing-operationid.md tests/validate-ux-spec.test.mjs
git commit -m "test(FEAT-B): negative fixtures for validate-ux-spec"
```

---

## Task 3: Wire `validate:ux-spec` into npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the script**

Edit `package.json`, add to `"scripts"`:

```json
"validate:ux-spec": "node ./scripts/validate-ux-spec.mjs"
```

- [ ] **Step 2: Confirm lint stays clean**

Run: `npm run lint`
Expected: zero warnings.

- [ ] **Step 3: Format check**

Run: `npm run format:check`
If fail: `npm run format` then re-check.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(FEAT-B): wire validate:ux-spec npm script"
```

---

## Task 4: Update `agents/uxdesigner.md` output contract

**Files:**
- Modify: `agents/uxdesigner.md`

- [ ] **Step 1: Read current uxdesigner agent prompt**

Open `agents/uxdesigner.md`. Locate the section that describes what a UX spec must contain (likely a list: interaction flows / component hierarchy / etc.).

- [ ] **Step 2: Add the mandatory section**

Append a new bullet to the UX spec required-output list:

```
- `## API touchpoints` — for every user action that triggers a network call, name the OpenAPI `operationId` it triggers (one bullet per action, format: `- "user action" → operationId \`opName\``).
```

If the agent file has an explicit "Output contract" section, also add this paragraph after the bullet list:

```markdown
## Frontmatter requirement

Every UX spec MUST include this frontmatter block so `scripts/validate-ux-spec.mjs` can cross-check operationIds:

\`\`\`yaml
---
slice: SLICE-NN
feat: FEAT-NNN
contracts: .claude/artifacts/crew/designs/FEAT-NNN-contracts.openapi.yaml
---
\`\`\`

The `contracts:` field must point at the FEAT's canonical OpenAPI YAML, relative to the repo root.
```

- [ ] **Step 3: Run validate:agents**

Run: `npm run validate:agents`
Expected: PASS (uxdesigner.md stays under 300-line cap; if it overflows, factor narrative into a skill).

- [ ] **Step 4: Commit**

```bash
git add agents/uxdesigner.md
git commit -m "feat(FEAT-B): uxdesigner mandates `## API touchpoints` + frontmatter"
```

---

## Task 5: Update `commands/orchestrate-slice.md` Step 2 prompt

**Files:**
- Modify: `commands/orchestrate-slice.md`

- [ ] **Step 1: Locate the Step 2 (uxdesigner) dispatch prompt**

In `commands/orchestrate-slice.md`, find the block under "Step 2 prompt — `crew:uxdesigner`".

- [ ] **Step 2: Add the mandatory section instruction**

In the prompt body, after the existing "Produce:" list, append:

```
- `## API touchpoints` section listing every user action that triggers a network call, with matching operationId from the OpenAPI YAML. Example:
    - "User clicks Save" → operationId `createThing`
    - "List page loads" → operationId `listThings`
- A YAML frontmatter block at the top of the file with `slice:`, `feat:`, and `contracts:` fields (where `contracts:` points to the FEAT YAML path).

After writing the spec, run:
  node ./scripts/validate-ux-spec.mjs <ux-spec-path>
(must exit 0; every operationId referenced must exist in the FEAT YAML.)
```

- [ ] **Step 3: Run orchestrate-slice tests**

Run: `node --test tests/orchestrate-slice.test.mjs`
Expected: PASS. If test greps for old prompt body, update expected strings.

- [ ] **Step 4: Commit**

```bash
git add commands/orchestrate-slice.md tests/orchestrate-slice.test.mjs
git commit -m "feat(FEAT-B): orchestrate-slice Step 2 mandates touchpoints + cross-check"
```

---

## Task 6: Add `validate:ux-spec` to CI

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add CI step**

Edit `.github/workflows/test.yml`. After the `validate:contracts` step added in FEAT-A, add:

```yaml
      - name: Validate UX spec fixtures
        run: |
          for f in tests/fixtures/ux-specs/*.md; do
            if [ "$(basename "$f")" = "missing-operationid.md" ]; then
              if node ./scripts/validate-ux-spec.mjs "$f"; then
                echo "ERROR: negative fixture passed"
                exit 1
              fi
            else
              node ./scripts/validate-ux-spec.mjs "$f"
            fi
          done
```

- [ ] **Step 2: Run locally to confirm**

```bash
for f in tests/fixtures/ux-specs/*.md; do
  echo "--- $f ---"
  node ./scripts/validate-ux-spec.mjs "$f" || echo "(expected failure)"
done
```

Expected: `valid-ux-spec.md` PASS; `missing-operationid.md` FAIL.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci(FEAT-B): run validate:ux-spec on committed fixtures"
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
npm run validate:slices
npm run validate:contracts -- tests/fixtures/openapi/valid-feat.openapi.yaml
npm run validate:ux-spec -- tests/fixtures/ux-specs/valid-ux-spec.md
```

All must exit 0.

- [ ] **Step 2: Write the FEAT-B handoff**

Run:

```bash
node ./scripts/crew.mjs write-handoff \
  --repo "$PWD" \
  --title "FEAT-B: uxdesigner API touchpoints + cross-check" \
  --from builder --to lead \
  --summary "UX specs now mandate `## API touchpoints` referencing OpenAPI operationIds; validator enforces it in CI" \
  --scope "FEAT-B only — uxdesigner.md, Step 2 prompt, new validator + fixtures + CI step" \
  --deliverable "scripts/validate-ux-spec.mjs + fixtures + uxdesigner.md + orchestrate-slice Step 2 + CI step" \
  --files "scripts/validate-ux-spec.mjs,tests/validate-ux-spec.test.mjs,tests/fixtures/ux-specs/*,agents/uxdesigner.md,commands/orchestrate-slice.md,.github/workflows/test.yml,package.json" \
  --confidence high \
  --risks "none — additive section + new validator" \
  --next "FEAT-C/D can proceed (both depend only on FEAT-A; FEAT-B is parallel)"
```

- [ ] **Step 3: Commit handoff**

```bash
git add .claude/artifacts/crew/handoffs/
git commit -m "chore(FEAT-B): handoff artifact for FEAT-B completion"
```
