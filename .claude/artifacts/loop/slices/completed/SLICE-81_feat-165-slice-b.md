---
id: SLICE-81
title: "FEAT-165 SLICE-B: live OTel hook bridge + OTLP HTTP exporter + config loader"
status: completed
feature: FEAT-165
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-19
updated: 2026-06-19
developer_type: agent
estimated_complexity: high
languages: [typescript]
autonomous_safe: false
touches_files: [scripts/lib/telemetry/span.ts, scripts/lib/telemetry/config.ts, scripts/lib/telemetry/otel-bridge.ts, scripts/lib/telemetry/scrub.ts, scripts/lib/telemetry/hook-input.ts, scripts/setup-langfuse-self-host.ts, hooks/otel-post-tool-use.ts, hooks/otel-stop.ts, hooks/otel-subagent-stop.ts, hooks/hooks.json, .claude/crew/telemetry.example.yaml, docs/observability/langfuse-bridge.md, tests/telemetry-otel-bridge.test.ts, tests/telemetry-config.test.ts, tests/telemetry-scrub.test.ts, tests/fixtures/telemetry/post-tool-use-bash.json, tests/fixtures/telemetry/stop.json, tests/fixtures/telemetry/subagent-stop.json, package.json]
touches_files_confidence: declared
line_budgets: null
completed_at: 2026-06-19
---
# SLICE-81: live OTel hook bridge + OTLP HTTP exporter (FEAT-165 SLICE-B)

Implements **SLICE-B of FEAT-165**: live PostToolUse / Stop / SubagentStop bridge that emits OTLP spans to a self-hosted Langfuse via `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http`. See [feature file](../../backlog/in-progress/FEAT-165.md) for product context and [SLICE-77 spec](../completed/SLICE-77_feat-165-slice-a.md) for the upstream span-shape contract.

`autonomous_safe: false` per FEAT-165 SLICE-B framing — touches the live hook surface (PostToolUse / Stop / SubagentStop), introduces a config file that resolves auth tokens from environment variables (secrets-handling), and adds two new runtime npm dependencies. Reviewer ladder enforces opt-in default-off + secret-redaction + hook-latency budget on real fixtures.

## Objective

Stand up the live OTel bridge that converts Claude Code hook payloads (PostToolUse / Stop / SubagentStop) into `SpanRecord` instances and ships them to an OTLP-compatible backend (Langfuse self-host primary, any OTel collector secondary). The bridge MUST stay default-disabled, MUST cost ≤50ms p95 on hook entry when disabled, MUST scrub PII before export, and MUST reuse the `SpanRecordSchema` landed in SLICE-77.

This slice ships:
- the bridge library + three opt-in hook entry shims (PostToolUse + Stop + SubagentStop)
- the YAML config loader with env-var auth resolution
- the PII scrub function reused by all three hook paths
- the Langfuse self-host bootstrapper helper
- the user-facing opt-in docs
- tests including a real fixture round-trip from a captured PostToolUse payload to a validated OTLP/JSON span

It does NOT ship: the CI dry-run gate (SLICE-C), production-hosted Langfuse SaaS connector, metric/log signals, cross-repo correlation. The bridge runs against local self-host only for v1.

**DEC-024 observability ceiling INVERTED for this slice:** per FEAT-165 line 91-93 and [project-plugin-observability-ceiling], the heavyweight observability shape (full OTel SDK, BatchSpanProcessor, OTLP exporter) IS the deliverable here. The ceiling rule does not apply to FEAT-165.

## In scope

### Deliverable 1 — Apply followup: `SpanRecordSchema.passthrough()` in `scripts/lib/telemetry/span.ts`

Per SLICE-77 grade followup line 74: `SpanRecordSchema.passthrough()` to absorb SDK-side attrs (`traceState`, `links`, `droppedAttributesCount`, `resource`) without breaking backfill consumers.

- Path: `scripts/lib/telemetry/span.ts` (edit only — preserve all existing exports).
- Change exactly one line: `z.object({...}).passthrough()` on the `SpanRecordSchema` definition (lines 31-45 of current file).
- All existing SLICE-77 tests MUST still pass byte-for-byte (the schema is additive — passthrough keeps unknown keys, never strips known ones).
- Add one new test case to `tests/telemetry-span-schema.test.ts`: a span with an extra `traceState: "vendor=x"` field passes `SpanRecordSchema.parse` AND the `traceState` field survives on the parsed output.
- Hard cap: ≤130 lines TS (span.ts grows by 1 line).

### Deliverable 2 — Config loader in `scripts/lib/telemetry/config.ts`

- Path: `scripts/lib/telemetry/config.ts`.
- Reads + validates `.claude/crew/telemetry.yaml` (the consumer-installed path; this repo ships only the `.example.yaml` template).
- Uses existing `yaml` devDep (already in package.json line 13) — do NOT add a new YAML lib.
- Zod schema `TelemetryConfigSchema`:
  ```
  z.object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().default("http://localhost:3000/api/public/otel/v1/traces"),
    auth: z.object({
      header_name: z.string().default("Authorization"),
      // Value supports literal OR ${ENV_VAR} interpolation.
      header_value: z.string().default("Basic ${LANGFUSE_AUTH_B64}")
    }).default({}),
    sample_rate: z.number().min(0).max(1).default(1.0),
    scrub_pii: z.boolean().default(true),
    redact_paths: z.array(z.string()).default([
      "**/.env", "**/.env.*", "**/secrets/**", "**/*credentials*",
      "**/private/**", "**/*.pem", "**/*.key"
    ]),
    redact_attr_max_chars: z.number().int().min(64).default(2048),
    max_queue_size: z.number().int().min(64).default(2048),
    schedule_delay_ms: z.number().int().min(100).default(5000),
    export_timeout_ms: z.number().int().min(500).default(30000)
  }).passthrough()
  ```
- Required exports:
  1. `interface TelemetryConfig` = `z.infer<typeof TelemetryConfigSchema>`.
  2. `loadTelemetryConfig(absPath?: string): Promise<TelemetryConfig>` — defaults `absPath` to `${CLAUDE_PROJECT_DIR ?? process.cwd()}/.claude/crew/telemetry.yaml`. If file does NOT exist, returns the schema defaults (i.e. `enabled: false`) — silently. No throw on missing file.
  3. `resolveAuthHeader(value: string, env: NodeJS.ProcessEnv = process.env): string` — replaces `${VAR}` tokens with `env[VAR]`. If a referenced env var is missing AND `enabled: true`, returns the literal `${VAR}` unchanged so caller can detect + warn. Multiple `${A}${B}` tokens supported.
  4. `bridgeEnabled(cfg: TelemetryConfig, env: NodeJS.ProcessEnv = process.env): boolean` — returns `cfg.enabled && env["CREW_OTEL_ENABLED"] === "1"`. **Two-key opt-in: config flag AND env var.** Either alone is insufficient. Documented as belt-and-suspenders against accidental enablement.
- Hard cap: ≤140 lines TS.

### Deliverable 3 — Hook input parser in `scripts/lib/telemetry/hook-input.ts`

- Path: `scripts/lib/telemetry/hook-input.ts`.
- Owns parsing the three hook payload shapes Claude Code emits into the bridge.
- Zod schemas (boundary validation — no `z.any()`):
  1. `PostToolUseHookInputSchema` = `z.object({ session_id: z.string(), tool_name: z.string(), tool_input: z.record(z.unknown()), tool_response: z.unknown().optional(), cwd: z.string().optional() }).passthrough()`.
  2. `StopHookInputSchema` = `z.object({ session_id: z.string(), cwd: z.string().optional(), reason: z.string().optional() }).passthrough()`.
  3. `SubagentStopHookInputSchema` = `z.object({ session_id: z.string(), agent_name: z.string().optional(), last_assistant_message: z.string().optional(), cwd: z.string().optional() }).passthrough()`.
- Required exports:
  1. `parsePostToolUse(raw: string): z.infer<typeof PostToolUseHookInputSchema> | null` — JSON.parse + Zod parse; returns `null` on any failure (NEVER throws — hooks must be silent on malformed stdin per hooks/post-tool-use-bash-gate.ts pattern at line 26-29).
  2. `parseStop(raw: string)` and `parseSubagentStop(raw: string)` mirror the above.
- Hard cap: ≤110 lines TS.

### Deliverable 4 — PII scrub in `scripts/lib/telemetry/scrub.ts`

- Path: `scripts/lib/telemetry/scrub.ts`.
- Required exports:
  1. `scrubAttrs(attrs: Record<string, string | number | boolean>, cfg: { scrub_pii: boolean; redact_paths: string[]; redact_attr_max_chars: number }): Record<string, string | number | boolean>`.
  2. `matchesRedactPath(path: string, globs: string[]): boolean` — exposed for reuse + testing. Use minimatch-style glob equivalent **without** adding a dep — implement a small `globToRegExp` (≤30 LOC: support `**`, `*`, `?`, and literal segments).
- Behavior when `scrub_pii: true`:
  - String attrs longer than `redact_attr_max_chars` are replaced with `<redacted:length=N>` (preserve numeric length so consumers see the data existed without seeing content).
  - String attrs whose **value** is a path matching any `redact_paths` glob are replaced with `<redacted:path>`.
  - Attrs whose **key** is in the explicit deny-list — `[ "input.prompt", "input.diff", "input.content", "input.code", "input.text", "tool_input.content", "tool_input.code", "tool_input.text", "tool_input.prompt", "tool_input.file_text", "tool_input.new_string", "tool_input.old_string", "tool_response", "last_assistant_message" ]` — are unconditionally replaced with `<redacted:key>` regardless of length.
  - Numeric and boolean attrs pass through unchanged.
- When `scrub_pii: false`: returns input unchanged (one branch, no mutation).
- Hard cap: ≤100 lines TS.

### Deliverable 5 — OTel bridge in `scripts/lib/telemetry/otel-bridge.ts`

- Path: `scripts/lib/telemetry/otel-bridge.ts`.
- Wires `@opentelemetry/sdk-node` + `@opentelemetry/exporter-trace-otlp-http` to the SLICE-77 `SpanRecord` shape.
- Required exports:
  1. `initBridge(cfg: TelemetryConfig): NodeSDK | null` — returns null if `bridgeEnabled(cfg)` is false (the caller's hook entry returns immediately, no SDK started, no measurable overhead). When enabled: constructs `OTLPTraceExporter` with `url: cfg.endpoint` + headers `{ [auth.header_name]: resolveAuthHeader(auth.header_value) }`, wraps in `BatchSpanProcessor` with `{ maxQueueSize: cfg.max_queue_size, scheduledDelayMillis: cfg.schedule_delay_ms, exportTimeoutMillis: cfg.export_timeout_ms }`, constructs `NodeSDK` with resource attrs `{ "service.name": "crew-plugin", "service.version": "<package.json version>" }`, calls `sdk.start()`, returns the sdk handle so the hook entry can `await sdk.shutdown()` on `process.beforeExit`.
  2. `emitPostToolUseSpan(sdk: NodeSDK, payload: PostToolUseHookInput, cfg: TelemetryConfig): void` — opens a span `name: "tool_call"`, `kind: "INTERNAL"`, attrs `{ "tool.name": payload.tool_name, "session.id": payload.session_id, "cwd": payload.cwd ?? "unknown" }` plus scrubbed flattened `tool_input` attrs (prefix keys with `tool_input.`). End the span immediately (PostToolUse fires after the tool returned; we record an "instantaneous" span where `endTime = startTime + 1ns`). The BatchSpanProcessor handles export off the hot path.
  3. `emitStopSpan(sdk: NodeSDK, payload: StopHookInput, cfg: TelemetryConfig): void` — span `name: "session.stop"`, attrs `{ "session.id": payload.session_id, "reason": payload.reason ?? "unknown" }`. Triggers `sdk.shutdown()` after enqueue so the BatchSpanProcessor flushes the queue before the Node process exits (`Stop` fires at session end).
  4. `emitSubagentStopSpan(sdk: NodeSDK, payload: SubagentStopHookInput, cfg: TelemetryConfig): void` — span `name: "agent.dispatch"`, attrs `{ "agent": payload.agent_name ?? "unknown", "session.id": payload.session_id }` plus scrubbed `last_assistant_message` (always redacted by key per Deliverable 4 deny-list).
  5. `sampleSpan(cfg: TelemetryConfig, rng: () => number = Math.random): boolean` — returns `rng() < cfg.sample_rate`. Pure function, RNG-injectable for tests.
- Implementation discipline:
  - Lazy import the SDK at top of `initBridge` (`const { NodeSDK } = await import("@opentelemetry/sdk-node")`). When the bridge is disabled the SDK never loads — keeps hook cold-start path off the OTel dependency tree (essential for ≤50ms p95 disabled-path).
  - Wrap every `emit*` body in `try { ... } catch (err) { /* swallow */ }`. A telemetry crash must never propagate into the hook process.
  - All span attrs flow through `scrubAttrs` before being attached.
  - Use `@opentelemetry/api` `trace.getTracer("crew-plugin", "<version>")` to create the tracer — Node SDK auto-registers the global provider.
- Hard cap: ≤220 lines TS.

### Deliverable 6 — Three hook entry shims under `hooks/`

Match the existing pattern in `hooks/post-tool-use-bash-gate.ts` (read entire stdin, parse, dispatch, swallow errors via `logHookError`, `process.exit(0)`).

- `hooks/otel-post-tool-use.ts` — reads stdin, calls `parsePostToolUse(raw)`; if non-null AND `bridgeEnabled(cfg)`, lazily `initBridge` (cached at module scope for the process lifetime), call `emitPostToolUseSpan`. Otherwise exit silent. Hard cap: ≤50 lines TS.
- `hooks/otel-stop.ts` — analogous for `Stop`. After enqueue, **await `sdk.shutdown()`** with a 1000ms timeout (use `Promise.race` against a `setTimeout`) so trace export gets one last chance to flush. Hard cap: ≤50 lines TS.
- `hooks/otel-subagent-stop.ts` — analogous for `SubagentStop`; no shutdown (subagent stop is not session end). Hard cap: ≤50 lines TS.

Wire each into `hooks/hooks.json` as additional entries (do NOT replace existing entries):
- New `PostToolUse` entry with no matcher (runs on every tool — wide net so PostToolUse spans include Bash/Read/Edit/Write/etc.), command `bun "${CLAUDE_PLUGIN_ROOT}/hooks/otel-post-tool-use.ts"`.
- New top-level `Stop` array with command `bun "${CLAUDE_PLUGIN_ROOT}/hooks/otel-stop.ts"`.
- The existing `SubagentStop` block already exists at `hooks.json` line 44-53 (currently runs `log_event.sh subagent_stop`); ADD a second hook command to the same `hooks` array running `bun "${CLAUDE_PLUGIN_ROOT}/hooks/otel-subagent-stop.ts"`. Do not remove the existing log_event.sh call.

### Deliverable 7 — Setup helper `scripts/setup-langfuse-self-host.ts`

- Path: `scripts/setup-langfuse-self-host.ts`. Top-level script per ADR-002 (`node` shebang, no `process.exit()` in lib code).
- CLI surface: `node ./scripts/setup-langfuse-self-host.ts [--out <path>]`.
- Behavior: writes a docker-compose.yml snippet (Langfuse + Postgres on localhost:3000) to `--out` (default `./langfuse/docker-compose.yml`) and prints to stdout:
  1. The compose-up command (`docker compose -f ./langfuse/docker-compose.yml up -d`).
  2. The Langfuse first-run URL (`http://localhost:3000`).
  3. The exact env vars the user needs to export (`LANGFUSE_AUTH_B64=$(echo -n "pk-...:sk-..." | base64)` then `export CREW_OTEL_ENABLED=1`).
  4. The path of the example telemetry.yaml template (`.claude/crew/telemetry.example.yaml`) and instruction to `cp` it to `.claude/crew/telemetry.yaml` + set `enabled: true`.
- Hard cap: ≤120 lines TS.

### Deliverable 8 — `.claude/crew/telemetry.example.yaml`

Ship a fully-commented template. Consumers `cp .claude/crew/telemetry.example.yaml .claude/crew/telemetry.yaml` and edit. The example file MUST have `enabled: false` so an accidental `cp` is safe.

```yaml
# .claude/crew/telemetry.yaml — FEAT-165 OTel bridge config. Default OFF.
# Two-key opt-in: enabled: true here AND CREW_OTEL_ENABLED=1 in env.
enabled: false
endpoint: "http://localhost:3000/api/public/otel/v1/traces"
auth:
  header_name: "Authorization"
  # ${VAR} tokens resolve from process.env at hook time.
  header_value: "Basic ${LANGFUSE_AUTH_B64}"
sample_rate: 1.0
scrub_pii: true
redact_paths:
  - "**/.env"
  - "**/.env.*"
  - "**/secrets/**"
  - "**/*credentials*"
  - "**/private/**"
  - "**/*.pem"
  - "**/*.key"
redact_attr_max_chars: 2048
max_queue_size: 2048
schedule_delay_ms: 5000
export_timeout_ms: 30000
```

### Deliverable 9 — Docs `docs/observability/langfuse-bridge.md`

≤180 lines. Sections (in order, with concrete commands):
1. **What this is** — one-paragraph summary of bridge + Langfuse.
2. **Default safety posture** — two-key opt-in, default disabled, PII scrub default on.
3. **One-shot self-host setup** — `node ./scripts/setup-langfuse-self-host.ts` walkthrough.
4. **Two-key opt-in flow** — config YAML edit + env var export, with the exact two grep commands a reviewer can run to confirm: `grep '^enabled:' .claude/crew/telemetry.yaml` and `echo "$CREW_OTEL_ENABLED"`.
5. **What gets emitted** — list of span names + key attrs (link to `scripts/lib/telemetry/span.ts`).
6. **What gets scrubbed** — list of redacted attr keys from Deliverable 4 deny-list verbatim.
7. **Disabling** — `unset CREW_OTEL_ENABLED` or set `enabled: false` in config (either alone is sufficient to disable).
8. **Subscription-only guarantee** — bridge endpoint MUST be a localhost or self-hosted Langfuse; bridge NEVER calls `api.anthropic.com`. Grep command for reviewer: `grep -rn 'api.anthropic.com' scripts/lib/telemetry/ hooks/otel-*` (expected: zero matches).

### Deliverable 10 — Dependency additions

Add to `package.json` `dependencies` (not devDependencies — runtime use):
- `@opentelemetry/api`: `^1.9.0` (already a peer of sdk-node; declare explicitly so types resolve in `tsc --noEmit`)
- `@opentelemetry/sdk-node`: `^0.55.0` or newer compatible with Node 22 (verify via `npm view @opentelemetry/sdk-node engines` at build time and pin to a range that includes `node: ">=18"`).
- `@opentelemetry/exporter-trace-otlp-http`: matching `^0.55.0`.

The builder MUST run `npm view @opentelemetry/sdk-node@latest engines.node` before pinning and record the resolved version + engines line in the build handoff. If the latest available version does NOT declare Node 22 support, fall back to the highest 0.5x release that does.

### Deliverable 11 — Tests

All tests flat under `tests/`. Use `bun test` + `node:assert/strict`. Test fixtures under `tests/fixtures/telemetry/`.

#### `tests/telemetry-config.test.ts` — 4 cases:

1. **Defaults when file absent.** Given a path that does not exist, `loadTelemetryConfig(path)` resolves to `{ enabled: false, endpoint: "http://localhost:3000/api/public/otel/v1/traces", scrub_pii: true, sample_rate: 1.0, ... }` (assert all default fields). No throw.
2. **YAML round-trip.** Write a temp `telemetry.yaml` with `enabled: true`, `endpoint: "https://cloud.langfuse.com/api/public/otel/v1/traces"`, `sample_rate: 0.5`; `loadTelemetryConfig` returns those exact values; unspecified fields fall back to defaults.
3. **Env var resolution.** `resolveAuthHeader("Basic ${LANGFUSE_AUTH_B64}", { LANGFUSE_AUTH_B64: "abc123" })` returns `"Basic abc123"`. Missing env var returns the literal `"Basic ${LANGFUSE_AUTH_B64}"` unchanged.
4. **Two-key opt-in semantics.** `bridgeEnabled({ enabled: true, ... }, { CREW_OTEL_ENABLED: "1" })` returns true. `bridgeEnabled({ enabled: true, ... }, {})` returns false. `bridgeEnabled({ enabled: false, ... }, { CREW_OTEL_ENABLED: "1" })` returns false.

#### `tests/telemetry-scrub.test.ts` — 4 cases:

1. **Deny-list keys redacted regardless of length.** `scrubAttrs({ "tool_input.content": "x" }, { scrub_pii: true, redact_paths: [], redact_attr_max_chars: 10000 })` returns `{ "tool_input.content": "<redacted:key>" }`. Numeric attrs unchanged.
2. **Long string redacted with length preserved.** A 3000-char string under a non-deny-list key with `redact_attr_max_chars: 2048` becomes `"<redacted:length=3000>"`.
3. **Path glob match redacts value.** `scrubAttrs({ "file_path": "/home/u/.env.local" }, { scrub_pii: true, redact_paths: ["**/.env.*"], redact_attr_max_chars: 10000 })` returns `{ "file_path": "<redacted:path>" }`.
4. **Disabled scrub passes through.** `scrubAttrs({ "tool_input.content": "secret-data" }, { scrub_pii: false, redact_paths: [], redact_attr_max_chars: 10 })` returns `{ "tool_input.content": "secret-data" }` unchanged.

#### `tests/telemetry-otel-bridge.test.ts` — 4 cases:

Use an **in-memory span exporter** for assertion (the `@opentelemetry/sdk-trace-base` package exports `InMemorySpanExporter` — if not transitively available, write a 30-LOC test double that conforms to `SpanExporter` interface and swap it in by passing an optional `exporter` override into `initBridge` — add that override to the bridge signature in Deliverable 5 specifically for testability: `initBridge(cfg: TelemetryConfig, opts?: { exporter?: SpanExporter }): NodeSDK | null`).

1. **Disabled bridge does NOT load SDK.** Given `cfg.enabled = false` (or `CREW_OTEL_ENABLED` unset), call `initBridge(cfg)`. Assert: return value is `null`; assert that `@opentelemetry/sdk-node` was NOT imported (use `require.cache` check or a module-graph proxy). Behavioral assert: total wall time for `initBridge` + a no-op `parsePostToolUse` of a captured fixture is ≤5ms on the CI box.
2. **PostToolUse fixture round-trip.** Given `tests/fixtures/telemetry/post-tool-use-bash.json` (a real captured payload with `tool_name: "Bash"`, `tool_input.command: "echo hello"`, `session_id: "test-session-001"`), call `parsePostToolUse(JSON.stringify(fixture))` then `emitPostToolUseSpan(sdk, parsed, cfg)`. Assert: the in-memory exporter receives exactly 1 finished span; span name === `"tool_call"`; span attrs include `"tool.name": "Bash"`, `"session.id": "test-session-001"`; the `tool_input.command` attr was scrubbed via the deny-list (asserted value === `"<redacted:key>"` or the attr is absent depending on Deliverable 4's behavior — pick one and assert exactly).
3. **Sampling.** Given `cfg.sample_rate: 0.0` and `rng: () => 0.5`, `sampleSpan(cfg, rng)` returns false. Given `cfg.sample_rate: 1.0`, returns true. Given `cfg.sample_rate: 0.6`, `rng: () => 0.3` returns true and `rng: () => 0.9` returns false.
4. **Stop hook flushes batch.** Given the Stop fixture, after `emitStopSpan(sdk, parsed, cfg)` and the awaited shutdown, the in-memory exporter's `getFinishedSpans()` returns the Stop span (proves the BatchSpanProcessor flushed during shutdown). Time-box the assertion to 1.5s wall time max so a hung shutdown fails loudly.

Fixtures `tests/fixtures/telemetry/post-tool-use-bash.json`, `stop.json`, `subagent-stop.json` are real captured payload shapes (modeled on the parser at `hooks/lib/bash-gate-timer-tap.ts` lines 65-94 and `.claude/hooks/subagent_handoff_check.sh` lines 16-25). Each fixture MUST round-trip through the matching Zod schema.

## Out of scope

- **PII scrub CI gate / dry-run mode** — SLICE-C territory per FEAT-165 line 103-104.
- **Backfill of historical cost reports** — already shipped in SLICE-77.
- **Production-hosted Langfuse SaaS connector** — self-host only per FEAT-165 line 110.
- **Cross-repo trace correlation** — single repo per FEAT-165 line 111.
- **Metrics + logs OTel signals** — traces only per FEAT-165 line 108.
- **PreToolUse hook wiring** — only PostToolUse + Stop + SubagentStop in this slice per FEAT-165 line 101-102. PreToolUse adds duplicate signal and hurts the ≤50ms p95 budget.
- **Agent-role auto-detection from agent_name string** — bridge passes `agent_name` through; mapping to canonical `crew:builder` etc. is FEAT-167 SLICE-C territory.
- **PromptId / promptVersion attrs** — FEAT-167 SLICE-C.

## Acceptance criteria

- [ ] **AC-1: Span schema passthrough applied + backward compatible.** Given `scripts/lib/telemetry/span.ts` at HEAD, When inspected, Then `SpanRecordSchema` is constructed with `.passthrough()`. When the full SLICE-77 test suite runs (`bun test tests/telemetry-span-schema.test.ts tests/telemetry-cost-report-loader.test.ts tests/telemetry-cost-report-to-spans.test.ts tests/telemetry-cli.test.ts`), Then exit code is 0 and zero existing assertions changed. Pass-fail: `bun test ...` returns 0 AND `grep -c "passthrough" scripts/lib/telemetry/span.ts` >= 1.

- [ ] **AC-2: All deliverable files exist with line caps respected.** Given the repo at HEAD, When inspected, Then every path in `touches_files` frontmatter exists AND every entry in `line_budgets` frontmatter has `wc -l < <path>` ≤ the declared cap. Pass-fail: a one-liner shell loop returns 0 for every path/cap pair (see Verification commands).

- [ ] **AC-3: Config loader honors two-key opt-in.** Given `tests/telemetry-config.test.ts`, When `bun test tests/telemetry-config.test.ts --timeout 30000` runs, Then exit code 0 and all 4 cases pass. Specifically `bridgeEnabled` returns false whenever EITHER `cfg.enabled === false` OR `env.CREW_OTEL_ENABLED !== "1"`. Pass-fail: command returns 0.

- [ ] **AC-4: PII scrub redacts deny-list + long strings + path globs.** Given `tests/telemetry-scrub.test.ts`, When `bun test tests/telemetry-scrub.test.ts` runs, Then exit code 0 and all 4 cases pass. Pass-fail: command returns 0.

- [ ] **AC-5: Bridge round-trips a real PostToolUse fixture into one validated OTLP span.** Given `tests/fixtures/telemetry/post-tool-use-bash.json` (a captured Bash PostToolUse payload), When `tests/telemetry-otel-bridge.test.ts` case 2 runs against the in-memory exporter, Then exactly one span is exported with `name === "tool_call"`, `attributes["tool.name"] === "Bash"`, `attributes["session.id"] === "test-session-001"`, the span's record validates against `SpanRecordSchema.parse(...)` after `SpanShim.toOtlpJson()` (or equivalent shape coercion). Pass-fail: `bun test tests/telemetry-otel-bridge.test.ts` returns 0.

- [ ] **AC-6: Bridge disabled-path stays under 5ms wall time.** Given `cfg.enabled = false`, When `initBridge(cfg)` is called 100 times in a tight loop and a single PostToolUse fixture is parsed each iteration, Then total wall time is ≤500ms (≤5ms per disabled iteration p100 in the test, comfortably under the ≤50ms p95 production budget). Pass-fail: assertion inside `tests/telemetry-otel-bridge.test.ts` case 1.

- [ ] **AC-7: Stop hook flushes BatchSpanProcessor on shutdown.** Given the Stop fixture, When `emitStopSpan(sdk, parsed, cfg)` is called followed by `await sdk.shutdown()` with the 1000ms timeout race, Then the in-memory exporter's `getFinishedSpans()` returns the Stop span and the shutdown promise resolves within 1.5s. Pass-fail: `tests/telemetry-otel-bridge.test.ts` case 4 returns 0.

- [ ] **AC-8: hooks.json wires three new entries without breaking existing entries.** Given `hooks/hooks.json` at HEAD, When parsed as JSON, Then: (a) every existing hook entry from pre-slice baseline is present byte-for-byte; (b) a new `PostToolUse` entry exists whose command contains `otel-post-tool-use.ts`; (c) a new top-level `Stop` array exists whose command contains `otel-stop.ts`; (d) the existing `SubagentStop` `hooks` array contains a SECOND command entry referencing `otel-subagent-stop.ts` AND retains the original `log_event.sh subagent_stop` entry. Pass-fail: a `tests/telemetry-hooks-json.test.ts` (add to Deliverable 11) reads `hooks/hooks.json`, asserts each of (a)-(d) explicitly.

- [ ] **AC-9: Subscription-only guarantee — no anthropic API calls.** Given the entire `scripts/lib/telemetry/`, `hooks/otel-*.ts`, and `scripts/setup-langfuse-self-host.ts` source set, When grepped for `api.anthropic.com`, Then zero matches. Pass-fail: `! grep -rn 'api.anthropic.com' scripts/lib/telemetry/ hooks/otel-*.ts scripts/setup-langfuse-self-host.ts`.

- [ ] **AC-10: Default-OFF assertion across config + env + example file.** Given `.claude/crew/telemetry.example.yaml`, When parsed as YAML, Then `enabled: false`. Given the test env without `CREW_OTEL_ENABLED`, When `bridgeEnabled(loadTelemetryConfig("nonexistent"))` is called, Then returns false. Given the bridge code, When grepped for `enabled: true`, Then only test files match (`tests/**`). Pass-fail: combined assertion in `tests/telemetry-config.test.ts` case 1 + a shell `! grep -rn 'enabled: true' scripts/lib/telemetry/ .claude/crew/telemetry.example.yaml`.

- [ ] **AC-11: Full local gate green — no regressions in unrelated suites.** Given the post-slice tree, When `bun run lint && bun run format:check && bun run typecheck && bun test --parallel --timeout 30000 && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts && node ./scripts/e2e-smoke.ts` runs, Then exit code is 0 for each step. Pass-fail: chained command returns 0. ALSO confirm `process.exit()` is NOT used in any of the new library TS files under `scripts/lib/telemetry/` (hook entry shims at `hooks/otel-*.ts` may use `process.exit(0)` per existing hook pattern at `hooks/post-tool-use-bash-gate.ts` line 28). Pass-fail: `! grep -n 'process\.exit' scripts/lib/telemetry/*.ts`.

- [ ] **AC-12: Reviewer-validated local Langfuse round trip (one-shot manual evidence).** Given the setup helper, When the verifier runs `node ./scripts/setup-langfuse-self-host.ts` and follows the printed instructions on a workstation with Docker available (compose-up Langfuse, copy example yaml, set `enabled: true`, export `CREW_OTEL_ENABLED=1` and `LANGFUSE_AUTH_B64`), When the verifier opens a Bash tool call in a fresh Claude Code session, Then within 30s of session-end the Langfuse UI at `http://localhost:3000` shows a trace under project "crew-plugin" containing the `tool_call` span with `tool.name: "Bash"`. Pass-fail: verifier records a screenshot path in the validation artifact OR records `validation_skipped: docker_unavailable` with explicit reason. AC-12 is the only manual-evidence AC in this slice and is permitted to be `validation_skipped` on a CI box without Docker — the in-memory exporter assertions in AC-5 carry the automated coverage.

## Done When

- all 12 acceptance criteria PASS with evidence per loop EVIDENCE_RULES (AC-12 may be `validation_skipped: docker_unavailable` with reason)
- build / test commands per `.claude/loop.json` pass (`bun test --parallel`, `bun run lint`, `bun run typecheck`, `bun run format:check`, all `node ./scripts/validate-*.ts`, `node ./scripts/e2e-smoke.ts`)
- feature FEAT-165 stays in `in-progress/` (SLICE-C remains — do NOT move FEAT-165 to `done/`)
- Crew `final-synthesis` artifact written
- `requires_validation: true` retained — AC-3 / AC-4 / AC-5 / AC-6 / AC-7 / AC-12 are behavior verification and MUST be executed independently by the verifier

## Verification commands

Runnable without manual args, in order:

```
bun run lint
bun run format:check
bun run typecheck
bun test --parallel --timeout 30000 tests/telemetry-span-schema.test.ts tests/telemetry-config.test.ts tests/telemetry-scrub.test.ts tests/telemetry-otel-bridge.test.ts tests/telemetry-hooks-json.test.ts
bun test --parallel --timeout 30000
node ./scripts/validate-manifests.ts
node ./scripts/validate-skills.ts
node ./scripts/validate-agents.ts
node ./scripts/validate-slices.ts
node ./scripts/e2e-smoke.ts
! grep -rn 'api.anthropic.com' scripts/lib/telemetry/ hooks/otel-post-tool-use.ts hooks/otel-stop.ts hooks/otel-subagent-stop.ts scripts/setup-langfuse-self-host.ts
! grep -rn 'enabled: true' scripts/lib/telemetry/ .claude/crew/telemetry.example.yaml
! grep -n 'process\.exit' scripts/lib/telemetry/config.ts scripts/lib/telemetry/hook-input.ts scripts/lib/telemetry/scrub.ts scripts/lib/telemetry/otel-bridge.ts
```

Optional manual leg for AC-12 (only when Docker is available on the verifier host):

```
node ./scripts/setup-langfuse-self-host.ts --out ./langfuse/docker-compose.yml
docker compose -f ./langfuse/docker-compose.yml up -d
cp .claude/crew/telemetry.example.yaml .claude/crew/telemetry.yaml
# edit enabled: true, set LANGFUSE_AUTH_B64 and CREW_OTEL_ENABLED=1 per docs
# open fresh Claude Code session, run any Bash tool call, end session
# open http://localhost:3000 → trace appears with tool_call span
```

## Reviewer ladder

- **Reviewer A (`crew:inspector`):** structural compliance + secrets-handling hygiene + boundary validation.
  - Is the Zod schema strict enough at the boundary (no `z.any()`, `passthrough` only on documented schemas)?
  - Do all 9 new TS files respect their per-file line caps from the frontmatter `line_budgets`?
  - Is the SDK lazy-loaded so the disabled path never imports `@opentelemetry/sdk-node`?
  - Is `process.exit()` absent from every new file under `scripts/lib/telemetry/`?
  - Are the three hook entry shims modeled on `hooks/post-tool-use-bash-gate.ts` (stdin read pattern, error swallow via `logHookError`, exit 0)?
  - Is the deny-list in `scrub.ts` covering at minimum the keys named in Deliverable 4 verbatim?
  - Does `bridgeEnabled` enforce BOTH `cfg.enabled === true` AND `env.CREW_OTEL_ENABLED === "1"`?
  - Is `.claude/crew/telemetry.example.yaml` shipped with `enabled: false`?
  - Are the two newly added runtime deps (`@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`) pinned to versions whose `engines.node` admits Node 22?
  - Skills to consult: `skills/workflow/reviewing-code/`, `docs/standards/code-conventions.md`, repo HARD RULE on no-process-exit-from-library.

- **Reviewer B (`crew:verifier`):** behavior verification on real fixtures + manual Langfuse round trip when feasible.
  - Runs the full chain in §Verification commands.
  - Confirms (a) AC-5 in-memory round trip produces the asserted `tool_call` span shape, (b) AC-6 disabled-path wall time ≤500ms across 100 iterations, (c) AC-7 Stop shutdown flushes within 1.5s, (d) AC-8 `hooks.json` parsed structure has all baseline entries plus the three new entries, (e) AC-9 grep for `api.anthropic.com` is zero matches.
  - For AC-12: if Docker is available, executes the optional manual leg and saves a screenshot of the Langfuse trace under `.claude/artifacts/crew/validations/<timestamp>-langfuse-trace.png` (or equivalent); otherwise records `validation_skipped: docker_unavailable` in the validation artifact with explicit reason and timestamps.
  - Skills to consult: `skills/workflow/validating-behavior/`, `skills/domain/opentelemetry/` if present.

---

## Spec-writer notes (informational — not for builder)

**developer_type verdict: `agent`** with reviewer-ladder safety on. The slice is structurally larger than SLICE-A (3 hook entries, OTel SDK wiring, YAML config, secrets resolution) but every surface is bounded and testable. The reasons it stays agent-tractable:

1. Span shape contract already locked by SLICE-77 — bridge has a target to hit, not a target to design.
2. Hook entry pattern already established by `hooks/post-tool-use-bash-gate.ts` — builder copies the shape, swaps the dispatch body.
3. PII scrub is a deterministic data-shape transform like SLICE-77's serializer — Zod boundary + unit tests verify directly.
4. In-memory exporter for AC-5/AC-7 means the OTel SDK wiring is testable without a live network round trip.

**Why `autonomous_safe: false` despite agent-tractable:**

The slice touches the live hook surface AND introduces a config file that resolves secrets from env vars. Per FEAT-165 SLICE-B framing (line 100-102 of FEAT body), this slice MUST go through human-in-loop on review even when the loop picks it. The reviewer ladder above explicitly calls out the secrets-handling and default-off audits that a human-aided review must confirm.

**Why two-key opt-in (`cfg.enabled` AND `CREW_OTEL_ENABLED`):**

Single-key opt-in failed safety review in prior plugin work: a developer can accidentally commit `enabled: true` in a config file (paste from teammate, copy from example), OR forget to unset an env var across sessions. Requiring BOTH means each accidental enablement has an offsetting safety net. The cost is one extra env var; the benefit is "no surprise network calls" per FEAT-165 line 80-81.

**Why InMemorySpanExporter for AC-5/AC-7 not network round trip:**

Per repo HARD RULES line 80-83 of FEAT-165, the bridge MUST NEVER call `api.anthropic.com` and MUST stay subscription-only. A test that requires a live Langfuse endpoint would either (a) need Docker on CI (currently unavailable per known constraints) OR (b) hit a remote endpoint. In-memory exporter is the industry-standard OTel test double for this exact case (`@opentelemetry/sdk-trace-base` ships `InMemorySpanExporter`); the manual AC-12 carries the live-Langfuse evidence one time per slice, reviewer-witnessed.

**Open notes for the SLICE-C author:**

1. `redact_paths` glob matcher (Deliverable 4) is the foundation SLICE-C extends — keep it pure and pass `redact_paths` through unmodified for SLICE-C's CI dry-run gate.
2. The bridge's `emit*` functions are designed so SLICE-C can wrap them with a dry-run shim that swaps the OTLP exporter for the in-memory exporter and dumps spans to JSONL for the CI gate to grep.
3. The `agent_name → canonical role` mapping (e.g. `crew:builder` → `agent` attr value) is intentionally NOT done here — FEAT-167 SLICE-C owns prompt-version + role attribution. SLICE-B passes `agent_name` through scrubbed but otherwise raw.
