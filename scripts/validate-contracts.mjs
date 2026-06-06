#!/usr/bin/env node

// Contract artifact CI gate. See docs/standards/contract-artifact-schema.md.
//
// Task 1 scaffold (this file): only the OpenAPI 3.1 marker check is enforced.
// Tasks 2–4 add the full gate list:
//   - Task 2: regenerate contracts.ts via openapi-typescript
//   - Task 3: drift detection (regenerated vs committed)
//   - Task 4: redocly lint + mandatory examples per declared response code

import fs from "node:fs/promises";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { parse as parseYaml } from "yaml";

/**
 * @param {object} opts
 * @param {string} opts.yamlPath
 * @param {string} opts.tsOutPath
 * @param {boolean} [opts.writeTs]
 * @param {boolean} [opts.runLint]
 */
export async function validateContracts(opts) {
  const errors = [];
  const yaml = await fs.readFile(opts.yamlPath, "utf8");
  if (!yaml.includes("openapi: 3.1")) {
    errors.push("YAML is not OpenAPI 3.1");
  }
  const regeneratedTs = await generateTs(yaml);
  if (opts.writeTs) {
    await fs.writeFile(opts.tsOutPath, regeneratedTs, "utf8");
  }
  return { ok: errors.length === 0, errors, regeneratedTs };
}

/** @param {string} yaml */
async function generateTs(yaml) {
  const doc = parseYaml(yaml);
  const ast = await openapiTS(doc);
  return astToString(ast);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const yamlPath = process.argv[2];
  if (!yamlPath) {
    console.error("usage: validate-contracts.mjs <yaml> [<ts-out>]");
    process.exit(2);
  }
  const tsOutPath =
    process.argv[3] ||
    path.join(path.dirname(yamlPath), path.basename(yamlPath, ".openapi.yaml") + "-contracts.ts");
  const result = await validateContracts({ yamlPath, tsOutPath, writeTs: false, runLint: true });
  if (!result.ok) {
    for (const e of result.errors) console.error("ERR:", e);
    process.exit(1);
  }
  console.log("OK");
}
