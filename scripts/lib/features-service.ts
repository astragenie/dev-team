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
      "Gates model-tier routing for the `crew resolve-model` CLI (interactive /crew:build /crew:fix /crew:orchestrate-slice dispatch) and the pre-tool-use-model-enforce hook. Enabled (default): resolves .claude/loop.json loop.modelRouting as today (build -> sonnet). Disabled: resolve-model prints the sentinel 'inherit' and the hook stands down — dispatches omit the Agent-tool model: argument so each agent's own model: frontmatter (agents/*.md) governs.",
    scope: "crew",
    owner: "platform",
    since: "0.51.2"
  },
  "reviewer-decision-guard": {
    version: "1.0.0",
    default: true,
    description:
      "SubagentStop guard (dev-team#199): blocks a reviewer-tier subagent (crew:reviewer, crew:reviewer-lite, crew:typescript-reviewer, crew:csharp-reviewer, crew:architect-reviewer) from going idle with no delivered decision (decision: approved|approved_with_notes|rejected line, or a written review-result artifact path). Mitigates parallel reviewer fan-out idling that stalls the dispatcher's post-review gate.",
    scope: "crew",
    owner: "safety",
    since: "0.59.0"
  },
  "builder-terminal-state-guard": {
    version: "1.0.0",
    default: true,
    description:
      "SubagentStop guard (dev-team#187, #174 — Wave 3 Guard 1, 'deliver-before-die'): blocks a builder-tier subagent (crew:fullstack-dev, crew:backend-dev, crew:frontend-dev, crew:aiplugin-dev, crew:dev-lite) from going idle with no delivered terminal state (a DONE|BLOCKED|HELP|IN-PROGRESS Report-contract line, or a written handoff/artifact path). BLOCKED is itself a valid terminal state and is never blocked. One retry only (stop_hook_active re-entry guard). Mitigates a builder clipping its report after risky work (commit/push/PR) but before the STATUS line the dispatcher's gates look for.",
    scope: "crew",
    owner: "safety",
    since: "0.63.0"
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
