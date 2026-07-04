#!/usr/bin/env bun
// SubagentStop OTel bridge shim for FEAT-165 SLICE-B.
// Opt-in: cfg.enabled=true AND CREW_OTEL_ENABLED=1, AND crew.json
// features["otel-telemetry"].enabled !== false (default true).
// Awaits sdk.shutdown() with 1000ms timeout so BatchSpanProcessor flushes —
// hook process exits immediately after main() resolves; without flush the
// BatchSpanProcessor's schedule_delay_ms buffer is lost (live-dogfood bug
// discovered post-v0.37.0).
// Always exits 0 — never blocks Claude.
import { logHookError } from "./hook-error.ts";
import { loadTelemetryConfig, bridgeEnabled } from "../scripts/lib/telemetry/config.ts";
import { parseSubagentStop } from "../scripts/lib/telemetry/hook-input.ts";
import { isFeatureEnabledLite } from "../scripts/lib/telemetry/feature-flag-lite.ts";

// otel-bridge is dynamically imported AFTER the bridgeEnabled gate so the
// disabled path never resolves @opentelemetry/* — v0.37.2 hotfix for plugin
// installs that lack node_modules in the plugin cache.
type OtelBridgeModule = typeof import("../scripts/lib/telemetry/otel-bridge.ts");

let cachedSdk: Awaited<ReturnType<OtelBridgeModule["initBridge"]>> = null;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const payload = parseSubagentStop(raw);
  if (payload === null) return;

  if (!(await isFeatureEnabledLite("otel-telemetry", payload.cwd ?? process.cwd()))) return;
  const cfg = await loadTelemetryConfig();
  if (!bridgeEnabled(cfg)) return;

  const { initBridge, emitSubagentStopSpan, sampleSpan }: OtelBridgeModule = await import(
    "../scripts/lib/telemetry/otel-bridge.ts"
  );

  if (!sampleSpan(cfg)) return;

  if (cachedSdk === null) {
    cachedSdk = await initBridge(cfg);
  }
  if (cachedSdk === null) return;

  emitSubagentStopSpan(cachedSdk, payload, cfg);

  // Await shutdown with 1000ms timeout so BatchSpanProcessor flushes.
  await Promise.race([
    cachedSdk.shutdown(),
    new Promise<void>((resolve) => setTimeout(resolve, 1000))
  ]);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "otel-subagent-stop", err);
  process.exit(0);
});
