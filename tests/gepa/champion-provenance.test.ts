/**
 * tests/gepa/champion-provenance.test.ts — SLICE-105
 *
 * Covers AC-4, AC-5, AC-6:
 *   AC-4: agent with NO existing gepa: frontmatter → new block written at top,
 *         file structure is exactly: --- / gepa: / fields / --- / original body.
 *   AC-5: agent with existing gepa: block → block replaced in-place (no dup),
 *         prior_prompt_hash hashes the body WITHOUT the old gepa: block so
 *         subsequent promotions chain correctly.
 *   AC-6: atomicity — tmp+rename guarantees either fully-old or fully-new content.
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeChampionProvenance,
  stripGepafrontmatter,
  hashPromptBody
} from "../../scripts/lib/gepa/champion-provenance-writer.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIAL_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PROMOTED_AT = "2026-07-02T10:00:00.000Z";

function agentBody(n = 10): string {
  return Array.from({ length: n }, (_, i) => `Line ${i + 1} of agent body.`).join("\n") + "\n";
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "provenance-test-"));
  mkdirSync(join(tmpDir, "agents"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── stripGepafrontmatter ──────────────────────────────────────────────────────

describe("stripGepafrontmatter", () => {
  it("returns content unchanged when no gepa: block present", () => {
    const content = "# Hello\nThis is a body.\n";
    expect(stripGepafrontmatter(content)).toBe(content);
  });

  it("strips a gepa: frontmatter block from the top", () => {
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

  it("does NOT strip a non-gepa frontmatter block (e.g. description:)", () => {
    const content = ["---", "description: my skill", "tier: universal", "---", "# Body"].join("\n");
    const result = stripGepafrontmatter(content);
    expect(result).toBe(content); // unchanged
  });

  it("handles unclosed gepa: block gracefully (returns content unchanged)", () => {
    const content = [
      "---",
      "gepa:",
      "  champion_from_trial: uuid",
      // no closing ---
      "# Body"
    ].join("\n");
    expect(stripGepafrontmatter(content)).toBe(content);
  });
});

// ── AC-4: no prior frontmatter ────────────────────────────────────────────────

describe("writeChampionProvenance — AC-4 no prior gepa: block", () => {
  it("writes gepa: block at the top; first 6 lines are the frontmatter boundary", () => {
    const body = agentBody(5);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    const lines = result.split("\n");

    // Lines 0-5 are the frontmatter block.
    expect(lines[0]).toBe("---");
    expect(lines[1]).toBe("gepa:");
    expect(lines[2]).toBe(`  champion_from_trial: ${TRIAL_UUID}`);
    expect(lines[3]).toMatch(/^  prior_prompt_hash: [0-9a-f]{64}$/);
    expect(lines[4]).toBe(`  promoted_at: ${PROMOTED_AT}`);
    expect(lines[5]).toBe("---");
  });

  it("original body is preserved verbatim after the frontmatter block", () => {
    const body = agentBody(5);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    const stripped = stripGepafrontmatter(result);
    expect(stripped).toBe(body);
  });

  it("prior_prompt_hash is SHA-256 of the original body", () => {
    const body = agentBody(5);
    const expectedHash = hashPromptBody(body);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    const { priorPromptHash } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    expect(priorPromptHash).toBe(expectedHash);

    const result = readFileSync(agentPath, "utf8");
    expect(result).toContain(`  prior_prompt_hash: ${expectedHash}`);
  });

  it("returns the promotedAt timestamp that was written", () => {
    const body = agentBody(3);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    const { promotedAt } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    expect(promotedAt).toBe(PROMOTED_AT);
  });
});

// ── AC-5: existing gepa: block replaced in-place ──────────────────────────────

describe("writeChampionProvenance — AC-5 existing gepa: block", () => {
  it("replaces existing gepa: block (not duplicated)", () => {
    const body = agentBody(4);
    const oldBlock = [
      "---",
      "gepa:",
      "  champion_from_trial: old-trial-uuid",
      "  prior_prompt_hash: olddeadhash",
      "  promoted_at: 2026-01-01T00:00:00.000Z",
      "---",
      ""
    ].join("\n");
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, oldBlock + body, "utf8");

    const NEW_TRIAL = "11111111-2222-4333-8444-555555555555";
    const NEW_PROMOTED_AT = "2026-07-02T12:00:00.000Z";
    writeChampionProvenance({
      agentPath,
      trialUuid: NEW_TRIAL,
      promotedAt: NEW_PROMOTED_AT
    });

    const result = readFileSync(agentPath, "utf8");

    // Must not contain the old trial UUID.
    expect(result).not.toContain("old-trial-uuid");
    // Must contain the new trial UUID.
    expect(result).toContain(NEW_TRIAL);
    // Only ONE gepa: occurrence (not duplicated).
    const gepaCnt = (result.match(/^gepa:$/m) ?? []).length;
    expect(gepaCnt).toBe(1);
    // Body preserved.
    const stripped = stripGepafrontmatter(result);
    // The body after stripping the NEW block should equal the original body.
    expect(stripped).toBe(body);
  });

  it("prior_prompt_hash is hashed from body WITHOUT the old gepa: block", () => {
    const body = agentBody(4);
    const oldBlock = [
      "---",
      "gepa:",
      "  champion_from_trial: old-trial-uuid",
      "  prior_prompt_hash: deadbeef",
      "  promoted_at: 2026-01-01T00:00:00.000Z",
      "---",
      ""
    ].join("\n");
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, oldBlock + body, "utf8");

    const { priorPromptHash } = writeChampionProvenance({
      agentPath,
      trialUuid: TRIAL_UUID,
      promotedAt: PROMOTED_AT
    });

    // Hash must be of `body` (without any gepa frontmatter).
    const expectedHash = hashPromptBody(body);
    expect(priorPromptHash).toBe(expectedHash);

    // Not the old hash.
    expect(priorPromptHash).not.toBe("deadbeef");
  });

  it("second promotion chains hashes correctly", () => {
    const body = agentBody(4);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    // First promotion.
    const first = writeChampionProvenance({
      agentPath,
      trialUuid: "trial-1",
      promotedAt: "2026-07-01T00:00:00.000Z"
    });

    // Second promotion (over the first).
    const second = writeChampionProvenance({
      agentPath,
      trialUuid: "trial-2",
      promotedAt: PROMOTED_AT
    });

    // Both promotions hash the SAME body (not the frontmatter).
    expect(first.priorPromptHash).toBe(second.priorPromptHash);
    expect(second.priorPromptHash).toBe(hashPromptBody(body));
  });
});

// ── AC-6: atomicity ──────────────────────────────────────────────────────────

describe("writeChampionProvenance — AC-6 atomic write (tmp+rename)", () => {
  it("no tmp file left behind after successful write", () => {
    const body = agentBody(3);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    // Scan the agents/ dir — no .gepa-tmp-* files should remain.
    const files = readdirSync(join(tmpDir, "agents"));
    const tmpFiles = files.filter((f) => f.startsWith(".gepa-tmp-"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("file is well-formed after write (no partial content)", () => {
    const body = agentBody(10);
    const agentPath = join(tmpDir, "agents", "fullstack-dev.md");
    writeFileSync(agentPath, body, "utf8");

    writeChampionProvenance({ agentPath, trialUuid: TRIAL_UUID, promotedAt: PROMOTED_AT });

    const result = readFileSync(agentPath, "utf8");
    // Must start with `---`
    expect(result.startsWith("---\n")).toBe(true);
    // Must contain closing `---`
    const lines = result.split("\n");
    const closingIdx = lines.indexOf("---", 1);
    expect(closingIdx).toBeGreaterThan(1);
    // Content after closing `---` must equal original body.
    const bodyAfter = lines.slice(closingIdx + 1).join("\n");
    expect(bodyAfter).toBe(body);
  });
});
