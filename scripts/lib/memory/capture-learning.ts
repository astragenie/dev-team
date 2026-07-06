// capture-learning.ts — FEAT-188 S1a capture repair.
//
// The legacy learnings store (.claude/artifacts/loop/learnings.jsonl) has
// been stale since 2026-06-11 (zero capture through the entire GEPA
// cluster) — nothing wired review-FAIL, validation-FAIL, inline-return-warn,
// or a mid-job death signal into it. This module is the fix: a single
// fire-and-forget sink every capture site (scripts/lib/artifacts/write.ts,
// hooks/lib/check-subagent-return.ts) calls into.
//
// This is NOT the S2 MemoryProvider (src/lib/memory/, Zod schema,
// provider-swap interface) — that doesn't exist yet. S1a writes straight to
// the existing JSONL so capture works today, independent of S2/astramem,
// using an entry shape S2's eventual Zod schema (kind/severity/tags/
// summary/source) can adopt without a migration. Existing rows in the file
// predate this shape (id/timestamp/key/insight/confidence) — JSONL
// tolerates the heterogeneous rows; S2 owns reconciling them.
//
// Contract: NEVER throws. Any failure (missing dir, unwritable path,
// permissions) is swallowed — capture must never block or fail the
// review/validation gate or hook it rides on (FEAT-188 S1a AC-6).
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

const LEARNINGS_PATH = [".claude", "artifacts", "loop", "learnings.jsonl"];
const MAX_SUMMARY_LENGTH = 280;

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
  try {
    const targetPath = path.join(repoPath, ...LEARNINGS_PATH);
    await mkdir(path.dirname(targetPath), { recursive: true });
    const line = `${JSON.stringify({
      kind: "failure",
      ts: new Date().toISOString(),
      agent: entry.agent ?? null,
      severity: entry.severity ?? "medium",
      tags: entry.tags ?? [],
      summary: entry.summary.slice(0, MAX_SUMMARY_LENGTH),
      source: entry.source
    })}\n`;
    // O_APPEND — atomic append, safe under concurrent writers.
    await appendFile(targetPath, line, { flag: "a" });
  } catch {
    // Fire-and-forget: never propagate (AC-6 — degrade safely).
  }
}
