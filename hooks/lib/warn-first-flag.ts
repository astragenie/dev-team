// hooks/lib/warn-first-flag.ts
// Shared local flag-resolution helper for warn-first / block-after-bake
// hooks that need a per-feature enabled flag which is NOT (yet) registered
// in scripts/lib/features-service.ts's central FEATURES table.
//
// Why local instead of routed through isEnabled()/FEATURES: this module's
// task scope (dev-team#257 pieces 1+2) is hooks/** + tests/hooks/** only —
// registering a new FEATURES entry means editing scripts/lib/features-service.ts,
// which is out of that boundary for this slice (see the PR body's deviation
// note). isEnabled()'s fallback-to-default behavior is also the wrong shape
// for an unregistered feature name: an unknown key resolves through
// `FEATURES[feature]?.default ?? true`, i.e. enabled by default — the exact
// opposite of the warn-first bake-in this helper exists to implement.
//
// Semantics mirror the proven git-gate-block / dispatch-size-gate precedent
// (scripts/lib/features-service.ts's own FEATURES entries for those two):
// default false (warn-only); a consumer repo must explicitly set
// config.features[<featureName>].enabled = true in .claude/crew.json to
// escalate a gate from warn (systemMessage, never blocks) to block
// (decision:"block").
export function resolveBlockMode(config: unknown, featureName: string): boolean {
  if (
    config === null ||
    typeof config !== "object" ||
    !("features" in config) ||
    (config as Record<string, unknown>)["features"] === null ||
    typeof (config as Record<string, unknown>)["features"] !== "object"
  ) {
    return false;
  }
  const features = (config as Record<string, unknown>)["features"] as Record<string, unknown>;
  const entry = features[featureName];
  if (entry === null || typeof entry !== "object" || !("enabled" in entry)) {
    return false;
  }
  const val = (entry as Record<string, unknown>)["enabled"];
  return typeof val === "boolean" ? val : false;
}
