import { test, expect } from "bun:test";
// hooks/lib/subagent-profile-core.ts — SubagentStart deterministic profile
// injection. Uses injected deps (fake buildProfileBlock + spy
// writeInjectedAtoms) so no daemon/provider is touched.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
  const out = await runSubagentProfileInjection(
    raw,
    {},
    deps("## Your track record (crew:reviewer)\n- x", ["c1", "l1"], writes)
  );
  expect(out).not.toBe(null);
  const parsed = JSON.parse(out as string);
  expect(parsed.hookSpecificOutput.hookEventName).toBe("SubagentStart");
  expect(parsed.hookSpecificOutput.additionalContext).toMatch(
    /Your track record \(crew:reviewer\)/
  );
  expect(writes).toEqual([["/repo", "crew:reviewer", ["c1", "l1"]]]);
});

test("returns null (emit nothing) when the payload has no agent_type", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const out = await runSubagentProfileInjection(
    JSON.stringify({ cwd: "/repo" }),
    {},
    deps("block", ["c1"], writes)
  );
  expect(out).toBe(null);
  expect(writes.length).toBe(0);
});

test("returns null when buildProfileBlock yields an empty block (disabled / cold / unpaired)", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: "/repo" });
  const out = await runSubagentProfileInjection(raw, {}, deps("", [], writes));
  expect(out).toBe(null);
  expect(writes.length).toBe(0);
});

test("returns null on malformed JSON — never throws", async () => {
  const out = await runSubagentProfileInjection("{ not json", {}, deps("block", ["c1"], []));
  expect(out).toBe(null);
});

test("returns null when buildProfileBlock throws — never throws", async () => {
  const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: "/repo" });
  const out = await runSubagentProfileInjection(
    raw,
    {},
    {
      buildProfileBlock: async () => {
        throw new Error("provider blew up");
      }
    }
  );
  expect(out).toBe(null);
});

test("falls back to CLAUDE_PROJECT_DIR when the payload omits cwd", async () => {
  const writes: Array<[string, string, string[]]> = [];
  const out = await runSubagentProfileInjection(
    JSON.stringify({ agent_type: "crew:backend-dev" }),
    { CLAUDE_PROJECT_DIR: "/env-repo" },
    deps("## Your track record (crew:backend-dev)\n- y", ["l9"], writes)
  );
  expect(out).not.toBe(null);
  expect(writes).toEqual([["/env-repo", "crew:backend-dev", ["l9"]]]);
});

// Dispatch-memory-credit-loop (runner-plugin upstream request 2026-07-16):
// with NO deps.buildProfileBlock override, the hook's default loader now
// resolves handoff-digest.ts's buildHandoffDigest instead of
// inject-profile.ts's buildProfileBlock directly (extending the seam — see
// subagent-profile-core.ts's file header). A repo with no memory config at
// all must still resolve cleanly to "emit nothing", proving the default
// loader wires up without needing a live daemon.
test("default loader (buildHandoffDigest, no deps override) resolves to null on an unconfigured repo", async () => {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), "subagent-hook-default-loader-"));
  try {
    const raw = JSON.stringify({ agent_type: "crew:reviewer", cwd: repo });
    const out = await runSubagentProfileInjection(
      raw,
      {},
      {
        writeInjectedAtoms: async () => {
          /* not asserted here — only proving the default buildProfileBlock loader runs */
        }
      }
    );
    expect(out).toBe(null);
  } finally {
    await fs.rm(repo, { recursive: true, force: true });
  }
});
