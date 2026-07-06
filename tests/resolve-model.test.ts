// tests/resolve-model.test.ts
// FEAT-194 S2 — interactive dispatch model-tier resolution.
// Covers scripts/lib/models/resolve-model.ts, the dev-team-local mirror of
// runner-plugin's model-router (resolveModel / resolveShapeTier /
// resolveWaveDispatchModel in runner-plugin/src/scripts/lib/model-router.mts).
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveModelForPhase,
  resolveShapeTier,
  resolveDispatchModel,
  TRIVIAL_SHAPE_TIER
} from "../scripts/lib/models/resolve-model.ts";

// The committed .claude/loop.json routing block (loop.modelRouting), used
// verbatim so this test fails loudly if that config drifts out of sync with
// what S2 assumes.
const COMMITTED_ROUTING = {
  loop: {
    modelRouting: {
      architect: "opus",
      build: "sonnet",
      default: "sonnet"
    }
  }
};

test("resolveModelForPhase: build resolves to sonnet under the committed routing", () => {
  assert.equal(resolveModelForPhase("build", COMMITTED_ROUTING), "sonnet");
});

test("resolveModelForPhase: architect resolves to opus under the committed routing", () => {
  assert.equal(resolveModelForPhase("architect", COMMITTED_ROUTING), "opus");
});

test("resolveModelForPhase: falls back to opus when no modelRouting is configured", () => {
  assert.equal(resolveModelForPhase("build", null), "opus");
  assert.equal(resolveModelForPhase("build", {}), "opus");
  assert.equal(resolveModelForPhase("build", { loop: {} }), "opus");
});

test("resolveModelForPhase: falls back to routing.default when the phase key is absent", () => {
  const config = { loop: { modelRouting: { default: "sonnet" } } };
  assert.equal(resolveModelForPhase("validate", config), "sonnet");
});

test("TRIVIAL_SHAPE_TIER: routes every trivial shape to sonnet", () => {
  assert.equal(TRIVIAL_SHAPE_TIER["doc-update"], "sonnet");
  assert.equal(TRIVIAL_SHAPE_TIER["config-tweak"], "sonnet");
  assert.equal(TRIVIAL_SHAPE_TIER["test-only"], "sonnet");
  assert.equal(TRIVIAL_SHAPE_TIER["single-module-edit"], "sonnet");
});

test("resolveShapeTier: returns sonnet for a trivial shape regardless of config", () => {
  assert.equal(resolveShapeTier("doc-update"), "sonnet");
});

test("resolveShapeTier: returns null for a non-trivial or unknown shape", () => {
  assert.equal(resolveShapeTier("none"), null);
  assert.equal(resolveShapeTier("unknown-shape"), null);
  assert.equal(resolveShapeTier(null), null);
  assert.equal(resolveShapeTier(undefined), null);
});

test("resolveDispatchModel: trivial shape wins even when phase routing points elsewhere", () => {
  const config = { loop: { modelRouting: { build: "opus", default: "opus" } } };
  assert.equal(resolveDispatchModel("build", "doc-update", config), "sonnet");
});

test("resolveDispatchModel: falls through to phase-based routing for a non-trivial shape", () => {
  assert.equal(resolveDispatchModel("build", "none", COMMITTED_ROUTING), "sonnet");
  assert.equal(resolveDispatchModel("architect", "none", COMMITTED_ROUTING), "opus");
});

test("resolveDispatchModel: falls back to opus with no shape and no config", () => {
  assert.equal(resolveDispatchModel("build", null, null), "opus");
});
