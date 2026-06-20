#!/usr/bin/env bun
// PostToolUse OTel bridge shim for FEAT-165 SLICE-B.
// Opt-in: cfg.enabled=true AND CREW_OTEL_ENABLED=1.
// Always exits 0 — never blocks Claude.
import { logHookError } from "./hook-error.ts";
import { loadTelemetryConfig, bridgeEnabled } from "../scripts/lib/telemetry/config.ts";
import { parsePostToolUse } from "../scripts/lib/telemetry/hook-input.ts";

// otel-bridge is dynamically imported AFTER the bridgeEnabled gate so the
// disabled path never resolves @opentelemetry/* — v0.37.2 hotfix for plugin
// installs that lack node_modules in the plugin cache.
type OtelBridgeModule = typeof import("../scripts/lib/telemetry/otel-bridge.ts");

// Module-scope SDK cache — one process per hook invocation; this is a no-op cache
// but mirrors the pattern for future long-lived hook processes.
let cachedSdk: Awaited<ReturnType<OtelBridgeModule["initBridge"]>> = null;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const cfg = await loadTelemetryConfig();
  if (!bridgeEnabled(cfg)) return;

  const { initBridge, emitPostToolUseSpan, sampleSpan }: OtelBridgeModule = await import(
    "../scripts/lib/telemetry/otel-bridge.ts"
  );

  const payload = parsePostToolUse(raw);
  if (payload === null) return;

  if (!sampleSpan(cfg)) return;

  if (cachedSdk === null) {
    cachedSdk = await initBridge(cfg);
  }
  if (cachedSdk === null) return;

  emitPostToolUseSpan(cachedSdk, payload, cfg);

  // Await shutdown with 1000ms timeout so BatchSpanProcessor flushes.
  await Promise.race([
    cachedSdk.shutdown(),
    new Promise<void>((resolve) => setTimeout(resolve, 1000))
  ]);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "otel-post-tool-use", err);
  process.exit(0);
});
