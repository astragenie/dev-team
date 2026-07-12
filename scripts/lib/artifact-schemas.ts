/**
 * Frontmatter-level validation for `write-review-result` / `write-validation-result`.
 *
 * Zero-dependency by design: this module sits on scripts/crew.ts's top-level
 * (static) import chain, which resolves on EVERY crew.ts invocation regardless
 * of which command runs. A marketplace plugin-cache install ships source only
 * — no `node_modules`, no install step — so any bare-specifier import here
 * (e.g. `zod`) throws `ERR_MODULE_NOT_FOUND` before the CLI can even dispatch
 * (dev-team#185, #194). Same failure shape/fix as the `@opentelemetry/api`
 * top-level-import bug fixed in v0.37.2 (CHANGELOG). The validation surface
 * here (a handful of optional string fields, one enum, one conditional
 * refinement) is small enough to hand-roll; `zod` stays a devDependency for
 * the test-only `WorkflowStateSchema` in schemas.ts, which crew.ts never
 * imports.
 *
 * `safeParse` mirrors zod's `{ success, data } | { success, error }` result
 * shape so existing callers (crew.ts's refuseIfSchemaInvalid, tests) are
 * unchanged.
 */

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

export interface SchemaIssue {
  message: string;
  path: string[];
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: { issues: SchemaIssue[] } };

function ok<T>(data: T): SafeParseResult<T> {
  return { success: true, data };
}

function fail<T>(issues: SchemaIssue[]): SafeParseResult<T> {
  return { success: false, error: { issues } };
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

// Frontmatter-level schemas. Scoped to the fields that actually land in
// frontmatter (see renderOptionalFrontmatter in artifacts/write.ts) — not the
// full CLI fields blob, which also carries body-prose-only concerns (summary,
// evidence, files, risks, next, reviewer, testSummary, ...).
export interface ReviewArtifactInput {
  decision?: string | undefined;
  phase?: string | undefined;
  feature?: string | undefined;
  slice?: string | undefined;
  findings?: string | undefined;
  status?: string | undefined;
  // dev-team#247: optional, backward-compatible review-metadata fields.
  not_checked?: string[] | undefined;
  author_id?: string | undefined;
  judge_id?: string | undefined;
  self_approval?: boolean | undefined;
}

export const ReviewArtifactSchema = {
  safeParse(value: ReviewArtifactInput): SafeParseResult<ReviewArtifactInput> {
    const issues: SchemaIssue[] = [];
    if (
      value.decision !== undefined &&
      !(REVIEW_DECISIONS as readonly string[]).includes(value.decision)
    ) {
      issues.push({
        message: `Invalid enum value. Expected ${REVIEW_DECISIONS.map((d) => `'${d}'`).join(" | ")}, received '${value.decision}'`,
        path: ["decision"]
      });
    }
    for (const key of [
      "phase",
      "feature",
      "slice",
      "findings",
      "status",
      "author_id",
      "judge_id"
    ] as const) {
      if (!isOptionalString(value[key])) {
        issues.push({ message: `Expected string, received ${typeof value[key]}`, path: [key] });
      }
    }
    if (value.not_checked !== undefined) {
      if (
        !Array.isArray(value.not_checked) ||
        value.not_checked.some((v) => typeof v !== "string")
      ) {
        issues.push({ message: "Expected array of strings", path: ["not_checked"] });
      }
    }
    if (value.self_approval !== undefined && typeof value.self_approval !== "boolean") {
      issues.push({
        message: `Expected boolean, received ${typeof value.self_approval}`,
        path: ["self_approval"]
      });
    }
    return issues.length > 0 ? fail(issues) : ok(value);
  }
};

export interface ValidationArtifactInput {
  decision?: string | undefined;
  skip_reason?: string | undefined;
  phase?: string | undefined;
  feature?: string | undefined;
  slice?: string | undefined;
  findings?: string | undefined;
  status?: string | undefined;
  validation_evidence?: string | undefined;
}

export const ValidationArtifactSchema = {
  safeParse(value: ValidationArtifactInput): SafeParseResult<ValidationArtifactInput> {
    const issues: SchemaIssue[] = [];
    if (
      value.decision !== undefined &&
      !(VALIDATION_DECISIONS as readonly string[]).includes(value.decision)
    ) {
      issues.push({
        message: `Invalid enum value. Expected ${VALIDATION_DECISIONS.map((d) => `'${d}'`).join(" | ")}, received '${value.decision}'`,
        path: ["decision"]
      });
    }
    for (const key of [
      "skip_reason",
      "phase",
      "feature",
      "slice",
      "findings",
      "status",
      "validation_evidence"
    ] as const) {
      if (!isOptionalString(value[key])) {
        issues.push({ message: `Expected string, received ${typeof value[key]}`, path: [key] });
      }
    }
    if (value.decision === "skipped" && !value.skip_reason?.trim()) {
      issues.push({
        message: "skip_reason is required when decision is 'skipped'",
        path: ["skip_reason"]
      });
    }
    return issues.length > 0 ? fail(issues) : ok(value);
  }
};
