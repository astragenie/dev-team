// scripts/lib/memory/inject-recall.ts — FEAT-188 S3a
//
// The ONE recall injection helper every dev-team dispatch-assembly site
// (commands/build.md, commands/fix.md, commands/ship.md retries,
// commands/orchestrate-slice.md) calls before handing an instruction to a
// subagent. Given the dispatch text + {agent, tags}, it resolves the
// configured MemoryProvider (@astragenie/memory-provider's resolveProvider),
// recalls entries scoped by agent/tags within the configured token budget,
// and appends a formatted block.
//
// Format: reuses/extends the runner-plugin bridge's EXISTING
// `## Prior context (from astramem)` header (recall-injector.mts's
// formatRecallBlock) rather than inventing a rival format — S3b unifies
// both sides of the bridge/dev-team split on this one shape. The per-line
// shape differs because MemoryEntry carries kind/severity/source/summary,
// not the bridge's RecallResult type/score/slice_id/content — same header,
// adapted line.
//
// Guard: best-effort. A recall failure (config parse error, provider error,
// timeout) must never block or alter dispatch beyond omitting the block —
// every path here is wrapped so the caller always gets text back, never a
// throw.
import fs from "node:fs/promises";
import path from "node:path";
import {
  parseMemoryConfig,
  resolveEffectiveConfig,
  resolveProvider,
  type MemoryEntry
} from "@astragenie/memory-provider";

/** Path (relative to repoPath) of the unified `memory` config block's home. */
const LOOP_CONFIG_PATH = [".claude", "loop.json"];

export interface InjectRecallOptions {
  repoPath: string;
  /** Scope recall to one agent (entries with no agent apply to everyone). */
  agent?: string;
  /** Scope recall to entries carrying at least one of these tags. */
  tags?: string[];
  /**
   * Raw `memory` config block. When omitted, loaded from
   * `<repoPath>/.claude/loop.json`'s top-level `memory` key.
   */
  rawConfig?: unknown;
}

/**
 * Load the top-level `memory` block from `<repoPath>/.claude/loop.json`.
 * Never throws — missing file, malformed JSON, or a missing `memory` key
 * all resolve to `undefined` (parseMemoryConfig treats that as provider:none).
 */
export async function loadMemoryConfig(repoPath: string): Promise<unknown> {
  try {
    const targetPath = path.join(repoPath, ...LOOP_CONFIG_PATH);
    const content = await fs.readFile(targetPath, "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parsed["memory"];
  } catch {
    return undefined;
  }
}

/** Format one recalled entry as one Markdown line. */
function formatEntry(entry: MemoryEntry): string {
  const label = `[${entry.kind} ${entry.severity}]`;
  const origin = entry.source ? `${entry.source} ` : "";
  return `- **${label}** ${origin}${entry.summary}`;
}

/**
 * Format recalled entries into the shared `## Prior context (from astramem)`
 * block. Empty input -> empty string (no header, no injected whitespace) so
 * callers can `if (!block)` cheaply.
 */
export function formatRecallBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map(formatEntry);
  return `## Prior context (from astramem)\n${lines.join("\n")}`;
}

/**
 * Resolve the configured provider, recall entries scoped by agent/tags
 * within the configured token budget, and format them. Returns "" when
 * memory/recall is disabled, no entries match, or anything fails.
 */
export async function buildRecallBlock(opts: InjectRecallOptions): Promise<string> {
  try {
    const rawConfig =
      opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    const config = parseMemoryConfig(rawConfig);
    const effective = resolveEffectiveConfig(config);
    if (!effective.recallEnabled) return "";

    const provider = resolveProvider(rawConfig, opts.repoPath);
    const entries = await provider.recall({
      ...(opts.agent !== undefined ? { agent: opts.agent } : {}),
      ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
      k: effective.recall.k,
      maxTokens: effective.recall.maxTokens
    });

    return formatRecallBlock(entries);
  } catch {
    // Best-effort: recall must never block or alter dispatch beyond
    // omitting the block.
    return "";
  }
}

/**
 * Recall-and-append: builds the recall block (see buildRecallBlock) and
 * appends it to `dispatchText`. GIVEN `provider:none` or
 * `recall.enabled:false` (or any failure), returns `dispatchText`
 * byte-identical/unchanged — the highest-risk regression property this
 * helper must hold.
 */
export async function injectRecall(
  dispatchText: string,
  opts: InjectRecallOptions
): Promise<string> {
  const block = await buildRecallBlock(opts);
  if (!block) return dispatchText;
  return `${dispatchText}\n\n${block}`;
}
