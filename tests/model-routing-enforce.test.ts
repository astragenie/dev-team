// tests/model-routing-enforce.test.ts
// FEAT-194 S2b — PreToolUse Agent-tool hook that HARD-enforces the resolved
// builder-tier model when an interactive dispatch omits `model:`.
// Covers hooks/lib/model-routing-enforce.ts. The shim (hooks/pre-tool-use-
// model-enforce.ts) owns stdin/stdout/process.exit and is exercised only by
// the "malformed payload" pass-through cases here, matching the split used
// by tests/dispatch-timing-pre-tap.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUILDER_TIER_AGENTS,
  isBuilderTierAgent,
  parseAgentDispatchInput,
  decideModelEnforcement,
  buildHookOutput
} from "../hooks/lib/model-routing-enforce.ts";

// The committed .claude/loop.json routing block, used verbatim so this test
// fails loudly if that config drifts out of sync with what S2b assumes
// (mirrors tests/resolve-model.test.ts's COMMITTED_ROUTING).
const COMMITTED_ROUTING = {
  loop: {
    modelRouting: {
      architect: "opus",
      build: "sonnet",
      default: "sonnet"
    }
  }
};

// ── isBuilderTierAgent / BUILDER_TIER_AGENTS ────────────────────────────────

test("BUILDER_TIER_AGENTS: covers the five builder-tier agents named in FEAT-194 S2b scope", () => {
  assert.deepEqual(
    [...BUILDER_TIER_AGENTS].sort(),
    ["aiplugin-dev", "backend-dev", "dev-lite", "frontend-dev", "fullstack-dev"].sort()
  );
});

test("isBuilderTierAgent: crew-prefixed builder tier names match", () => {
  assert.equal(isBuilderTierAgent("crew:fullstack-dev"), true);
  assert.equal(isBuilderTierAgent("crew:backend-dev"), true);
  assert.equal(isBuilderTierAgent("crew:frontend-dev"), true);
  assert.equal(isBuilderTierAgent("crew:aiplugin-dev"), true);
  assert.equal(isBuilderTierAgent("crew:dev-lite"), true);
});

test("isBuilderTierAgent: bare (non-prefixed) builder tier names match", () => {
  assert.equal(isBuilderTierAgent("fullstack-dev"), true);
});

test("isBuilderTierAgent: non-builder agents do not match", () => {
  assert.equal(isBuilderTierAgent("crew:reviewer"), false);
  assert.equal(isBuilderTierAgent("crew:investigator"), false);
  assert.equal(isBuilderTierAgent("crew:verifier"), false);
  assert.equal(isBuilderTierAgent("general-purpose"), false);
});

// ── parseAgentDispatchInput ──────────────────────────────────────────────────

test("parseAgentDispatchInput: valid Agent payload with subagent_type → parsed", () => {
  const payload = JSON.stringify({
    tool_name: "Agent",
    tool_input: { subagent_type: "crew:fullstack-dev", description: "build the thing" }
  });
  const result = parseAgentDispatchInput(payload);
  assert.ok(result !== null);
  assert.equal(result.subagentType, "crew:fullstack-dev");
  assert.equal(result.toolInput["description"], "build the thing");
});

test("parseAgentDispatchInput: non-Agent tool_name → null (pass through)", () => {
  const payload = JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(parseAgentDispatchInput(payload), null);
});

test("parseAgentDispatchInput: malformed JSON → null (fail-open pass through)", () => {
  assert.equal(parseAgentDispatchInput("not json"), null);
  assert.equal(parseAgentDispatchInput("{broken:"), null);
  assert.equal(parseAgentDispatchInput(""), null);
});

test("parseAgentDispatchInput: missing subagent_type → null", () => {
  const payload = JSON.stringify({ tool_name: "Agent", tool_input: { description: "x" } });
  assert.equal(parseAgentDispatchInput(payload), null);
});

test("parseAgentDispatchInput: missing tool_input → null", () => {
  const payload = JSON.stringify({ tool_name: "Agent" });
  assert.equal(parseAgentDispatchInput(payload), null);
});

// ── decideModelEnforcement ───────────────────────────────────────────────────

test("decideModelEnforcement: builder-tier + no model + modelRouting configured → inject", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev", description: "build the thing" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(decision.action, "inject");
  assert.equal(decision.model, "sonnet");
  assert.equal(decision.updatedInput?.["model"], "sonnet");
  // Original fields preserved alongside the injected model.
  assert.equal(decision.updatedInput?.["description"], "build the thing");
});

test("decideModelEnforcement: explicit model already set → untouched (none)", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev", model: "opus" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(decision.action, "none");
  assert.equal(decision.model, undefined);
  assert.equal(decision.updatedInput, undefined);
});

test("decideModelEnforcement: non-builder agent → untouched (none)", () => {
  const dispatch = {
    subagentType: "crew:reviewer",
    toolInput: { subagent_type: "crew:reviewer" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(decision.action, "none");
});

test("decideModelEnforcement: no modelRouting configured (null config) → fail-open none", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev" }
  };
  assert.equal(decideModelEnforcement(dispatch, null).action, "none");
  assert.equal(decideModelEnforcement(dispatch, {}).action, "none");
  assert.equal(decideModelEnforcement(dispatch, { loop: {} }).action, "none");
});

test("decideModelEnforcement: malformed/empty-string explicit model is treated as absent → inject", () => {
  const dispatch = {
    subagentType: "crew:backend-dev",
    toolInput: { subagent_type: "crew:backend-dev", model: "" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(decision.action, "inject");
  assert.equal(decision.model, "sonnet");
});

test("decideModelEnforcement: dev-lite (bare, no crew: prefix) → inject", () => {
  const dispatch = { subagentType: "dev-lite", toolInput: { subagent_type: "dev-lite" } };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(decision.action, "inject");
  assert.equal(decision.model, "sonnet");
});

// ── buildHookOutput ───────────────────────────────────────────────────────

test("buildHookOutput: inject decision → JSON with hookSpecificOutput.updatedInput + systemMessage", () => {
  const dispatch = {
    subagentType: "crew:aiplugin-dev",
    toolInput: { subagent_type: "crew:aiplugin-dev" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  const out = buildHookOutput(dispatch, decision);
  assert.ok(out !== null);
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(parsed.hookSpecificOutput.updatedInput.model, "sonnet");
  assert.match(parsed.systemMessage, /crew:aiplugin-dev/);
  assert.match(parsed.systemMessage, /sonnet/);
});

test("buildHookOutput: none decision → null (no stdout output, pure pass-through)", () => {
  const dispatch = { subagentType: "crew:reviewer", toolInput: { subagent_type: "crew:reviewer" } };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  assert.equal(buildHookOutput(dispatch, decision), null);
});
