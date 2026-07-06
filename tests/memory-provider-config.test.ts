// tests/memory-provider-config.test.ts
// FEAT-188 S2 AC coverage: the unified config schema/parser + enabled x
// provider precedence rule. See docs/research/2026-07-06-memory-bridge-reconciliation.md
// section 4 for the bridge-collision this schema resolves.
import test from "node:test";
import assert from "node:assert/strict";
import { parseMemoryConfig, resolveEffectiveConfig } from "../scripts/lib/memory/config.ts";

test("parseMemoryConfig defaults to provider:none when no memory block is given", () => {
  const config = parseMemoryConfig(undefined);
  assert.equal(config.provider, "none");
  assert.equal(config.enabled, "auto");
  assert.equal(config.dualWrite, false);
});

test("parseMemoryConfig accepts the live bridge's existing keys (enabled, recall.k, recall.timeoutMs, project)", () => {
  const config = parseMemoryConfig({
    enabled: "auto",
    project: "dev-team",
    recall: { k: 7, timeoutMs: 3000 }
  });
  assert.equal(config.enabled, "auto");
  assert.equal(config.project, "dev-team");
  assert.equal(config.recall.k, 7);
  assert.equal(config.recall.timeoutMs, 3000);
});

test("parseMemoryConfig rejects recall.topK as an unknown key", () => {
  assert.throws(() =>
    parseMemoryConfig({
      recall: { topK: 5 }
    })
  );
});

test("parseMemoryConfig hard-errors on an unknown provider value", () => {
  assert.throws(() => parseMemoryConfig({ provider: "redis" }));
});

test("parseMemoryConfig accepts provider:file|astramem|none", () => {
  for (const provider of ["file", "astramem", "none"]) {
    assert.doesNotThrow(() => parseMemoryConfig({ provider }));
  }
});

test("parseMemoryConfig parses and carries dualWrite", () => {
  const config = parseMemoryConfig({ provider: "astramem", dualWrite: true });
  assert.equal(config.dualWrite, true);
});

test("parseMemoryConfig defaults dualWrite to false when absent", () => {
  const config = parseMemoryConfig({ provider: "astramem" });
  assert.equal(config.dualWrite, false);
});

test("parseMemoryConfig accepts additive recall.maxTokens and capture.events", () => {
  const config = parseMemoryConfig({
    provider: "file",
    recall: { maxTokens: 400 },
    capture: { events: ["slice_close"] }
  });
  assert.equal(config.recall.maxTokens, 400);
  assert.deepEqual(config.capture.events, ["slice_close"]);
});

// --- enabled x provider precedence (AC-3) ---

test("precedence: provider:none forces effective-disabled regardless of enabled", () => {
  const config = parseMemoryConfig({ provider: "none", enabled: "auto" });
  const effective = resolveEffectiveConfig(config);
  assert.equal(effective.captureEnabled, false);
  assert.equal(effective.recallEnabled, false);
});

test("precedence: enabled:never disables emit/recall regardless of provider", () => {
  const config = parseMemoryConfig({ provider: "file", enabled: "never" });
  const effective = resolveEffectiveConfig(config);
  assert.equal(effective.captureEnabled, false);
  assert.equal(effective.recallEnabled, false);
});

test("precedence: provider:file|astramem with enabled:auto is active", () => {
  for (const provider of ["file", "astramem"]) {
    const config = parseMemoryConfig({ provider, enabled: "auto" });
    const effective = resolveEffectiveConfig(config);
    assert.equal(effective.captureEnabled, true, `provider=${provider} should be capture-enabled`);
  }
});

test("precedence: recall.enabled:false disables recall only, capture stays enabled", () => {
  const config = parseMemoryConfig({
    provider: "file",
    enabled: "auto",
    recall: { enabled: false }
  });
  const effective = resolveEffectiveConfig(config);
  assert.equal(effective.captureEnabled, true);
  assert.equal(effective.recallEnabled, false);
});

test("effective config carries dualWrite through untouched", () => {
  const config = parseMemoryConfig({ provider: "astramem", dualWrite: true });
  const effective = resolveEffectiveConfig(config);
  assert.equal(effective.dualWrite, true);
});
