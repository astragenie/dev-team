#!/usr/bin/env node
// scripts/validate-configs.ts — FEAT-crew-architecture-review Section 7/8
//
// Hard CI gate for the repo's machine-readable config files. Every new config
// schema lives in one place (scripts/lib/*/schema.ts) and is validated here,
// per Section 7's "guard against untyped mess" note — one script wrapping all
// schemas rather than a validator-per-file proliferation.
//
// docs/routing-table.yaml — authoritative routing source (docs/routing-table.md
// is a generated view — see scripts/render-routing-table.ts). Three checks:
//   1. Structural validity — parses and Zod-validates against RoutingTableSchema
//      (malformed row / bad section enum -> fail).
//   2. Drift — the committed docs/routing-table.md matches a fresh render of
//      the yaml (same pattern as validate-contracts.ts's regenerated-file
//      check). Catches a hand-edit to the .md that the generator no longer
//      reflects.
//   3. Resolution — every `crew:<name>` token appearing in a row's route_to
///     or notes resolves to a real agents/<name>.md, commands/<name>.md, or
//      skills/**/<name>/SKILL.md. This is the new fitness function from
//      Section 8 ("every routing row resolves to an existing agent/skill"),
//      scoped to first-party crew: tokens — narrower than
//      validate-routing-table.ts's advisory Pass 1/2 (which also resolves
//      external plugin skill IDs and cross-checks each agent's own "Skills
//      you consult" block; Pass 2 currently carries pre-existing consistency
//      debt unrelated to this change, so it stays advisory-only).
//
// models.yaml — Decision 4 tier-profile map (scripts/apply-model-profile.ts +
// evals/lib/model-profile.ts). One check: structural validity via
// ModelsConfigSchema (malformed profile / missing tier / unknown
// default_profile -> fail). No drift or token-resolution check applies —
// this file isn't generated and carries no crew: tokens.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { parseRoutingTable, type RoutingRow } from "./lib/routing/schema.ts";
import { render } from "./render-routing-table.ts";
import { ModelsConfigSchema, type ModelsConfig } from "./lib/models/schema.ts";
import { createTokenResolver } from "./lib/dispatch/resolve-token.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_YAML_PATH = path.join(REPO_ROOT, "docs", "routing-table.yaml");
const DEFAULT_MD_PATH = path.join(REPO_ROOT, "docs", "routing-table.md");
const DEFAULT_MODELS_YAML_PATH = path.join(REPO_ROOT, "models.yaml");

const CREW_TOKEN_RE = /\bcrew:([a-z0-9-]+)\b/g;

/**
 * Resolves a first-party `crew:<name>` token to an agent, command, skill, or
 * documented forward reference. Shared semantics with validate-agent-refs.ts
 * via scripts/lib/dispatch/resolve-token.ts. Builds a fresh resolver per call —
 * use checkResolution (one resolver for all rows) on hot paths.
 */
export async function resolveCrewToken(name: string, repoRoot = REPO_ROOT): Promise<boolean> {
  const resolver = await createTokenResolver(repoRoot);
  return resolver.resolves(name);
}

export function extractCrewTokens(row: RoutingRow): string[] {
  const tokens = new Set<string>();
  for (const field of [row.route_to, row.notes ?? ""]) {
    CREW_TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = CREW_TOKEN_RE.exec(field)) !== null) {
      if (m[1]) tokens.add(m[1]);
    }
  }
  return [...tokens];
}

export async function checkStructure(yamlPath = DEFAULT_YAML_PATH): Promise<{
  table: ReturnType<typeof parseRoutingTable> | null;
  errors: string[];
}> {
  const errors: string[] = [];
  let raw: string;
  try {
    raw = await fs.readFile(yamlPath, "utf8");
  } catch {
    return { table: null, errors: [`${yamlPath} does not exist`] };
  }
  try {
    const data = parseYaml(raw);
    return { table: parseRoutingTable(data), errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      table: null,
      errors: [`${yamlPath} failed schema validation:\n${message}`]
    };
  }
}

export async function checkDrift(rows: RoutingRow[], mdPath = DEFAULT_MD_PATH): Promise<string[]> {
  const rendered = render(rows);
  let committed: string;
  try {
    committed = await fs.readFile(mdPath, "utf8");
  } catch {
    return [`${mdPath} does not exist — run \`node scripts/render-routing-table.ts\``];
  }
  if (committed !== rendered) {
    return [
      `${mdPath} is stale relative to its yaml source. ` +
        "Run `node scripts/render-routing-table.ts` and commit the result."
    ];
  }
  return [];
}

export async function checkResolution(rows: RoutingRow[], repoRoot = REPO_ROOT): Promise<string[]> {
  const errors: string[] = [];
  const resolver = await createTokenResolver(repoRoot);
  for (const row of rows) {
    for (const token of extractCrewTokens(row)) {
      if (!resolver.resolves(token)) {
        errors.push(
          `crew:${token} (row: "${row.signal}", section: ${row.section}) does not resolve to ` +
            `agents/${token}.md, commands/${token}.md, a skills/**/${token}/SKILL.md, ` +
            `or a documented forward_references entry in docs/routing-table.yaml`
        );
      }
    }
  }
  return errors;
}

/**
 * Consistency guard between the yaml builder-matrix and its signal-level
 * implementation in commands/orchestrate-slice.md (the third historical copy
 * of the routing policy — richer composite-boolean table, kept hand-authored
 * on purpose). One-directional invariant: every `crew:<name>` token the yaml
 * builder-matrix routes to MUST appear somewhere in orchestrate-slice.md,
 * otherwise the yaml routes to a builder the implementation never dispatches.
 */
export async function checkOrchestrateConsistency(
  rows: RoutingRow[],
  repoRoot = REPO_ROOT
): Promise<string[]> {
  const matrixTokens = new Set<string>();
  for (const row of rows.filter((r) => r.section === "builder-matrix")) {
    for (const token of extractCrewTokens(row)) matrixTokens.add(token);
  }
  if (matrixTokens.size === 0) return [];
  let orchestrate: string;
  try {
    orchestrate = await fs.readFile(
      path.join(repoRoot, "commands", "orchestrate-slice.md"),
      "utf8"
    );
  } catch {
    return []; // synthetic roots without the command file skip this check
  }
  const errors: string[] = [];
  for (const token of matrixTokens) {
    if (!orchestrate.includes(`crew:${token}`)) {
      errors.push(
        `builder-matrix routes to crew:${token} but commands/orchestrate-slice.md never dispatches it — ` +
          "update the orchestrate-slice dispatch table or fix the yaml row"
      );
    }
  }
  return errors;
}

export async function checkModelsConfig(modelsYamlPath = DEFAULT_MODELS_YAML_PATH): Promise<{
  config: ModelsConfig | null;
  errors: string[];
}> {
  let raw: string;
  try {
    raw = await fs.readFile(modelsYamlPath, "utf8");
  } catch {
    return { config: null, errors: [`${modelsYamlPath} does not exist`] };
  }
  try {
    const data = parseYaml(raw);
    return { config: ModelsConfigSchema.parse(data), errors: [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { config: null, errors: [`${modelsYamlPath} failed schema validation:\n${message}`] };
  }
}

async function main() {
  const structural = await checkStructure();
  const modelsResult = await checkModelsConfig();

  if (!structural.table || !modelsResult.config) {
    console.error("validate-configs: FAILED");
    for (const e of [...structural.errors, ...modelsResult.errors]) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  const driftErrors = await checkDrift(structural.table.rows);
  const resolutionErrors = await checkResolution(structural.table.rows);
  const orchestrateErrors = await checkOrchestrateConsistency(structural.table.rows);
  const allErrors = [
    ...structural.errors,
    ...driftErrors,
    ...resolutionErrors,
    ...orchestrateErrors,
    ...modelsResult.errors
  ];

  if (allErrors.length > 0) {
    console.error(`validate-configs: FAILED (${allErrors.length} error(s))`);
    for (const e of allErrors) console.error(`  - ${e}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `validate-configs: OK (${structural.table.rows.length} routing rows, ${Object.keys(modelsResult.config.profiles).length} model profile(s), schema valid, no drift, all crew: tokens resolve)`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
