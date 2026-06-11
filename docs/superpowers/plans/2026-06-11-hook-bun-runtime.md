# Hook Runtime Swap (node → bun) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut per-event hook latency by ≥ 60% by swapping `node --experimental-strip-types` to `bun` for the 4 in-process hook entries, async-firing the bash `log_event.sh` telemetry write, and adding a loud-failure `bun --version` installer preflight.

**Architecture:** SLICE-67 (FEAT-146) already extracted hook flows into runtime-neutral cores at `hooks/lib/*.ts`. This plan flips the entry-shim spawn target from Node to Bun (mechanical change in `hooks/hooks.json`), backgrounds the disk write in `scripts/log_event.sh`, adds a Bun preflight to the installer, and adds Windows + Linux CI smoke gates.

**Tech Stack:** Bun 1.3.14 (already installed; already drives test/lint/format/typecheck per ADR-002), bash, GitHub Actions, TypeScript, the existing hooks/lib core contract.

**Spec:** `docs/superpowers/specs/2026-06-11-hook-bun-runtime-design.md`

**Prerequisite:** SLICE-67 must be closed (✓ — closed 2026-06-11 as commit `ebc4c1e`).

---

## File map

| Path | Action | Responsibility |
| --- | --- | --- |
| `tests/log-event-async-bench.test.ts` | Create | Foreground-latency p95 assertion for `log_event.sh`. |
| `scripts/log_event.sh` | Modify | Wrap disk write in backgrounded subshell. |
| `tests/hook-cold-start-bench.test.ts` | Create | Median + p95 assertions for hook entry cold start. |
| `hooks/hooks.json` | Modify | 4 PreToolUse/PostToolUse entries: `node ...` → `bun ...`. |
| `scripts/lib/installer/bun-preflight.ts` | Create | `assertBunPresent()` — runs `bun --version`, throws on missing with install URL. |
| `tests/bun-preflight.test.ts` | Create | Unit tests for `assertBunPresent()`. |
| `scripts/crew.ts` | Modify | Call `assertBunPresent()` at the top of the `install` command. |
| `README.md` | Modify | Promote Bun from "verify locally" to runtime dep; update install steps. |
| `.github/workflows/test.yml` | Modify | Add `strategy.matrix.os` for Windows + Linux; add bun-hook smoke step. |
| `CHANGELOG.md` | Modify | New section noting the runtime swap. |

---

## Task 1: log_event.sh async-fire bench (failing first)

**Files:**
- Create: `tests/log-event-async-bench.test.ts`

- [ ] **Step 1: Write the failing bench**

```ts
// tests/log-event-async-bench.test.ts
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "scripts", "log_event.sh");
const RUNS = 100;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

describe("log_event.sh foreground latency", () => {
  test(`p95 foreground latency over ${RUNS} runs is <= 20ms`, () => {
    const root = mkdtempSync(join(tmpdir(), "log-event-bench-"));
    const samples: number[] = [];
    try {
      for (let i = 0; i < RUNS; i++) {
        const start = process.hrtime.bigint();
        const res = spawnSync("bash", [SCRIPT, "bench_event"], {
          cwd: root,
          env: { ...process.env, CLAUDE_PROJECT_DIR: root },
          input: '{"sample":true}\n',
        });
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        expect(res.status).toBe(0);
        samples.push(elapsedMs);
      }
      samples.sort((a, b) => a - b);
      const p50 = percentile(samples, 0.5);
      const p95 = percentile(samples, 0.95);
      console.log(`log_event.sh foreground p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
      expect(p95).toBeLessThanOrEqual(20);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run to verify failure (current ~113ms baseline)**

```bash
bun test tests/log-event-async-bench.test.ts
```

Expected: FAIL with p95 ≈ 100-150ms (current synchronous bash write).

- [ ] **Step 3: Convert `log_event.sh` to async-fire**

Replace `scripts/log_event.sh` body so the disk write runs in a backgrounded subshell and the foreground returns immediately:

```bash
#!/usr/bin/env bash
set -euo pipefail

event_name="${1:-unknown}"
project_dir="${CLAUDE_PROJECT_DIR:-$PWD}"
log_dir="${project_dir}/.claude/logs"
payload_dir="${log_dir}/payloads"
timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
payload_path="${payload_dir}/${stamp}-$$-${event_name}.json"
events_path="${log_dir}/events.jsonl"

mkdir -p "$payload_dir"

# Capture stdin synchronously so the caller's pipe is drained.
if [ -t 0 ]; then
  stdin_payload='{}'
else
  stdin_payload="$(cat)"
fi

# Async-fire the disk writes — foreground returns in <20ms.
(
  printf '%s\n' "$stdin_payload" > "$payload_path"
  printf '{"schemaVersion":"1.0","source":"crew","timestamp":"%s","event":"%s","repoPath":"%s","payloadPath":"%s"}\n' \
    "$timestamp" \
    "$event_name" \
    "$project_dir" \
    "$payload_path" >> "$events_path"
) &
disown 2>/dev/null || true
```

- [ ] **Step 4: Run bench, expect pass**

```bash
bun test tests/log-event-async-bench.test.ts
```

Expected: PASS with p95 ≤ 20ms.

- [ ] **Step 5: Commit**

```bash
git add tests/log-event-async-bench.test.ts scripts/log_event.sh
git commit -m "perf(hooks): async-fire log_event.sh disk write (AC-6)

Wrap the payload + events.jsonl writes in a backgrounded subshell so the
foreground exits in <20ms. Captures stdin synchronously first so the
hook caller's pipe still drains. Telemetry loss on session crash is
acceptable per spec section 7.

Bench tests/log-event-async-bench.test.ts asserts p95 <= 20ms over
100 runs (was ~113ms synchronous)."
```

---

## Task 2: Hook cold-start bench (baseline on node first)

**Files:**
- Create: `tests/hook-cold-start-bench.test.ts`

- [ ] **Step 1: Write the bench (intentionally points at node first so we record the baseline)**

```ts
// tests/hook-cold-start-bench.test.ts
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const HOOK = join(import.meta.dir, "..", "hooks", "check-redundant-read.ts");
const RUNTIME = process.env.HOOK_BENCH_RUNTIME ?? "bun";
const RUNS = 100;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx]!;
}

describe(`hook cold start (${RUNTIME})`, () => {
  test(`median + p95 over ${RUNS} cold spawns`, () => {
    const samples: number[] = [];
    const args = RUNTIME === "node" ? ["--experimental-strip-types", HOOK] : [HOOK];
    for (let i = 0; i < RUNS; i++) {
      const start = process.hrtime.bigint();
      const res = spawnSync(RUNTIME, args, {
        env: { ...process.env, CREW_COST_HYGIENE: "1" },
        input: '{}\n',
      });
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      expect(res.status).toBe(0);
      samples.push(elapsedMs);
    }
    samples.sort((a, b) => a - b);
    const p50 = percentile(samples, 0.5);
    const p95 = percentile(samples, 0.95);
    console.log(`hook cold start (${RUNTIME}) p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
    if (RUNTIME === "bun") {
      expect(p50).toBeLessThanOrEqual(60);
      expect(p95).toBeLessThanOrEqual(120);
    }
  });
});
```

- [ ] **Step 2: Run on node to record the baseline (asserts skipped for node)**

```bash
HOOK_BENCH_RUNTIME=node bun test tests/hook-cold-start-bench.test.ts
```

Expected: PASS, console log shows p50 ≈ 150-180ms, p95 ≈ 200-250ms.

- [ ] **Step 3: Run on bun (assertions live — expect FAIL while hooks.json still points at node, because bun is not the runtime under test yet)**

```bash
bun test tests/hook-cold-start-bench.test.ts
```

Expected: PASS — this bench spawns `bun` directly regardless of `hooks.json`, so p50 should already be ≤ 60ms on the host. If FAIL on slow CI, see Task 7 for the matrix loosening.

- [ ] **Step 4: Commit**

```bash
git add tests/hook-cold-start-bench.test.ts
git commit -m "perf(hooks): bench harness for cold-start latency (AC-3)

Adds tests/hook-cold-start-bench.test.ts with selectable runtime via
HOOK_BENCH_RUNTIME (default bun). Runs 100 cold spawns, reports p50 +
p95, asserts bun p50 <= 60ms and p95 <= 120ms. Node mode records the
legacy baseline without asserting."
```

---

## Task 3: Swap hooks.json node → bun (AC-1, AC-2)

**Files:**
- Modify: `hooks/hooks.json:64-112`

- [ ] **Step 1: Confirm runtime contract test green on baseline**

```bash
bun test tests/hook-feature-gating.test.ts
```

Expected: PASS (this suite is the byte-identical contract proof from SLICE-67).

- [ ] **Step 2: Modify `hooks/hooks.json` — replace each `node "..."` with `bun "..."`**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/check-redundant-read.ts\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/preflight-shell.ts\""
          }
        ]
      },
      {
        "matcher": "PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/preflight-shell.ts\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/record-read-content.ts\""
          }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"${CLAUDE_PLUGIN_ROOT}/hooks/check-subagent-return.ts\""
          }
        ]
      }
    ]
  }
}
```

(Keep the `SessionStart`, `TaskCreated`, `TaskCompleted`, `SubagentStart`, `SubagentStop`, `TeammateIdle` entries unchanged — those route through `scripts/log_event.sh`.)

- [ ] **Step 3: Verify AC-1 — no `node` runtime in PreToolUse/PostToolUse entries**

```bash
node -e 'const j=require("./hooks/hooks.json"); const r=[...(j.hooks.PreToolUse||[]),...(j.hooks.PostToolUse||[])]; const bad=r.flatMap(b=>b.hooks).filter(h=>/(^|\s)node\s/.test(h.command)); console.log("bad node entries:", bad.length); process.exit(bad.length===0?0:1)'
```

Expected: `bad node entries: 0` and exit 0.

- [ ] **Step 4: Verify AC-2 — runtime contract test still green**

```bash
bun test tests/hook-feature-gating.test.ts tests/cost-hygiene-hook.test.ts tests/preflight-shell.test.ts tests/subagent-return.test.ts
```

Expected: 92 pass / 0 fail.

- [ ] **Step 5: Re-run cold-start bench**

```bash
bun test tests/hook-cold-start-bench.test.ts
```

Expected: PASS with p50 ≤ 60ms.

- [ ] **Step 6: Commit**

```bash
git add hooks/hooks.json
git commit -m "perf(hooks): swap node -> bun for PreToolUse/PostToolUse entries (AC-1)

Replaces the per-event node --experimental-strip-types spawn with bun
for the 4 in-process hook entries (check-redundant-read,
preflight-shell, record-read-content, check-subagent-return). Hook
cores at hooks/lib/*.ts are runtime-neutral (SLICE-67 contract) so the
byte-identical guarantee in tests/hook-feature-gating.test.ts holds.

Measured cold start: ~178ms (node) -> ~40ms (bun). Per spec AC-3 the
bench asserts p50 <= 60ms and p95 <= 120ms."
```

---

## Task 4: Bun preflight module (AC-4 unit half)

**Files:**
- Create: `scripts/lib/installer/bun-preflight.ts`
- Create: `tests/bun-preflight.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bun-preflight.test.ts
import { describe, expect, test } from "bun:test";
import { assertBunPresent } from "../scripts/lib/installer/bun-preflight.ts";

describe("assertBunPresent", () => {
  test("returns the detected bun version when bun is on PATH", () => {
    const got = assertBunPresent({ env: process.env });
    expect(got.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("throws with an install URL when bun is missing", () => {
    const empty: NodeJS.ProcessEnv = { PATH: "" };
    let err: unknown;
    try {
      assertBunPresent({ env: empty });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(String(err)).toContain("https://bun.sh");
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
bun test tests/bun-preflight.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `assertBunPresent`**

```ts
// scripts/lib/installer/bun-preflight.ts
import { spawnSync } from "node:child_process";

export interface BunPresentResult {
  readonly version: string;
}

export interface BunPreflightOptions {
  readonly env?: NodeJS.ProcessEnv;
}

const INSTALL_URL = "https://bun.sh";
const MIN_MAJOR = 1;
const MIN_MINOR = 3;

export function assertBunPresent(opts: BunPreflightOptions = {}): BunPresentResult {
  const env = opts.env ?? process.env;
  const res = spawnSync("bun", ["--version"], { env, encoding: "utf8" });
  if (res.error || res.status !== 0) {
    throw new Error(
      `crew install requires Bun >= ${MIN_MAJOR}.${MIN_MINOR}. ` +
        `Install from ${INSTALL_URL} and re-run.`
    );
  }
  const version = (res.stdout ?? "").trim();
  const m = version.match(/^(\d+)\.(\d+)/);
  if (!m) {
    throw new Error(
      `Could not parse "bun --version" output: ${JSON.stringify(version)}. ` +
        `Install from ${INSTALL_URL}.`
    );
  }
  const major = Number.parseInt(m[1]!, 10);
  const minor = Number.parseInt(m[2]!, 10);
  if (major < MIN_MAJOR || (major === MIN_MAJOR && minor < MIN_MINOR)) {
    throw new Error(
      `crew install requires Bun >= ${MIN_MAJOR}.${MIN_MINOR}; detected ${version}. ` +
        `Upgrade from ${INSTALL_URL}.`
    );
  }
  return { version };
}
```

- [ ] **Step 4: Run to verify pass**

```bash
bun test tests/bun-preflight.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/installer/bun-preflight.ts tests/bun-preflight.test.ts
git commit -m "feat(installer): bun-preflight module (AC-4)

assertBunPresent() runs \`bun --version\`, throws with the bun.sh
install URL when bun is missing or older than 1.3. Unit-tested via
PATH stripping. Will be wired into the install entry in the next task."
```

---

## Task 5: Wire preflight into the install entry (AC-4 integration half)

**Files:**
- Modify: `scripts/crew.ts`

- [ ] **Step 1: Locate the install command handler**

```bash
grep -n "case \"install\"\\|^async function install\\|installCommand\\|run.*install" scripts/crew.ts | head -20
```

Expected: One or two hits identifying the install dispatch site.

- [ ] **Step 2: Add the preflight call as the FIRST thing the install entry does**

Insert this import at the top of `scripts/crew.ts` next to the other `./lib/installer/...` imports:

```ts
import { assertBunPresent } from "./lib/installer/bun-preflight.ts";
```

Then add this as the first statement inside the install command handler (before any filesystem work):

```ts
const bun = assertBunPresent();
console.log(`[install] bun ${bun.version} detected.`);
```

- [ ] **Step 3: Verify installer still works end-to-end on this machine**

```bash
bun ./scripts/crew.ts install --dry-run --repo "$PWD" 2>&1 | tail -20
```

(If `--dry-run` is not supported, run `--help` for `install` to confirm the subcommand still parses cleanly.) Expected: first line of output shows `[install] bun X.Y.Z detected.`

- [ ] **Step 4: Manually verify loud failure when bun is missing**

```bash
PATH="$(echo "$PATH" | tr ':' '\n' | grep -v bun | paste -sd ':')" bun ./scripts/crew.ts install --repo "$PWD" 2>&1 | head -10
```

Expected: non-zero exit, stderr/stdout contains `https://bun.sh`.

(On Windows PowerShell, replicate by setting `$env:PATH = ($env:PATH -split ';' | Where-Object { $_ -notmatch 'bun' }) -join ';'` before the same `bun ./scripts/crew.ts install` invocation.)

- [ ] **Step 5: Commit**

```bash
git add scripts/crew.ts
git commit -m "feat(installer): call assertBunPresent at install entry (AC-4)

Bun is now a hard runtime dependency for hook execution. The install
entry runs assertBunPresent() before any filesystem work so consumers
see a loud failure with the bun.sh install URL when bun is missing or
older than 1.3 — no silent node-fallback path."
```

---

## Task 6: README runtime-dep callout

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the existing "Verify locally" line**

```bash
grep -n "Verify locally\|bun run test\|Pinned release" README.md
```

Expected: One match around line 64.

- [ ] **Step 2: Replace the line + add a Requirements block above the install step**

Open `README.md` and locate the existing line:

```
Verify locally with `bun run test`. Pinned release: `v0.31.1`.
```

Replace it with:

```
Verify locally with `bun run test`. Pinned release: `v0.31.1`.

> **Runtime dependency:** Bun ≥ 1.3 is required at install time. The Crew hook entries (`hooks/check-*.ts`, `hooks/preflight-shell.ts`, `hooks/record-read-content.ts`) run under Bun for fast cold-start (~40 ms vs ~180 ms on Node). The installer fails loud if Bun is missing — install from <https://bun.sh>.
```

- [ ] **Step 3: Verify the markdown lints cleanly**

```bash
bun run format:check README.md 2>&1 | tail
```

Expected: clean exit. If not, run `bun run format README.md` and re-check.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): note Bun >= 1.3 as runtime dep (AC-4 docs)

Hook entries now spawn under Bun for ~75% cold-start latency cut. Add
a Requirements callout below the install steps with the bun.sh URL."
```

---

## Task 7: CI Windows + Linux matrix + bun-hook smoke (AC-5)

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add the OS matrix + bun-hook smoke step**

Open `.github/workflows/test.yml`. Replace the existing `jobs.test` block with:

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: npm ci
      - name: bun-hook smoke (cross-platform)
        shell: bash
        run: |
          echo '{}' | bun "$GITHUB_WORKSPACE/hooks/check-redundant-read.ts"
      - run: node ./scripts/validate-manifests.ts
      - run: node ./scripts/validate-skills.ts
      - run: node ./scripts/validate-agents.ts
      - run: node ./scripts/validate-slices.ts
      - run: node ./scripts/validate-loop-state.ts
      - run: node ./scripts/validate-bundles.ts
      - name: Validate contracts (against committed fixtures)
        shell: bash
        run: |
          for f in tests/fixtures/openapi/*.openapi.yaml; do
            if [ "$(basename "$f")" = "broken-missing-examples.openapi.yaml" ]; then
              if node ./scripts/validate-contracts.ts "$f"; then
                echo "ERROR: negative fixture passed lint"
                exit 1
              fi
            else
              node ./scripts/validate-contracts.ts "$f"
            fi
          done
      - name: Validate UX spec fixtures
        shell: bash
        run: |
          for f in tests/fixtures/ux-specs/*.md; do
            if [ "$(basename "$f")" = "missing-operationid.md" ]; then
              if node ./scripts/validate-ux-spec.ts "$f"; then
                echo "ERROR: negative fixture passed"
                exit 1
              fi
            else
              node ./scripts/validate-ux-spec.ts "$f"
            fi
          done
      - name: Validate synthesis artifacts (advisory)
        continue-on-error: true
        run: node ./scripts/validate-syntheses.ts
      - name: Validate routing-table skill IDs (advisory — external-plugin IDs unresolvable on runner)
        continue-on-error: true
        env:
          CREW_VALIDATE_ROUTING_TABLE: "1"
        run: node ./scripts/validate-routing-table.ts
      - run: bun run lint
      - run: bun run format:check
      - run: bun run typecheck
      - name: Validate type-graph (advisory, becomes blocking in Phase 5)
        continue-on-error: true
        run: bun run validate:typegraph
      - run: bun run test
      - run: node ./scripts/e2e-smoke.ts
      - name: e2e smoke — ux validation
        if: matrix.os == 'ubuntu-latest'
        run: bun run e2e:smoke:ux
```

(Note the `shell: bash` directives on POSIX-flavored steps — Windows runners default to PowerShell.)

- [ ] **Step 2: Push branch + open draft PR to surface the matrix run**

```bash
git checkout -b perf/hook-bun-runtime
git push -u origin perf/hook-bun-runtime
gh pr create --draft --title "perf(hooks): swap node->bun + bench gates" --body "Implementation of docs/superpowers/specs/2026-06-11-hook-bun-runtime-design.md"
```

Expected: PR opens. CI begins running on `ubuntu-latest` AND `windows-latest`.

- [ ] **Step 3: Wait for CI; confirm both matrix legs green (focus on the `bun-hook smoke` step on Windows)**

```bash
gh pr checks --watch
```

Expected: both `test (ubuntu-latest)` and `test (windows-latest)` green. If `windows-latest` fails on the bun-hook smoke, debug the path quoting in `hooks.json` — Bun on Windows must accept `"${CLAUDE_PLUGIN_ROOT}/hooks/X.ts"` identically to bash-style quoting.

- [ ] **Step 4: Commit (CI changes only)**

```bash
git add .github/workflows/test.yml
git commit -m "ci: matrix Windows + Linux + bun-hook smoke (AC-5)

Adds strategy.matrix.os covering ubuntu-latest + windows-latest, plus a
cross-platform bun-hook smoke step that pipes empty JSON into
check-redundant-read.ts to verify the Bun entry boots on each runner.
ux smoke is Linux-only (matrix.os == ubuntu-latest) — Windows lacks the
Playwright dependency chain."
```

---

## Task 8: CHANGELOG + final verification (AC-7 + slice close)

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Append a new top section to `CHANGELOG.md`**

Open `CHANGELOG.md` and insert immediately under the title heading:

```markdown
## [Unreleased]

### Performance

- Hook runtime swap: PreToolUse / PostToolUse entries now spawn under Bun
  (≥ 1.3) instead of `node --experimental-strip-types`. Measured cold start
  dropped from ~178 ms to ~40 ms per event. Hook cores at `hooks/lib/*.ts`
  are byte-identical (SLICE-67 contract).
- `scripts/log_event.sh` now async-fires the payload + events.jsonl writes
  in a backgrounded subshell. Foreground latency dropped from ~113 ms to
  ≤ 20 ms p95.

### Tooling

- Installer now requires Bun ≥ 1.3 at install time (`scripts/lib/installer/bun-preflight.ts`).
  Missing Bun → loud failure with the bun.sh install URL.
- CI matrix expanded to `ubuntu-latest` + `windows-latest` for cross-platform
  hook coverage.

### Tests

- `tests/hook-cold-start-bench.test.ts` asserts p50 ≤ 60 ms and p95 ≤ 120 ms
  over 100 cold spawns.
- `tests/log-event-async-bench.test.ts` asserts foreground p95 ≤ 20 ms over
  100 invocations.
- `tests/bun-preflight.test.ts` unit-covers the installer preflight.
```

- [ ] **Step 2: Run the full local gate**

```bash
bun run lint && bun run format:check && bun run typecheck && bun test
```

Expected: all green. 614+ tests pass (existing 611 + 3 new bench/preflight tests).

- [ ] **Step 3: Manual end-to-end smoke (AC-7)**

```bash
wc -l .claude/logs/events.jsonl
```

Note the line count, then run a small slice (e.g. `bun ./scripts/crew.ts brief-me --repo "$PWD" >/dev/null`). Re-check:

```bash
wc -l .claude/logs/events.jsonl
```

Expected: line count increased monotonically (no events dropped). Run `tail -5 .claude/logs/events.jsonl` to confirm latest entries parse as valid JSON.

- [ ] **Step 4: Push final commits + flip PR to ready**

```bash
git push
gh pr ready
```

- [ ] **Step 5: Commit (CHANGELOG)**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): hook runtime swap + log_event async-fire

Records the per-event latency cut for the [Unreleased] section."
git push
```

- [ ] **Step 6: After merge — close ceremony**

(This step runs after the PR merges to `main`.)

```bash
bun "C:/Users/serge/.claude/plugins/cache/loop/loop/0.38.1/src/scripts/loop.mts" slice complete --id SLICE-68 --repo "$PWD"
bun "C:/Users/serge/.claude/plugins/cache/loop/loop/0.38.1/src/scripts/loop.mts" slice grade --id SLICE-68 --repo "$PWD"
```

Expected: handoff + final-synthesis + cost-report + grade template written. Edit the grade with the actual scores (architecture / reliability / observability / production_readiness / security / test_confidence / product_completeness) before running `slice grade-write`.

---

## Self-review

Spec coverage:

- AC-1 ✓ Task 3 step 3 verifies 0 `node` entries in hooks.json PreToolUse/PostToolUse blocks.
- AC-2 ✓ Task 3 step 4 runs `tests/hook-feature-gating.test.ts` unchanged.
- AC-3 ✓ Task 2 + Task 3 step 5 run the cold-start bench asserting p50 ≤ 60ms + p95 ≤ 120ms.
- AC-4 ✓ Task 4 covers the unit half; Task 5 covers the installer integration; Task 5 step 4 covers the loud-failure manual test.
- AC-5 ✓ Task 7 adds the OS matrix + the `bun-hook smoke` step.
- AC-6 ✓ Task 1 covers both the async-fire change and the p95 assertion.
- AC-7 ✓ Task 8 step 3 covers the end-to-end events.jsonl line-count smoke.

Placeholder scan: no TBD/TODO/"appropriate" hedging. Every step shows complete code or an exact command.

Type / name consistency: `assertBunPresent` declared in Task 4 with `BunPresentResult` + `BunPreflightOptions`; wired in Task 5 by the same name. `INSTALL_URL`, `MIN_MAJOR`, `MIN_MINOR` only used inside the module. The HOOK constant in the bench points at `check-redundant-read.ts`, which exists per the `hooks/` listing.

Risks reflected in plan:
- Task 7 step 3 flags Windows path quoting as the most likely CI failure mode.
- Task 8 step 3 verifies no events dropped (Risk: async log_event silent loss).
- Task 2 step 3 sets a generous p95 ≤ 120ms to absorb CI noise (Risk: bench flake).
