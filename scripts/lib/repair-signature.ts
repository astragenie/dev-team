/**
 * scripts/lib/repair-signature.ts — dev-team#257 piece 3.
 *
 * Bounded-retry-loop helper: normalizes a failure result into a stable
 * signature string, then tracks consecutive signatures so a caller can
 * stop early once retrying stops changing the outcome. Ported from the
 * otta-plugin `workflows/repair-policy.mjs` pattern.
 *
 * Pure, no I/O — callers own persistence (see gepa's
 * `no-winner-streak-tracker.ts` for the sibling on-disk pattern when a
 * loop spans separate process invocations).
 */

/**
 * Normalizes raw failure output (stderr, a test-runner summary, a review
 * rejection message, ...) into a short, comparable signature: first
 * non-empty line, whitespace-collapsed, with absolute paths and
 * line:column noise stripped so two retries that hit the identical
 * failure at a slightly different location still compare equal.
 *
 * Returns "" for empty/undefined input — an empty signature never
 * participates in the consecutive-repeat count (see `shouldStop`).
 */
export function normalizeSignature(failureOutput: string | null | undefined): string {
  if (!failureOutput) return "";
  const firstLine = failureOutput
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "";
  return firstLine
    .replace(/[A-Za-z]:[\\/][^\s:]+(:\d+){0,2}|\/[^\s:]+(:\d+){0,2}|\b\d+:\d+(:\d+)?\b/g, "<path>")
    .replace(/\s+/g, " ")
    .trim();
}

export interface RepairSignatureTrackerOptions {
  /** Consecutive repeats of the same signature before shouldStop() flips true. Default 2. */
  stopAfterRepeats?: number;
}

export interface RepairSignatureTracker {
  /**
   * Records `signature` and returns true once it has repeated
   * `stopAfterRepeats` times in a row. A falsy signature is ignored
   * (recorded as neither a repeat nor a break) and always returns false.
   */
  shouldStop(signature: string | null | undefined): boolean;
  /** Clears tracked history — e.g. once a new attempt kind starts. */
  reset(): void;
}

/**
 * Creates a fresh, in-memory consecutive-signature tracker for one bounded
 * retry loop. Signatures are compared as opaque strings — callers normalize
 * with `normalizeSignature` (or their own scheme) before calling
 * `shouldStop`.
 */
export function createRepairSignatureTracker(
  options: RepairSignatureTrackerOptions = {}
): RepairSignatureTracker {
  const stopAfterRepeats = options.stopAfterRepeats ?? 2;
  let lastSignature: string | null = null;
  let consecutiveCount = 0;

  return {
    shouldStop(signature) {
      if (!signature) return false;
      consecutiveCount = signature === lastSignature ? consecutiveCount + 1 : 1;
      lastSignature = signature;
      return consecutiveCount >= stopAfterRepeats;
    },
    reset() {
      lastSignature = null;
      consecutiveCount = 0;
    }
  };
}
