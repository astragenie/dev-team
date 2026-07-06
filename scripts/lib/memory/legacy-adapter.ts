// scripts/lib/memory/legacy-adapter.ts — FEAT-188 S2
//
// .claude/artifacts/loop/learnings.jsonl has accumulated three row
// generations (per capture-learning.ts's own comment):
//   1. pre-S1a legacy:  { id, timestamp, key, insight, confidence }
//   2. S1a capture repair: { kind, ts, agent, severity, tags, summary, source }
//      (no id, no supersedes)
//   3. S2 MemoryEntrySchema: the full shape, already valid as-is.
// normalizeLegacyRow() reconciles all three into MemoryEntry, and returns
// null for anything unrecognized — including torn/corrupt trailing lines
// from a mid-write crash, which is how "torn-line discard on read" (AC)
// is satisfied: an unparseable row simply fails every shape check below.
import {
  MemoryEntrySchema,
  type MemoryEntry,
  type MemoryKind,
  type MemorySeverity
} from "./schema.ts";

const MAX_SUMMARY_LENGTH = 280;
const DEFAULT_SEVERITY: MemorySeverity = "medium";
const VALID_KINDS: MemoryKind[] = ["failure", "lesson", "decision", "standard_violation"];

function isValidKind(value: unknown): value is MemoryKind {
  return typeof value === "string" && (VALID_KINDS as string[]).includes(value);
}

function isValidSeverity(value: unknown): value is MemorySeverity {
  return typeof value === "string" && ["critical", "high", "medium", "low"].includes(value);
}

function fromS1aShape(raw: Record<string, unknown>, indexHint: number): MemoryEntry | null {
  const candidate = {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `legacy-s1a-${indexHint}`,
    ts: raw.ts,
    kind: isValidKind(raw.kind) ? raw.kind : "failure",
    severity: isValidSeverity(raw.severity) ? raw.severity : DEFAULT_SEVERITY,
    agent: typeof raw.agent === "string" ? raw.agent : null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    summary: (raw.summary as string).slice(0, MAX_SUMMARY_LENGTH),
    source: raw.source
  };
  const parsed = MemoryEntrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function fromPreS1aShape(raw: Record<string, unknown>, indexHint: number): MemoryEntry | null {
  const candidate = {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `legacy-pre-s1a-${indexHint}`,
    ts: raw.timestamp,
    kind: "lesson" as const,
    severity: DEFAULT_SEVERITY,
    agent: null,
    tags: typeof raw.key === "string" ? [raw.key] : [],
    summary: (raw.insight as string).slice(0, MAX_SUMMARY_LENGTH),
    source: "legacy"
  };
  const parsed = MemoryEntrySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Normalize one raw JSONL row into a MemoryEntry, or null when unrecognized/torn. */
export function normalizeLegacyRow(raw: unknown, indexHint: number): MemoryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  // Generation 3: already schema-valid as-is.
  const direct = MemoryEntrySchema.safeParse(row);
  if (direct.success) return direct.data;

  // Generation 2: S1a capture-repair shape.
  if (
    typeof row.summary === "string" &&
    typeof row.source === "string" &&
    typeof row.ts === "string"
  ) {
    return fromS1aShape(row, indexHint);
  }

  // Generation 1: pre-S1a legacy shape.
  if (typeof row.insight === "string" && typeof row.timestamp === "string") {
    return fromPreS1aShape(row, indexHint);
  }

  return null;
}
