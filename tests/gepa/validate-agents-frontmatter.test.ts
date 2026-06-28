import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { checkAgentLineCap } from "../../scripts/validate-agents.ts";

const FIX = join(import.meta.dir, "..", "fixtures", "gepa");

describe("validate-agents gepa frontmatter exemption", () => {
  test("348 body + 8 frontmatter (356 total) PASSES the 350 cap", () => {
    const result = checkAgentLineCap(join(FIX, "agent-with-frontmatter.md"), 350);
    expect(result.ok).toBe(true);
  });

  test("360-line plain agent (no frontmatter) FAILS the 350 cap", () => {
    const result = checkAgentLineCap(join(FIX, "agent-no-frontmatter.md"), 350);
    expect(result.ok).toBe(false);
  });

  test("mid-document YAML block is NOT exempted (smuggle prevention)", () => {
    // 360-line file with a gepa: YAML block at lines 50-57 but NOT at the start.
    // The validator must still reject it — exemption only applies to leading frontmatter.
    const result = checkAgentLineCap(join(FIX, "agent-smuggled-yaml.md"), 350);
    expect(result.ok).toBe(false);
  });
});
