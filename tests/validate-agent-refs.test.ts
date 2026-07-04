// tests/validate-agent-refs.test.ts — crew-architecture-review 2026-07-04 quick win
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgentRefs } from "../scripts/validate-agent-refs.ts";

/** Write a synthetic repo root with commands/, skills/, agents/ subtrees. */
async function makeRepoRoot(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-agent-refs-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
  }
  return root;
}

test("passes when crew: tokens resolve to real agents or commands", async () => {
  const root = await makeRepoRoot({
    "agents/fullstack-dev.md": "---\nname: fullstack-dev\n---\nbody",
    "agents/reviewer.md": "---\nname: reviewer\n---\nbody",
    "commands/build.md": "---\n---\nbody",
    "commands/review.md":
      "---\n---\nDispatch the **`crew:reviewer`** agent. Pair with `/crew:build`.\n"
  });
  const result = await validateAgentRefs(root);
  assert.equal(result.ok, true, `unexpected findings: ${JSON.stringify(result.findings)}`);
});

test("fails on a phantom agent reference", async () => {
  const root = await makeRepoRoot({
    "agents/fullstack-dev.md": "---\nname: fullstack-dev\n---\nbody",
    "commands/parallel.md": "---\n---\nDispatch `crew:builder` then `crew:validator`.\n"
  });
  const result = await validateAgentRefs(root);
  assert.equal(result.ok, false);
  const tokens = result.findings.map((f) => f.token).sort();
  assert.deepEqual(tokens, ["crew:builder", "crew:validator"]);
});

test("fails on a phantom 3rdparty reference", async () => {
  const root = await makeRepoRoot({
    "agents/3rdparty/critical-thinking.md": "---\nname: critical-thinking\n---\nbody",
    "skills/workflow/foo/SKILL.md": "Route to `crew:3rdparty:nonexistent-agent`.\n"
  });
  const result = await validateAgentRefs(root);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.token === "crew:3rdparty:nonexistent-agent"));
});

test("allows documented forward references (reviewer-validator, reviewer-verifier)", async () => {
  const root = await makeRepoRoot({
    "agents/reviewer.md": "---\nname: reviewer\n---\nbody",
    "commands/orchestrate-slice.md":
      "---\n---\nDispatch single `crew:reviewer-validator` (combined agent).\n" +
      "Registry fallback: if `crew:reviewer-verifier` is unregistered, fall back to the full ladder.\n"
  });
  const result = await validateAgentRefs(root);
  assert.equal(result.ok, true, `unexpected findings: ${JSON.stringify(result.findings)}`);
});
