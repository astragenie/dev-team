#!/usr/bin/env bun
// Stop OTel bridge shim for FEAT-165 SLICE-B.
// Opt-in: cfg.enabled=true AND CREW_OTEL_ENABLED=1.
// Awaits sdk.shutdown() with 1000ms timeout so BatchSpanProcessor flushes.
// Always exits 0 — never blocks Claude.
import { logHookError } from "./hook-error.ts";
import { loadTelemetryConfig, bridgeEnabled } from "../scripts/lib/telemetry/config.ts";
import { parseStop } from "../scripts/lib/telemetry/hook-input.ts";

// otel-bridge is dynamically imported AFTER the bridgeEnabled gate so the
// disabled path never resolves @opentelemetry/* — v0.37.2 hotfix for plugin
// installs that lack node_modules in the plugin cache.
type OtelBridgeModule = typeof import("../scripts/lib/telemetry/otel-bridge.ts");

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const cfg = await loadTelemetryConfig();
  if (!bridgeEnabled(cfg)) return;

  const { initBridge, emitStopSpan, sampleSpan }: OtelBridgeModule = await import(
    "../scripts/lib/telemetry/otel-bridge.ts"
  );

  const payload = parseStop(raw);
  if (payload === null) return;

  if (!sampleSpan(cfg)) return;

  const sdk = await initBridge(cfg);
  if (sdk === null) return;

  emitStopSpan(sdk, payload, cfg);

  // Await shutdown with 1000ms timeout so BatchSpanProcessor flushes.
  await Promise.race([
    sdk.shutdown(),
    new Promise<void>((resolve) => setTimeout(resolve, 1000))
  ]);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "otel-stop", err);
  process.exit(0);
});
