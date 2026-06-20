/**
 * OTel bridge for FEAT-165 SLICE-B.
 *
 * Converts Claude Code hook payloads into OTLP spans and exports them via
 * BatchSpanProcessor + OTLP HTTP exporter to a self-hosted Langfuse.
 *
 * All @opentelemetry/* packages are lazy-imported inside initBridge so the
 * disabled path never touches the OTel module graph AND a consumer repo
 * without the runtime deps installed never crashes on plugin load (v0.37.2
 * hotfix — prior versions static-imported @opentelemetry/api at top level,
 * which ENOENT'd in plugin-cache installs that lack node_modules).
 *
 * The api module is cached in `cachedOtelApi` after first init so the
 * synchronous emit* functions can call into it without awaiting an import.
 * If init never ran (or failed to load deps), emit* no-ops.
 *
 * Every emit* is wrapped in try/catch — telemetry crash must never propagate.
 */
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { bridgeEnabled, resolveAuthHeader, type TelemetryConfig } from "./config.ts";
import type { PostToolUseHookInput, StopHookInput, SubagentStopHookInput } from "./hook-input.ts";
import { scrubAttrs } from "./scrub.ts";

// Cached @opentelemetry/api module — populated on first successful initBridge.
// emit* functions read from this; null means bridge never initialized.
let cachedOtelApi: typeof import("@opentelemetry/api") | null = null;

// One-shot stderr guard so a missing-deps warning fires at most once per process.
let warnedMissingDeps = false;

function warnMissingDeps(err: unknown): void {
  if (warnedMissingDeps) return;
  warnedMissingDeps = true;
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `crew-otel: telemetry deps not installed, bridge disabled. ` +
      `Run \`npm i @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/sdk-trace-base @opentelemetry/resources\` ` +
      `in this repo to enable. (${msg})\n`
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Opaque SDK handle — avoids importing NodeSDK type at module level (lazy-import).
export interface BridgeSdk {
  start(): void;
  shutdown(): Promise<void>;
}

// Internal type used by tests to inject an in-memory exporter.
export interface BridgeInitOptions {
  exporter?: SpanExporter;
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

export function sampleSpan(cfg: TelemetryConfig, rng: () => number = Math.random): boolean {
  return rng() < cfg.sample_rate;
}

// ---------------------------------------------------------------------------
// Bridge init (lazy SDK import for heavy packages)
// ---------------------------------------------------------------------------

export async function initBridge(
  cfg: TelemetryConfig,
  opts?: BridgeInitOptions
): Promise<BridgeSdk | null> {
  if (!bridgeEnabled(cfg)) return null;

  // Lazy import everything — including @opentelemetry/api. Disabled path AND
  // missing-deps path both stay quiet. ENOENT here = deps not installed in
  // consumer repo → warn once + return null. Hook still exits 0.
  let api: typeof import("@opentelemetry/api");
  let NodeSDK: typeof import("@opentelemetry/sdk-node").NodeSDK;
  let OTLPTraceExporter: typeof import("@opentelemetry/exporter-trace-otlp-http").OTLPTraceExporter;
  let BatchSpanProcessor: typeof import("@opentelemetry/sdk-trace-base").BatchSpanProcessor;
  let Resource: typeof import("@opentelemetry/resources").Resource;
  try {
    api = await import("@opentelemetry/api");
    ({ NodeSDK } = await import("@opentelemetry/sdk-node"));
    ({ OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http"));
    ({ BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base"));
    ({ Resource } = await import("@opentelemetry/resources"));
  } catch (err) {
    warnMissingDeps(err);
    return null;
  }

  cachedOtelApi = api;

  let pkgVersion = "0.0.0";
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const pkg = req("../../package.json") as { version: string };
    pkgVersion = pkg.version;
  } catch {
    // ignore
  }

  const exporter: SpanExporter =
    opts?.exporter ??
    new OTLPTraceExporter({
      url: cfg.endpoint,
      headers: {
        [cfg.auth.header_name]: resolveAuthHeader(cfg.auth.header_value)
      }
    });

  const processor = new BatchSpanProcessor(exporter, {
    maxQueueSize: cfg.max_queue_size,
    scheduledDelayMillis: cfg.schedule_delay_ms,
    exportTimeoutMillis: cfg.export_timeout_ms
  });

  // Resource is typed differently across the sdk-node bundle vs top-level package.
  // Cast to any to satisfy NodeSDKConfiguration without an incompatible version import.
  const resource = new Resource({
    "service.name": "crew-plugin",
    "service.version": pkgVersion
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk = new NodeSDK({ resource: resource as any, spanProcessors: [processor] });
  sdk.start();
  return sdk as unknown as BridgeSdk;
}

// ---------------------------------------------------------------------------
// Span emitters
// ---------------------------------------------------------------------------

function flattenToolInput(
  toolInput: Record<string, unknown>,
  cfg: TelemetryConfig
): Record<string, string | number | boolean> {
  const raw: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(toolInput)) {
    const key = `tool_input.${k}`;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      raw[key] = v;
    } else if (v !== null && v !== undefined) {
      raw[key] = String(v);
    }
  }
  return scrubAttrs(raw, cfg);
}

export function emitPostToolUseSpan(
  _sdk: BridgeSdk,
  payload: PostToolUseHookInput,
  cfg: TelemetryConfig
): void {
  if (cachedOtelApi === null) return; // initBridge never succeeded — silently skip
  try {
    const tracer = cachedOtelApi.trace.getTracer("crew-plugin");
    const baseAttrs: Record<string, string | number | boolean> = {
      "tool.name": payload.tool_name,
      "session.id": payload.session_id,
      cwd: payload.cwd ?? "unknown"
    };
    const toolInputAttrs = flattenToolInput(payload.tool_input, cfg);
    const attrs = scrubAttrs({ ...baseAttrs, ...toolInputAttrs }, cfg);
    const span = tracer.startSpan("tool_call", {
      kind: cachedOtelApi.SpanKind.INTERNAL,
      attributes: attrs
    });
    span.end();
  } catch {
    // swallow — telemetry crash must never propagate
  }
}

export function emitStopSpan(_sdk: BridgeSdk, payload: StopHookInput, cfg: TelemetryConfig): void {
  if (cachedOtelApi === null) return;
  try {
    const tracer = cachedOtelApi.trace.getTracer("crew-plugin");
    const raw: Record<string, string | number | boolean> = {
      "session.id": payload.session_id,
      reason: payload.reason ?? "unknown"
    };
    const attrs = scrubAttrs(raw, cfg);
    const span = tracer.startSpan("session.stop", {
      kind: cachedOtelApi.SpanKind.INTERNAL,
      attributes: attrs
    });
    span.end();
    // NOTE: shutdown is intentionally NOT called here. The otel-stop.ts hook
    // entry calls sdk.shutdown() after emitStopSpan so it can await the flush
    // with a timeout race. Calling it here would cause a double-shutdown.
  } catch {
    // swallow
  }
}

export function emitSubagentStopSpan(
  _sdk: BridgeSdk,
  payload: SubagentStopHookInput,
  cfg: TelemetryConfig
): void {
  if (cachedOtelApi === null) return;
  try {
    const tracer = cachedOtelApi.trace.getTracer("crew-plugin");
    const raw: Record<string, string | number | boolean> = {
      agent: payload.agent_name ?? "unknown",
      "session.id": payload.session_id
    };
    // last_assistant_message is in deny-list — scrubAttrs will replace it with <redacted:key>
    if (payload.last_assistant_message !== undefined) {
      raw["last_assistant_message"] = payload.last_assistant_message;
    }
    const attrs = scrubAttrs(raw, cfg);
    const span = tracer.startSpan("agent.dispatch", {
      kind: cachedOtelApi.SpanKind.INTERNAL,
      attributes: attrs
    });
    span.end();
  } catch {
    // swallow
  }
}
