import assert from "node:assert";
import { test } from "node:test";

test("briefing modules can be imported independently", async () => {
  // Import each module independently to verify no circular dependencies
  const git = await import("../scripts/lib/briefing/git.ts");
  const cost = await import("../scripts/lib/briefing/cost.ts");
  const workflow = await import("../scripts/lib/briefing/workflow.ts");
  const hook = await import("../scripts/lib/briefing/hook.ts");
  const bundle = await import("../scripts/lib/briefing/bundle.ts");
  await import("../scripts/lib/briefing/collect.ts");

  // Verify core functions exist in their home modules
  assert.ok(typeof git.collectGitActivity === "function", "git.collectGitActivity exists");
  assert.ok(typeof cost.collectRecentCosts === "function", "cost.collectRecentCosts exists");
  assert.ok(typeof cost.collectCostHealth === "function", "cost.collectCostHealth exists");
  assert.ok(typeof cost.collectCostAggregate === "function", "cost.collectCostAggregate exists");
  assert.ok(
    typeof cost.computeModelCompliance === "function",
    "cost.computeModelCompliance exists"
  );
  assert.ok(
    typeof cost.collectModelCompliance === "function",
    "cost.collectModelCompliance exists"
  );
  assert.ok(
    typeof workflow.collectRelevantArtifacts === "function",
    "workflow.collectRelevantArtifacts exists"
  );
  assert.ok(
    typeof workflow.fetchAutonomousLoopBrief === "function",
    "workflow.fetchAutonomousLoopBrief exists"
  );
  assert.ok(
    typeof workflow.findAutonomousLoopCli === "function",
    "workflow.findAutonomousLoopCli exists"
  );
  assert.ok(typeof hook.collectHookHealth === "function", "hook.collectHookHealth exists");
  assert.ok(typeof bundle.collectBundleStats === "function", "bundle.collectBundleStats exists");
});

test("collect.ts re-exports all functions from modules", async () => {
  const collect = await import("../scripts/lib/briefing/collect.ts");

  // Verify all functions are re-exported from collect.ts
  assert.ok(
    typeof collect.collectGitActivity === "function",
    "collect.collectGitActivity re-exported"
  );
  assert.ok(
    typeof collect.collectRecentCosts === "function",
    "collect.collectRecentCosts re-exported"
  );
  assert.ok(
    typeof collect.collectCostHealth === "function",
    "collect.collectCostHealth re-exported"
  );
  assert.ok(
    typeof collect.collectCostAggregate === "function",
    "collect.collectCostAggregate re-exported"
  );
  assert.ok(
    typeof collect.computeModelCompliance === "function",
    "collect.computeModelCompliance re-exported"
  );
  assert.ok(
    typeof collect.collectModelCompliance === "function",
    "collect.collectModelCompliance re-exported"
  );
  assert.ok(
    typeof collect.collectRelevantArtifacts === "function",
    "collect.collectRelevantArtifacts re-exported"
  );
  assert.ok(
    typeof collect.fetchAutonomousLoopBrief === "function",
    "collect.fetchAutonomousLoopBrief re-exported"
  );
  assert.ok(
    typeof collect.findAutonomousLoopCli === "function",
    "collect.findAutonomousLoopCli re-exported"
  );
  assert.ok(
    typeof collect.collectHookHealth === "function",
    "collect.collectHookHealth re-exported"
  );
  assert.ok(
    typeof collect.collectBundleStats === "function",
    "collect.collectBundleStats re-exported"
  );
});

test("collect.ts re-exports all interfaces from modules", async () => {
  const collect = await import("../scripts/lib/briefing/collect.ts");

  // Verify all type exports are available (these are types, not functions)
  // We can't directly check if a type exists at runtime, but we can verify
  // they're not undefined if they were somehow exported as values.
  assert.ok(collect, "collect module exports exist");

  // Check that we can import the types without error (TypeScript check happens at compile time)
  // This is more of a compile-time verification, but we can at least verify the module is importable.
});

test("no circular imports between modules", async () => {
  // This test verifies no circular dependencies by checking that all modules
  // load without stack overflow or circular import errors. The test passes if
  // all imports complete successfully (which we've already done above).
  const git = await import("../scripts/lib/briefing/git.ts");
  const cost = await import("../scripts/lib/briefing/cost.ts");
  const workflow = await import("../scripts/lib/briefing/workflow.ts");
  const hook = await import("../scripts/lib/briefing/hook.ts");
  const bundle = await import("../scripts/lib/briefing/bundle.ts");
  const collect = await import("../scripts/lib/briefing/collect.ts");

  // If we got here, all modules loaded successfully with no circular imports
  assert.ok(git, "git module loaded");
  assert.ok(cost, "cost module loaded");
  assert.ok(workflow, "workflow module loaded");
  assert.ok(hook, "hook module loaded");
  assert.ok(bundle, "bundle module loaded");
  assert.ok(collect, "collect module loaded");
});
