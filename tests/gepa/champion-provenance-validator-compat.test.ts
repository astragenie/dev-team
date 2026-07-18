/**
 * tests/gepa/champion-provenance-validator-compat.test.ts — W5 honesty pass
 * (astragenie/runner-plugin#525 §4.3).
 *
 * Proves the actual bug fix: a champion-provenance-written agent must pass
 * the SAME field-read `validate-agents.ts` uses, without any special-casing
 * on the validator's side. Two proofs, per the fix's ask:
 *   (a) a unit test writing provenance onto a fixture agent file, then
 *       running the exact field-read `validate-agents.ts` uses over it;
 *   (b) running the repo's full agent validation (`validateAgents`) over a
 *       fixture directory containing the new-shape file.
 *
 * This supersedes and RETIRES `tests/gepa-provenance-validate.test.ts`
 * (FEAT-193 AC-10, top-level `tests/`), which hardcoded assertions against
 * the SUPERSEDED leading-`gepa:`-block shape
 * (`promoted.startsWith("---\ngepa:\n")`) — see champion-provenance-writer.ts's
 * header for the full root-cause writeup. Both of that file's tests (baseline
 * validates → promote → still validates; idempotent re-promotion still
 * validates) are fully duplicated here against the current shape, so it was
 * deleted rather than patched.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeChampionProvenance } from "../../scripts/lib/gepa/champion-provenance-writer.ts";
import { validateAgents } from "../../scripts/validate-agents.ts";

const WELL_FORMED = `---
name: foo
prompt_id: foo
version: 1.0.0
description: A test agent.
model: sonnet
---

You are a foo agent on a Claude Code engineering team.

## Report contract

Write your handoff via write-handoff.
`;

// The same field-read shape validate-agents.ts's parseFrontmatter uses
// internally (see scripts/validate-agents.ts): first frontmatter block,
// flat `key: value` lines.
function fieldRead(text: string): Record<string, string> {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fm: Record<string, string> = {};
  if (!match?.[1]) return fm;
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (kv) fm[kv[1] as string] = (kv[2] ?? "").trim();
  }
  return fm;
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "gepa-provenance-validator-compat-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("(a) direct field-read parity with validate-agents.ts", () => {
  it("name/description/model are all readable from the FIRST frontmatter block after promotion", () => {
    const agentPath = join(root, "foo.md");
    writeFileSync(agentPath, WELL_FORMED, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: "11111111-1111-4111-8111-111111111111" });

    const promoted = readFileSync(agentPath, "utf8");
    const fm = fieldRead(promoted);

    expect(fm["name"]).toBe("foo");
    expect(fm["description"]).toBe("A test agent.");
    expect(fm["model"]).toBe("sonnet");
    // Provenance fields land in the SAME block, alongside the standard fields.
    expect(fm["gepa_champion_from_trial"]).toBe("11111111-1111-4111-8111-111111111111");
  });
});

describe("(b) full validateAgents() run over the new shape", () => {
  it("a champion-provenance-written agent validates cleanly (no missing name/description/model)", async () => {
    const agentsDir = join(root, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, "foo.md");
    writeFileSync(agentPath, WELL_FORMED, "utf8");

    const before = await validateAgents(agentsDir);
    expect(before.ok, `baseline errors: ${before.errors.join("; ")}`).toBe(true);

    writeChampionProvenance({ agentPath, trialUuid: "22222222-2222-4222-8222-222222222222" });

    const after = await validateAgents(agentsDir);
    expect(
      after.ok,
      `provenance-written agent must validate; errors: ${after.errors.join("; ")}`
    ).toBe(true);
  });

  it("idempotent re-promotion still validates cleanly", async () => {
    const agentsDir = join(root, "agents");
    mkdirSync(agentsDir, { recursive: true });
    const agentPath = join(agentsDir, "foo.md");
    writeFileSync(agentPath, WELL_FORMED, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: "33333333-3333-4333-8333-333333333333" });
    writeChampionProvenance({ agentPath, trialUuid: "44444444-4444-4444-8444-444444444444" });

    const result = await validateAgents(agentsDir);
    expect(result.ok, `errors: ${result.errors.join("; ")}`).toBe(true);

    const content = readFileSync(agentPath, "utf8");
    expect((content.match(/^gepa_champion_from_trial:/gm) ?? []).length).toBe(1);
  });
});
