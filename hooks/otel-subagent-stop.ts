#!/usr/bin/env bun
// SubagentStop OTel bridge shim for FEAT-165 SLICE-B.
// Opt-in: cfg.enabled=true AND CREW_OTEL_ENABLED=1.
// No shutdown — subagent stop is not session end.
// Always exits 0 — never blocks Claude.
import { logHookError } from "./hook-error.ts";
import { loadTelemetryConfig, bridgeEnabled } from "../scripts/lib/telemetry/config.ts";
import { parseSubagentStop } from "../scripts/lib/telemetry/hook-input.ts";
import { initBridge, emitSubagentStopSpan, sampleSpan } from "../scripts/lib/telemetry/otel-bridge.ts";

let cachedSdk: Awaited<ReturnType<typeof initBridge>> = null;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const cfg = await loadTelemetryConfig();
  if (!bridgeEnabled(cfg)) return;

  const payload = parseSubagentStop(raw);
  if (payload === null) return;

  if (!sampleSpan(cfg)) return;

  if (cachedSdk === null) {
    cachedSdk = await initBridge(cfg);
  }
  if (cachedSdk === null) return;

  emitSubagentStopSpan(cachedSdk, payload, cfg);
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "otel-subagent-stop", err);
  process.exit(0);
});
