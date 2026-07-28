// tests/resolve-model.test.ts
// FEAT-194 S2 — interactive dispatch model-tier resolution.
// Covers scripts/lib/models/resolve-model.ts, the dev-team-local mirror of
// runner-plugin's model-router (resolveModel / resolveShapeTier /
// resolveWaveDispatchModel in runner-plugin/src/scripts/lib/model-router.mts).
import { test, expect } from "bun:test";
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
  expect(resolveModelForPhase("build", COMMITTED_ROUTING)).toBe("sonnet");
});

test("resolveModelForPhase: architect resolves to opus under the committed routing", () => {
  expect(resolveModelForPhase("architect", COMMITTED_ROUTING)).toBe("opus");
});

test("resolveModelForPhase: falls back to opus when no modelRouting is configured", () => {
  expect(resolveModelForPhase("build", null)).toBe("opus");
  expect(resolveModelForPhase("build", {})).toBe("opus");
  expect(resolveModelForPhase("build", { loop: {} })).toBe("opus");
});

test("resolveModelForPhase: falls back to routing.default when the phase key is absent", () => {
  const config = { loop: { modelRouting: { default: "sonnet" } } };
  expect(resolveModelForPhase("validate", config)).toBe("sonnet");
});

test("TRIVIAL_SHAPE_TIER: routes every trivial shape to sonnet", () => {
  expect(TRIVIAL_SHAPE_TIER["doc-update"]).toBe("sonnet");
  expect(TRIVIAL_SHAPE_TIER["config-tweak"]).toBe("sonnet");
  expect(TRIVIAL_SHAPE_TIER["test-only"]).toBe("sonnet");
  expect(TRIVIAL_SHAPE_TIER["single-module-edit"]).toBe("sonnet");
});

test("resolveShapeTier: returns sonnet for a trivial shape regardless of config", () => {
  expect(resolveShapeTier("doc-update")).toBe("sonnet");
});

test("resolveShapeTier: returns null for a non-trivial or unknown shape", () => {
  expect(resolveShapeTier("none")).toBe(null);
  expect(resolveShapeTier("unknown-shape")).toBe(null);
  expect(resolveShapeTier(null)).toBe(null);
  expect(resolveShapeTier(undefined)).toBe(null);
});

test("resolveDispatchModel: trivial shape wins even when phase routing points elsewhere", () => {
  const config = { loop: { modelRouting: { build: "opus", default: "opus" } } };
  expect(resolveDispatchModel("build", "doc-update", config)).toBe("sonnet");
});

test("resolveDispatchModel: falls through to phase-based routing for a non-trivial shape", () => {
  expect(resolveDispatchModel("build", "none", COMMITTED_ROUTING)).toBe("sonnet");
  expect(resolveDispatchModel("architect", "none", COMMITTED_ROUTING)).toBe("opus");
});

test("resolveDispatchModel: falls back to opus with no shape and no config", () => {
  expect(resolveDispatchModel("build", null, null)).toBe("opus");
});

// FEAT-194 S1 — crew.json features["model-routing"].enabled toggle. The
// crew.ts CLI handler resolves this boolean via features-service.ts's
// isEnabled() and passes it in as the 4th arg; these tests exercise the
// pure resolution behavior directly.
test("resolveDispatchModel: toggle omitted (default) behaves exactly as before — routing on", () => {
  expect(resolveDispatchModel("build", null, COMMITTED_ROUTING)).toBe("sonnet");
  expect(resolveDispatchModel("architect", null, COMMITTED_ROUTING)).toBe("opus");
});

test("resolveDispatchModel: toggle explicitly true — routing on, same as default", () => {
  expect(resolveDispatchModel("build", null, COMMITTED_ROUTING, true)).toBe("sonnet");
});

test("resolveDispatchModel: toggle false — returns null (omit model:, agent frontmatter governs)", () => {
  expect(resolveDispatchModel("build", null, COMMITTED_ROUTING, false)).toBe(null);
  expect(resolveDispatchModel("architect", null, COMMITTED_ROUTING, false)).toBe(null);
});

test("resolveDispatchModel: toggle false — bypasses the trivial-shape override too", () => {
  expect(resolveDispatchModel("build", "doc-update", COMMITTED_ROUTING, false)).toBe(null);
});

test("resolveDispatchModel: loop.modelRouting.enabled false — returns null even with toggle on", () => {
  const disabledConfig = {
    loop: { modelRouting: { enabled: false, build: "sonnet", default: "sonnet" } }
  };
  expect(resolveDispatchModel("build", null, disabledConfig)).toBe(null);
  expect(resolveDispatchModel("build", "doc-update", disabledConfig)).toBe(null);
});
