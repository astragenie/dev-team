# devcrew Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipped devcrew plugin work from a clean consumer install, close the fail-open gates the audit and Codex found, fix the broken references, and prove it with automated and manual smoke tests.

**Architecture:** Fix enforcement before architecture (Codex sequencing). Every task starts with a test that is red on devcrew 1.1.0 today. Runtime crash is fixed by bundling each entry point into a self-contained file under `dist/` committed to the repo (the plugin cache is a git checkout; nothing runs `bun install` there). Gates become data: explicit verdicts, per-reviewer aggregation, explicit skip records. Hooks collapse into one dispatcher per event only after the gates are correct.

**Tech Stack:** Bun 1.3 (tests, bundler, hook runtime), Node 22+ (.mjs hooks), TypeScript, Biome, GitHub Actions self-hosted.

**Spec:** `C:\work\mega\dev-team\.claude\artifacts\crew\reviews\20261105T130000Z-plugin-audit-and-landscape.md` (sections 1, 4a, "Horizon 1, revised order") + Codex review `20261105T132500Z-codex-review-of-plugin-audit.md` + smoke baseline `.claude/artifacts/crew/validations/20261105T134500Z-validation-devcrew-consumer-smoke-baseline.md`. Task 0 copies all three into the dev-crew clone.

**Target repo:** `astragenie/dev-crew` (devcrew 1.1.0). The dev-team repo is archived; nothing in this plan edits it. All paths below are relative to the dev-crew clone unless prefixed.

## Global Constraints

- No commits to `main`; work on branch `fix/audit-2026-11` in a worktree. Local commits only; no tags, no push until the user says so.
- Plugin cache never runs an install: every shipped entry point must run with `node_modules` absent (`bun --no-install`, or `node` for `.mjs`).
- Commands invoke `bun "${CLAUDE_PLUGIN_ROOT}/crew/scripts/crew.mts"` (85 refs) and `bun "${CLAUDE_PLUGIN_ROOT}/src/scripts/loop.mts"` (37 refs); keep `bun` as the runtime, change the path only via one render script.
- `docs/` stays in the shipped tree (shipped prompts reference it, Codex #25).
- Keep `crew/hooks/pre-tool-use-model-enforce.mts` behaviour (Codex #26); it moves into the dispatcher, it is not deleted.
- Fail closed means `onFailure: "block"` on an enforcement hook and a non-zero exit with a one-line reason; fail open is allowed only for telemetry.
- `bun run test:all`, `bun run typecheck`, `bun run lint`, `bun run validate:manifests` green before each commit.

## Review Focus

1. A consumer with a space in `%USERPROFILE%` (`C:\Users\John Smith`): cost reports and any `import.meta.url` path math must still work (Task 9 test `pricing path with space`).
2. A reviewer that writes `rejected` and a second that writes `approved` for the same run, in either order: gate stays `review_failed` (Task 4 tests).
3. A `changes` CI job that errors (no output at all): the required `gate` must fail, not pass (Task 3 test on the gate script).
4. A `/devcrew:build` on a clean tree with no diff: must take the standard ladder, never `dev-lite` (Task 7 test on the classifier).
5. A hook that throws inside the dispatcher: other checks in the same event still run and their blocks still apply; a throwing telemetry check never blocks (Task 8 tests).

---

### Task 0: Clone, baseline, carry the spec

**Files:**
- Create: `C:\work\mega\dev-crew\` (clone), worktree `C:\work\mega\dev-crew\.worktrees\fix-audit-2026-11`
- Create: `docs/audits/2026-11-05/` with the three spec files copied in
- Create: `docs/superpowers/plans/2026-11-05-devcrew-audit-remediation.md` (this file, copied)

- [ ] **Step 1: Clone and branch**

```bash
cd /c/work/mega && git clone git@github.com:astragenie/dev-crew.git dev-crew
cd dev-crew && git worktree add .worktrees/fix-audit-2026-11 -b fix/audit-2026-11
cd .worktrees/fix-audit-2026-11 && git check-ignore -q .worktrees || (echo ".worktrees/" >> .gitignore && git add .gitignore && git commit -m "chore: ignore .worktrees")
```

- [ ] **Step 2: Confirm the clone matches the installed cache**

Run: `diff -rq --exclude=.git --exclude=node_modules . ~/.claude/plugins/cache/astra/devcrew/1.1.0 | head`
Expected: no output, or only files newer than the 1.1.0 tag. If `main` has moved past 1.1.0, re-run the smoke baseline (Task 1 Step 3 command) before continuing and note differences in `docs/audits/2026-11-05/README.md`.

- [ ] **Step 3: Install and record the baseline**

Run: `bun install && bun run test:all 2>&1 | tail -5 && bun run typecheck && bun run lint`
Expected: record pass/fail/skip counts and wall time into `docs/audits/2026-11-05/README.md` under "Baseline". Any failing test is noted, not fixed here.

- [ ] **Step 4: Copy the spec files and commit**

```bash
mkdir -p docs/audits/2026-11-05 docs/superpowers/plans
cp /c/work/mega/dev-team/.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md docs/audits/2026-11-05/audit.md
cp /c/work/mega/dev-team/.claude/artifacts/crew/reviews/20261105T132500Z-codex-review-of-plugin-audit.md docs/audits/2026-11-05/codex-review.md
cp /c/work/mega/dev-team/.claude/artifacts/crew/validations/20261105T134500Z-validation-devcrew-consumer-smoke-baseline.md docs/audits/2026-11-05/smoke-baseline.md
cp /c/work/mega/dev-team/docs/superpowers/plans/2026-11-05-devcrew-audit-remediation.md docs/superpowers/plans/
git add docs && git commit -m "docs(audit): import 2026-11-05 plugin audit, codex review, smoke baseline, remediation plan"
```

---

### Task 1: Consumer-install smoke test (red first)

**Files:**
- Create: `src/tests/install/consumer-smoke.test.mts`
- Create: `src/tests/install/fixtures/pretooluse-bash.json`, `subagentstop-done.json`, `prepush-bash.json`
- Create: `src/scripts/lib/install/shipped-entrypoints.mts`

**Interfaces:**
- Produces: `listShippedEntrypoints(pluginRoot: string): Promise<Array<{ kind: "hook" | "cli"; runtime: "bun" | "node"; file: string; args: string[]; stdinFixture?: string }>>` reading `.claude-plugin/hooks/hooks.json` for hooks and a fixed list `[["crew/scripts/crew.mts","brief-me"],["crew/scripts/crew.mts","show-workflow-state"],["crew/scripts/crew.mts","write-review-result","--help"],["src/scripts/loop.mts","--help"]]` for CLI.
- Produces: `stageConsumerCopy(pluginRoot: string): Promise<{ pluginCopy: string; consumerRepo: string }>` copying the tree minus `node_modules`, `.git`, `.worktrees` to a temp dir and running `git init` + one commit in a sibling temp consumer repo.

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/install/consumer-smoke.test.mts
import { test, expect } from "bun:test";
import { listShippedEntrypoints, stageConsumerCopy } from "../../scripts/lib/install/shipped-entrypoints.mts";

test("every shipped hook and CLI entry runs without node_modules", async () => {
  const { pluginCopy, consumerRepo } = await stageConsumerCopy(process.cwd());
  const entries = await listShippedEntrypoints(pluginCopy);
  expect(entries.length).toBeGreaterThan(20);
  const failures: string[] = [];
  for (const e of entries) {
    const cmd = e.runtime === "bun" ? ["bun", "--no-install", e.file, ...e.args] : ["node", e.file, ...e.args];
    const proc = Bun.spawnSync(cmd, { cwd: consumerRepo, stdin: e.stdinFixture ? Buffer.from(await Bun.file(e.stdinFixture).text()) : Buffer.from("{}"), env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginCopy, CLAUDE_PROJECT_DIR: consumerRepo } });
    const err = proc.stderr.toString();
    if (proc.exitCode !== 0 || /Cannot find (package|module)/.test(err)) failures.push(`${e.file} ${e.args.join(" ")} rc=${proc.exitCode} ${err.split("\n")[0]}`);
  }
  expect(failures).toEqual([]);
}, 180_000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/tests/install/consumer-smoke.test.mts`
Expected: FAIL listing at least `crew/hooks/subagent-gate-guard.mts`, `hooks/pre-push-gate.mts`, `crew/hooks/pre-tool-use-agent.mts`, `crew/hooks/otel-post-tool-use.mts`, `crew/scripts/crew.mts brief-me`, `crew/scripts/crew.mts show-workflow-state` with `Cannot find`.

- [ ] **Step 3: Implement `shipped-entrypoints.mts`**

`listShippedEntrypoints` parses every `hooks[event][*].hooks[*].command`, extracts the runtime word and the `${CLAUDE_PLUGIN_ROOT}/...` path plus trailing args, maps `PreToolUse` to `fixtures/pretooluse-bash.json`, `SubagentStop` to `subagentstop-done.json`, everything else to `{}`. `stageConsumerCopy` uses `fs.cp` with a `filter` excluding the three dirs.

- [ ] **Step 4: Run the test; it must still fail, now only on runtime-resolution errors**

Run: `bun test src/tests/install/consumer-smoke.test.mts`
Expected: FAIL with the same six entries; no test-harness errors.

- [ ] **Step 5: Commit the red test**

```bash
git add src/tests/install src/scripts/lib/install
git commit -m "test(install): consumer-install smoke test, red on 1.1.0 (audit #41)"
```

---

### Task 2: Self-contained runtime bundles

**Files:**
- Create: `src/scripts/build-dist.mts`
- Create: `dist/` (committed output, one `.js` per entry)
- Modify: `.claude-plugin/hooks/hooks.json` (generated), `commands/*.md` (path rewrite via Task 8's render script is later; here use `sed` once), `package.json` scripts, `.github/workflows/ci.yml` (dist-freshness check)
- Test: `src/tests/install/consumer-smoke.test.mts` (Task 1), `src/tests/install/dist-fresh.test.mts`

**Interfaces:**
- Produces: `bun run build:dist` writing `dist/hooks/<name>.js`, `dist/crew.js`, `dist/loop.js`; `bun run build:dist --check` exits 1 if any output differs from the committed file.
- Produces: hooks.json commands of the form `bun "${CLAUDE_PLUGIN_ROOT}/dist/hooks/<name>.js"`; commands reference `bun "${CLAUDE_PLUGIN_ROOT}/dist/crew.js"` and `dist/loop.js`.

- [ ] **Step 1: Write the freshness test**

```ts
// src/tests/install/dist-fresh.test.mts
import { test, expect } from "bun:test";
test("committed dist matches a fresh build", () => {
  const p = Bun.spawnSync(["bun", "src/scripts/build-dist.mts", "--check"], { cwd: process.cwd() });
  expect(p.exitCode, p.stderr.toString()).toBe(0);
});
```

- [ ] **Step 2: Implement `build-dist.mts`**

Entry list = every `.mts`/`.mjs` referenced in hooks.json plus `crew/scripts/crew.mts`, `src/scripts/loop.mts`, `crew/scripts/report-to-pr.mts`, `crew/scripts/prune-artifacts.mts`, `src/scripts/watch-tick.mts`. For each: `Bun.build({ entrypoints: [src], target: "bun", outdir: "dist/...", minify: false, sourcemap: "none", external: ["@opentelemetry/*", "@aws-sdk/*"] })`. `--check` builds to a temp dir and byte-compares. Keep `.mjs` hooks that already run under plain `node` as-is (copy, do not bundle) so the `node` invocation keeps working.

- [ ] **Step 3: Build, rewrite references, run both tests**

```bash
bun src/scripts/build-dist.mts
sed -i 's#"${CLAUDE_PLUGIN_ROOT}/crew/scripts/crew.mts"#"${CLAUDE_PLUGIN_ROOT}/dist/crew.js"#g; s#"${CLAUDE_PLUGIN_ROOT}/src/scripts/loop.mts"#"${CLAUDE_PLUGIN_ROOT}/dist/loop.js"#g' commands/*.md agents/*.md
bun test src/tests/install/
```
Expected: both PASS. If an entry still fails with `Cannot find`, the module uses a dynamic `import()` of a bare specifier; add it to the entry's static import list or to `external` and document why.

- [ ] **Step 4: Wire CI and scripts**

Add to `package.json`: `"build:dist": "bun src/scripts/build-dist.mts"`, `"test:install": "bun test src/tests/install/"`. Add a `dist-fresh` step to `ci.yml` under the existing validator job: `bun run build:dist -- --check`. Add `test:install` to `test:all`.

- [ ] **Step 5: Full gate and commit**

Run: `bun run test:all && bun run typecheck && bun run lint && bun run validate:manifests`
Expected: green.

```bash
git add dist src/scripts/build-dist.mts .claude-plugin/hooks/hooks.json commands agents package.json .github/workflows/ci.yml src/tests/install
git commit -m "build: ship self-contained dist bundles; plugin runs without node_modules (audit #41)"
```

---

### Task 3: CI exemption and gate fail-closed

**Files:**
- Modify: `.github/workflows/ci.yml:106-118` (changes filter), `:337-355` (gate)
- Create: `src/scripts/ci/docs-only.sh` (the filter logic, so it is testable), `src/scripts/ci/gate.sh`
- Test: `src/tests/ci/docs-only.test.mts`

**Interfaces:**
- Produces: `docs-only.sh` reads changed paths on stdin, prints `code=true|false`; exempt pattern is exactly `^(docs/|README\.md$|CHANGELOG\.md$|.*/backlog/|\.github/backlog/)`. Any path under `agents/`, `commands/`, `skills/`, `hooks/`, `crew/`, `src/`, `dist/`, `.claude-plugin/` is code.
- Produces: `gate.sh CODE FASTGATE_RESULT` exits 0 only when `CODE == "false"` or (`CODE == "true"` and `FASTGATE_RESULT == "success"`); every other combination exits 1.

- [ ] **Step 1: Write the failing tests**

```ts
// src/tests/ci/docs-only.test.mts
import { test, expect } from "bun:test";
const run = (sh: string, args: string[], stdin = "") => Bun.spawnSync(["bash", sh, ...args], { stdin: Buffer.from(stdin) });
test("agents/skills/commands markdown is code", () => {
  expect(run("src/scripts/ci/docs-only.sh", [], "agents/reviewer.md\n").stdout.toString().trim()).toBe("code=true");
  expect(run("src/scripts/ci/docs-only.sh", [], "skills/workflow/x/SKILL.md\n").stdout.toString().trim()).toBe("code=true");
  expect(run("src/scripts/ci/docs-only.sh", [], "docs/a.md\nREADME.md\n").stdout.toString().trim()).toBe("code=false");
  expect(run("src/scripts/ci/docs-only.sh", [], "").stdout.toString().trim()).toBe("code=true");
});
test("gate fails closed on missing or failed detection", () => {
  expect(run("src/scripts/ci/gate.sh", ["", "success"]).exitCode).toBe(1);
  expect(run("src/scripts/ci/gate.sh", ["true", "failure"]).exitCode).toBe(1);
  expect(run("src/scripts/ci/gate.sh", ["true", "success"]).exitCode).toBe(0);
  expect(run("src/scripts/ci/gate.sh", ["false", "skipped"]).exitCode).toBe(0);
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `bun test src/tests/ci/` Expected: FAIL (scripts missing).

- [ ] **Step 3: Implement the two scripts and call them from `ci.yml`** (the `changes` step pipes `git diff --name-only` into `docs-only.sh`; the `gate` step calls `gate.sh "${{ needs.changes.outputs.code }}" "${{ needs.fast-gate.result }}"`).

- [ ] **Step 4: Run tests** — Run: `bun test src/tests/ci/` Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "ci: prompt files are code; gate fails closed when detection is missing (codex #18, #19)"`

---

### Task 4: Explicit, aggregated review and validation verdicts

**Files:**
- Modify: `crew/scripts/crew.mts:566-577` (`resolveReviewVerdict`), the `write-review-result` and `write-validation-result` handlers (~`:1015-1140`)
- Modify: `crew/scripts/lib/workflow-state.mts:424-480` (`handleReviewResult`, `handleValidationResult`), `crew/scripts/lib/workflow-state-gates.mts:47` (`RunArtifacts`/`RunGates` types)
- Test: `crew/tests/review-verdict-aggregation.test.mts`

**Interfaces:**
- Produces: `--decision` is required for both commands; missing → stderr `[crew] write-review-result refused: --decision is required (approved|approved_with_notes|rejected)` and exit 2. `resolveReviewVerdict(rawDecision: string | null): string` (never `undefined`).
- Produces: `run.gates.review.reviewers: Record<string, "approved" | "approved_with_notes" | "rejected">` keyed by `--reviewer`; `run.gates.review.status` = `failed` if any value is `rejected`, else `passed`. Same shape for `validation.validators` with `pass|fail|skipped`; `skipped` requires `--skip-reason` and sets `validation_skipped`.
- Produces: `--required-reviewers a,b` optional flag on `write-review-result`; when present, status stays `required` until every listed reviewer has written.

- [ ] **Step 1: Write the failing tests**

```ts
// crew/tests/review-verdict-aggregation.test.mts
import { test, expect } from "bun:test";
import { registerWorkflowArtifact, loadWorkflowState } from "../scripts/lib/workflow-state.mts";
// helper mkRepo() creates a temp repo with an open run; helper cli(args) spawns crew.mts
test("missing --decision is refused", async () => {
  const r = cli(["write-review-result", "--repo", repo, "--title", "t", "--reviewer", "a"]);
  expect(r.exitCode).toBe(2);
  expect(r.stderr).toMatch(/--decision is required/);
});
test("reject then approve stays failed", async () => {
  await registerWorkflowArtifact(repo, "review-result", { reviewer: "a", verdict: "rejected" });
  await registerWorkflowArtifact(repo, "review-result", { reviewer: "b", verdict: "approved" });
  const s = await loadWorkflowState(repo);
  expect(s.currentRun.gates.review.status).toBe("failed");
  expect(s.currentRun.gates.review.reviewers).toEqual({ a: "rejected", b: "approved" });
});
test("approve then reject is failed", async () => { /* mirror order */ });
test("required reviewers: one approval is still required", async () => {
  await registerWorkflowArtifact(repo, "review-result", { reviewer: "a", verdict: "approved", requiredReviewers: ["a", "b"] });
  expect((await loadWorkflowState(repo)).currentRun.gates.review.status).toBe("required");
});
test("validation skipped needs a reason", async () => {
  const r = cli(["write-validation-result", "--repo", repo, "--title", "t", "--decision", "skipped"]);
  expect(r.exitCode).toBe(2);
});
```

- [ ] **Step 2: Run to verify failure** — Run: `cd crew && bun test tests/review-verdict-aggregation.test.mts` Expected: FAIL (missing-decision accepted; status `passed` after reject-then-approve).

- [ ] **Step 3: Implement** — `handleReviewResult`: remove the `verdict === undefined` branch (throw), write `reviewers[fields.reviewer] = verdict`, recompute status from the map. Same for validation. `resolveReviewVerdict`: `if (!rawDecision) { stderr; process.exit(2) }`. Add `--required-reviewers` parsing next to `--reviewer`. Update `WorkflowRun` types.

- [ ] **Step 4: Run crew tests** — Run: `cd crew && bun test --timeout 60000 tests/` Expected: PASS; fix any existing test that relied on default-approve by adding `--decision approved` to it (there is a "legacy" path comment at `workflow-state.mts:418-423`; delete the comment).

- [ ] **Step 5: Commit** — `git commit -am "fix(gates): require explicit verdicts; aggregate per reviewer, reject wins (codex #20, #21)"`

---

### Task 5: Explicit validation-skip and consumer-CI check in the dispatchers

**Files:**
- Modify: `commands/orchestrate-slice.md` (the `RISK_GATE=false` branch that says "Do not dispatch a dedicated verifier"), `commands/fix.md` (the "No verifier dispatch" paragraph), `docs/routing-table.md:64`, `skills/workflow/dispatcher-routing/SKILL.md:41`
- Create: `crew/scripts/lib/ci/consumer-ci.mts`, subcommand `crew.mts has-consumer-ci --repo <path>`
- Test: `crew/tests/consumer-ci.test.mts`, `crew/tests/command-gate-policy.test.mts`

**Interfaces:**
- Produces: `hasConsumerCi(repoPath: string): Promise<{ present: boolean; workflows: string[] }>` true when `.github/workflows/*.yml` contains a job that runs the repo's configured test command (`.claude/loop.json` `stack.build[].cmd`) or any of `bun test|npm test|dotnet test|pytest|go test`.
- Produces: one policy sentence, identical in all four docs: "LOW-risk slices: one reviewer; verifier is replaced by `write-validation-result --decision skipped --skip-reason "delegated to CI: <workflow file>"` only when `has-consumer-ci` reports present; otherwise dispatch `devcrew:verifier`."

- [ ] **Step 1: Write failing tests** — `consumer-ci.test.mts`: temp repo without `.github` → `present=false`; with a workflow containing `bun test` → `present=true, workflows=["ci.yml"]`. `command-gate-policy.test.mts`: reads the four docs and asserts each contains the exact policy sentence and that none contains "No skip path" or "No verifier dispatch".

- [ ] **Step 2: Run to verify failure** — Run: `cd crew && bun test tests/consumer-ci.test.mts tests/command-gate-policy.test.mts` Expected: FAIL.

- [ ] **Step 3: Implement the lib + subcommand; edit the four docs** to the policy sentence; in `orchestrate-slice.md` and `fix.md` add the two-line bash that calls `has-consumer-ci` and branches.

- [ ] **Step 4: Run tests** — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix(gates): record validation_skipped explicitly; verifier waived only with consumer CI (audit #10, codex #23)"`

---

### Task 6: Builders report inline; no pre-review publishing

**Files:**
- Modify: `agents/fullstack-dev.md`, `agents/backend-dev.md`, `agents/frontend-dev.md`, `agents/aiplugin-dev.md` (the "push + open draft PR before reporting" step and the `node ./scripts/report-to-pr` call; the "Your last action MUST be a SendMessage to main" paragraph)
- Modify: `commands/build.md` (the sentence requiring a `write-handoff` artifact for `size: standard`), `skills/workflow/builder-ceremony/SKILL.md:14`
- Modify: `crew/scripts/validate-agents.mts` (new rule), `crew/scripts/validate-agent-refs.mts` (path rule)
- Test: `crew/tests/builder-report-contract.test.mts`

**Interfaces:**
- Produces: the single builder report contract is the final message, a 4-line block `STATUS: DONE|BLOCKED|HELP|IN-PROGRESS / FILES: ... / TESTS: <command> rc=<n> / NEXT: ...`. No PR comment, no mandatory handoff, no SendMessage.
- Produces: validator rule `no-relative-script-path`: any agent/command line matching `node \./scripts/|bun \./scripts/|node scripts/` fails; rule `no-prereview-publish`: builders must not contain `gh pr create` or `git push` outside a section headed `## Ship` (none of the four has one).

- [ ] **Step 1: Write failing tests** — `builder-report-contract.test.mts`: for each of the four builders assert the file contains `STATUS:` block spec once, does not contain `report-to-pr`, `gh pr create`, `SendMessage`, or `git push`; assert `commands/build.md` does not contain "REQUIRE a `write-handoff`"; assert `validate-agents.mts` exits 1 on a fixture agent containing `node ./scripts/x.mts`.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL on all four builders.

- [ ] **Step 3: Edit the prompts and the validator** — delete the publish step and the PR-comment step; replace the SendMessage paragraph with "Return the STATUS block as your final message."; add the two validator rules.

- [ ] **Step 4: Run** — `cd crew && bun test tests/builder-report-contract.test.mts && bun crew/scripts/validate-agents.mts` Expected: PASS, validator OK.

- [ ] **Step 5: Commit** — `git commit -am "fix(agents): one builder report contract; no publish before review (audit #7, codex #22)"`

---

### Task 7: Broken references batch + reference validators + light-path classifier

**Files:**
- Modify: `commands/parallel.md:36-63` (`subagent_type: devcrew:build` → `subagent_type: general-purpose` with prompt line "Run the `/devcrew:build` ladder for slice <id> in worktree <path>"), `commands/fix.md:36` (delete `mark-badge inspected`), `agents/reviewer.md:100` (`docs/workflow/reviewing-code/` → `skills/workflow/reviewing-code/`), `commands/orchestrate-slice.md:444` (`/devcrew:fix --target integration` → `/devcrew:fix "integration smoke failed: <artifact path>"`)
- Delete: `skills/workflow/reviewing-code/scripts/*.py` (3), `skills/domain/architecture/architecture-advisory/scripts/*.py` (3); the "Automated analysis" / "Quick Start" / "Core Capabilities" blocks in `reviewing-code/SKILL.md:27-45`, `backend-advisory/SKILL.md`, `fullstack-advisory/SKILL.md`, `security-advisory/SKILL.md` that name the 9 missing scripts
- Modify: `crew/scripts/validate-agent-refs.mts` (three new rules), `commands/build.md:14-22` + `commands/fix.md` (light path)
- Create: `crew/scripts/lib/light-path.mts`, subcommand `crew.mts classify-light --task "<text>" [--files a,b]`
- Test: `crew/tests/validate-refs-rules.test.mts`, `crew/tests/light-path.test.mts`

**Interfaces:**
- Produces: validator rules (each with a fixture that must fail): `subagent-exists` (every `subagent_type: devcrew:<x>` has `agents/<x>.md`), `repo-path-exists` (every backticked path starting with `skills/`, `docs/`, `commands/`, `agents/`, `crew/`, `src/` exists), `skill-script-exists` (every `scripts/<name>.(py|ts|mts|sh)` mentioned in a SKILL.md exists beside it).
- Produces: `classifyLight(input: { task: string; files?: string[] }): { eligible: boolean; reason: string }`; eligible only when `files` is non-empty, `files.length <= 2`, and `task` matches `/\b(typo|rename|format|comment|lint|whitespace|bump)\b/i`; empty `files` → `{ eligible: false, reason: "no files named" }`.

- [ ] **Step 1: Write failing tests** — `validate-refs-rules.test.mts`: three fixtures (an agent naming `devcrew:nope`, a reviewer citing `docs/workflow/x/`, a SKILL.md citing `scripts/ghost.py`) each make the validator exit 1 with the rule name in stderr; the real tree passes. `light-path.test.mts`: `classifyLight({task:"add OAuth login flow"})` → not eligible, reason "no files named"; `classifyLight({task:"fix typo in README", files:["README.md"]})` → eligible; `classifyLight({task:"fix typo", files:["a","b","c"]})` → not eligible.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (rules absent; the real tree would fail `subagent-exists` on `parallel.md` and `repo-path-exists` on `reviewer.md`).

- [ ] **Step 3: Implement rules and classifier; apply the reference edits; delete the stub scripts and their SKILL.md blocks; replace the `git diff HEAD` block in `build.md` and `fix.md`** with: `bun "${CLAUDE_PLUGIN_ROOT}/dist/crew.js" classify-light --task "$ARGUMENTS"` and branch on `eligible`.

- [ ] **Step 4: Run** — `cd crew && bun test tests/validate-refs-rules.test.mts tests/light-path.test.mts && bun crew/scripts/validate-agent-refs.mts && bun crew/scripts/validate-skills.mts` Expected: PASS, both validators OK.

- [ ] **Step 5: Commit** — `git commit -am "fix(refs): real dispatch targets, paths, badges; remove stub analyzers; light path decided from the task (audit #1,#2,#4,#5,#8,#9)"`

---

### Task 8: One hook dispatcher per event

**Files:**
- Create: `crew/hooks/dispatch.mts` (entry: `bun dispatch.js <EventName>`), `crew/hooks/registry.mts`, `src/scripts/render-hooks-json.mts`
- Modify: `.claude-plugin/hooks/hooks.json` (generated), `src/scripts/build-dist.mts` entry list, `crew/hooks/otel-*.mts` (spool), add `crew/hooks/otel-flush.mts` on `Stop`
- Delete: `crew/hooks/pre-tool-use-bash-gate.mts`, `crew/hooks/post-tool-use-bash-gate.mts`, `crew/hooks/lib/bash-gate-timer-tap.mts` (dead cross-process Map), `crew/scripts/log_event.sh` (ported into the dispatcher)
- Test: `crew/tests/hooks/dispatch.test.mts`, `crew/tests/hooks/hooks-json-shape.test.mts`

**Interfaces:**
- Produces: `registry.mts` exports `CHECKS: Array<{ event: HookEvent; matcher?: string; name: string; enforce: boolean; timeoutMs: number; run: (input: HookInput) => Promise<CheckResult> }>` where `CheckResult = { block?: { reason: string }; systemMessage?: string; updatedInput?: Record<string, unknown> }`. Each existing `crew/hooks/lib/*.mts` `run*Hook` function is wrapped once here (including `model-routing-enforce`).
- Produces: `dispatch.mts` reads stdin once, filters `CHECKS` by event + tool matcher, runs them with `Promise.allSettled` and per-check timeout, merges: any `block` from an `enforce: true` check → exit 2 with every blocker's reason joined by `; `; rejected promises from `enforce: false` checks are logged to `.claude/logs/events.jsonl` and ignored; rejected `enforce: true` checks → exit 2 (fail closed). Output uses `hookSpecificOutput.permissionDecision` for PreToolUse.
- Produces: `render-hooks-json.mts` emits exactly one entry per `(event, matcher)` with `"command": "bun \"${CLAUDE_PLUGIN_ROOT}/dist/hooks/dispatch.js\" <Event>"`, `"timeout"` = max check timeout + 1 s, `"onFailure": "block"` when any check in the group is `enforce: true`, plus the unchanged `node .../hooks/*.mjs` entries.

- [ ] **Step 1: Write failing tests** — `hooks-json-shape.test.mts`: for every event, the number of `bun` commands per `(event, matcher)` is ≤ 1 and every entry has `timeout`; enforcement groups have `onFailure: "block"`. `dispatch.test.mts`: (a) PreToolUse Bash payload with a registry stub where one check throws and another blocks → exit 2, reason lists the blocker; (b) telemetry check throws → exit 0, line in events.jsonl; (c) SubagentStop payload with `DONE:` and a red review gate → exit 2 (gate-guard still works through the dispatcher); (d) Agent dispatch with `loop.modelRouting.enabled: true` and no `model` → `updatedInput.model` set (model-enforce preserved).

- [ ] **Step 2: Run to verify failure** — Expected: FAIL (dispatch.mts missing; hooks.json has 10 bun entries on PreToolUse).

- [ ] **Step 3: Implement registry, dispatcher, renderer; port `log_event.sh` to a `log-event` check (`enforce: false`, writes `{schemaVersion, event, session_id, agent_id, ts}` only, no payload file); make otel checks append one JSON line to `.claude/state/otel-spool.jsonl` and `otel-flush` export at `Stop` with a 2 s cap.**

- [ ] **Step 4: Run** — `bun src/scripts/render-hooks-json.mts && bun run build:dist && cd crew && bun test tests/hooks/ && cd .. && bun run test:install` Expected: PASS; `consumer-smoke` still green through `dist/hooks/dispatch.js`.

- [ ] **Step 5: Measure** — Run from the consumer temp repo: `hyperfine -w 3 -r 20 'echo "{...PreToolUse Bash payload...}" | bun --no-install <pluginCopy>/dist/hooks/dispatch.js PreToolUse'` and record p50 in `docs/audits/2026-11-05/README.md` next to the baseline (6 spawns, p50 214 ms per spawn on dev-team). Target: one spawn, p50 under 250 ms end to end.

- [ ] **Step 6: Commit** — `git commit -am "perf(hooks): single dispatcher per event, timeouts, fail-closed enforcement, spooled telemetry (audit #3,#11,#12,#25)"`

---

### Task 9: Telemetry honesty (cost, pricing, grades, paths)

**Files:**
- Modify: `crew/scripts/lib/cost-hygiene/emit-cost-report.mts:134-152`, `crew/scripts/lib/session-cost.mts:21,27-34`, `crew/scripts/lib/pricing.json`, grade writer (locate via `grep -rn "<fill title>" src crew/scripts`), `crew/scripts/lib/artifacts/write.mts:764`
- Test: `crew/tests/cost-report-honesty.test.mts`, `crew/tests/pricing.test.mts`

**Interfaces:**
- Produces: `emitCostReport` refuses (returns `{ written: false, reason }`) when `sessionsScanned === 0` or when the window exceeds `maxWindowHours` (default 24) unless `--allow-wide-window`; frontmatter gains `run_id`; a second emit with the same `run_id` and identical totals returns `{ written: false, reason: "duplicate run_id" }`.
- Produces: `priceFor(modelId: string): { input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number; matched: string | null }`; unmatched → `matched: null` and the report lists `unpriced_models: [...]`; cost-advisor verdict becomes `unknown` when non-empty. Keys added: `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` with the per-MTok prices from the spec section 3.7.
- Produces: grade writer rejects any axis `=== 0` with title `<fill title>` or any unreplaced `<fill ...>` token (exit 2, "grade template unfilled").

- [ ] **Step 1: Write failing tests** — `cost-report-honesty.test.mts`: zero sessions → not written; 30 h window → not written; same run_id twice → second not written; `pricing.test.mts`: `priceFor("claude-sonnet-5-5").matched === "claude-sonnet-5-5"`; `priceFor("claude-opus-4-9").matched === null`; "pricing path with space": copy `pricing.json` under a temp dir containing a space, point the loader at it via `PRICING_PATH`, assert it loads. Grade test: template stub → exit 2.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL on all.

- [ ] **Step 3: Implement** — `fileURLToPath(new URL("./pricing.json", import.meta.url))`; add keys; window + run_id guards; grade token check.

- [ ] **Step 4: Run** — `cd crew && bun test tests/cost-report-honesty.test.mts tests/pricing.test.mts` Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -am "fix(telemetry): refuse missing observations, dedupe by run_id, price Claude 5, fix path with spaces (audit #16,#17,#42-#44)"`

---

### Task 10: Session-start diet and test quarantine

**Files:**
- Modify: `CLAUDE.md` (remove `@.claude/artifacts/loop/loop-snapshot.md` and `@.claude/crew/constitution.md` includes; keep `@AGENTS.md`), `.claude/crew/constitution.md` (reduce to the delta vs `~/.claude/crew/constitution.md`: peer-dispatch section + dev.stable carve-out only), `skills/loop-discipline/SKILL.md` (gains the "read `.claude/loop/rules.md` and `MASTER_PROMPT.md` first" instruction that leaves CLAUDE.md)
- Modify: `package.json` (`test` excludes `src/tests/perf/`; `bench` runs it), `crew/tests/hook-cold-start-bench.test.mts` and `crew/tests/gepa/capture-perf.test.mts` move under `crew/tests/perf/` and out of `test:crew`
- Modify: `.github/workflows/ci.yml` e2e step: replace the 3x retry with a single run **after** Step 3 below finds the cause
- Test: `src/tests/context/session-start-budget.test.mts`

**Interfaces:**
- Produces: `measureSessionStart(repoRoot: string): { bytes: number; files: string[] }` resolving `@` includes transitively from `CLAUDE.md` and `~/.claude/CLAUDE.md`; test asserts `bytes <= 12_288` and that no file appears twice.

- [ ] **Step 1: Write failing test** — assert budget ≤ 12,288 bytes and no duplicate file. Expected baseline on dev-team was ~30.5 KB via includes.

- [ ] **Step 2: Run to verify failure** — Expected: FAIL with the measured bytes.

- [ ] **Step 3: Diagnose the e2e flake before touching the retry** — Run `for i in 1 2 3 4 5; do bun crew/scripts/e2e-smoke.mts || echo FAIL-$i; done` and record every failure's first error line in `docs/audits/2026-11-05/README.md` under "e2e flake causes". If all five pass, remove the retry. If any fail, open a task note with the cause and keep the retry at 1 extra attempt.

- [ ] **Step 4: Apply the include changes, move the perf tests, update scripts** — then Run: `bun test src/tests/context/ && bun run test:all` Expected: PASS; `test:all` wall time lower than the Task 0 baseline by at least the two perf tests' durations (~80 s on dev-team).

- [ ] **Step 5: Commit** — `git commit -am "chore(context): session start under 12 KB; perf tests quarantined to bench; e2e retry based on measured cause (audit #15,#18)"`

---

### Task 11: End-to-end smoke in a real consumer and sign-off

**Files:**
- Create: `docs/audits/2026-11-05/smoke-after.md`
- Create: scratch consumer repo `C:\work\mega\scratch-devcrew-smoke\` (not committed anywhere)

- [ ] **Step 1: Install the branch build as a local plugin in the scratch repo**

```bash
mkdir -p /c/work/mega/scratch-devcrew-smoke && cd /c/work/mega/scratch-devcrew-smoke && git init -q && printf '# smoke\n' > README.md && git add -A && git commit -qm init
claude plugin validate --strict /c/work/mega/dev-crew/.worktrees/fix-audit-2026-11
claude plugin install --from /c/work/mega/dev-crew/.worktrees/fix-audit-2026-11   # or the marketplace "add local path" flow if `--from` is unavailable in this CLI version
```
Expected: validate OK; install succeeds; `ls ~/.claude/plugins/cache/<name>/*/node_modules` → absent.

- [ ] **Step 2: Hook smoke inside a live session** — In the scratch repo run `claude -p --max-budget-usd 2 "Run: echo hello. Then read README.md. Then say done."`; afterwards assert `.claude/logs/events.jsonl` exists with `PreToolUse`, `PostToolUse`, `Stop` rows and zero `hook_error` rows: `grep -c hook_error .claude/logs/events.jsonl` → `0`.

- [ ] **Step 3: Gate smoke** — In the scratch repo: `bun ~/.claude/plugins/cache/<name>/<ver>/dist/crew.js write-review-result --repo . --title t --reviewer a --decision rejected` then `... --reviewer b --decision approved`, then `... show-workflow-state` → review gate `failed`. Then `write-review-result` with no `--decision` → exit 2.

- [ ] **Step 4: Dispatcher smoke** — `claude --max-budget-usd 5` interactive in the scratch repo: `/devcrew:build add a CONTRIBUTING.md with one sentence`. Expected: no `dev-lite` dispatch (task names no files), builder returns the STATUS block, two reviewers write artifacts with `--decision`, `show-workflow-state` shows `review_passed`, and no PR was opened (`gh pr list` empty / no remote).

- [ ] **Step 5: Record and commit** — write every command and observed output into `docs/audits/2026-11-05/smoke-after.md` with PASS/FAIL per row mirroring `smoke-baseline.md`; `git commit -am "docs(audit): post-remediation consumer smoke results"`.

- [ ] **Step 6: Whole-branch review** — dispatch a fresh reviewer on `git diff main...fix/audit-2026-11` with the spec files as the acceptance list (one row per audit finding #1-#53 closed by this plan: #1-#5, #7-#13, #15-#18, #25, #41-#44, #48-#53). Any row without a test or a smoke line is not closed.

---

## Self-review notes

- Spec coverage: Horizon 1 revised items 1 to 8 map to Tasks 3, 4+5, 6, 2, 7, 8, 9, 10. Horizon 2 and 3 (roster collapse, skills cut, Workflow prototype, memory v2) are intentionally out of this plan per Codex #24, #27, #28; they need usage data first.
- Not covered here, by design: skill-discovery verification (#19) beyond `claude plugin validate --strict` in Task 11 Step 1; add a follow-up if validate does not report skills.
- Type consistency: `CheckResult`, `registry.CHECKS`, `classifyLight`, `priceFor`, `hasConsumerCi`, `listShippedEntrypoints`, `stageConsumerCopy` are each defined once and used by name in later tasks.
- Line numbers cite devcrew 1.1.0 as installed on 2026-11-05; Task 0 Step 2 re-checks them if `main` moved.
