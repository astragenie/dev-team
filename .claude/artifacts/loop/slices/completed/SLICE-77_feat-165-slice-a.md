---
id: SLICE-77
title: "FEAT-165 SLICE-A: cost-report -> OTel span backfill (serialization only, no hooks, no exporter)"
status: completed
feature: FEAT-165
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-19
updated: 2026-06-19
developer_type: agent
estimated_complexity: medium
languages: [typescript]
autonomous_safe: true
touches_files: [scripts/lib/telemetry/span.ts, scripts/lib/telemetry/cost-report-loader.ts, scripts/lib/telemetry/cost-report-to-spans.ts, scripts/lib/telemetry/serialize-jsonl.ts, scripts/cost-report-to-spans.ts, tests/telemetry-span-schema.test.ts, tests/telemetry-cost-report-loader.test.ts, tests/telemetry-cost-report-to-spans.test.ts, tests/telemetry-cli.test.ts]
touches_files_confidence: declared
completed_at: 2026-06-19
---
# SLICE-77: cost-report -> OTel span backfill (FEAT-165 SLICE-A)

Implements **SLICE-A of FEAT-165**: cost-report -> OTel span backfill, no hooks touched. See [feature file](../../../backlog/pending/FEAT-165.md) for product context.

`autonomous_safe: true` per FEAT-165 SLICE-A — backfill is a pure data-shape transform over existing artifacts, no agent-prompt edits, no network calls, no hook surface. Schema validation and pure-function decomposition make verification by `crew:inspector` + `crew:verifier` straightforward.

## Objective

Convert completed slice cost reports under `.claude/artifacts/crew/cost/*.md` into OpenTelemetry-shaped span records serialized as JSONL at `.claude/artifacts/crew/spans/<run_id>.jsonl`. This unblocks FEAT-165 SLICE-B (live OTLP HTTP exporter) by locking in the span shape, and gives FEAT-167 SLICE-C a known target for prompt-version attribute injection.

This slice ships data shape + library + CLI entrypoint + tests **only** — no OTLP HTTP exporter, no `@opentelemetry/sdk-node` runtime, no hooks wired. The `@opentelemetry/api` package is consulted for type names (`Span`, `SpanContext`, `SpanKind`, `SpanStatusCode`) but the actual SDK is not imported — the serializer emits the plain OTLP/JSON span shape directly per the Langfuse `/api/public/otel/v1/traces` ingestion contract referenced in FEAT-165.

**DEC-024 observability ceiling:** This FEAT is *about* observability infrastructure, so the heavyweight shape is the deliverable (per FEAT-165 design constraints line "Plugin obs ceiling does not apply here"). The serializer's own optional CLI emit is one stderr line: `OTEL-BACKFILL wrote <N> spans across <M> runs` when `--emit-observability` is passed; default invocation stays silent.

## In scope

### Deliverable 1 — Span schema + types in `scripts/lib/telemetry/span.ts`

- Path: `scripts/lib/telemetry/span.ts`. New directory `scripts/lib/telemetry/`.
- Zod schemas + inferred TS types for the OTel span record. Boundary validation per `scripts/lib/schemas.ts` precedent.
- Required exports:
  1. `SpanKindSchema` = `z.enum(["INTERNAL", "CLIENT", "SERVER", "PRODUCER", "CONSUMER"])` — mirrors `@opentelemetry/api` `SpanKind` string form for OTLP/JSON.
  2. `SpanStatusSchema` = `z.object({ code: z.enum(["UNSET", "OK", "ERROR"]), message: z.string().optional() })`.
  3. `SpanAttrValueSchema` = `z.union([z.string(), z.number(), z.boolean()])` — OTLP forbids null; numeric attrs may be int or float.
  4. `SpanEventSchema` = `z.object({ name: z.string(), timeUnixNano: z.string(), attributes: z.record(SpanAttrValueSchema).optional() })`. Time stored as decimal nanoseconds since epoch in a **string** (OTLP convention, avoids JS number precision loss).
  5. `SpanRecordSchema` = `z.object({ traceId: z.string().regex(/^[0-9a-f]{32}$/), spanId: z.string().regex(/^[0-9a-f]{16}$/), parentSpanId: z.string().regex(/^[0-9a-f]{16}$/).optional(), name: z.string(), kind: SpanKindSchema, startTimeUnixNano: z.string(), endTimeUnixNano: z.string(), attributes: z.record(SpanAttrValueSchema), events: z.array(SpanEventSchema).default([]), status: SpanStatusSchema })`.
  6. `type SpanRecord = z.infer<typeof SpanRecordSchema>`.
- Helper: `newTraceId(seed: string): string` — deterministic 32-hex (SHA-256 of seed, first 32 hex chars). Used so backfilling the same cost report twice produces the same trace id (idempotent re-runs).
- Helper: `newSpanId(seed: string): string` — deterministic 16-hex (SHA-256 of seed, first 16 hex chars).
- Hard cap: ≤ 120 lines TS.

### Deliverable 2 — Cost-report loader in `scripts/lib/telemetry/cost-report-loader.ts`

- Path: `scripts/lib/telemetry/cost-report-loader.ts`.
- Owns reading + parsing cost reports. Reuses parsing helpers from `scripts/lib/briefing/collect-cost-parser.ts` (`parseFrontmatterBlock`, `parseModelMix`, `parseToolUsage`) — does NOT duplicate regex logic.
- Required exports:
  1. `interface CostReport { sliceFilename: string; runId: string; featureId: string | null; runTitle: string; usd: number; durationMs: number; totalTokens: number; cacheHitPct: number; windowStart: string; windowEnd: string; createdAt: string; modelMix: ModelMixEntry[]; toolUsage: Record<string, number>; subagentDispatches: number; cacheCreate1h: number; cacheRead: number; inputTokens: number; outputTokens: number; aggregateAll: boolean; }` — fields sourced from real frontmatter + body of `.claude/artifacts/crew/cost/*.md` (see `20260607T122544Z-cost-report-slice-feat113-slice37.md` for reference shape; all fields above are present in that file).
  2. `loadCostReport(absPath: string): Promise<CostReport>` — reads file via `node:fs/promises`, parses frontmatter + Model Mix + Tool Usage + Tokens (totals), returns typed object. `runId` derives from the filename's leading timestamp (`20260607T122544Z`) — guaranteed unique per emission.
  3. `derivedFeatureId(report: CostReport): string | null` — extracts FEAT-NNN from `feature:` frontmatter when set; otherwise scans `runTitle` for `/FEAT-?(\d{3,})/i` (e.g. `FEAT113 SLICE37`); returns canonical `FEAT-NNN` or null.
  4. `derivedSliceId(report: CostReport): string | null` — scans `runTitle` for `/SLICE-?(\d{1,3})/i`; returns canonical `SLICE-NN` or null.
- Only single-source slice reports are in scope: skip files whose frontmatter has `aggregate_all: true` (return `null` from a paired `loadCostReportSafe` helper, or throw a typed `AggregateReportSkipped` from `loadCostReport`). Aggregate reports are excluded because their spans would double-count slice spans.
- Hard cap: ≤ 150 lines TS.

### Deliverable 3 — Span builder in `scripts/lib/telemetry/cost-report-to-spans.ts`

- Path: `scripts/lib/telemetry/cost-report-to-spans.ts`.
- Pure function: `costReportToSpans(report: CostReport): SpanRecord[]`. No I/O.
- Trace structure (per FEAT-165 "Trace structure" section line 47-58):
  1. **Root slice span**: `name: "slice.run"`, `kind: "INTERNAL"`, `parentSpanId: undefined`. Attrs: `feat_id`, `slice_id` (both nullable -> omit attr if null), `run_id` (= report `runId`), `run_title`, `started_at` (= `windowStart`), `branch: "unknown"` (backfill cannot recover branch — explicit literal so consumers don't misread missing-data as zero). `traceId` derived from `newTraceId(runId)`. `spanId` derived from `newSpanId(runId + ".root")`. `startTimeUnixNano` and `endTimeUnixNano` computed from `windowStart` and `windowEnd` via `Date.parse(...) * 1_000_000` then `BigInt(...).toString()`.
  2. **Phase span — `phase.build`**: `parentSpanId` = root spanId. Same time window as root (backfill has no per-phase timing yet — `started_at`/`ended_at` collapse to slice window). Attrs: `gate: "build"`, `outcome: "completed"` (backfill assumption: the cost report exists therefore the slice completed). `spanId` derived from `newSpanId(runId + ".phase.build")`.
  3. **Agent dispatch spans — one per dominant agent role**: ship ONE span per model in `report.modelMix` (typically 1-2 entries: e.g. `claude-sonnet-4-6` + occasionally `claude-opus-4-7`). For each: `name: "agent.dispatch"`, `parentSpanId` = build phase spanId. Attrs: `agent: "unknown"` (backfill cannot map model -> role; SLICE-B will fill this from live hook stdin), `model: <model name>`, `prompt_id: undefined` (FEAT-167 SLICE-C will inject this), `prompt_version: undefined`, `usage.input_tokens: <int>`, `usage.output_tokens: <int>`, `usage.cache_read_tokens: <int>`, `usage.cache_creation_tokens: <int>` (= `cache_create_1h` + `cache_create_5m`; backfill collapses 5m + 1h since OTel attr does not distinguish), `cost.usd: <float>` (per-model from modelMix `usd` field). `spanId` derived from `newSpanId(runId + ".agent." + model)`.
  4. **Events on agent span**: events array stays empty in backfill (`handoff_written`, `tool_call`, `bash_gate` events require live hook stdin, not available from cost reports). SLICE-B will populate.
- All spans share one `traceId` so Langfuse / Tempo / Jaeger render them as one trace tree.
- Hard cap: ≤ 160 lines TS.

### Deliverable 4 — JSONL serializer in `scripts/lib/telemetry/serialize-jsonl.ts`

- Path: `scripts/lib/telemetry/serialize-jsonl.ts`.
- Required exports:
  1. `serializeSpansToJsonl(spans: SpanRecord[]): string` — one JSON-encoded `SpanRecord` per line, trailing `\n` after each line including the last (standard JSONL). Each line MUST individually parse via `SpanRecordSchema.parse(JSON.parse(line))`.
  2. `writeSpansToFile(spans: SpanRecord[], outPath: string): Promise<void>` — ensures parent dir exists via `fs.mkdir(..., { recursive: true })`, writes via `fs.writeFile`. Overwrites existing file (re-runs are idempotent because spanIds + traceIds are deterministic from run_id).
- Hard cap: ≤ 60 lines TS.

### Deliverable 5 — CLI entrypoint `scripts/cost-report-to-spans.ts`

- Path: `scripts/cost-report-to-spans.ts` (top-level script alongside `scripts/validate-*.ts`).
- Node 22 strip-types shebang convention per ADR-002. NO `process.exit(N)` from library functions (per repo HARD RULES line 6). The CLI top level may use `process.exitCode = N; return;`.
- CLI surface:
  - `node ./scripts/cost-report-to-spans.ts [--cost-dir <path>] [--out-dir <path>] [--only <glob>] [--emit-observability]`.
  - `--cost-dir` default: `.claude/artifacts/crew/cost/`.
  - `--out-dir` default: `.claude/artifacts/crew/spans/`.
  - `--only` optional fnmatch-style filter on cost-report filenames (e.g. `--only "*feat113*"`).
  - `--emit-observability` optional flag; when set, emits exactly ONE stderr line at end of run matching `/^OTEL-BACKFILL wrote \d+ spans across \d+ runs$/`. When NOT set, stderr stays empty.
- Behavior: scan `--cost-dir` for `*.md` cost reports; skip `aggregate_all: true` files; for each remaining file load -> build spans -> write `.claude/artifacts/crew/spans/<run_id>.jsonl`. Idempotent (re-run = same output bytes).
- Exit codes: `0` = success or zero files matched, `1` = at least one file failed to parse or validate, `2` = I/O failure (unreadable cost-dir, unwritable out-dir). Set via `process.exitCode`.
- Hard cap: ≤ 130 lines TS.

### Deliverable 6 — Tests

All tests flat under `tests/` per repo convention (mirror `tests/cost-report-emission.test.ts` shape). Use `node:test` + `node:assert/strict`. Test fixtures live under `tests/fixtures/telemetry/` (rename to non-`.test.ts` extension or rely on existing test-runner exclusion).

- **`tests/telemetry-span-schema.test.ts`** — 3 cases:
  1. Valid span passes `SpanRecordSchema.parse` (happy path: 32-hex traceId, 16-hex spanId, all required fields present, valid SpanKind).
  2. Invalid traceId (31 hex chars) is rejected with a Zod error mentioning `traceId`.
  3. `newTraceId("run-x")` returns same 32-hex on second call; `newSpanId("run-x.root")` returns same 16-hex on second call (idempotency / determinism).

- **`tests/telemetry-cost-report-loader.test.ts`** — 3 cases:
  1. Load the real fixture `.claude/artifacts/crew/cost/20260607T122544Z-cost-report-slice-feat113-slice37.md` (file exists in repo; do NOT invent). Assert `runId === "20260607T122544Z"`, `derivedFeatureId === "FEAT-113"`, `derivedSliceId === "SLICE-37"`, `usd === 1.9962`, `totalTokens === 4947801`, `modelMix.length === 1`, `modelMix[0].model === "claude-sonnet-4-6"`, `subagentDispatches === 5`.
  2. An aggregate-variant file (use real fixture `.claude/artifacts/crew/cost/20260602T133012Z-cost-report-aggregate-feat034-slice13.md` if `aggregate_all: yes` is in frontmatter; else find any file matching `*-cost-report-aggregate-*` and verify it is skipped or throws `AggregateReportSkipped`).
  3. A malformed cost report (write a temp file lacking `## Tokens (totals)` body) returns a typed parse error, not an unhandled exception.

- **`tests/telemetry-cost-report-to-spans.test.ts`** — 3 cases:
  1. Given the loaded FEAT113/SLICE37 report from test 1 above, `costReportToSpans(report)` returns exactly 3 spans: 1 root (`name: "slice.run"`), 1 phase (`name: "phase.build"`), 1 agent (`name: "agent.dispatch"`, `attributes.model === "claude-sonnet-4-6"`). All 3 share `traceId`. Root has no `parentSpanId`; phase's `parentSpanId === root.spanId`; agent's `parentSpanId === phase.spanId`. Root attrs include `feat_id: "FEAT-113"`, `slice_id: "SLICE-37"`, `run_id: "20260607T122544Z"`.
  2. A report with TWO model mix entries produces 4 spans total (1 root + 1 phase + 2 agent spans, each with distinct `model` attr).
  3. Re-running `costReportToSpans(report)` returns spans with identical `traceId`, `spanId`s, and `parentSpanId`s as the first run (determinism / idempotency assertion).

- **`tests/telemetry-cli.test.ts`** — 3 cases:
  1. Run the CLI via `spawnSync("node", ["./scripts/cost-report-to-spans.ts", "--cost-dir", tmpCostDir, "--out-dir", tmpOutDir, "--only", "*feat113*"])` against a temp dir seeded with the real FEAT113/SLICE37 fixture copy; assert exit code 0, file `<tmpOutDir>/20260607T122544Z.jsonl` exists, file parses to 3 valid `SpanRecord`s via `SpanRecordSchema.parse(JSON.parse(line))`.
  2. CLI run twice in a row produces byte-identical output (idempotency).
  3. CLI with `--emit-observability` emits exactly one stderr line matching `/^OTEL-BACKFILL wrote \d+ spans across \d+ runs$/`; without the flag, stderr is empty.

## Out of scope

- **Live hook bridge** (PostToolUse / Stop / SubagentStop reading stdin) — SLICE-B territory.
- **OTLP HTTP exporter** (`@opentelemetry/exporter-trace-otlp-http`, BatchSpanProcessor) — SLICE-B.
- **`@opentelemetry/sdk-node` runtime import** — types from `@opentelemetry/api` may be referenced if already a transitive dep, but no new runtime SDK packages added.
- **PII scrub / redaction** — SLICE-C.
- **`.claude/crew/telemetry.yaml` config file** — SLICE-B (config loader belongs with the live bridge).
- **Hook latency budget measurement** — no hooks touched, so no latency surface.
- **Langfuse self-host helper (`setup-langfuse-self-host.ts`)** — out of scope for SLICE-A; lives with SLICE-B.
- **Backfilling `handoff_written` / `tool_call` / `bash_gate` events** — events array stays `[]` for backfill spans; these require live hook stdin.
- **Agent-role mapping** (`crew:builder` / `crew:inspector`) — backfill sets `agent: "unknown"`; SLICE-B fills from live `SubagentStop` hook.
- **Branch attribute population** — backfill sets `branch: "unknown"` (cost reports don't record branch).

## Acceptance criteria

- [ ] **AC-1: All deliverable files exist with line caps respected.** Given the repo at HEAD, When inspected, Then `scripts/lib/telemetry/span.ts` (≤120 lines), `scripts/lib/telemetry/cost-report-loader.ts` (≤150 lines), `scripts/lib/telemetry/cost-report-to-spans.ts` (≤160 lines), `scripts/lib/telemetry/serialize-jsonl.ts` (≤60 lines), `scripts/cost-report-to-spans.ts` (≤130 lines) all exist. Pass-fail: each `test -f <path> && [ $(wc -l < <path>) -le <cap> ]` returns 0.

- [ ] **AC-2: Zod span schema validates real spans end-to-end.** Given the test suite, When `bun test tests/telemetry-span-schema.test.ts --timeout 30000` runs, Then exit code is 0 and all 3 cases pass (happy path, invalid-traceId rejection, deterministic id generation). Pass-fail: command returns 0.

- [ ] **AC-3: Cost-report loader reads real FEAT113/SLICE37 fixture correctly.** Given `tests/telemetry-cost-report-loader.test.ts`, When run via `bun test`, Then exit code is 0 and the test asserts: `runId === "20260607T122544Z"`, `derivedFeatureId === "FEAT-113"`, `derivedSliceId === "SLICE-37"`, `usd === 1.9962`, `totalTokens === 4947801`, `modelMix[0].model === "claude-sonnet-4-6"`. Pass-fail: command returns 0.

- [ ] **AC-4: Span builder produces the trace tree described in FEAT-165 §"Trace structure".** Given a loaded cost report with one model in modelMix, When `costReportToSpans(report)` is called, Then output is `[root, phase, agent]` (length 3), all three share `traceId`, parent links chain correctly (root has no parent, phase parents to root, agent parents to phase), and re-running produces byte-identical spans (determinism). Pass-fail: `bun test tests/telemetry-cost-report-to-spans.test.ts` returns 0; cases 1, 2, 3 all green.

- [ ] **AC-5: CLI writes valid JSONL idempotently against real fixture.** Given a temp dir seeded with the real `20260607T122544Z-cost-report-slice-feat113-slice37.md` fixture, When `node ./scripts/cost-report-to-spans.ts --cost-dir <tmp> --out-dir <tmp-out> --only "*feat113*"` runs twice in a row, Then both runs exit 0, the second run's output is byte-identical to the first, the output file `<tmp-out>/20260607T122544Z.jsonl` has exactly 3 lines, and each line `JSON.parse`s and validates via `SpanRecordSchema`. Pass-fail: `bun test tests/telemetry-cli.test.ts` returns 0.

- [ ] **AC-6: Aggregate cost-report variants are skipped (no double-counting).** Given a temp dir containing one slice variant and one `aggregate_all: yes` variant, When the CLI runs, Then only the slice variant produces a `.jsonl` file in out-dir (the aggregate is skipped). Pass-fail: a unit test asserts `aggregate_all: yes` short-circuits the loader (`AggregateReportSkipped` thrown OR loader returns null), and the CLI logs zero output for the aggregate file.

- [ ] **AC-7: Observability emit shape — one optional grep-able stderr line.** Given the CLI invocation, When `--emit-observability` is passed, Then stderr contains exactly one line matching `/^OTEL-BACKFILL wrote \d+ spans across \d+ runs$/`. When the flag is NOT passed, stderr is empty for a clean run. Pass-fail: assertion in `tests/telemetry-cli.test.ts` case 3.

- [ ] **AC-8: Full local gate green — no regressions in unrelated suites.** Given the post-slice tree, When `bun run lint && bun run format:check && bun run typecheck && bun test --parallel --timeout 30000 && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && node ./scripts/e2e-smoke.ts` runs, Then exit code is 0 for each step. Pass-fail: chained command returns 0. ALSO confirm `process.exit()` is NOT used in any of the 5 new TS files (use `process.exitCode = N; return;` pattern per repo HARD RULES).

## Done When

- all 8 acceptance criteria PASS with evidence per loop EVIDENCE_RULES
- build / test commands per `.claude/loop.json` pass (`bun test --parallel`, `bun run lint`, `bun run typecheck`, `bun run format:check`, all `node ./scripts/validate-*.ts`)
- feature FEAT-165 stays in `pending/` (SLICE-A is one of three slices; SLICE-B + SLICE-C remain — do NOT move FEAT-165 to `done/`)
- Crew `final-synthesis` artifact written
- A sample backfill run committed: `.claude/artifacts/crew/spans/20260607T122544Z.jsonl` (built from the real FEAT113/SLICE37 fixture) demonstrates the shape end-to-end for the SLICE-B builder to reference
- `requires_validation: true` retained — AC-2 / AC-3 / AC-4 / AC-5 are behavior verification (data-shape correctness on real fixtures, idempotency) and MUST be executed independently by the verifier

## Verification commands

Runnable without manual args, in order:

```
bun run lint
bun run format:check
bun run typecheck
bun test --parallel --timeout 30000 tests/telemetry-span-schema.test.ts tests/telemetry-cost-report-loader.test.ts tests/telemetry-cost-report-to-spans.test.ts tests/telemetry-cli.test.ts
bun test --parallel --timeout 30000
node ./scripts/validate-manifests.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-agents.ts
node ./scripts/validate-slices.ts
node ./scripts/cost-report-to-spans.ts --cost-dir .claude/artifacts/crew/cost --out-dir .claude/artifacts/crew/spans --only "*feat113-slice37*" --emit-observability
```

The last command does a smoke backfill against the real fixture and emits the observability line to stderr — eyeball that `.claude/artifacts/crew/spans/20260607T122544Z.jsonl` has 3 valid JSON lines.

## Reviewer ladder

- **Reviewer A (`crew:inspector`):** structural compliance + boundary-validation hygiene. Is the Zod schema strict enough at the boundary (no `z.any()`, no `z.unknown()` escape hatches)? Do all 5 TS files respect their line caps? Does `cost-report-to-spans.ts` stay a pure function (no I/O, no `Date.now()`, no `Math.random()`)? Is `process.exit()` absent from every new file? Is `parseFrontmatterBlock` / `parseModelMix` / `parseToolUsage` REUSED from `scripts/lib/briefing/collect-cost-parser.ts` rather than duplicated? Do deterministic `traceId` / `spanId` derivations actually produce stable hex (not random UUIDs)? Are aggregate cost reports skipped to avoid double-counting? Skills to consult: `skills/workflow/reviewing-code/`, repo standard `docs/standards/code-conventions.md` (ESM Node 22).

- **Reviewer B (`crew:verifier`):** behavior verification on real fixtures. Runs the full chain in §Verification commands. Confirms (a) the smoke backfill produces a real `.claude/artifacts/crew/spans/20260607T122544Z.jsonl` with 3 valid JSON lines, (b) the produced spans, when assembled by parent-child links, form one valid trace tree (root -> phase -> agent), (c) re-running the CLI produces byte-identical output, (d) the observability stderr line matches the documented regex exactly. Skills to consult: `skills/workflow/validating-behavior/`.

---

## Spec-writer notes (informational — not for builder)

**developer_type verdict: `agent`** — pure data-shape transform, deterministic id derivation, real fixtures already in repo, no agent-prompt edits, no network. Failure modes are all caught by Zod boundary validation + idempotency assertions. Matches the FEAT-165 SLICE-A `autonomous_safe: true` framing exactly.

**Why backfill ships before live bridge:** SLICE-B builder will need a known-good span shape to test their hook bridge against. Locking the shape in TS + zod here means SLICE-B can write `bridge.emit(span) -> serializeSpansToJsonl([span]) -> matches AC-2 schema`, and SLICE-C can extend the existing zod schema with `prompt_id` / `prompt_version` attrs without re-deriving the contract.

**Open notes for the SLICE-B / SLICE-C author:**
1. The `agent: "unknown"` and `branch: "unknown"` literals in backfill spans are explicit so consumers can distinguish "backfill, data unrecoverable" from "live bridge, data missing — bug". SLICE-B fills these.
2. Events array stays empty for backfill; SLICE-B populates `handoff_written` from PostToolUse hook stdin and `tool_call` / `bash_gate` from `dispatch-timing.jsonl` + `bash-gates.jsonl`.
3. The `cache_creation_tokens` attr collapses `cache_create_5m + cache_create_1h` from the cost report — this is lossy. SLICE-B may choose to emit two separate attrs (`usage.cache_creation_5m_tokens` + `usage.cache_creation_1h_tokens`) from live hook data; the schema would extend additively without breaking SLICE-A consumers.
