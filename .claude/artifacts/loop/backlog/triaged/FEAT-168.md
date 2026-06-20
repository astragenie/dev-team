---
id: FEAT-168
status: triaged
priority: P2
category: quality
target_release: null
created: 2026-06-20
updated: 2026-06-20
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
tags: [test, observability, regression-gate, plugin-cache]
pm_customer_impact: 0.60
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.60
pm_technical_risk: 0.20
pm_dependency_depth: 0.10
composite_score: 0.610
triage_notes: "Derived 2026-06-20 from v0.37.2 hotfix (commit 938df50). Caps the bug class that produced the v0.37.1 customer-repo ENOENT on every hook fire: a top-level static `import \"@opentelemetry/*\"` in any file reachable from a hook entry crashes Bun resolution in plugin-cache installs because the cache lacks node_modules. SLICE-81 unit tests + v0.37.1 flush integration test both missed it — both run with the repo's own node_modules populated. Pure additive test (no prod code, no agent prompts, no command authorship) → autonomous_safe=true; risk band 0.2. Effort 0.25: 1 test file, spawn subprocess in temp cwd with PATH stripped of node_modules. Customer impact 0.6: prevents recurrence of a high-visibility (per-tool-call stderr noise) bug, not blocking a new use case."
---
# FEAT-168: Plugin-cache install smoke for hook entries

## Problem

`v0.37.1` shipped with a top-level `import { trace, SpanKind } from "@opentelemetry/api"` in `scripts/lib/telemetry/otel-bridge.ts`, statically reachable from all three `hooks/otel-*.ts` entries. Plugin installs land at `~/.claude/plugins/cache/astra/crew/<version>/` with the repo's `package.json` but no `node_modules` (the plugin loader does not run `npm install`). Bun resolved the top-level import, hit ENOENT, and wrote one stderr line per hook fire — every tool call. Hooks still exited 0 via `main().catch`, so the gate was non-blocking but loud.

Two test layers existed and both passed:
- `tests/telemetry-otel-bridge.test.ts` — unit, imports `@opentelemetry/*` from the plugin repo's populated `node_modules`.
- `tests/telemetry-hook-flush.test.ts` — integration (v0.37.1), spawns hook subprocess but with `process.cwd()` rooted in the plugin repo, so `node_modules` again resolves.

Neither layer simulates the plugin-cache shape: a checkout of plugin source with no installed deps. v0.37.2 fixed the immediate bug by lazy-importing everything, but nothing prevents a future contributor from re-introducing a top-level `import "@opentelemetry/*"` in any file reachable from a hook entry.

## Goal

Add a regression gate that fails CI if any hook entry resolves a `@opentelemetry/*` package at module load (disabled-telemetry path) when invoked from a working directory without those deps installed.

## Acceptance criteria

- AC-1: New test file `tests/telemetry-plugin-cache-smoke.test.ts` spawns each of `hooks/otel-post-tool-use.ts`, `hooks/otel-stop.ts`, `hooks/otel-subagent-stop.ts` as a child subprocess.
- AC-2: Spawn uses `cwd = <os.tmpdir()>/crew-cache-smoke-<random>` (created empty for the test, removed after) AND clears `NODE_PATH` AND sets `CLAUDE_PROJECT_DIR` to that empty dir. Stdin payload is a minimal valid hook fixture. `CREW_OTEL_ENABLED` is unset (default disabled path).
- AC-3: Each subprocess MUST exit 0.
- AC-4: Each subprocess MUST emit zero stderr containing the substrings `@opentelemetry`, `ENOENT`, or `MODULE_NOT_FOUND`. (One-shot `crew-otel: telemetry deps not installed` is acceptable only on enabled+missing-deps path; this test runs the disabled path so even that line MUST NOT appear.)
- AC-5: Test runs under both `node` and `bun` runtimes via parameterized describe blocks — both are valid hook invokers in consumer repos.
- AC-6: CI workflow (`.github/workflows/test.yml`) executes the new test as part of the existing `bun run test` step; no new top-level CI step needed unless the suite needs isolation.
- AC-7: Documentation note in `docs/observability/langfuse-bridge.md` (or adjacent) referencing the plugin-cache constraint so future telemetry-adjacent contributors see it before adding top-level `@opentelemetry/*` imports.

## Out of scope

- Bundling `node_modules` into the plugin package (rejected in v0.37.2 hotfix release notes — runtime-light invariant).
- esbuild single-file vendor of `otel-bridge.ts` (rejected same).
- Enabled-path smoke (covered by the existing live-flush integration test once a contributor wires deps in their consumer repo).

## Risks / mitigations

- **Risk**: temp-dir spawn flaky on Windows due to path quoting → mitigation: use `path.join(os.tmpdir(), ...)` + `fs.mkdtemp` per Node std.
- **Risk**: Bun's module resolver caches across spawns in the same parent process → mitigation: each spawn is a fresh child process, cache scoped per child.
- **Risk**: false-positive ENOENT from unrelated dep (e.g., `yaml`, `zod`) if those are also reachable from hook entry top-level → mitigation: the assertion greps for `@opentelemetry` specifically; other dep gaps would surface separately and are out of scope.

## Slice plan

- SLICE-A (only slice for this FEAT): add the smoke test + doc note. Single-file test + single Markdown edit. Estimated 0.25 effort.
