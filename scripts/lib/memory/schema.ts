// scripts/lib/memory/schema.ts — FEAT-188 S2
//
// Zod schemas for the MemoryProvider interface's two boundaries:
//   1. MemoryEntry — the persisted, on-disk shape (kind | severity | tags |
//      summary<=280 | source provenance | supersedes).
//   2. MemoryConfigSchema — the unified `memory` config block. This resolves
//      the collision between runner-plugin's live memory-bridge keys
//      (enabled, recall.k, recall.timeoutMs, project) and this FEAT's new
//      keys (provider, dualWrite, recall.maxTokens, capture.events). See
//      docs/research/2026-07-06-memory-bridge-reconciliation.md section 4.
import { z } from "zod";

const MAX_SUMMARY_LENGTH = 280;

const IsoTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "expected an ISO 8601 timestamp" });

export const MemorySeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type MemorySeverity = z.infer<typeof MemorySeveritySchema>;

export const MemoryKindSchema = z.enum(["failure", "lesson", "decision", "standard_violation"]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

/** The persisted shape of one memory entry (a single JSONL row). */
export const MemoryEntrySchema = z.object({
  id: z.string().min(1),
  ts: IsoTimestamp,
  kind: MemoryKindSchema,
  severity: MemorySeveritySchema,
  /** Agent the entry is scoped to; absent/null = applies to all agents. */
  agent: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  /** One-line summary, injected verbatim at recall time. */
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH),
  /** Full text, fetched only on demand — never injected by default. */
  detail: z.string().optional(),
  /** Provenance: artifact path, DEC id, or capture-site name. Mandatory. */
  source: z.string().min(1),
  /** Id of the entry this one replaces, when part of a supersede chain. */
  supersedes: z.string().optional()
});
export type MemoryEntry = z.infer<typeof MemoryEntrySchema>;

/**
 * Caller-supplied shape for capture()/supersede() — id and ts are optional
 * because the provider assigns them when the caller omits them.
 */
export const MemoryEntryInputSchema = MemoryEntrySchema.extend({
  id: z.string().min(1).optional(),
  ts: IsoTimestamp.optional()
});
// z.input (not z.infer/output) so tags/id/ts stay optional pre-defaulting —
// this is the shape callers pass to capture()/supersede(), before the
// provider assigns id/ts and Zod fills in default tags.
export type MemoryEntryInput = z.input<typeof MemoryEntryInputSchema>;

export const MemoryProviderKindSchema = z.enum(["none", "file", "astramem"]);
export type MemoryProviderKind = z.infer<typeof MemoryProviderKindSchema>;

const MemoryEnabledModeSchema = z.enum(["auto", "never"]);

const RecallConfigSchema = z
  .object({
    /** Shared recall kill-switch (bridge-live key). */
    enabled: z.boolean().default(true),
    /** Bridge-live key — FEAT-188's original draft used `topK`; renamed to match. */
    k: z.number().int().positive().default(5),
    timeoutMs: z.number().int().positive().default(5000),
    /** Additive — token budget for the injected recall block. */
    maxTokens: z.number().int().positive().default(800)
  })
  .strict();

const DEFAULT_CAPTURE_EVENTS = [
  "slice_close",
  "review_fail",
  "validation_fail",
  "inline_return_warn",
  "subagent_incomplete",
  "incident_close"
];

const CaptureConfigSchema = z
  .object({
    events: z.array(z.string()).default(DEFAULT_CAPTURE_EVENTS)
  })
  .strict();

/** The unified `memory` config block (`.claude/loop.json` / `crew.json`). */
export const MemoryConfigSchema = z
  .object({
    /** Bridge-live key — gates emit/recall active independent of provider. */
    enabled: MemoryEnabledModeSchema.default("auto"),
    /** NEW — backend selector, orthogonal to `enabled`. Absent = "none". */
    provider: MemoryProviderKindSchema.default("none"),
    /**
     * NEW — when provider:"astramem", also append to the local JSONL
     * duplicate (operator's "2 parallel providers" mode). Ignored for
     * provider:"file"|"none". S2 only parses + carries this; S4 consumes it.
     */
    dualWrite: z.boolean().default(false),
    /** Bridge-live key — cortex project (never featId; DEC-065/066). */
    project: z.string().optional(),
    recall: RecallConfigSchema.default({}),
    capture: CaptureConfigSchema.default({})
  })
  .strict();
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
