/**
 * OTel span schema and deterministic id helpers for FEAT-165 SLICE-A backfill.
 *
 * No runtime SDK import — types only. Span shape matches the OTLP/JSON contract
 * that Langfuse /api/public/otel/v1/traces ingests.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SpanKindSchema = z.enum(["INTERNAL", "CLIENT", "SERVER", "PRODUCER", "CONSUMER"]);

export const SpanStatusSchema = z.object({
  code: z.enum(["UNSET", "OK", "ERROR"]),
  message: z.string().optional()
});

// OTLP forbids null; numeric attrs may be int or float.
export const SpanAttrValueSchema = z.union([z.string(), z.number(), z.boolean()]);

// Time stored as decimal nanoseconds since epoch in a string (avoids JS number precision loss).
export const SpanEventSchema = z.object({
  name: z.string(),
  timeUnixNano: z.string(),
  attributes: z.record(SpanAttrValueSchema).optional()
});

export const SpanRecordSchema = z
  .object({
    traceId: z.string().regex(/^[0-9a-f]{32}$/),
    spanId: z.string().regex(/^[0-9a-f]{16}$/),
    parentSpanId: z
      .string()
      .regex(/^[0-9a-f]{16}$/)
      .optional(),
    name: z.string(),
    kind: SpanKindSchema,
    startTimeUnixNano: z.string(),
    endTimeUnixNano: z.string(),
    attributes: z.record(SpanAttrValueSchema),
    events: z.array(SpanEventSchema).default([]),
    status: SpanStatusSchema
  })
  .passthrough();

export type SpanRecord = z.infer<typeof SpanRecordSchema>;

// ---------------------------------------------------------------------------
// Deterministic id helpers — SHA-256-seeded, stable across re-runs
// ---------------------------------------------------------------------------

/**
 * Returns a deterministic 32-hex string derived from SHA-256(seed).
 * Same seed always produces the same trace id — backfilling the same
 * cost report twice yields the same trace (idempotent).
 */
export function newTraceId(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

/**
 * Returns a deterministic 16-hex string derived from SHA-256(seed).
 */
export function newSpanId(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}
