/**
 * Zod schemas for every JSON-on-disk boundary the crew CLI reads or writes.
 *
 * Phase 0 shipped WorkflowStateSchema. P1.3 (2026-07-04) adds ReviewArtifactSchema
 * and ValidationArtifactSchema — the enum verdict frontmatter contract. Remaining
 * phase plans still add:
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
  incident: GateEntry.nullable().default(null)
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

// ---------------------------------------------------------------------------
// P1.3 — canonical review / validation verdict enums (D7 2026-07-04)
//
// The pre-existing `decision` CLI flag on write-review-result / write-validation-result
// stays a free-form field for body-prose back-compat (existing artifacts and tests
// assert on literal legacy strings like "passed_with_notes"). These enums + the
// normalize* helpers below are the machine-readable canonical layer written
// alongside it: crew.ts normalizes the raw --decision input into one of these
// enum values ("verdict"), writes it to a dedicated frontmatter `decision:` field,
// and workflow-state.ts's ARTIFACT_HANDLERS switch on the canonical value only
// (never on the raw legacy string) so an unrecognized verdict throws instead of
// silently mapping to *_passed.
// ---------------------------------------------------------------------------

export const REVIEW_DECISIONS = ["approved", "approved_with_notes", "rejected"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const VALIDATION_DECISIONS = ["pass", "fail", "skipped"] as const;
export type ValidationDecision = (typeof VALIDATION_DECISIONS)[number];

// needs_fix is a write-time alias for rejected, not a fourth review state (D7).
// approved_with_conditions / needs_revision are the verdicts agents/architect-reviewer.md
// actually emits (FIX-0) — widened here rather than adding a fourth/fifth
// canonical state, same pattern as needs_fix.
const REVIEW_DECISION_ALIASES: Record<string, ReviewDecision> = {
  needs_fix: "rejected",
  approved_with_conditions: "approved_with_notes",
  needs_revision: "rejected"
};

// Legacy values actually emitted by existing callers (agents/verifier.md,
// agents/release-engineer.md, commands/ship.md) before P1.3 introduced the
// canonical enum. Normalized rather than rejected so those callers don't break.
const VALIDATION_DECISION_ALIASES: Record<string, ValidationDecision> = {
  passed: "pass",
  passed_with_notes: "pass",
  failed: "fail",
  skip: "skipped"
};

export interface DecisionNormalization<T extends string> {
  canonical: T;
  /** Present when the input differed from the canonical spelling (alias or legacy value). */
  aliasOf?: string;
}

/** Returns null for unrecognized input (including empty/whitespace) — callers must refuse, never fail open. */
export function normalizeReviewDecision(
  input: string | null | undefined
): DecisionNormalization<ReviewDecision> | null {
  if (!input) return null;
  if ((REVIEW_DECISIONS as readonly string[]).includes(input)) {
    return { canonical: input as ReviewDecision };
  }
  const alias = REVIEW_DECISION_ALIASES[input];
  return alias ? { canonical: alias, aliasOf: input } : null;
}

/** Returns null for unrecognized input (including empty/whitespace) — callers must refuse, never fail open. */
export function normalizeValidationDecision(
  input: string | null | undefined
): DecisionNormalization<ValidationDecision> | null {
  if (!input) return null;
  if ((VALIDATION_DECISIONS as readonly string[]).includes(input)) {
    return { canonical: input as ValidationDecision };
  }
  const alias = VALIDATION_DECISION_ALIASES[input];
  return alias ? { canonical: alias, aliasOf: input } : null;
}

// Frontmatter-level schemas. Scoped to the fields that actually land in
// frontmatter (see renderOptionalFrontmatter in artifacts/write.ts) — not the
// full CLI fields blob, which also carries body-prose-only concerns (summary,
// evidence, files, risks, next, reviewer, testSummary, ...).
export const ReviewArtifactSchema = z.object({
  decision: z.enum(REVIEW_DECISIONS).optional(),
  phase: z.string().optional(),
  feature: z.string().optional(),
  slice: z.string().optional(),
  findings: z.string().optional(),
  status: z.string().optional(),
  // dev-team#247: optional, backward-compatible review-metadata fields.
  not_checked: z.array(z.string()).optional(),
  author_id: z.string().optional(),
  judge_id: z.string().optional(),
  self_approval: z.boolean().optional()
});
export type ReviewArtifact = z.infer<typeof ReviewArtifactSchema>;

export const ValidationArtifactSchema = z
  .object({
    decision: z.enum(VALIDATION_DECISIONS).optional(),
    skip_reason: z.string().optional(),
    phase: z.string().optional(),
    feature: z.string().optional(),
    slice: z.string().optional(),
    findings: z.string().optional(),
    status: z.string().optional(),
    validation_evidence: z.string().optional()
  })
  .superRefine((val, ctx) => {
    if (val.decision === "skipped" && !val.skip_reason?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "skip_reason is required when decision is 'skipped'",
        path: ["skip_reason"]
      });
    }
  });
export type ValidationArtifact = z.infer<typeof ValidationArtifactSchema>;
