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
//
// FEAT-194 S3: this resolver does NOT consult an agent's `model_pinned`
// frontmatter (agents/*.md). That field is a declared-preference default
// only — see docs/standards/agent-playbook.md "`model_pinned` is advisory,
// not enforced" for the reconciliation note. While routing is ENABLED,
// effective model comes from `loop.modelRouting` (this file) or the
// operator's manual `model:` arg on the Agent tool call. While routing is
// DISABLED (crew.json features["model-routing"].enabled: false, or
// loop.modelRouting.enabled: false), resolveDispatchModel returns null and
// dispatches omit `model:` entirely — the harness then honors each agent's
// `model:` frontmatter in agents/*.md. Keep this comment and that doc note
// in sync if per-agent routing is ever wired in.

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
    modelRouting?: Record<string, string | boolean | Record<string, string>>;
  };
}

/**
 * Config-level kill-switch (mirrors runner-plugin's model-router semantics):
 * `loop.modelRouting.enabled: false` disables routing for this repo without
 * deleting the block. Absent block or absent `enabled` key → routing stays
 * in whatever state the crew.json feature flag says (see resolveDispatchModel).
 */
export function isModelRoutingEnabledInConfig(
  config: LoopModelRoutingConfig | null | undefined
): boolean {
  return config?.loop?.modelRouting?.["enabled"] !== false;
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
  const phaseTier = routing[phase];
  const defaultTier = routing["default"];
  return (
    (typeof phaseTier === "string" ? phaseTier : null) ||
    (typeof defaultTier === "string" ? defaultTier : null) ||
    FALLBACK_MODEL
  );
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
 * (routing on) so existing call sites and tests are unaffected.
 *
 * Disabled semantics (either the crew.json flag is off or
 * `loop.modelRouting.enabled: false` in loop.json): returns null, meaning
 * "do not pass a model: argument at all". Omitting the argument lets the
 * dispatched agent's own `model:` frontmatter (agents/*.md) govern — the
 * whole point of disabling routing is that per-agent declared models win,
 * not that everything silently pins to the opus fallback.
 */
export function resolveDispatchModel(
  phase: string,
  shape: string | null | undefined,
  config: LoopModelRoutingConfig | null | undefined,
  modelRoutingEnabled = true
): string | null {
  if (!modelRoutingEnabled) return null;
  if (!isModelRoutingEnabledInConfig(config)) return null;
  return resolveShapeTier(shape) ?? resolveModelForPhase(phase, config);
}
