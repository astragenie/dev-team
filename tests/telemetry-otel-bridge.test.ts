/**
 * Tests for scripts/lib/telemetry/otel-bridge.ts
 * AC-5: PostToolUse fixture round-trip → OTLP span.
 * AC-6: Disabled-path wall time ≤5ms per iteration.
 * AC-7: Stop hook flushes BatchSpanProcessor on shutdown.
 *
 * Bun / OTel SDK interaction notes:
 * - NodeSDK.start() registers a NodeTracerProvider as the global OTel delegate.
 * - NodeSDK.shutdown() marks the provider as shut-down; re-starting a second
 *   NodeSDK after that leaves spans unrecorded (provider ignores them).
 * - InMemorySpanExporter.shutdown() clears its own buffer.
 * - Therefore: all enabled-bridge span tests share ONE SDK + ONE exporter
 *   for the process lifetime. exporter.reset() clears between tests.
 * - forceFlush() on the provider delegate drains BatchSpanProcessor into the
 *   InMemorySpanExporter without triggering the shutdown-and-clear path.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { trace } from "@opentelemetry/api";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import {
  initBridge,
  emitPostToolUseSpan,
  emitStopSpan,
  sampleSpan,
  type BridgeSdk
} from "../scripts/lib/telemetry/otel-bridge.ts";
import { parsePostToolUse, parseStop } from "../scripts/lib/telemetry/hook-input.ts";
import type { TelemetryConfig } from "../scripts/lib/telemetry/config.ts";
import postToolUseFixture from "./fixtures/telemetry/post-tool-use-bash.json";
import stopFixture from "./fixtures/telemetry/stop.json";

// ---------------------------------------------------------------------------
// Module-level shared SDK — one NodeSDK for all enabled-bridge tests.
// Initialized lazily on first use via getSharedSdk().
// ---------------------------------------------------------------------------

type TraceProviderWithDelegate = { _delegate?: { forceFlush?(): Promise<void> } };

const SHARED_EXPORTER = new InMemorySpanExporter();
let sharedSdk: BridgeSdk | null = null;

async function getSharedSdk(): Promise<{ sdk: BridgeSdk; exporter: InMemorySpanExporter }> {
  if (sharedSdk === null) {
    const prev = process.env["CREW_OTEL_ENABLED"];
    process.env["CREW_OTEL_ENABLED"] = "1";
    sharedSdk = await initBridge(makeEnabledConfig(), { exporter: SHARED_EXPORTER });
    if (prev === undefined) delete process.env["CREW_OTEL_ENABLED"];
    else process.env["CREW_OTEL_ENABLED"] = prev;
  }
  SHARED_EXPORTER.reset(); // clear spans from any previous test
  return { sdk: sharedSdk as BridgeSdk, exporter: SHARED_EXPORTER };
}

async function flushSpans(
  exporter: InMemorySpanExporter
): Promise<Array<{ name: string; attributes: Record<string, unknown> }>> {
  const tp = trace.getTracerProvider() as TraceProviderWithDelegate;
  await tp._delegate?.forceFlush?.();
  return exporter.getFinishedSpans() as unknown as Array<{
    name: string;
    attributes: Record<string, unknown>;
  }>;
}

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function makeEnabledConfig(overrides: Partial<TelemetryConfig> = {}): TelemetryConfig {
  return {
    enabled: true,
    endpoint: "http://localhost:3000/api/public/otel/v1/traces",
    auth: { header_name: "Authorization", header_value: "Basic test" },
    sample_rate: 1.0,
    scrub_pii: true,
    redact_paths: [],
    redact_attr_max_chars: 2048,
    max_queue_size: 2048,
    schedule_delay_ms: 50,
    export_timeout_ms: 5000,
    ...overrides
  };
}

function makeDisabledConfig(): TelemetryConfig {
  return makeEnabledConfig({ enabled: false });
}

// ---------------------------------------------------------------------------
// Case 1: Disabled bridge returns null, never loads heavy SDK
// ---------------------------------------------------------------------------

test("initBridge: disabled cfg returns null without CREW_OTEL_ENABLED", async () => {
  const cfg = makeDisabledConfig();
  const envBefore = process.env["CREW_OTEL_ENABLED"];
  delete process.env["CREW_OTEL_ENABLED"];
  try {
    const t0 = performance.now();
    const sdk = await initBridge(cfg);
    const elapsed = performance.now() - t0;
    assert.equal(sdk, null, "disabled bridge must return null");
    assert.ok(elapsed < 50, `initBridge disabled should be < 50ms, was ${elapsed.toFixed(1)}ms`);
  } finally {
    if (envBefore !== undefined) process.env["CREW_OTEL_ENABLED"] = envBefore;
  }
});

test("initBridge disabled-path: 100 iterations ≤ 500ms total (AC-6)", async () => {
  const cfg = makeDisabledConfig();
  const envBefore = process.env["CREW_OTEL_ENABLED"];
  delete process.env["CREW_OTEL_ENABLED"];
  try {
    const raw = JSON.stringify(postToolUseFixture);
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      await initBridge(cfg);
      parsePostToolUse(raw);
    }
    const elapsed = performance.now() - t0;
    assert.ok(
      elapsed <= 500,
      `100 disabled iterations must be ≤500ms, was ${elapsed.toFixed(1)}ms`
    );
  } finally {
    if (envBefore !== undefined) process.env["CREW_OTEL_ENABLED"] = envBefore;
  }
});

// ---------------------------------------------------------------------------
// Case 2: PostToolUse fixture round-trip → validated OTLP span (AC-5)
// ---------------------------------------------------------------------------

test("emitPostToolUseSpan: fixture round-trip produces tool_call span", async () => {
  const { sdk, exporter } = await getSharedSdk();
  const cfg = makeEnabledConfig();

  const payload = parsePostToolUse(JSON.stringify(postToolUseFixture));
  assert.ok(payload !== null, "fixture must parse successfully");

  emitPostToolUseSpan(sdk, payload, cfg);

  const spans = await flushSpans(exporter);
  assert.ok(spans.length >= 1, `expected at least 1 span, got ${spans.length}`);

  const toolCallSpan = spans.find((s) => s.name === "tool_call");
  assert.ok(toolCallSpan !== undefined, "expected span named 'tool_call'");
  assert.equal(toolCallSpan.attributes["tool.name"], "Bash");
  assert.equal(toolCallSpan.attributes["session.id"], "test-session-001");
  assert.ok("cwd" in toolCallSpan.attributes, "span must have cwd attr");
});

// ---------------------------------------------------------------------------
// Case 3: sampleSpan logic
// ---------------------------------------------------------------------------

test("sampleSpan: sample_rate=0.0 always false", () => {
  const cfg = makeEnabledConfig({ sample_rate: 0.0 });
  assert.equal(
    sampleSpan(cfg, () => 0.5),
    false
  );
  assert.equal(
    sampleSpan(cfg, () => 0.0),
    false
  );
});

test("sampleSpan: sample_rate=1.0 always true", () => {
  const cfg = makeEnabledConfig({ sample_rate: 1.0 });
  assert.equal(
    sampleSpan(cfg, () => 0.999),
    true
  );
  assert.equal(
    sampleSpan(cfg, () => 0.0),
    true
  );
});

test("sampleSpan: sample_rate=0.6 boundary", () => {
  const cfg = makeEnabledConfig({ sample_rate: 0.6 });
  assert.equal(
    sampleSpan(cfg, () => 0.3),
    true,
    "0.3 < 0.6 → true"
  );
  assert.equal(
    sampleSpan(cfg, () => 0.9),
    false,
    "0.9 >= 0.6 → false"
  );
});

// ---------------------------------------------------------------------------
// Case 4: Stop span exported via forceFlush within 1.5s (AC-7)
// ---------------------------------------------------------------------------

test("emitStopSpan: Stop span flushed via forceFlush within 1.5s", async () => {
  const { sdk, exporter } = await getSharedSdk();
  const cfg = makeEnabledConfig();

  const payload = parseStop(JSON.stringify(stopFixture));
  assert.ok(payload !== null, "stop fixture must parse");

  emitStopSpan(sdk, payload, cfg);

  // Production path: otel-stop.ts awaits sdk.shutdown() which drains a live
  // OTLP exporter. In tests we use forceFlush() to drain without clearing the
  // InMemorySpanExporter buffer. The 1.5s timeout is the AC-7 deadline.
  const t0 = performance.now();
  const spans = await Promise.race([
    flushSpans(exporter),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("forceFlush timed out after 1.5s")), 1500)
    )
  ]);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 1500, `flush must complete within 1.5s, took ${elapsed.toFixed(0)}ms`);

  const stopSpan = spans.find((s) => s.name === "session.stop");
  assert.ok(stopSpan !== undefined, "session.stop span must be flushed");
  assert.equal(stopSpan.attributes["session.id"], "test-session-001");
  assert.equal(stopSpan.attributes["reason"], "user_requested");
});
