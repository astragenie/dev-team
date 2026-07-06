// scripts/lib/models/resolve-model.ts — FEAT-194 S2.
//
// Interactive dispatch (/crew:build, /crew:fix, /crew:orchestrate-slice,
// Agent-tool dispatch) previously inherited the session model instead of
// resolving the builder's intended tier. The autonomous wave path already
// solves this via runner-plugin's `model-router`
// (`resolveModel` / `resolveShapeTier` / `resolveWaveDispatchModel` in
// runner-plugin/src/scripts/lib/model-router.mts), reading
// `.claude/loop.json` -> `loop.modelRouting`.
//
// dev-team has no npm/workspace dependency on runner-plugin — they are
// separate plugin repos with no shared package boundary today — so a direct
// import isn't cleanly available. This module is a deliberate, minimal,
// self-contained MIRROR of that resolver's semantics (phase lookup with
// default fallback, trivial-shape override table), not a divergent fork.
// If runner-plugin's model-router semantics change, mirror the change here
// too rather than let the two drift apart silently.
//
// Pure — no I/O. The CLI wrapper (`crew resolve-model` in scripts/crew.ts)
// owns reading .claude/loop.json and handing the parsed config in.

const FALLBACK_MODEL = "opus";

// Slice shapes that classify-slice-shape-style tooling considers mechanical
// enough to not need top-tier reasoning. Mirrors runner-plugin's
// SHAPE_TIER_MAP (minus the "none" -> null entry, which resolveShapeTier
// below expresses via its return type instead of a table row).
export const TRIVIAL_SHAPE_TIER: Readonly<Record<string, string>> = Object.freeze({
  "doc-update": "sonnet",
  "config-tweak": "sonnet",
  "test-only": "sonnet",
  "single-module-edit": "sonnet"
});

export interface LoopModelRoutingConfig {
  loop?: {
    modelRouting?: Record<string, string>;
  };
}

/**
 * Resolve the trivial-shape tier override for a classified slice shape.
 * Returns null for "none", unrecognized shapes, or a missing shape — callers
 * fall through to resolveModelForPhase() in that case.
 */
export function resolveShapeTier(shape: string | null | undefined): string | null {
  if (!shape) return null;
  return TRIVIAL_SHAPE_TIER[shape] ?? null;
}

/**
 * Resolve the model for a routing phase (e.g. "build", "architect"):
 * modelRouting[phase] -> modelRouting.default -> FALLBACK_MODEL ("opus").
 */
export function resolveModelForPhase(
  phase: string,
  config: LoopModelRoutingConfig | null | undefined
): string {
  const routing = config?.loop?.modelRouting;
  if (!routing) return FALLBACK_MODEL;
  return routing[phase] || routing.default || FALLBACK_MODEL;
}

/**
 * Resolve the model an interactive dispatch should pass explicitly as the
 * Agent-tool `model:` argument: trivial-shape override first, falling back
 * to phase-based routing when the shape doesn't carry one.
 *
 * `modelRoutingEnabled` (FEAT-194 S1) is the crew.json `features["model-
 * routing"].enabled` toggle, resolved by the CLI caller via
 * features-service.ts's `isEnabled()` — this function stays pure/no-I/O, so
 * the caller hands in the already-resolved boolean. Defaults to `true`
 * (routing on) so existing call sites and tests are unaffected. When
 * `false`, routing is fully bypassed (including the trivial-shape override)
 * and the FALLBACK_MODEL ("opus") is returned unconditionally — an operator
 * flips the flag off to audit or roll back routing without editing
 * loop.json.
 */
export function resolveDispatchModel(
  phase: string,
  shape: string | null | undefined,
  config: LoopModelRoutingConfig | null | undefined,
  modelRoutingEnabled = true
): string {
  if (!modelRoutingEnabled) return FALLBACK_MODEL;
  return resolveShapeTier(shape) ?? resolveModelForPhase(phase, config);
}
