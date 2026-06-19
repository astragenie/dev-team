---
id: SLICE-80
title: "FEAT-162 SLICE-A: agent-eval harness foundation — dry-run replay fixture, no live claude -p"
status: completed
feature: FEAT-162
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-19
updated: 2026-06-19
developer_type: agent
estimated_complexity: low
languages: [typescript]
autonomous_safe: true
touches_files: [tests/agent-eval/lib/run-claude.ts, tests/agent-eval/lib/assert-trace.ts, tests/agent-eval/lib/types.ts, tests/agent-eval/fixtures/00-dry-run-replay.fixture.ts, tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json, tests/agent-eval/run.test.ts, tests/agent-eval/README.md, package.json]
touches_files_confidence: declared
completed_at: 2026-06-19
---
# SLICE-80: agent-eval harness foundation (FEAT-162 SLICE-A)

Implements **SLICE-A of FEAT-162**: scaffold the `tests/agent-eval/` tree, the `Fixture` / `CapturedTrace` type contract, and pure-function trace-assertion helpers. Ships one dry-run fixture that replays a captured JSON trace through the helpers — **no `claude -p` subprocess is spawned in this slice**. See the [feature file](../../backlog/in-progress/FEAT-162.md) for product context.

`autonomous_safe: true` per FEAT-162 §"Per-slice decomposition suggestion" — foundation only, no CLI process spawning, no auth surface, no CI workflow. SLICE-B/C/D remain `autonomous_safe: false`.

## Objective

Lock in the **shape** of an "agent unit test" so SLICE-B has a known target. After this slice the repo has: (a) a typed `Fixture` interface, (b) a typed `CapturedTrace` interface mirroring the `claude -p --output-format stream-json` event shape, (c) five pure assertion helpers over `CapturedTrace`, (d) one replay fixture proving the helpers work end-to-end against a realistic captured trace, (e) a Bun test loop gated behind `CREW_AGENT_EVAL=1`, and (f) a `test:agents` npm script. The `run-claude.ts` module is stubbed (signature only, throws "not implemented") — SLICE-B fills it.

Per FEAT-162 §"Design constraints": all assertions are fuzzy (regex / contains / exists / shape). No exact-string asserts on free text. Per repo plugin-observability ceiling (memory `project_plugin_observability_ceiling.md`): this harness emits no observability lines — test runner output is the observable surface.

## In scope

### Deliverable 1 — Type contract in `tests/agent-eval/lib/types.ts`

- Path: `tests/agent-eval/lib/types.ts`. New directory `tests/agent-eval/lib/`.
- Pure type module; no runtime code, no zod (validation lives inside the assertion helpers' positive paths, not at module boundary — fixtures are author-controlled).
- Required exports:
  1. `interface ToolCallEvent { type: "tool_use"; name: string; input: Record<string, unknown>; id: string; }` — mirrors the `stream-json` `tool_use` block shape from the Claude Code CLI.
  2. `interface TextEvent { type: "text"; text: string; }` — assistant text deltas / final message.
  3. `interface SubagentDispatchEvent { type: "tool_use"; name: "Agent"; input: { subagent_type: string; prompt: string; description?: string }; id: string; }` — sub-shape of `ToolCallEvent` for `Agent`-tool calls (used by `dispatchedAgent` helper).
  4. `type TraceEvent = ToolCallEvent | TextEvent;` — union of event shapes the helpers operate on.
  5. `interface CapturedTrace { events: TraceEvent[]; finalText: string; exitCode: number; cwd: string; }` — matches the return shape `lib/run-claude.ts` will emit in SLICE-B (locked here so SLICE-B targets it).
  6. `interface Fixture { name: string; prompt: string; agent?: string; timeoutMs?: number; setup?: (cwd: string) => Promise<void>; expect: (trace: CapturedTrace) => Promise<void> | void; }` — the author-facing fixture contract. `name` is human-readable, `prompt` is the user-message passed to `claude -p`, `agent` is the optional `subagent_type` hint for SLICE-B, `timeoutMs` defaults to 180000 (180s) per FEAT body, `setup` runs inside a `mkdtemp` cwd before the prompt, `expect` receives the parsed trace and throws on failure (any thrown error becomes a Bun test failure).
- Hard cap: ≤ 60 lines TS.

### Deliverable 2 — Stub runner in `tests/agent-eval/lib/run-claude.ts`

- Path: `tests/agent-eval/lib/run-claude.ts`.
- SLICE-A ships **signature only**. Body throws.
- Required export:
  1. `export async function runClaude(opts: { prompt: string; cwd: string; timeoutMs?: number; agent?: string }): Promise<CapturedTrace>` — throws `new Error("runClaude not implemented — SLICE-B (FEAT-162) will land the live subprocess wrapper")` from the first line of the body.
- File MUST include a top-of-file comment block stating: "STUB — SLICE-A. Real implementation lands in SLICE-B (FEAT-162). See `.claude/artifacts/loop/backlog/in-progress/FEAT-162.md` §Per-slice decomposition.".
- The stub MUST be imported and referenced from `run.test.ts` (so the type-check sees it) but MUST NOT be invoked by any fixture in this slice — the only fixture (Deliverable 4) uses `loadCapturedTrace()` instead.
- Hard cap: ≤ 30 lines TS.

### Deliverable 3 — Pure assertion helpers in `tests/agent-eval/lib/assert-trace.ts`

- Path: `tests/agent-eval/lib/assert-trace.ts`.
- All helpers are pure functions over `CapturedTrace`. No I/O, no `Date.now()`, no `process.*`.
- Required exports (signatures + behavior):
  1. `toolCallsOf(trace: CapturedTrace, name: string): ToolCallEvent[]` — returns every `tool_use` event whose `name` exactly equals the argument. Returns `[]` (never throws) if none match. `name` is case-sensitive (Claude tool names are stable: `Read`, `Write`, `Edit`, `Bash`, `Agent`, `Grep`, `Glob`, etc.).
  2. `hasToolCall(trace: CapturedTrace, name: string, inputMatcher?: (input: Record<string, unknown>) => boolean): boolean` — returns true if at least one `tool_use` matches `name` AND (if `inputMatcher` provided) the matcher returns true for that event's `input`. Designed for fuzzy assertions like `hasToolCall(trace, "Bash", inp => /bun (run )?test/.test(String(inp.command ?? "")))`.
  3. `dispatchedAgent(trace: CapturedTrace, subagentType: string | RegExp): SubagentDispatchEvent | null` — scans for `tool_use` events with `name === "Agent"`. Returns the first whose `input.subagent_type` matches the argument (string = exact match; RegExp = `.test()`). Returns `null` if none. This is the helper that catches FEAT-162's motivating regression (the `Agent`-tool misroute pattern from v0.35.2): a fixture can assert `dispatchedAgent(trace, /^crew:builder/) !== null` to verify the lead chose the right subagent_type.
  4. `findArtifact(trace: CapturedTrace, pathPattern: string | RegExp): ToolCallEvent | null` — scans for `Write` / `Edit` `tool_use` events whose `input.file_path` (string) matches `pathPattern` (string = `.includes()` substring match; RegExp = `.test()`). Returns the first match or `null`. Used for "did the builder write the handoff?" assertions.
  5. `artifactContains(trace: CapturedTrace, pathPattern: string | RegExp, bodyPattern: string | RegExp): boolean` — combines `findArtifact` with a body check against `input.content` (for `Write`) or `input.new_string` (for `Edit`). Returns true iff an artifact was found AND its content matches the body pattern. `bodyPattern` is a substring (string) or regex (RegExp) match against the content field.
- All five helpers MUST have JSDoc on the exported declaration documenting return shape and the matching semantics described above.
- Hard cap: ≤ 120 lines TS.

### Deliverable 4 — Captured trace fixture data in `tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json`

- Path: `tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json`. New directory `tests/agent-eval/fixtures/captured-traces/`.
- Synthetic but realistic — must mirror the shape `claude -p --output-format stream-json` produces for a successful builder run. JSON file matching the `CapturedTrace` interface exactly.
- Required minimum content (the assertion helpers' acceptance tests depend on this):
  - `exitCode: 0`
  - `cwd: "/tmp/agent-eval-builder-handoff-XXXXXX"` (sentinel placeholder, never a real path)
  - `finalText: "Handoff written to .claude/artifacts/crew/handoffs/SLICE-XX-builder.md. Build complete."`
  - `events` array containing AT LEAST these five entries in order:
    1. A `text` event with `text: "Starting build for SLICE-XX..."`.
    2. A `tool_use` event with `name: "Agent"`, `input.subagent_type: "crew:builder"`, `input.prompt` containing `"SLICE-XX"`, `input.description: "Build SLICE-XX"`, `id: "tool_001"`.
    3. A `tool_use` event with `name: "Bash"`, `input.command: "bun run test --parallel"`, `id: "tool_002"`.
    4. A `tool_use` event with `name: "Write"`, `input.file_path: ".claude/artifacts/crew/handoffs/SLICE-XX-builder.md"`, `input.content` containing `"verdict: PASS"`, `id: "tool_003"`.
    5. A `text` event with `text: "Handoff written. PASS."` (or similar — must contain literal `"PASS"`).
- This file is the unit-of-truth for all `assert-trace.ts` assertions in this slice's test suite (Deliverable 6).

### Deliverable 5 — Dry-run replay fixture in `tests/agent-eval/fixtures/00-dry-run-replay.fixture.ts`

- Path: `tests/agent-eval/fixtures/00-dry-run-replay.fixture.ts`.
- Exports `default` as a `Fixture` (per Deliverable 1 contract).
- Fixture body:
  - `name: "00-dry-run-replay"`
  - `prompt: "(dry-run — no live claude -p invocation)"`
  - `setup`: copies the captured trace JSON into the temp cwd as `_captured.trace.json` (or skips — the `expect` callback loads from the well-known path regardless).
  - `expect`: loads `tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json` via `fs.readFile` + `JSON.parse`, treats it as the `CapturedTrace`, then runs at minimum these four assertions using the helpers (any thrown error fails the fixture): (a) `assert(trace.exitCode === 0)`, (b) `assert(dispatchedAgent(trace, /^crew:builder/) !== null)`, (c) `assert(hasToolCall(trace, "Bash", inp => /bun (run )?test/.test(String(inp.command ?? ""))))`, (d) `assert(artifactContains(trace, /SLICE-.*-builder\.md$/, /verdict:\s*PASS/i))`.
- Fixture MUST NOT call `runClaude` (stub would throw). It MUST exercise the helpers against the captured JSON — that is the value SLICE-A delivers.
- Hard cap: ≤ 60 lines TS.

### Deliverable 6 — Bun test loop in `tests/agent-eval/run.test.ts`

- Path: `tests/agent-eval/run.test.ts`.
- Uses `bun:test` (mirrors `tests/test-quality-integration.test.ts` import pattern: `import { describe, test, expect } from "bun:test"`).
- Structure:
  - Top-level: `const EVAL_ENABLED = process.env.CREW_AGENT_EVAL === "1";`
  - `describe.skipIf(!EVAL_ENABLED)("agent-eval fixtures", () => { ... })` block.
  - Inside: load fixtures via static import (start with one — `import dryRunFixture from "./fixtures/00-dry-run-replay.fixture.ts"`). Avoid dynamic `import()` to keep Bun's parallel scheduler honest.
  - Loop: `for (const fixture of [dryRunFixture]) { test(fixture.name, async () => { const cwd = await mkdtemp(...); try { await fixture.setup?.(cwd); /* SLICE-A: no runClaude — fixture loads captured trace itself */ const trace = await loadCapturedFor(fixture.name); await fixture.expect(trace); } finally { await fs.rm(cwd, { recursive: true, force: true }); } }, fixture.timeoutMs ?? 180000); }`
  - The `loadCapturedFor` helper inside the test file maps `fixture.name` to its `captured-traces/<name>.trace.json` path. For `00-dry-run-replay` it maps to `00-builder-handoff.trace.json` per Deliverable 4.
- Top-of-file comment MUST state: "Default `bun run test` skips this file (CREW_AGENT_EVAL unset). Run via `bun run test:agents` or `CREW_AGENT_EVAL=1 bun test tests/agent-eval/`."
- A separate, **always-on** unit-test block in this same file MUST exercise the pure helpers directly against the captured JSON (outside the `skipIf` guard) — this is what gives SLICE-A real coverage without burning subscription quota. See Deliverable 8 for the test-case list.
- Hard cap: ≤ 130 lines TS.

### Deliverable 7 — README in `tests/agent-eval/README.md`

- Path: `tests/agent-eval/README.md`.
- Required sections:
  1. **Purpose** — one paragraph quoting FEAT-162 §Description (the "no behavioral test layer for agents" gap).
  2. **Status** — explicit: "SLICE-A landed (this commit). Dry-run replay only. Live `claude -p` lands in SLICE-B; nightly CI in SLICE-D. See `.claude/artifacts/loop/backlog/in-progress/FEAT-162.md`."
  3. **Running locally** — exact command: `bun run test:agents` (env var pre-set via package script).
  4. **Adding a fixture** — 4 numbered steps: (a) write a `.fixture.ts` exporting `default: Fixture`, (b) record or hand-author a captured trace under `captured-traces/`, (c) add the import to `run.test.ts`'s fixture list, (d) run `bun run test:agents`.
  5. **Rate-limit math** — pulled verbatim from FEAT-162 §Notes: "Max plan ≈ 200–800 messages per 5h window depending on tier. A fixture suite of 10 scenarios × ~30 tool calls/turns each fits comfortably nightly but would burn ~half a Pro window — hence the nightly-only stance."
  6. **Prerequisites (SLICE-B onward)** — bulleted: (a) `claude login` OAuth completed on the runner, (b) `claude plugin link <repo>` so the crew plugin is discoverable, (c) `CREW_AGENT_EVAL=1` env var set.
  7. **Troubleshooting** — three rows: (a) "no fixtures ran" -> CREW_AGENT_EVAL unset; (b) "runClaude not implemented" -> running SLICE-A stub directly; SLICE-B not landed yet; (c) "OAuth error" -> SLICE-B+ concern, run `claude login`.
- Hard cap: ≤ 100 lines markdown.

### Deliverable 8 — Tests (always-on coverage of pure helpers)

The pure-helper tests live inside `tests/agent-eval/run.test.ts` outside the `describe.skipIf` guard so they run on every `bun run test` invocation. They prove SLICE-A's behavior without spawning `claude -p`.

- **Test block: `assert-trace helpers (always-on)`** — 6 cases (minimum 3 per spec-writer rules; this block over-delivers because the helpers are the slice's load-bearing API):
  1. **`toolCallsOf` happy path:** loads `captured-traces/00-builder-handoff.trace.json`, asserts `toolCallsOf(trace, "Bash").length === 1` and the returned event's `input.command === "bun run test --parallel"`.
  2. **`toolCallsOf` empty path:** asserts `toolCallsOf(trace, "NoSuchTool").length === 0` and result is an array (`Array.isArray(...) === true`), never `undefined`.
  3. **`hasToolCall` fuzzy regex match:** asserts `hasToolCall(trace, "Bash", inp => /bun (run )?test/.test(String(inp.command ?? ""))) === true` AND `hasToolCall(trace, "Bash", inp => /npm test/.test(String(inp.command ?? ""))) === false` (proves the matcher actually runs).
  4. **`dispatchedAgent` regex match:** asserts `dispatchedAgent(trace, /^crew:builder/)?.input.subagent_type === "crew:builder"` and `dispatchedAgent(trace, "crew:reviewer") === null` (string mode = exact match, returns null when absent).
  5. **`findArtifact` returns Write event:** asserts `findArtifact(trace, /SLICE-.*-builder\.md$/)?.name === "Write"` and `findArtifact(trace, "nonexistent-path") === null`.
  6. **`artifactContains` combined match:** asserts `artifactContains(trace, /-builder\.md$/, /verdict:\s*PASS/i) === true` and `artifactContains(trace, /-builder\.md$/, /verdict:\s*FAIL/i) === false` (proves both path AND body matchers participate in the result).
- **Test block: `runClaude stub`** — 1 case:
  7. Importing `runClaude` from `lib/run-claude.ts` and invoking it MUST throw an error whose message contains `"not implemented"` and `"SLICE-B"`. Asserts the stub is wired but not callable, so SLICE-B's contract is locked.

All seven cases use `bun:test`'s `test()` + `expect()` API. No `node:test`. No `chai`. No new dev-deps.

### Deliverable 9 — `test:agents` script in `package.json`

- Add one entry under `scripts`: `"test:agents": "CREW_AGENT_EVAL=1 bun test tests/agent-eval/"`.
- MUST sit alphabetically between existing `test` and `test:node` entries (or anywhere consistent — Biome formatting will normalize).
- MUST NOT alter the default `test` script. The default `bun run test` continues to glob `tests/` — the `tests/agent-eval/run.test.ts` skipIf guard ensures the live fixtures are skipped when `CREW_AGENT_EVAL` is unset; the always-on helper tests inside the same file still run as part of default `test` (this is the coverage handshake).
- Windows note: the `CREW_AGENT_EVAL=1` env prefix works under Bun on Windows (Bun parses npm-script env-prefixes itself, not via the shell). No `cross-env` needed; do NOT add `cross-env` as a dep.

## Out of scope

- **Live `runClaude` subprocess** — SLICE-B. This slice stubs the signature only.
- **Fixtures 01 / 02 / 03** (`builder-handoff` / `reviewer-pass-fail` / `lead-dispatches-builder`) — SLICE-B and SLICE-C.
- **GitHub Actions workflow** (`.github/workflows/agent-eval.yml`) — SLICE-D.
- **OAuth setup, `claude login`, secrets management** — SLICE-B / SLICE-D.
- **Replacing or modifying `scripts/e2e-smoke.ts`** — explicit FEAT-162 out-of-scope (line 72 of FEAT body): structural smoke tests stay.
- **Adding external eval framework deps** (promptfoo, Inspect AI, DeepEval, Anthropic Evals SDK) — explicit FEAT-162 out-of-scope (line 69).
- **Recording new captured traces from a live session** — SLICE-A uses one hand-authored synthetic trace. Capture tooling, if needed, is SLICE-B territory.

## Acceptance criteria

- [ ] **AC-1: All deliverable files exist with line caps respected.** Given the repo at HEAD, When inspected, Then `tests/agent-eval/lib/types.ts` (≤60 lines), `tests/agent-eval/lib/run-claude.ts` (≤30 lines), `tests/agent-eval/lib/assert-trace.ts` (≤120 lines), `tests/agent-eval/fixtures/00-dry-run-replay.fixture.ts` (≤60 lines), `tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json` (any size, must `JSON.parse`), `tests/agent-eval/run.test.ts` (≤130 lines), `tests/agent-eval/README.md` (≤100 lines) all exist. `package.json` contains a `"test:agents"` script. Pass-fail: each `[ -f <path> ] && [ $(wc -l < <path>) -le <cap> ]` returns 0; `jq -r '.scripts["test:agents"]' package.json` returns the documented command.

- [ ] **AC-2: Captured trace JSON parses and matches the `CapturedTrace` shape.** Given `tests/agent-eval/fixtures/captured-traces/00-builder-handoff.trace.json`, When loaded via `JSON.parse`, Then it has `exitCode: 0`, `cwd` (string), `finalText` (string), and `events` array of length ≥ 5 with at least one `tool_use` matching `name === "Agent"` and `input.subagent_type === "crew:builder"`, one matching `name === "Bash"`, and one matching `name === "Write"` with `input.file_path` ending in `-builder.md`. Pass-fail: assertion inside Deliverable 8 case 1 + case 4 + case 5 green.

- [ ] **AC-3: Pure assert-trace helpers behave per contract.** Given the test file's always-on block, When `bun test tests/agent-eval/run.test.ts --timeout 30000` runs (with `CREW_AGENT_EVAL` UNSET), Then all 6 always-on helper tests + the 1 runClaude-stub test pass (7 total). The 1 fixture-loop test under `describe.skipIf` is reported as skipped (not failed). Pass-fail: command exits 0; stdout contains `7 pass` and `1 skip` (or Bun's equivalent reporter strings — substring match on `"pass"` count ≥ 7 and `"skip"` ≥ 1).

- [ ] **AC-4: `runClaude` stub is callable but throws the documented sentinel.** Given `import { runClaude } from "./tests/agent-eval/lib/run-claude.ts"`, When invoked with `{ prompt: "x", cwd: "/tmp" }`, Then it rejects with an `Error` whose `message` contains both substrings `"not implemented"` AND `"SLICE-B"`. Pass-fail: Deliverable 8 case 7 green.

- [ ] **AC-5: Default test run does not invoke any subprocess.** Given `CREW_AGENT_EVAL` unset, When `bun run test` runs, Then no `claude` binary is spawned (the `runClaude` stub is imported for type-check only, never called). Pass-fail: Deliverable 8 cases 1–6 do not import `runClaude` at the call-site; case 7 imports it but only to assert the throw. A grep of `tests/agent-eval/run.test.ts` for `runClaude(` MUST find exactly one call site (the throw-assertion in case 7).

- [ ] **AC-6: Opt-in path works.** Given `CREW_AGENT_EVAL=1` exported, When `bun run test:agents` runs, Then exit code is 0 and the dry-run fixture (`00-dry-run-replay`) reports as passed (the fixture's `expect` callback runs the four documented assertions against the captured trace). Pass-fail: `CREW_AGENT_EVAL=1 bun test tests/agent-eval/` exits 0 with at least 8 passing tests (7 always-on + 1 fixture).

- [ ] **AC-7: Fuzzy-assertion discipline upheld.** Given the test file and fixture, When reviewed, Then no assertion compares an entire free-text field via `===` against a literal multi-word string. All text-matching uses RegExp or `.includes()`. Pass-fail: reviewer grep for `=== "` against `finalText` / `text` / `prompt` / `content` fields in `tests/agent-eval/` returns zero hits.

- [ ] **AC-8: Full local gate green — no regressions in unrelated suites.** Given the post-slice tree, When `bun run lint && bun run format:check && bun run typecheck && bun run test && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && node ./scripts/e2e-smoke.ts` runs, Then each step exits 0. Pass-fail: chained command returns 0. ALSO confirm no `process.exit()` in any new TS file (helpers/types/fixtures/test must use `throw` or `expect` failures, never `process.exit`).

## Done When

- all 8 acceptance criteria PASS with evidence per loop EVIDENCE_RULES
- build / test commands per `.claude/loop.json` pass (`bun test --parallel`, `bun run lint`, `bun run format:check`, `bun run typecheck`, all `node ./scripts/validate-*.ts`)
- feature FEAT-162 stays in `in-progress/` (SLICE-A is one of four slices; SLICE-B/C/D remain — do NOT move FEAT-162 to `done/`)
- Crew `final-synthesis` artifact written
- `requires_validation: true` retained — AC-3 / AC-4 / AC-6 are behavior verification (helper semantics + opt-in skipIf gating) and MUST be executed independently by the verifier

## Verification commands

Runnable without manual args, in order:

```
bun run lint
bun run format:check
bun run typecheck
bun test --parallel --timeout 30000 tests/agent-eval/run.test.ts
bun run test
CREW_AGENT_EVAL=1 bun test tests/agent-eval/
node ./scripts/validate-manifests.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-agents.ts
node ./scripts/validate-slices.ts
node ./scripts/e2e-smoke.ts
```

The 4th command exercises only the new test file (always-on block + skipped fixture loop). The 5th is the full default suite — should be 0 added failures, only added passes (7 new always-on cases). The 6th is the opt-in path proving the dry-run fixture wires through. The skip is expected on commands 4 and 5; the dry-run fixture should pass on command 6.

## Reviewer ladder

- **Reviewer A (`crew:inspector`):** structural compliance + scope hygiene. Are the five assert-trace helpers pure (no I/O, no mutation of input)? Are the line caps respected on all 7 files? Is `runClaude` reduced to a throw stub (no try/catch logic, no half-implementation that might look complete)? Does `run.test.ts` use `bun:test` (mirrors `tests/test-quality-integration.test.ts`)? Is `describe.skipIf(!CREW_AGENT_EVAL)` wrapping ONLY the live-fixture loop, not the always-on helper tests? Is the JSON trace fixture's `events` array shaped to match the documented `TraceEvent` union exactly (no extra fields the helpers don't expect)? Are README claims about SLICE-B/C/D scope grounded in the FEAT body (no overpromising)? Skills to consult: `skills/workflow/reviewing-code/`, repo standard `docs/standards/code-conventions.md` (ESM Node 22 + Bun).

- **Reviewer B (`crew:verifier`):** behavior verification. Runs the Verification commands chain. Confirms (a) command 4 exits 0 with 7 passes + 1 skip, (b) command 6 exits 0 with the fixture passing (8 passes), (c) command 5 (default `bun run test`) does NOT regress — pre-slice pass count + 7 = post-slice pass count, (d) `runClaude` throws on import-and-invoke per AC-4, (e) the JSON trace fixture round-trips through `JSON.parse` cleanly and shape-matches `CapturedTrace`. Skills to consult: `skills/workflow/validating-behavior/`.

---

## Spec-writer notes (informational — not for builder)

**developer_type verdict: `agent`** — pure type contract + pure-function helpers + one JSON fixture + one Bun test file. No agent-prompt edits, no network, no subprocess, no auth, no CI workflow. Mirrors FEAT-162's own `autonomous_safe: true` framing for SLICE-A exactly. Failure modes (helper semantics, skipIf gating, line caps) are all caught by the always-on test block + structural validators. Matches the SLICE-77 pattern (data-shape transform, deterministic fixtures, no I/O in pure functions).

**Why ship the captured-trace JSON as a hand-authored fixture (vs. recording a live one):** SLICE-A explicitly forbids `claude -p` invocation. A hand-authored synthetic trace lets the assertion helpers prove their contract against a known shape, locks the `CapturedTrace` interface SLICE-B will target, and gives the SLICE-B builder a reference to diff their live capture against. Recording infra belongs with the live runner in SLICE-B.

**Open notes for SLICE-B / SLICE-C / SLICE-D authors:**
1. `lib/run-claude.ts` body needs to: (a) `spawn("claude", ["-p", opts.prompt, "--output-format", "stream-json", ...(opts.agent ? ["--agent", opts.agent] : [])], { cwd, timeout: opts.timeoutMs ?? 180000 })`, (b) parse stdout line-by-line as JSON, (c) accumulate events + final text, (d) return `{events, finalText, exitCode, cwd}` matching the locked `CapturedTrace` shape. The SLICE-A trace JSON is the integration target.
2. The `--agent crew:backend-dev` CLI flag is the FEAT-162 §Notes open Q. SLICE-B should pre-research whether the current CC CLI accepts it. If yes, fixtures can target individual agents. If no, fixtures prompt main-thread Claude to invoke the Agent tool — coarser but `dispatchedAgent` already handles both shapes.
3. SLICE-D MUST decide between self-hosted runner (persistent OAuth) vs `anthropic-ai/claude-code-action` (if it gains non-issue OAuth support). FEAT-162 §Per-slice decomposition flags this as a SLICE-D pre-research step.
4. The `Fixture.timeoutMs` default of 180000 matches FEAT-162 §Design constraints. SLICE-B will need a hard-kill code path if `claude -p` exceeds it; current stub throws long before that's relevant.
