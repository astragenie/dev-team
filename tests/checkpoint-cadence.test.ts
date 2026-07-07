// dev-team#174: checkpoint-cadence PostToolUse hook tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckpointCadenceHook } from "../hooks/lib/checkpoint-cadence.ts";

async function makeTempRepo() {
  return fs.mkdtemp(path.join(os.tmpdir(), "checkpoint-cadence-"));
}
async function cleanup(dir: string) {
  await fs.rm(dir, { recursive: true, force: true });
}
function input(cwd: string, tool: string, session = "sess-1") {
  return JSON.stringify({ session_id: session, cwd, tool_name: tool });
}

test("does not nudge before the first Edit/Write (read-heavy phase)", async () => {
  const repo = await makeTempRepo();
  try {
    process.env["CREW_CHECKPOINT_CADENCE_N"] = "3";
    for (let i = 0; i < 10; i++) {
      const out = await runCheckpointCadenceHook(input(repo, "Read"));
      assert.equal(out, null, `Read #${i} must not nudge before any edit`);
    }
  } finally {
    delete process.env["CREW_CHECKPOINT_CADENCE_N"];
    await cleanup(repo);
  }
});

test("nudges once the threshold of post-edit tool calls is reached", async () => {
  const repo = await makeTempRepo();
  try {
    process.env["CREW_CHECKPOINT_CADENCE_N"] = "3";
    // First Edit arms the counter and is itself call #1.
    assert.equal(await runCheckpointCadenceHook(input(repo, "Write")), null);
    assert.equal(await runCheckpointCadenceHook(input(repo, "Read")), null);
    const out = await runCheckpointCadenceHook(input(repo, "Bash")); // call #3 → fire
    assert.ok(out, "expected a nudge at the threshold");
    const parsed = JSON.parse(out!);
    assert.equal(parsed.decision, "approve");
    assert.match(parsed.systemMessage, /checkpoint/i);
    assert.ok(!("hookSpecificOutput" in parsed), "must not use hookSpecificOutput (#176 trap)");
  } finally {
    delete process.env["CREW_CHECKPOINT_CADENCE_N"];
    await cleanup(repo);
  }
});

test("counter resets after firing — nudges on a fixed cadence, not every call", async () => {
  const repo = await makeTempRepo();
  try {
    process.env["CREW_CHECKPOINT_CADENCE_N"] = "2";
    await runCheckpointCadenceHook(input(repo, "Edit")); // #1
    const first = await runCheckpointCadenceHook(input(repo, "Bash")); // #2 → fire
    assert.ok(first, "first nudge at call 2");
    const between = await runCheckpointCadenceHook(input(repo, "Bash")); // #1 after reset
    assert.equal(between, null, "no nudge immediately after reset");
    const second = await runCheckpointCadenceHook(input(repo, "Bash")); // #2 → fire again
    assert.ok(second, "second nudge one cadence later");
  } finally {
    delete process.env["CREW_CHECKPOINT_CADENCE_N"];
    await cleanup(repo);
  }
});

test("respects the disable flag in crew.json", async () => {
  const repo = await makeTempRepo();
  try {
    process.env["CREW_CHECKPOINT_CADENCE_N"] = "1";
    await fs.mkdir(path.join(repo, ".claude"), { recursive: true });
    await fs.writeFile(
      path.join(repo, ".claude", "crew.json"),
      JSON.stringify({ features: { "checkpoint-cadence": { enabled: false } } })
    );
    await runCheckpointCadenceHook(input(repo, "Edit"));
    const out = await runCheckpointCadenceHook(input(repo, "Edit"));
    assert.equal(out, null, "disabled feature must never nudge");
  } finally {
    delete process.env["CREW_CHECKPOINT_CADENCE_N"];
    await cleanup(repo);
  }
});

test("malformed input returns null (never throws)", async () => {
  assert.equal(await runCheckpointCadenceHook("not json"), null);
  assert.equal(await runCheckpointCadenceHook(JSON.stringify({ foo: 1 })), null);
});
