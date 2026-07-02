/**
 * scripts/lib/gepa/champion-provenance-writer.ts — SLICE-105
 *
 * Writes the `gepa:` YAML frontmatter block at the top of an agent prompt file
 * to record which trial promoted this champion, the hash of the body before
 * promotion, and the promotion timestamp.
 *
 * Frontmatter shape (written):
 *
 *   ---
 *   gepa:
 *     champion_from_trial: <trial-uuid>
 *     prior_prompt_hash: <sha256-hex-of-body-without-gepa-block>
 *     promoted_at: <iso-datetime>
 *   ---
 *   <original prompt body>
 *
 * Idempotency: if a `gepa:` block already exists at the top, it is replaced
 * in place (not duplicated). Other frontmatter blocks below are preserved.
 *
 * Hash semantics: `prior_prompt_hash` is computed from the prompt body WITHOUT
 * any existing `gepa:` frontmatter block, so subsequent promotions produce a
 * chain of deterministic hashes over the actual prompt content.
 *
 * Atomicity: writes via a tmp file + `fs.renameSync` which on Windows maps to
 * `MoveFileEx(MOVEFILE_REPLACE_EXISTING)` via Node's libuv — safe against
 * partial writes.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProvenanceOpts {
  /** Absolute path to the agent prompt file (e.g. `agents/fullstack-dev.md`). */
  agentPath: string;
  /** UUID of the winning trial. */
  trialUuid: string;
  /**
   * ISO 8601 datetime for `promoted_at`.
   * Defaults to `new Date().toISOString()`.
   */
  promotedAt?: string;
}

export interface ProvenanceResult {
  /** SHA-256 hex of the prompt body (without any gepa: frontmatter). */
  priorPromptHash: string;
  /** ISO datetime written to `promoted_at`. */
  promotedAt: string;
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

/**
 * Strip the leading `gepa:` frontmatter block (if present) and return the
 * remaining content.
 *
 * A `gepa:` frontmatter block is defined as:
 *   - File starts with `---\n`
 *   - The first non-dashes content line starts with `gepa:`
 *   - Followed by indented `  key: value` lines
 *   - Closed by a `---\n` line
 *
 * Any other leading frontmatter blocks (with different keys) are NOT stripped.
 */
export function stripGepafrontmatter(content: string): string {
  const lines = content.split("\n");

  // Must start with `---`
  if (lines[0]?.trimEnd() !== "---") return content;

  // Second line must start with `gepa:` (the key that identifies this block).
  if (!lines[1]?.trimStart().startsWith("gepa:")) return content;

  // Find the closing `---`.
  let closeIdx = -1;
  for (let i = 2; i < lines.length; i++) {
    if (lines[i]?.trimEnd() === "---") {
      closeIdx = i;
      break;
    }
  }
  if (closeIdx === -1) return content; // Malformed frontmatter — leave unchanged.

  // Return everything after the closing `---\n`.
  return lines.slice(closeIdx + 1).join("\n");
}

// ── Hash ─────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of the prompt body (without gepa frontmatter).
 * The hash is stable regardless of trailing newline normalization — we hash
 * the raw string returned by stripGepafrontmatter.
 */
export function hashPromptBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

// ── Frontmatter builder ──────────────────────────────────────────────────────

function buildGepafrontmatter(trialUuid: string, priorHash: string, promotedAt: string): string {
  return `---\ngepa:\n  champion_from_trial: ${trialUuid}\n  prior_prompt_hash: ${priorHash}\n  promoted_at: ${promotedAt}\n---\n`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write the `gepa:` YAML frontmatter block to the top of the agent prompt file.
 *
 * Idempotent: if a `gepa:` block already exists, it is replaced in place.
 * Atomic: writes via tmp file + renameSync.
 *
 * Returns the hash and timestamp written so the caller can record them in
 * the optimization artifact.
 */
export function writeChampionProvenance(opts: ProvenanceOpts): ProvenanceResult {
  const { agentPath, trialUuid } = opts;
  const promotedAt = opts.promotedAt ?? new Date().toISOString();

  // Read the current file.
  const current = readFileSync(agentPath, "utf8");

  // Strip any existing gepa: block to get the clean body.
  const body = stripGepafrontmatter(current);

  // Hash the body (without gepa frontmatter).
  const priorPromptHash = hashPromptBody(body);

  // Build the new content.
  const newContent = buildGepafrontmatter(trialUuid, priorPromptHash, promotedAt) + body;

  // Atomic write: tmp sibling + rename.
  const dir = dirname(agentPath);
  const tmpPath = join(dir, `.gepa-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, newContent, "utf8");
  renameSync(tmpPath, agentPath);

  return { priorPromptHash, promotedAt };
}
