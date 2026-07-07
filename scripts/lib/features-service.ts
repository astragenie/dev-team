import fs from "node:fs/promises";
import path from "node:path";

/**
 * Per-feature metadata. Each feature carries its own SemVer so we can
 * deprecate or rename one without touching the others. Add a new entry
 * here when a feature ships; bump `version` when you change its semantics.
 */
export interface FeatureMeta {
  version: string;
  default: boolean;
  description: string;
  scope: "crew" | "shared";
  owner: string;
  since: string;
  deprecates?: string[];
}

export const FEATURES: Readonly<Record<string, FeatureMeta>> = {
  "cost-hygiene": {
    version: "2.1.0",
    default: true,
    description:
      "Umbrella telemetry: read/edit tracking, redundant-read warn, TaskUpdate burst detection.",
    scope: "crew",
    owner: "platform",
    since: "0.38.0"
  },
  "redundant-read-stop": {
    version: "1.1.0",
    default: true,
    description:
      "Warn the agent when re-reading a file with identical content. Gates the warn-emit only; recording still happens under cost-hygiene.",
    scope: "crew",
    owner: "platform",
    since: "0.33.0"
  },
  "shell-preflight": {
    version: "2.1.0",
    default: true,
    description: "Pre-Bash hook: warn on $env: syntax, redirect anti-patterns, etc.",
    scope: "crew",
    owner: "safety",
    since: "0.33.11"
  },
  "subagent-inline-warn": {
    version: "2.1.0",
    default: true,
    description:
      "Warn when a subagent returns a large body without an artifact path. Threshold knob: features['subagent-inline-warn'].threshold (bytes, default 512).",
    scope: "crew",
    owner: "platform",
    since: "0.33.0"
  },
  "push-verify": {
    version: "1.0.0",
    default: false,
    description:
      "Gate git push and gh pr create behind a PASS validation artifact written within the last hour. Opt out per-repo via deployment.md `push.verify: false`. Enable via crew.json features['push-verify'].enabled=true.",
    scope: "crew",
    owner: "safety",
    since: "0.46.1"
  },
  "git-gate-block": {
    version: "1.0.0",
    default: false,
    description:
      "Enforcement level of the repo-side commit/PR gate hook (check_git_gate.sh). Default false = warn (advisory systemMessage on pending badges); flips to block (decision:block) after a 1-week bake. Guardrail: this flag may only soften block→warn, never silence the gate.",
    scope: "shared",
    owner: "safety",
    since: "0.48.0"
  },
  "otel-telemetry": {
    version: "1.0.0",
    default: true,
    description:
      "Wraps the otel-post-tool-use / otel-stop / otel-subagent-stop hooks. Independent of the existing telemetry-config opt-in gate (cfg.enabled + CREW_OTEL_ENABLED) — both must pass for a span to emit.",
    scope: "crew",
    owner: "platform",
    since: "0.48.0"
  },
  "bash-gate-telemetry": {
    version: "1.0.0",
    default: true,
    description:
      "Wraps pre-tool-use-bash-gate / post-tool-use-bash-gate recording. Independent of the existing CREW_BASH_GATE_LOG=0 escape hatch — either one disables recording.",
    scope: "crew",
    owner: "platform",
    since: "0.48.0"
  },
  "task-update-burst-warn": {
    version: "1.0.0",
    default: true,
    description:
      "Wraps the check-task-update-burst hook. Sits alongside the cost-hygiene umbrella check — both must be enabled for burst detection to record.",
    scope: "crew",
    owner: "platform",
    since: "0.48.0"
  },
  "checkpoint-cadence": {
    version: "1.0.0",
    default: true,
    description:
      "dev-team#174: PostToolUse child-side hook. After the first Edit/Write in a builder session, every N post-edit tool calls it injects a systemMessage nudging the builder to write a resume scaffold (.claude/state/crew/checkpoint-<slice>.md) so a mid-job death loses no WIP. Cadence knob: features['checkpoint-cadence'].threshold (default 20).",
    scope: "crew",
    owner: "platform",
    since: "0.54.0"
  },
  "event-emit": {
    version: "1.0.0",
    default: true,
    description:
      "Future P2.2 artifact-event emission at ARTIFACT_HANDLERS (unify-event-stream). Registry entry only — no consumer wired yet.",
    scope: "shared",
    owner: "platform",
    since: "0.48.0"
  },
  "model-routing": {
    version: "1.0.0",
    default: true,
    description:
      "Gates model-tier routing for the `crew resolve-model` CLI (interactive /crew:build /crew:fix /crew:orchestrate-slice dispatch). Enabled (default): resolves .claude/loop.json loop.modelRouting as today (build -> sonnet). Disabled: resolve-model always returns the opus fallback regardless of loop.json, so an operator can turn routing off for audit/rollback without deleting the loop.json config.",
    scope: "crew",
    owner: "platform",
    since: "0.51.2"
  }
} as const;

export type FeatureName = keyof typeof FEATURES;

export function getFeatureMeta(name: string): FeatureMeta | undefined {
  return FEATURES[name];
}

export function listFeatures(): ReadonlyArray<{ name: string } & FeatureMeta> {
  return Object.entries(FEATURES).map(([name, meta]) => ({ name, ...meta }));
}

/**
 * Check if a feature is enabled.
 *
 * Reads config.features?.[feature]?.enabled.
 * Returns true if:
 *   - config is null/undefined
 *   - config.features is missing
 *   - config.features[feature] is missing
 *   - config.features[feature].enabled is not a boolean (malformed)
 *
 * Returns false if:
 *   - config.features[feature].enabled is explicitly false
 *
 * This default-ON policy ensures backward compatibility — features must be
 * explicitly disabled in config to be gated off.
 *
 * Every gate evaluation emits a diagnostic line on stderr (feature name +
 * resolved state) so stdout stays a clean machine-readable channel.
 */
export function isEnabled(feature: string, config: unknown): boolean {
  const enabled =
    config &&
    typeof config === "object" &&
    "features" in config &&
    config.features &&
    typeof config.features === "object" &&
    feature in config.features &&
    config.features[feature as never] &&
    typeof config.features[feature as never] === "object" &&
    "enabled" in config.features[feature as never] &&
    typeof (config.features[feature as never] as Record<string, unknown>).enabled === "boolean"
      ? (config.features[feature as never] as Record<string, unknown>).enabled === true
      : (FEATURES[feature as FeatureName]?.default ?? true);

  // Emit a diagnostic line on stderr (NOT stdout) so machine-readable CLI
  // JSON output stays clean. Mirrors dispatch-trace.mts's stderr convention.
  process.stderr.write(`[features] ${feature}: ${enabled ? "enabled" : "disabled"}\n`);
  return enabled;
}

/**
 * Read the crew config from <cwd>/.claude/crew.json.
 *
 * Returns the parsed object on success. On missing file or malformed JSON,
 * returns an empty object {} — NEVER throws, to ensure hooks remain robust.
 */
export async function readCrewConfig(cwd: string): Promise<unknown> {
  const configPath = path.join(cwd, ".claude", "crew.json");

  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(content);
    return parsed;
  } catch {
    // Missing file, read error, or JSON parse error → return empty config
    // Hooks must not crash due to config issues
    return {};
  }
}
