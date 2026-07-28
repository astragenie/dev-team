/**
 * tests/gepa/champion-provenance.test.ts — SLICE-105, rewritten W5 honesty
 * pass (astragenie/runner-plugin#525 §4.3).
 *
 * Covers AC-4, AC-5, AC-6 against the CURRENT shape — `gepa_*` keys merged
 * into the agent's own single frontmatter block, appended after every
 * existing field:
 *   AC-4: agent with NO existing gepa_* keys → keys appended at the end of
 *         the frontmatter block, `name:` (and everything else) unaffected.
 *   AC-5: agent with existing gepa_* keys → keys replaced in-place (no dup),
 *         prior_prompt_hash hashes the content WITHOUT the old gepa_* keys
 *         so subsequent promotions chain correctly.
 *   AC-6: atomicity — tmp+rename guarantees either fully-old or fully-new
 *         content.
 *
 * Also covers the legacy leading `gepa:` block (SUPERSEDED shape,
 * `stripGepafrontmatter`) purely for backward compatibility, and the actual
 * bug this pass fixes: a champion-provenance-written agent must still pass
 * the same field-read `validate-agents.ts` uses (see
 * champion-provenance-validator-compat.test.ts for the full validator run).
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeChampionProvenance,
  stripGepafrontmatter,
  stripGepaKeys,
  hashPromptBody
} from "../../scripts/lib/gepa/champion-provenance-writer.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIAL_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PROMOTED_AT = "2026-07-02T10:00:00.000Z";

function realAgentContent(n = 5): string {
  const body = Array.from({ length: n }, (_, i) => `Line ${i + 1} of agent body.`).join("\n");
  return (
    "---\n" +
    "name: fullstack-dev\n" +
    "description: A test agent.\n" +
    "model: sonnet\n" +
    "---\n\n" +
    body +
    "\n"
  );
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "provenance-test-"));
  mkdirSync(join(tmpDir, "agents"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── stripGepafrontmatter (legacy, backward-compat only) ────────────────────────

describe("stripGepafrontmatter (legacy shape, backward-compat)", () => {
  it("returns content unchanged when no leading gepa: block present", () => {
    const content = "# Hello\nThis is a body.\n";
    expect(stripGepafrontmatter(content)).toBe(content);
  });

  it("is a no-op on the current (single-block, flat gepa_* keys) shape", () => {
    const content = realAgentContent();
    expect(stripGepafrontmatter(content)).toBe(content);
  });

  it("strips a legacy leading gepa: frontmatter block", () => {
    const content = [
      "---",
      "gepa:",
      "  champion_from_trial: some-uuid",
      "  prior_prompt_hash: abc123",
      "  promoted_at: 2026-01-01T00:00:00.000Z",
      "---",
      "# Body",
      "Content here."
    ].join("\n");
    const stripped = stripGepafrontmatter(content);
    expect(stripped).toBe("# Body\nContent here.");
    expect(stripped).not.toContain("gepa:");
  });
});

// ── stripGepaKeys (current shape) ───────────────────────────────────────────────

describe("stripGepaKeys", () => {
  it("returns content unchanged when no frontmatter block present", () => {
    const content = "# Hello\nThis is a body.\n";
    expect(stripGepaKeys(content)).toBe(content);
  });

  it("returns content unchanged when the block has no gepa_* keys", () => {
    const content = realAgentContent();
    expect(stripGepaKeys(content)).toBe(content);
  });

  it("removes gepa_* keys from within the frontmatter block, leaving everything else", () => {
    const content = [
      "---",
      "name: fullstack-dev",
      "gepa_champion_from_trial: old-trial",
      "gepa_prior_prompt_hash: deadbeef",
      "gepa_promoted_at: 2026-01-01T00:00:00.000Z",
      "description: A test agent.",
      "---",
      "",
      "Body."
    ].join("\n");
    const stripped = stripGepaKeys(content);
    expect(stripped).not.toContain("gepa_");
    expect(stripped).toContain("name: fullstack-dev");
    expect(stripped).toContain("description: A test agent.");
    expect(stripped).toContain("Body.");
  });
});

// ── AC-4: no prior gepa_* keys ────────────────────────────────────────────────

describe("writeChampionProvenance — AC-4 no prior gepa_* keys", () => {
  it("merges gepa_* keys into the SAME frontmatter block, after existing fields", () => {
    const content = realAgentContent(5);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    const lines = result.split("\n");

    // Exactly ONE frontmatter block — only two `---` lines total.
    const dashLines = lines.filter((l) => l.trimEnd() === "---");
    expect(dashLines.length).toBe(2);

    // name: is still the very first field encountered.
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe("name: fullstack-dev");

    // gepa_* keys are present, after the original fields, before the closing ---.
    expect(result).toContain(`gepa_champion_from_trial: ${TRIAL_UUID}`);
    expect(result).toMatch(/gepa_prior_prompt_hash: [0-9a-f]{64}/);
    expect(result).toContain(`gepa_promoted_at: ${PROMOTED_AT}`);

    const closeIdx = lines.indexOf("---", 1);
    expect(lines[closeIdx - 1]).toBe(`gepa_promoted_at: ${PROMOTED_AT}`);
  });

  it("body after the frontmatter block is preserved verbatim", () => {
    const content = realAgentContent(5);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    const originalBody = content.split("\n---\n")[1];
    expect(result.endsWith(originalBody as string)).toBe(true);
  });

  it("prior_prompt_hash is SHA-256 of the original content (no gepa_* keys)", () => {
    const content = realAgentContent(5);
    const expectedHash = hashPromptBody(content);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    const { priorPromptHash } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    expect(priorPromptHash).toBe(expectedHash);

    const result = readFileSync(agentPath, "utf8");
    expect(result).toContain(`gepa_prior_prompt_hash: ${expectedHash}`);
  });

  it("returns the promotedAt timestamp that was written", () => {
    const content = realAgentContent(3);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    const { promotedAt } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    expect(promotedAt).toBe(PROMOTED_AT);
  });
});

// ── AC-5: existing gepa_* keys replaced in-place ──────────────────────────────

describe("writeChampionProvenance — AC-5 existing gepa_* keys", () => {
  it("replaces existing gepa_* keys (not duplicated)", () => {
    const content = realAgentContent(4);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({
      agentPath,
      trialUuid: "old-trial-uuid",
      promotedAt: "2026-01-01T00:00:00.000Z"
    });

    const NEW_TRIAL = "11111111-2222-4333-8444-555555555555";
    const NEW_PROMOTED_AT = "2026-07-02T12:00:00.000Z";
    writeChampionProvenance({
      agentPath,
      trialUuid: NEW_TRIAL,
      promotedAt: NEW_PROMOTED_AT
    });

    const result = readFileSync(agentPath, "utf8");

    expect(result).not.toContain("old-trial-uuid");
    expect(result).toContain(NEW_TRIAL);
    // Only ONE occurrence of each gepa_* key (not duplicated).
    expect((result.match(/^gepa_champion_from_trial:/gm) ?? []).length).toBe(1);
    expect((result.match(/^gepa_promoted_at:/gm) ?? []).length).toBe(1);
    // Still exactly one frontmatter block.
    expect((result.match(/^---$/gm) ?? []).length).toBe(2);
    // Body preserved.
    const originalBody = content.split("\n---\n")[1];
    expect(result.endsWith(originalBody as string)).toBe(true);
  });

  it("prior_prompt_hash is hashed from content WITHOUT the old gepa_* keys", () => {
    const content = realAgentContent(4);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({
      agentPath,
      trialUuid: "old-trial-uuid",
      promotedAt: "2026-01-01T00:00:00.000Z"
    });

    const { priorPromptHash } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    const expectedHash = hashPromptBody(content);
    expect(priorPromptHash).toBe(expectedHash);
  });

  it("second promotion chains hashes correctly (both hash the same clean content)", () => {
    const content = realAgentContent(4);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    const first = writeChampionProvenance({
      agentPath,
      trialUuid: "trial-1",
      promotedAt: "2026-07-01T00:00:00.000Z"
    });

    const second = writeChampionProvenance({
      agentPath,
      trialUuid: "trial-2",
      promotedAt: PROMOTED_AT
    });

    expect(first.priorPromptHash).toBe(second.priorPromptHash);
    expect(second.priorPromptHash).toBe(hashPromptBody(content));
  });
});

// ── AC-6: atomicity ──────────────────────────────────────────────────────────

describe("writeChampionProvenance — AC-6 atomic write (tmp+rename)", () => {
  it("no tmp file left behind after successful write", () => {
    const content = realAgentContent(3);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const files = readdirSync(join(tmpDir, "agents"));
    const tmpFiles = files.filter((f) => f.startsWith(".gepa-tmp-"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("file is well-formed after write (single frontmatter block, body intact)", () => {
    const content = realAgentContent(10);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, content, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    expect(result.startsWith("---\n")).toBe(true);
    const lines = result.split("\n");
    const closingIdx = lines.indexOf("---", 1);
    expect(closingIdx).toBeGreaterThan(1);
    const originalBody = content.split("\n---\n")[1] as string;
    const bodyAfter = lines.slice(closingIdx + 1).join("\n");
    expect(bodyAfter).toBe(originalBody);
  });
});
