#!/usr/bin/env node

// UX spec validator. Verifies every operationId referenced in `## API touchpoints`
// exists in the FEAT's contracts.openapi.yaml.
//
// Errors (fail CI):
//   - `## API touchpoints` section missing
//   - operationId referenced but not present in YAML
//   - `contracts:` frontmatter pointing to a non-existent YAML

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

export async function validateUxSpec(opts: { specPath: string; repoRoot: string }) {
  const errors: string[] = [];
  const md = await fs.readFile(opts.specPath, "utf8");
  const fm = parseFrontmatter(md);
  if (!fm || !fm["contracts"]) {
    errors.push("frontmatter missing `contracts:` pointing to the FEAT YAML");
    return { ok: false, errors, touchpoints: [] };
  }
  const yamlPath = path.resolve(opts.repoRoot, fm["contracts"] as string);
  let yamlDoc: unknown;
  try {
    yamlDoc = parseYaml(await fs.readFile(yamlPath, "utf8"));
  } catch (e) {
    errors.push(`contracts YAML not readable at ${yamlPath}: ${(e as Error).message}`);
    return { ok: false, errors, touchpoints: [] };
  }
  const touchpoints = parseTouchpoints(md);
  if (touchpoints.length === 0) {
    errors.push("`## API touchpoints` section missing or empty");
  }
  const declaredOps = collectOperationIds(yamlDoc);
  for (const t of touchpoints) {
    if (!declaredOps.has(t.operationId)) {
      errors.push(
        `operationId "${t.operationId}" referenced by UX action "${t.action}" not found in ${fm["contracts"]}`
      );
    }
  }
  return { ok: errors.length === 0, errors, touchpoints };
}

function parseFrontmatter(md: string): Record<string, string> | null {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || m[1] === undefined) return null;
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_-]+):\s*(.*)$/);
    if (kv) fm[kv[1] as string] = (kv[2] ?? "").trim();
  }
  return fm;
}

function parseTouchpoints(md: string): Array<{ action: string; operationId: string }> {
  const section = md.split(/^##\s+API touchpoints\s*$/m)[1];
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  const out: Array<{ action: string; operationId: string }> = [];
  for (const line of lines) {
    if (/^##\s/.test(line)) break;
    const m = line.match(/^-\s+"([^"]+)"\s+→\s+operationId\s+`([^`]+)`/);
    if (m) out.push({ action: m[1] ?? "", operationId: m[2] ?? "" });
  }
  return out;
}

function collectOperationIds(doc: unknown): Set<string> {
  const ids = new Set<string>();
  if (!doc || typeof doc !== "object" || !("paths" in doc)) return ids;
  const paths = (doc as Record<string, unknown>)["paths"];
  if (!paths || typeof paths !== "object") return ids;
  for (const pathItem of Object.values(paths as Record<string, unknown>)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const op of Object.values(pathItem as Record<string, unknown>)) {
      if (
        op &&
        typeof op === "object" &&
        "operationId" in op &&
        typeof (op as Record<string, unknown>)["operationId"] === "string"
      ) {
        ids.add((op as Record<string, string>)["operationId"] as string);
      }
    }
  }
  return ids;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const specPath = process.argv[2];
  if (!specPath) {
    console.error("usage: validate-ux-spec.mjs <spec-md-path>");
    process.exit(2);
  }
  const result = await validateUxSpec({ specPath, repoRoot: process.cwd() });
  if (!result.ok) {
    for (const e of result.errors) console.error("ERR:", e);
    process.exit(1);
  }
  console.log(`OK — ${result.touchpoints.length} touchpoint(s)`);
}
