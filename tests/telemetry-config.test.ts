/**
 * Tests for scripts/lib/telemetry/config.ts
 * AC-3: config loader, env-var resolution, two-key opt-in semantics.
 */
import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(cfg.enabled, false, "enabled must default false");
  assert.equal(cfg.endpoint, "http://localhost:3000/api/public/otel/v1/traces");
  assert.equal(cfg.scrub_pii, true);
  assert.equal(cfg.sample_rate, 1.0);
  assert.equal(cfg.redact_attr_max_chars, 2048);
  assert.equal(cfg.max_queue_size, 2048);
  assert.equal(cfg.schedule_delay_ms, 5000);
  assert.equal(cfg.export_timeout_ms, 30000);
  assert.ok(Array.isArray(cfg.redact_paths));
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
    assert.equal(cfg.enabled, true);
    assert.equal(cfg.endpoint, "https://cloud.langfuse.com/api/public/otel/v1/traces");
    assert.equal(cfg.sample_rate, 0.5);
    // Unspecified fields fall back to defaults
    assert.equal(cfg.scrub_pii, true);
    assert.equal(cfg.redact_attr_max_chars, 2048);
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
  assert.equal(resolved, "Basic abc123");
});

test("resolveAuthHeader: missing env var returns literal unchanged", () => {
  const resolved = resolveAuthHeader("Basic ${LANGFUSE_AUTH_B64}", {});
  assert.equal(resolved, "Basic ${LANGFUSE_AUTH_B64}");
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
  assert.equal(bridgeEnabled(enabledCfg, { CREW_OTEL_ENABLED: "1" }), true);
  // cfg.enabled=true but no env var → false
  assert.equal(bridgeEnabled(enabledCfg, {}), false);
  // cfg.enabled=false with env var → false
  assert.equal(bridgeEnabled(disabledCfg, { CREW_OTEL_ENABLED: "1" }), false);
  // Neither → false
  assert.equal(bridgeEnabled(disabledCfg, {}), false);
});
