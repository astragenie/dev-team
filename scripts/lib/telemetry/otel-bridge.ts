/**
 * OTel bridge for FEAT-165 SLICE-B.
 *
 * Converts Claude Code hook payloads into OTLP spans and exports them via
 * BatchSpanProcessor + OTLP HTTP exporter to a self-hosted Langfuse.
 *
 * @opentelemetry/api is imported at module level — it is the global singleton
 * registry (~30 kB, no heavy deps). The heavy SDK packages (sdk-node,
 * exporter-trace-otlp-http) are lazy-imported inside initBridge so the
 * disabled path never touches the OTel module graph.
 *
 * Every emit* is wrapped in try/catch — telemetry crash must never propagate.
 */
import { trace, SpanKind } from "@opentelemetry/api";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import { bridgeEnabled, resolveAuthHeader, type TelemetryConfig } from "./config.ts";
import type { PostToolUseHookInput, StopHookInput, SubagentStopHookInput } from "./hook-input.ts";
import { scrubAttrs } from "./scrub.ts";

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

  // Lazy import — disabled path never loads these heavy packages.
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const { BatchSpanProcessor } = await import("@opentelemetry/sdk-trace-base");

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
  const { Resource } = await import("@opentelemetry/resources");
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
  try {
    const tracer = trace.getTracer("crew-plugin");
    const baseAttrs: Record<string, string | number | boolean> = {
      "tool.name": payload.tool_name,
      "session.id": payload.session_id,
      cwd: payload.cwd ?? "unknown"
    };
    const toolInputAttrs = flattenToolInput(payload.tool_input, cfg);
    const attrs = scrubAttrs({ ...baseAttrs, ...toolInputAttrs }, cfg);
    const span = tracer.startSpan("tool_call", { kind: SpanKind.INTERNAL, attributes: attrs });
    span.end();
  } catch {
    // swallow — telemetry crash must never propagate
  }
}

export function emitStopSpan(_sdk: BridgeSdk, payload: StopHookInput, cfg: TelemetryConfig): void {
  try {
    const tracer = trace.getTracer("crew-plugin");
    const raw: Record<string, string | number | boolean> = {
      "session.id": payload.session_id,
      reason: payload.reason ?? "unknown"
    };
    const attrs = scrubAttrs(raw, cfg);
    const span = tracer.startSpan("session.stop", { kind: SpanKind.INTERNAL, attributes: attrs });
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
  try {
    const tracer = trace.getTracer("crew-plugin");
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
      kind: SpanKind.INTERNAL,
      attributes: attrs
    });
    span.end();
  } catch {
    // swallow
  }
}
