/**
 * Zod schema for the workflow-state.json boundary. Test-only (see
 * tests/schemas.test.ts) — scripts/crew.ts never imports this file, so `zod`
 * stays a devDependency without breaking a fresh plugin-cache install
 * (dev-team#185, #194).
 *
 * The runtime-validated review/validation artifact schemas that crew.ts DOES
 * parse live in ./artifact-schemas.ts instead, hand-rolled with zero
 * dependencies for exactly that reason — see the file header there.
 *
 * Phase 0 shipped WorkflowStateSchema. Remaining phase plans still add:
 * - CostReportFrontmatterSchema
 * - FeatFrontmatterSchema
 * - SliceFrontmatterSchema
 * - MarketplaceSchema
 * - PluginManifestSchema
 * - HandoffArtifactSchema
 * - DeploymentArtifactSchema
 *
 * See: standards/typescript/coding-conventions.md §Runtime validation with Zod,
 *      docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md §Boundary validation policy.
 */
import { z } from "zod";

const IsoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: "expected ISO 8601 date string" });

const GateEntry = z.object({
  status: z.string(),
  updatedAt: IsoDate,
  note: z.string().optional()
});

const DeploymentGates = z.object({
  dev: GateEntry.nullable(),
  prod: GateEntry.nullable()
});

const RunGates = z.object({
  review: GateEntry.nullable(),
  validation: GateEntry.nullable(),
  deployment: DeploymentGates,
  blocked: GateEntry.nullable(),
  escalation: GateEntry.nullable(),
  incident: GateEntry.nullable().default(null),
  help: GateEntry.nullable().default(null)
});

const RunArtifacts = z.object({
  runBrief: z.string().nullable(),
  handoffs: z.array(z.string()),
  reviewResult: z.string().nullable(),
  validationPlan: z.string().nullable(),
  validationResult: z.string().nullable(),
  deploymentChecks: z.object({
    dev: z.string().nullable(),
    prod: z.string().nullable()
  }),
  finalSynthesis: z.string().nullable()
});

const WorkflowRun = z.object({
  title: z.string(),
  goal: z.string(),
  mode: z.string(),
  status: z.string(),
  startedAt: IsoDate,
  updatedAt: IsoDate,
  completedAt: IsoDate.optional(),
  next: z.string(),
  gates: RunGates,
  artifacts: RunArtifacts
});

export const WorkflowStateSchema = z.object({
  version: z.string(),
  updatedAt: IsoDate,
  currentRun: WorkflowRun.nullable(),
  recentRuns: z.array(WorkflowRun)
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Review/validation verdict enums, normalize* helpers, and the runtime-parsed
// ReviewArtifactSchema / ValidationArtifactSchema moved to ./artifact-schemas.ts
// (dev-team#185, #194) — see that file's header for why.
