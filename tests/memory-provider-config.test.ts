// tests/memory-provider-config.test.ts
// FEAT-188 S2 AC coverage: the unified config schema/parser + enabled x
// provider precedence rule. See docs/research/2026-07-06-memory-bridge-reconciliation.md
// section 4 for the bridge-collision this schema resolves.
import { test, expect } from "bun:test";
import { parseMemoryConfig, resolveEffectiveConfig } from "@astragenie/memory-provider";

test("parseMemoryConfig defaults to provider:none when no memory block is given", () => {
  const config = parseMemoryConfig(undefined);
  expect(config.provider).toBe("none");
  expect(config.enabled).toBe("auto");
  expect(config.dualWrite).toBe(false);
});

test("parseMemoryConfig accepts the live bridge's existing keys (enabled, recall.k, recall.timeoutMs, project)", () => {
  const config = parseMemoryConfig({
    enabled: "auto",
    project: "dev-team",
    recall: { k: 7, timeoutMs: 3000 }
  });
  expect(config.enabled).toBe("auto");
  expect(config.project).toBe("dev-team");
  expect(config.recall.k).toBe(7);
  expect(config.recall.timeoutMs).toBe(3000);
});

test("parseMemoryConfig rejects recall.topK as an unknown key", () => {
  expect(() =>
    parseMemoryConfig({
      recall: { topK: 5 }
    })
  ).toThrow();
});

test("parseMemoryConfig hard-errors on an unknown provider value", () => {
  expect(() => parseMemoryConfig({ provider: "redis" })).toThrow();
});

test("parseMemoryConfig accepts provider:file|astramem|none", () => {
  for (const provider of ["file", "astramem", "none"]) {
    expect(() => parseMemoryConfig({ provider })).not.toThrow();
  }
});

test("parseMemoryConfig parses and carries dualWrite", () => {
  const config = parseMemoryConfig({ provider: "astramem", dualWrite: true });
  expect(config.dualWrite).toBe(true);
});

test("parseMemoryConfig defaults dualWrite to false when absent", () => {
  const config = parseMemoryConfig({ provider: "astramem" });
  expect(config.dualWrite).toBe(false);
});

test("parseMemoryConfig accepts additive recall.maxTokens and capture.events", () => {
  const config = parseMemoryConfig({
    provider: "file",
    recall: { maxTokens: 400 },
    capture: { events: ["slice_close"] }
  });
  expect(config.recall.maxTokens).toBe(400);
  expect(config.capture.events).toEqual(["slice_close"]);
});

// --- enabled x provider precedence (AC-3) ---

test("precedence: provider:none forces effective-disabled regardless of enabled", () => {
  const config = parseMemoryConfig({ provider: "none", enabled: "auto" });
  const effective = resolveEffectiveConfig(config);
  expect(effective.captureEnabled).toBe(false);
  expect(effective.recallEnabled).toBe(false);
});

test("precedence: enabled:never disables emit/recall regardless of provider", () => {
  const config = parseMemoryConfig({ provider: "file", enabled: "never" });
  const effective = resolveEffectiveConfig(config);
  expect(effective.captureEnabled).toBe(false);
  expect(effective.recallEnabled).toBe(false);
});

test("precedence: provider:file|astramem with enabled:auto is active", () => {
  for (const provider of ["file", "astramem"]) {
    const config = parseMemoryConfig({ provider, enabled: "auto" });
    const effective = resolveEffectiveConfig(config);
    expect(effective.captureEnabled, `provider=${provider} should be capture-enabled`).toBe(true);
  }
});

test("precedence: recall.enabled:false disables recall only, capture stays enabled", () => {
  const config = parseMemoryConfig({
    provider: "file",
    enabled: "auto",
    recall: { enabled: false }
  });
  const effective = resolveEffectiveConfig(config);
  expect(effective.captureEnabled).toBe(true);
  expect(effective.recallEnabled).toBe(false);
});

test("effective config carries dualWrite through untouched", () => {
  const config = parseMemoryConfig({ provider: "astramem", dualWrite: true });
  const effective = resolveEffectiveConfig(config);
  expect(effective.dualWrite).toBe(true);
});
