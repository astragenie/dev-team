/**
 * Telemetry config loader for FEAT-165 SLICE-B.
 *
 * Reads + validates .claude/crew/telemetry.yaml. Missing file → schema defaults
 * (enabled: false). Never throws on missing/malformed file — bridge stays silent.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const TelemetryConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().default("http://localhost:3000/api/public/otel/v1/traces"),
    auth: z
      .object({
        header_name: z.string().default("Authorization"),
        header_value: z.string().default("Basic ${LANGFUSE_AUTH_B64}")
      })
      .default({}),
    sample_rate: z.number().min(0).max(1).default(1.0),
    scrub_pii: z.boolean().default(true),
    redact_paths: z
      .array(z.string())
      .default([
        "**/.env",
        "**/.env.*",
        "**/secrets/**",
        "**/*credentials*",
        "**/private/**",
        "**/*.pem",
        "**/*.key"
      ]),
    redact_attr_max_chars: z.number().int().min(64).default(2048),
    max_queue_size: z.number().int().min(64).default(2048),
    schedule_delay_ms: z.number().int().min(100).default(5000),
    export_timeout_ms: z.number().int().min(500).default(30000)
  })
  .passthrough();

export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_SUBPATH = path.join(".claude", "crew", "telemetry.yaml");

/**
 * Loads and Zod-validates the telemetry config from the given absolute path.
 * If the file does not exist, returns schema defaults (enabled: false) silently.
 */
export async function loadTelemetryConfig(absPath?: string): Promise<TelemetryConfig> {
  const resolvedPath =
    absPath ??
    path.join(process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(), DEFAULT_CONFIG_SUBPATH);

  let raw: string;
  try {
    raw = await fs.readFile(resolvedPath, "utf8");
  } catch {
    // File absent or unreadable — return defaults
    return TelemetryConfigSchema.parse({});
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch {
    // Malformed YAML — return defaults
    return TelemetryConfigSchema.parse({});
  }

  const result = TelemetryConfigSchema.safeParse(parsed ?? {});
  if (!result.success) {
    return TelemetryConfigSchema.parse({});
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

/**
 * Replaces ${VAR} tokens in `value` with values from `env`.
 * Missing vars return the literal ${VAR} unchanged so callers can detect + warn.
 */
export function resolveAuthHeader(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName: string) => {
    return env[varName] ?? `\${${varName}}`;
  });
}

// ---------------------------------------------------------------------------
// Two-key opt-in gate
// ---------------------------------------------------------------------------

/**
 * Returns true only when BOTH cfg.enabled AND CREW_OTEL_ENABLED=1.
 * Either alone is insufficient — belt-and-suspenders against accidental enablement.
 */
export function bridgeEnabled(cfg: TelemetryConfig, env: NodeJS.ProcessEnv = process.env): boolean {
  return cfg.enabled === true && env["CREW_OTEL_ENABLED"] === "1";
}
