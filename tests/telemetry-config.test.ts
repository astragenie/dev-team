/**
 * Tests for scripts/lib/telemetry/config.ts
 * AC-3: config loader, env-var resolution, two-key opt-in semantics.
 */
import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadTelemetryConfig,
  resolveAuthHeader,
  bridgeEnabled
} from "../scripts/lib/telemetry/config.ts";

// ---------------------------------------------------------------------------
// Case 1: Defaults when file is absent
// ---------------------------------------------------------------------------

test("loadTelemetryConfig: defaults when file absent", async () => {
  const nonexistent = path.join(os.tmpdir(), `telemetry-absent-${Date.now()}.yaml`);
  const cfg = await loadTelemetryConfig(nonexistent);
  expect(cfg.enabled, "enabled must default false").toBe(false);
  expect(cfg.endpoint).toBe("http://localhost:3000/api/public/otel/v1/traces");
  expect(cfg.scrub_pii).toBe(true);
  expect(cfg.sample_rate).toBe(1.0);
  expect(cfg.redact_attr_max_chars).toBe(2048);
  expect(cfg.max_queue_size).toBe(2048);
  expect(cfg.schedule_delay_ms).toBe(5000);
  expect(cfg.export_timeout_ms).toBe(30000);
  expect(Array.isArray(cfg.redact_paths)).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Case 2: YAML round-trip with overrides
// ---------------------------------------------------------------------------

test("loadTelemetryConfig: YAML round-trip with overrides", async () => {
  const tmpFile = path.join(os.tmpdir(), `telemetry-roundtrip-${Date.now()}.yaml`);
  const yaml = [
    "enabled: true",
    "endpoint: https://cloud.langfuse.com/api/public/otel/v1/traces",
    "sample_rate: 0.5"
  ].join("\n");
  await fs.writeFile(tmpFile, yaml, "utf8");
  try {
    const cfg = await loadTelemetryConfig(tmpFile);
    expect(cfg.enabled).toBe(true);
    expect(cfg.endpoint).toBe("https://cloud.langfuse.com/api/public/otel/v1/traces");
    expect(cfg.sample_rate).toBe(0.5);
    // Unspecified fields fall back to defaults
    expect(cfg.scrub_pii).toBe(true);
    expect(cfg.redact_attr_max_chars).toBe(2048);
  } finally {
    await fs.unlink(tmpFile).catch(() => undefined);
  }
});

// ---------------------------------------------------------------------------
// Case 3: Env var resolution in resolveAuthHeader
// ---------------------------------------------------------------------------

test("resolveAuthHeader: resolves ${VAR} tokens from env", () => {
  const resolved = resolveAuthHeader("Basic ${LANGFUSE_AUTH_B64}", {
    LANGFUSE_AUTH_B64: "abc123"
  });
  expect(resolved).toBe("Basic abc123");
});

test("resolveAuthHeader: missing env var returns literal unchanged", () => {
  const resolved = resolveAuthHeader("Basic ${LANGFUSE_AUTH_B64}", {});
  expect(resolved).toBe("Basic ${LANGFUSE_AUTH_B64}");
});

// ---------------------------------------------------------------------------
// Case 4: Two-key opt-in semantics
// ---------------------------------------------------------------------------

test("bridgeEnabled: both keys required for true", () => {
  const enabledCfg = {
    enabled: true,
    endpoint: "http://localhost:3000/api/public/otel/v1/traces",
    auth: { header_name: "Authorization", header_value: "Basic x" },
    sample_rate: 1.0,
    scrub_pii: true,
    redact_paths: [],
    redact_attr_max_chars: 2048,
    max_queue_size: 2048,
    schedule_delay_ms: 5000,
    export_timeout_ms: 30000
  };
  const disabledCfg = { ...enabledCfg, enabled: false };

  // Both keys set → true
  expect(bridgeEnabled(enabledCfg, { CREW_OTEL_ENABLED: "1" })).toBe(true);
  // cfg.enabled=true but no env var → false
  expect(bridgeEnabled(enabledCfg, {})).toBe(false);
  // cfg.enabled=false with env var → false
  expect(bridgeEnabled(disabledCfg, { CREW_OTEL_ENABLED: "1" })).toBe(false);
  // Neither → false
  expect(bridgeEnabled(disabledCfg, {})).toBe(false);
});
