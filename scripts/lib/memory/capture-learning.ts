// capture-learning.ts — FEAT-188 S1a capture repair.
//
// The legacy learnings store (.claude/artifacts/loop/learnings.jsonl) has
// been stale since 2026-06-11 (zero capture through the entire GEPA
// cluster) — nothing wired review-FAIL, validation-FAIL, inline-return-warn,
// or a mid-job death signal into it. This module is the fix: a single
// fire-and-forget sink every capture site (scripts/lib/artifacts/write.ts,
// hooks/lib/check-subagent-return.ts) calls into.
//
// This is NOT the S2 MemoryProvider (scripts/lib/memory/{schema,types,
// file-provider}.ts, Zod schema, provider-swap interface) on its own — S1a
// wrote straight to the existing JSONL so capture worked before S2 shipped,
// independent of astramem, using an entry shape S2's Zod schema
// (kind/severity/tags/summary/source) adopted without a migration. Existing
// rows in the file predate this shape (id/timestamp/key/insight/confidence)
// — JSONL tolerates the heterogeneous rows; S2's legacy-adapter.ts
// reconciles them at recall() time.
//
// Contract: NEVER throws. Any failure (missing dir, unwritable path,
// permissions) is swallowed — capture must never block or fail the
// review/validation gate or hook it rides on (FEAT-188 S1a AC-6).
//
// FEAT-188 S2 note: appendJsonlEntry()/LEARNINGS_PATH are exported so the S2
// fileProvider (scripts/lib/memory/file-provider.ts) can write into this
// SAME store using this SAME atomic-append primitive — not a second,
// forked JSONL writer.
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/** Path (relative to repoPath) of the durable, committed learnings store. */
export const LEARNINGS_PATH = [".claude", "artifacts", "loop", "learnings.jsonl"];

const MAX_SUMMARY_LENGTH = 280;

/**
 * Append one JSON line to `repoPath/segments...`. Creates parent directories
 * as needed. Fire-and-forget: never throws. Shared by captureFailureLearning
 * below and the S2 fileProvider.
 */
export async function appendJsonlEntry(
  repoPath: string,
  segments: string[],
  entry: Record<string, unknown>
): Promise<void> {
  try {
    const targetPath = path.join(repoPath, ...segments);
    await mkdir(path.dirname(targetPath), { recursive: true });
    // O_APPEND — atomic append, safe under concurrent writers.
    await appendFile(targetPath, `${JSON.stringify(entry)}\n`, { flag: "a" });
  } catch {
    // Fire-and-forget: never propagate.
  }
}

export type FailureSeverity = "low" | "medium" | "high" | "critical";

export interface FailureEntryInput {
  /** Agent that produced the failing artifact/return, when known. */
  agent?: string | null;
  severity?: FailureSeverity;
  /** Free-text summary of the failure; truncated to 280 chars. */
  summary: string;
  tags?: string[];
  /** Origin of the capture, e.g. "review_fail" | "validation_fail" | "inline-return-warn" | "subagent-incomplete". */
  source: string;
}

/**
 * Append a `failure`-kind entry to the legacy learnings.jsonl store.
 * Fire-and-forget: never throws, never propagates. Mirrors the
 * fireCaptureTeeSilent contract in scripts/lib/artifacts/write.ts — this is
 * its learnings-store sibling for FEAT-188 S1a.
 */
export async function captureFailureLearning(
  repoPath: string,
  entry: FailureEntryInput
): Promise<void> {
  await appendJsonlEntry(repoPath, LEARNINGS_PATH, {
    kind: "failure",
    ts: new Date().toISOString(),
    agent: entry.agent ?? null,
    severity: entry.severity ?? "medium",
    tags: entry.tags ?? [],
    summary: entry.summary.slice(0, MAX_SUMMARY_LENGTH),
    source: entry.source
  });
}
