import { test, expect } from "bun:test";
// tests/validate-agent-refs.test.ts — crew-architecture-review 2026-07-04 quick win
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
  expect(result.ok, `unexpected findings: ${JSON.stringify(result.findings)}`).toBe(true);
});

test("fails on a phantom agent reference", async () => {
  const root = await makeRepoRoot({
    "agents/fullstack-dev.md": "---\nname: fullstack-dev\n---\nbody",
    "commands/parallel.md": "---\n---\nDispatch `crew:builder` then `crew:validator`.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok).toBe(false);
  const tokens = result.findings.map((f) => f.token).sort();
  expect(tokens).toEqual(["crew:builder", "crew:validator"]);
});

test("fails on a phantom 3rdparty reference", async () => {
  const root = await makeRepoRoot({
    "agents/3rdparty/critical-thinking.md": "---\nname: critical-thinking\n---\nbody",
    "skills/workflow/foo/SKILL.md": "Route to `crew:3rdparty:nonexistent-agent`.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok).toBe(false);
  expect(result.findings.some((f) => f.token === "crew:3rdparty:nonexistent-agent")).toBeTruthy();
});

test("allows forward references declared in docs/routing-table.yaml", async () => {
  const root = await makeRepoRoot({
    "agents/reviewer.md": "---\nname: reviewer\n---\nbody",
    "docs/routing-table.yaml":
      'version: "1.0.0"\nforward_references:\n  - reviewer-validator\n  - reviewer-verifier\n' +
      "rows:\n  - section: workflow-signals\n    signal: x\n    route_to: y\n",
    "commands/orchestrate-slice.md":
      "---\n---\nDispatch single `crew:reviewer-validator` (combined agent).\n" +
      "Registry fallback: if `crew:reviewer-verifier` is unregistered, fall back to the full ladder.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok, `unexpected findings: ${JSON.stringify(result.findings)}`).toBe(true);
});

test("forward references NOT in routing-table.yaml are findings (allowlist is data, not code)", async () => {
  const root = await makeRepoRoot({
    "commands/foo.md": "---\n---\nDispatch `crew:reviewer-validator`.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok).toBe(false);
  expect(result.findings.some((f) => f.token === "crew:reviewer-validator")).toBeTruthy();
});

test("resolves crew: tokens that name a skill directory", async () => {
  const root = await makeRepoRoot({
    "skills/workflow/risk-tier/SKILL.md": "tier skill",
    "commands/foo.md": "---\n---\nConsult `crew:risk-tier` guidance.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok, `unexpected findings: ${JSON.stringify(result.findings)}`).toBe(true);
});

test("fails on a phantom agent reference inside .claude/loop/rules.md", async () => {
  // Regression for the shipped bug: a phantom `crew:builder` dispatch
  // instruction in the loop-methodology markdown broke a consumer repo
  // because the scan only covered commands/skills/agents, not .claude/loop/.
  const root = await makeRepoRoot({
    "agents/fullstack-dev.md": "---\nname: fullstack-dev\n---\nbody",
    ".claude/loop/rules.md":
      "# Autonomous Loop — HARD RULES\n\nDispatch implementation via `crew:builder`.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok).toBe(false);
  expect(
    result.findings.some((f) => f.token === "crew:builder" && f.file === ".claude/loop/rules.md")
  ).toBeTruthy();
});

test("passes on a real agent reference inside .claude/loop/rules.md", async () => {
  const root = await makeRepoRoot({
    "agents/fullstack-dev.md": "---\nname: fullstack-dev\n---\nbody",
    ".claude/loop/rules.md":
      "# Autonomous Loop — HARD RULES\n\nDispatch implementation via `crew:fullstack-dev`.\n"
  });
  const result = await validateAgentRefs(root);
  expect(result.ok, `unexpected findings: ${JSON.stringify(result.findings)}`).toBe(true);
});
