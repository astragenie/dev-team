/**
 * scripts/lib/gepa/champion-provenance-writer.ts — SLICE-105 (W5 honesty pass,
 * astragenie/runner-plugin#525 §4.3)
 *
 * Writes GEPA promotion provenance onto an agent prompt file: which trial
 * promoted this champion, the hash of the content before promotion, and the
 * promotion timestamp.
 *
 * Frontmatter shape (written) — flat `gepa_*` keys MERGED into the agent's
 * own single frontmatter block, appended after every existing field so
 * `name:` (and every other required field a consumer reads) is always
 * encountered first, in the SAME block:
 *
 *   ---
 *   name: <agent-name>
 *   description: ...
 *   model: ...
 *   ...
 *   gepa_champion_from_trial: <trial-uuid>
 *   gepa_prior_prompt_hash: <sha256-hex-of-file-without-gepa_* keys>
 *   gepa_promoted_at: <iso-datetime>
 *   ---
 *   <original prompt body>
 *
 * Root cause of the prior (SUPERSEDED) shape: it prepended a SEPARATE leading
 * `---\ngepa:\n  ...\n---` block ABOVE the agent's own frontmatter, producing
 * two adjacent `---...---` blocks. Any consumer that reads only the FIRST
 * frontmatter block as ground truth — which is the standard frontmatter
 * contract, and is what Claude Code's own agent loader does — would see only
 * `{gepa: {...}}` with no `name`/`description`/`model` and silently mis-load
 * the agent. This repo's own `validate-agents.ts` was patched around it
 * (FEAT-193 AC-10: its `parseFrontmatter` special-cased stripping a leading
 * `gepa:` block via `stripGepafrontmatter` before reading fields), but that
 * only fixed this repo's own CI gate — it did nothing for the actual
 * downstream frontmatter contract every other consumer relies on. As a
 * result the writer was never actually run against a real agent file: zero
 * `gepa_*`-tagged agents existed repo-wide, and the one real promotion
 * (CHANGELOG 0.51.1) was done by hand with the provenance block omitted
 * entirely and the provenance tracked in CHANGELOG prose instead.
 *
 * The new shape needs no special-casing anywhere: it is a single, ordinary
 * frontmatter block, so every existing frontmatter consumer — field-read,
 * line-count, section checks — sees exactly what it already expects to see.
 *
 * `stripGepafrontmatter` is kept below for backward compatibility only: it
 * still recognizes and strips the old leading-block shape if one is ever
 * encountered (e.g. a promotion made before this fix), and is a no-op on
 * every file written under the new shape — `validate-agents.ts`'s existing
 * import of it stays safe.
 *
 * Idempotency: if `gepa_*` keys already exist in the frontmatter block, they
 * are replaced in place (not duplicated).
 *
 * Hash semantics: `prior_prompt_hash` is computed over the full file content
 * with any existing `gepa_*` frontmatter keys (and any legacy leading
 * `gepa:` block) stripped first, so subsequent promotions produce a chain of
 * deterministic hashes over the actual prompt content (frontmatter + body).
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
  /** SHA-256 hex of the file content (without any gepa provenance). */
  priorPromptHash: string;
  /** ISO datetime written to `promoted_at`. */
  promotedAt: string;
}

// ── Legacy shape support (SUPERSEDED — backward-compat only) ──────────────────

/**
 * Strip the legacy leading `gepa:` frontmatter block (if present) and return
 * the remaining content. SUPERSEDED by the flat `gepa_*`-key shape below —
 * kept only so a file promoted before this fix (or `validate-agents.ts`'s
 * existing import of this function) still behaves correctly. No-op on any
 * file written under the current shape.
 *
 * A legacy `gepa:` frontmatter block is defined as:
 *   - File starts with `---\n`
 *   - The first non-dashes content line starts with `gepa:`
 *   - Followed by indented `  key: value` lines
 *   - Closed by a `---\n` line
 *
 * Any other leading frontmatter block (with different keys) is NOT stripped.
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

// ── Frontmatter-block helpers (current shape) ──────────────────────────────────

const GEPA_KEY_RE = /^gepa_(champion_from_trial|prior_prompt_hash|promoted_at):/;

/** Locate the leading `---\n...\n---` frontmatter block. Null if absent/malformed. */
function findFrontmatterBlock(content: string): { lines: string[]; closeIdx: number } | null {
  const lines = content.split("\n");
  if (lines[0]?.trimEnd() !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trimEnd() === "---") return { lines, closeIdx: i };
  }
  return null;
}

/**
 * Strip any existing `gepa_champion_from_trial` / `gepa_prior_prompt_hash` /
 * `gepa_promoted_at` lines from within the leading frontmatter block, so a
 * re-promotion replaces them in place instead of duplicating. No-op when the
 * block is absent or carries none of those keys. Exported for testability.
 */
export function stripGepaKeys(content: string): string {
  const block = findFrontmatterBlock(content);
  if (!block) return content;
  const { lines, closeIdx } = block;
  const kept = lines.slice(1, closeIdx).filter((line) => !GEPA_KEY_RE.test(line.trim()));
  return [lines[0] as string, ...kept, ...lines.slice(closeIdx)].join("\n");
}

/**
 * Insert the three `gepa_*` provenance lines at the END of the leading
 * frontmatter block — after every existing field, so `name:` and every other
 * required field are always read first, in the same block. Falls back to
 * prepending a minimal frontmatter block only when no leading block exists
 * at all (should not happen for a real agent file, which always carries its
 * own frontmatter; kept so the writer stays total rather than throwing).
 */
function injectGepaKeys(
  content: string,
  trialUuid: string,
  priorHash: string,
  promotedAt: string
): string {
  const newFields = [
    `gepa_champion_from_trial: ${trialUuid}`,
    `gepa_prior_prompt_hash: ${priorHash}`,
    `gepa_promoted_at: ${promotedAt}`
  ];
  const block = findFrontmatterBlock(content);
  if (!block) {
    return `---\n${newFields.join("\n")}\n---\n${content}`;
  }
  const { lines, closeIdx } = block;
  return [...lines.slice(0, closeIdx), ...newFields, ...lines.slice(closeIdx)].join("\n");
}

// ── Hash ─────────────────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of the given content. Stable regardless of trailing
 * newline normalization — hashes the raw string passed in.
 */
export function hashPromptBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write GEPA promotion provenance onto the agent prompt file, merged into its
 * existing frontmatter block.
 *
 * Idempotent: if `gepa_*` keys already exist, they are replaced in place.
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

  // Recover from the legacy leading `gepa:` block shape if ever encountered,
  // then strip any existing flat gepa_* keys — together these give the clean
  // prior content this promotion's hash is measured against.
  const clean = stripGepaKeys(stripGepafrontmatter(current));

  // Hash the clean content (no gepa provenance of any shape).
  const priorPromptHash = hashPromptBody(clean);

  // Build the new content: gepa_* keys merged into the existing frontmatter block.
  const newContent = injectGepaKeys(clean, trialUuid, priorPromptHash, promotedAt);

  // Atomic write: tmp sibling + rename.
  const dir = dirname(agentPath);
  const tmpPath = join(dir, `.gepa-tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(tmpPath, newContent, "utf8");
  renameSync(tmpPath, agentPath);

  return { priorPromptHash, promotedAt };
}
