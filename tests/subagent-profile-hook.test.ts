// hooks/lib/subagent-profile-core.ts — SubagentStart deterministic profile
// injection. Uses injected deps (fake buildProfileBlock + spy
// writeInjectedAtoms) so no daemon/provider is touched.
import test from "node:test";
import assert from "node:assert/strict";
import { runSubagentProfileInjection } from "../hooks/lib/subagent-profile-core.ts";

function deps(block: string, ids: string[], writes: Array<[string, string, string[]]>) {
  return {
    buildProfileBlock: async (o: { repoPath: string; agent: string }) => {
      void o;
      return { block, injectedIds: ids };
    },
    writeInjectedAtoms: async (repoPath: string, key: string, atomIds: string[]) => {
      writes.push([repoPath, key, atomIds]);
    }
  };
}

test("emits additionalContext + records the agent-keyed sidecar for a valid payload", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: "/repo" });
  const out = await runSubagentProfileInjection(raw, {}, deps("## Your track record (crew:reviewer)\n- x", ["c1", "l1"], writes));
  assert.notEqual(out, null);
  const parsed = JSON.parse(out as string);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "SubagentStart");
  assert.match(parsed.hookSpecificOutput.additionalContext, /Your track record \(crew:reviewer\)/);
  assert.deepEqual(writes, [["/repo", "crew:reviewer", ["c1", "l1"]]]);
});

test("returns null (emit nothing) when the payload has no agent_type", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const out = await runSubagentProfileInjection(JSON.stringify({ cwd: "/repo" }), {}, deps("block", ["c1"], writes));
  assert.equal(out, null);
  assert.equal(writes.length, 0);
});

test("returns null when buildProfileBlock yields an empty block (disabled / cold / unpaired)", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: "/repo" });
  const out = await runSubagentProfileInjection(raw, {}, deps("", [], writes));
  assert.equal(out, null);
  assert.equal(writes.length, 0);
});

test("returns null on malformed JSON — never throws", async () => {
  const out = await runSubagentProfileInjection("{ not json", {}, deps("block", ["c1"], []));
  assert.equal(out, null);
});

test("returns null when buildProfileBlock throws — never throws", async () => {
  const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: "/repo" });
  const out = await runSubagentProfileInjection(raw, {}, {
    buildProfileBlock: async () => {
      throw new Error("provider blew up");
    }
  });
  assert.equal(out, null);
});

test("falls back to CLAUDE_PROJECT_DIR when the payload omits cwd", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const out = await runSubagentProfileInjection(
    JSON.stringify({ agent_type: "crew:backend-dev" }),
    { CLAUDE_PROJECT_DIR: "/env-repo" },
    deps("## Your track record (crew:backend-dev)\n- y", ["l9"], writes)
  );
  assert.notEqual(out, null);
  assert.deepEqual(writes, [["/env-repo", "crew:backend-dev", ["l9"]]]);
});
