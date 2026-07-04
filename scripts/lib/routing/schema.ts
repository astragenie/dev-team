// scripts/lib/routing/schema.ts — FEAT-crew-architecture-review Section 7
//
// Zod schema for docs/routing-table.yaml, the authoritative machine-readable
// source for dispatcher routing rows. docs/routing-table.md is a generated
// view rendered from this file by scripts/render-routing-table.ts — never
// hand-edit the .md directly; edit the .yaml and re-run the render script.
//
// Zod chosen to match the repo's existing standard (gepa-core's TrialSchema,
// EvalCaseSchema, GepaConfigSchema are all Zod already; package.json already
// carries "zod" as a direct dependency).

import { z } from "zod";

/**
 * One section of the routing table, in fixed render order. Matches the H2/H3
 * headings in docs/routing-table.md. Adding a new section requires a matching
 * entry in scripts/render-routing-table.ts's SECTION_META map (validated at
 * render time — an unmapped section fails the render, not silently drops rows).
 */
export const RoutingSectionSchema = z.enum([
  "builder-matrix",
  "workflow-signals",
  "review-gates",
  "code-language",
  "architecture",
  "infra-ops",
  "research",
  "docs-comms",
  "ux",
  "crew-internals"
]);
export type RoutingSection = z.infer<typeof RoutingSectionSchema>;

export const RoutingRowSchema = z.object({
  /** Observed signal / task pattern / condition, e.g. "New feature request (FEAT-*, `feat:` in title)". */
  signal: z.string().min(1),
  /** Destination role(s), agent id(s), or command — free-form prose (e.g. "dispatcher + fullstack-dev"). */
  route_to: z.string().min(1),
  /** Guidance, skill pointers, rationale. Optional — a handful of builder-matrix rows have none. */
  notes: z.string().optional(),
  section: RoutingSectionSchema
});
export type RoutingRow = z.infer<typeof RoutingRowSchema>;

export const RoutingTableSchema = z.object({
  /** Semver. Bump MAJOR on breaking row-shape changes (new required field, section removed, etc.). */
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be MAJOR.MINOR.PATCH"),
  generated_at: z.string().datetime().optional(),
  rows: z.array(RoutingRowSchema).min(1)
});
export type RoutingTable = z.infer<typeof RoutingTableSchema>;

/** Parses and validates raw YAML-decoded data. Throws ZodError on shape mismatch. */
export function parseRoutingTable(data: unknown): RoutingTable {
  return RoutingTableSchema.parse(data);
}
