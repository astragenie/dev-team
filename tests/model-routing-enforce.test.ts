import { test, expect } from "bun:test";
// tests/model-routing-enforce.test.ts
// FEAT-194 S2b — PreToolUse Agent-tool hook that HARD-enforces the resolved
// builder-tier model when an interactive dispatch omits `model:`.
// Covers hooks/lib/model-routing-enforce.ts. The shim (hooks/pre-tool-use-
// model-enforce.ts) owns stdin/stdout/process.exit and is exercised only by
// the "malformed payload" pass-through cases here, matching the split used
// by tests/dispatch-timing-pre-tap.test.ts.
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
  expect([...BUILDER_TIER_AGENTS].sort()).toEqual(
    ["aiplugin-dev", "backend-dev", "dev-lite", "frontend-dev", "fullstack-dev"].sort()
  );
});

test("isBuilderTierAgent: crew-prefixed builder tier names match", () => {
  expect(isBuilderTierAgent("crew:fullstack-dev")).toBe(true);
  expect(isBuilderTierAgent("crew:backend-dev")).toBe(true);
  expect(isBuilderTierAgent("crew:frontend-dev")).toBe(true);
  expect(isBuilderTierAgent("crew:aiplugin-dev")).toBe(true);
  expect(isBuilderTierAgent("crew:dev-lite")).toBe(true);
});

test("isBuilderTierAgent: bare (non-prefixed) builder tier names match", () => {
  expect(isBuilderTierAgent("fullstack-dev")).toBe(true);
});

test("isBuilderTierAgent: non-builder agents do not match", () => {
  expect(isBuilderTierAgent("crew:reviewer")).toBe(false);
  expect(isBuilderTierAgent("crew:investigator")).toBe(false);
  expect(isBuilderTierAgent("crew:verifier")).toBe(false);
  expect(isBuilderTierAgent("general-purpose")).toBe(false);
});

// ── parseAgentDispatchInput ──────────────────────────────────────────────────

test("parseAgentDispatchInput: valid Agent payload with subagent_type → parsed", () => {
  const payload = JSON.stringify({
    tool_name: "Agent",
    tool_input: { subagent_type: "crew:fullstack-dev", description: "build the thing" }
  });
  const result = parseAgentDispatchInput(payload);
  expect(result !== null).toBeTruthy();
  if (result === null) return;
  expect(result.subagentType).toBe("crew:fullstack-dev");
  expect(result.toolInput["description"]).toBe("build the thing");
});

test("parseAgentDispatchInput: non-Agent tool_name → null (pass through)", () => {
  const payload = JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls" } });
  expect(parseAgentDispatchInput(payload)).toBe(null);
});

test("parseAgentDispatchInput: malformed JSON → null (fail-open pass through)", () => {
  expect(parseAgentDispatchInput("not json")).toBe(null);
  expect(parseAgentDispatchInput("{broken:")).toBe(null);
  expect(parseAgentDispatchInput("")).toBe(null);
});

test("parseAgentDispatchInput: missing subagent_type → null", () => {
  const payload = JSON.stringify({ tool_name: "Agent", tool_input: { description: "x" } });
  expect(parseAgentDispatchInput(payload)).toBe(null);
});

test("parseAgentDispatchInput: missing tool_input → null", () => {
  const payload = JSON.stringify({ tool_name: "Agent" });
  expect(parseAgentDispatchInput(payload)).toBe(null);
});

// ── decideModelEnforcement ───────────────────────────────────────────────────

test("decideModelEnforcement: builder-tier + no model + modelRouting configured → inject", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev", description: "build the thing" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(decision.action).toBe("inject");
  expect(decision.model).toBe("sonnet");
  expect(decision.updatedInput?.["model"]).toBe("sonnet");
  // Original fields preserved alongside the injected model.
  expect(decision.updatedInput?.["description"]).toBe("build the thing");
});

test("decideModelEnforcement: explicit model already set → untouched (none)", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev", model: "opus" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(decision.action).toBe("none");
  expect(decision.model).toBe(undefined);
  expect(decision.updatedInput).toBe(undefined);
});

test("decideModelEnforcement: non-builder agent → untouched (none)", () => {
  const dispatch = {
    subagentType: "crew:reviewer",
    toolInput: { subagent_type: "crew:reviewer" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(decision.action).toBe("none");
});

test("decideModelEnforcement: no modelRouting configured (null config) → fail-open none", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev" }
  };
  expect(decideModelEnforcement(dispatch, null).action).toBe("none");
  expect(decideModelEnforcement(dispatch, {}).action).toBe("none");
  expect(decideModelEnforcement(dispatch, { loop: {} }).action).toBe("none");
});

test("decideModelEnforcement: loop.modelRouting.enabled false → stand down (agent frontmatter governs)", () => {
  const dispatch = {
    subagentType: "crew:fullstack-dev",
    toolInput: { subagent_type: "crew:fullstack-dev" }
  };
  const disabledConfig = {
    loop: { modelRouting: { enabled: false, build: "sonnet", default: "sonnet" } }
  };
  expect(decideModelEnforcement(dispatch, disabledConfig).action).toBe("none");
});

test("decideModelEnforcement: malformed/empty-string explicit model is treated as absent → inject", () => {
  const dispatch = {
    subagentType: "crew:backend-dev",
    toolInput: { subagent_type: "crew:backend-dev", model: "" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(decision.action).toBe("inject");
  expect(decision.model).toBe("sonnet");
});

test("decideModelEnforcement: dev-lite (bare, no crew: prefix) → inject", () => {
  const dispatch = { subagentType: "dev-lite", toolInput: { subagent_type: "dev-lite" } };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(decision.action).toBe("inject");
  expect(decision.model).toBe("sonnet");
});

// ── buildHookOutput ───────────────────────────────────────────────────────

test("buildHookOutput: inject decision → JSON with hookSpecificOutput.updatedInput + systemMessage", () => {
  const dispatch = {
    subagentType: "crew:aiplugin-dev",
    toolInput: { subagent_type: "crew:aiplugin-dev" }
  };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  const out = buildHookOutput(dispatch, decision);
  expect(out !== null).toBeTruthy();
  if (out === null) return;
  const parsed = JSON.parse(out);
  // Required by the PreToolUse hookSpecificOutput schema — without it the
  // harness rejects the whole payload and the model injection silently no-ops
  // (dev-team#176). Assert it so the field can't regress.
  expect(parsed.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(parsed.hookSpecificOutput.permissionDecision).toBe("allow");
  expect(parsed.hookSpecificOutput.updatedInput.model).toBe("sonnet");
  expect(parsed.systemMessage).toMatch(/crew:aiplugin-dev/);
  expect(parsed.systemMessage).toMatch(/sonnet/);
});

test("buildHookOutput: none decision → null (no stdout output, pure pass-through)", () => {
  const dispatch = { subagentType: "crew:reviewer", toolInput: { subagent_type: "crew:reviewer" } };
  const decision = decideModelEnforcement(dispatch, COMMITTED_ROUTING);
  expect(buildHookOutput(dispatch, decision)).toBe(null);
});
