import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enumerateAgents } from "../../scripts/validate-agents.ts";

describe("validate-agents .gepa/ skip", () => {
  test("enumerator excludes files under agents/<name>/.gepa/", () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-skip-"));
    try {
      mkdirSync(join(root, "agents/fullstack-dev/.gepa/eval"), { recursive: true });
      writeFileSync(join(root, "agents/fullstack-dev.md"), "# fullstack-dev\n");
      writeFileSync(join(root, "agents/fullstack-dev/.gepa/eval/sample.jsonl"), `{"id":"x"}\n`);
      writeFileSync(join(root, "agents/fullstack-dev/.gepa/rubric.md"), "criterion 1\n");
      const files = enumerateAgents(join(root, "agents"));
      expect(files.some((f) => f.includes(".gepa/"))).toBe(false);
      expect(files.some((f) => f.endsWith("fullstack-dev.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
