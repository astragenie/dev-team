/**
 * Minimal, dependency-free feature-flag reader for the otel-* hook shims.
 *
 * Why this exists instead of importing ../features-service.ts directly: the
 * plugin-cache smoke test (tests/telemetry-plugin-cache-smoke.test.ts)
 * simulates an install that only ships hooks/ + scripts/lib/telemetry/ on
 * the otel hooks' static-import graph. A static `import ... from
 * "../features-service.ts"` reaches outside that tree and throws
 * MODULE_NOT_FOUND before main() ever runs — even on the disabled-telemetry
 * default path that never actually needs the registry. This file duplicates
 * just the resolution rule (explicit features.<name>.enabled wins, else the
 * registered default) for the one flag the otel hooks consume, so the whole
 * dependency stays inside the copied tree.
 *
 * Mirrors runner-plugin's hooks/feature-flag-lite.mjs pattern.
 *
 * MUST stay in sync with the `default` field of the same name in
 * ../features-service.ts — a parity test in tests/features-service.test.ts
 * fails the suite if this drifts from the registry.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const HOOK_FLAG_DEFAULTS: Readonly<Record<string, boolean>> = {
  "otel-telemetry": true
};

/**
 * Resolve whether `name` is enabled by reading `<cwd>/.claude/crew.json`.
 * Returns the registered default (or `true` if `name` isn't in
 * HOOK_FLAG_DEFAULTS) on any missing file, parse error, or malformed entry —
 * hooks must never crash or block on config issues. Emits the same
 * `[features] <name>: enabled|disabled` stderr diagnostic as
 * features-service.ts's isEnabled() for parity with existing hook tests.
 */
export async function isFeatureEnabledLite(
  name: string,
  cwd: string = process.cwd()
): Promise<boolean> {
  const fallback = Object.hasOwn(HOOK_FLAG_DEFAULTS, name) ? HOOK_FLAG_DEFAULTS[name]! : true;

  let enabled = fallback;
  try {
    const configPath = path.join(cwd, ".claude", "crew.json");
    const raw = await fs.readFile(configPath, "utf8");
    const config: unknown = JSON.parse(raw);
    const value =
      config && typeof config === "object" && "features" in config
        ? (config as Record<string, unknown>)["features"]
        : undefined;
    const entry =
      value && typeof value === "object" ? (value as Record<string, unknown>)[name] : undefined;
    const flag =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>)["enabled"] : undefined;
    if (typeof flag === "boolean") enabled = flag;
  } catch {
    // Missing file, read error, or JSON parse error — fall back to default.
  }

  process.stderr.write(`[features] ${name}: ${enabled ? "enabled" : "disabled"}\n`);
  return enabled;
}
