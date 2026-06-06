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
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import openapiTS, { astToString } from "openapi-typescript";
import { parse as parseYaml } from "yaml";

/**
 * @param {string} yamlPath
 * @returns {Promise<{ok: boolean, output: string}>}
 */
async function runRedoclyLint(yamlPath) {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["--no-install", "redocly", "lint", yamlPath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    });
    let output = "";
    proc.stdout.on("data", (d) => (output += d.toString()));
    proc.stderr.on("data", (d) => (output += d.toString()));
    proc.on("close", (code) => resolve({ ok: code === 0, output }));
  });
}

/**
 * @param {object} opts
 * @param {string} opts.yamlPath
 * @param {string} opts.tsOutPath
 * @param {boolean} [opts.writeTs]
 * @param {boolean} [opts.runLint]
 * @param {boolean} [opts.checkDrift]
 */
export async function validateContracts(opts) {
  const errors = [];
  let yaml = "";
  try {
    yaml = await fs.readFile(opts.yamlPath, "utf8");
  } catch (err) {
    errors.push(`Cannot read ${opts.yamlPath}: ${err.message}`);
    return { ok: false, errors, regeneratedTs: "" };
  }
  if (!yaml.includes("openapi: 3.1")) {
    errors.push("YAML is not OpenAPI 3.1");
  }
  if (opts.runLint) {
    const lint = await runRedoclyLint(opts.yamlPath);
    if (!lint.ok) {
      errors.push(`redocly lint failed:\n${lint.output}`);
    }
  }
  let regeneratedTs = "";
  try {
    regeneratedTs = await generateTs(yaml);
  } catch (err) {
    errors.push(`Failed to generate TS from YAML: ${err.message}`);
  }
  if (opts.checkDrift && regeneratedTs) {
    let committedTs = "";
    let readOk = false;
    try {
      committedTs = await fs.readFile(opts.tsOutPath, "utf8");
      readOk = true;
    } catch {
      errors.push(
        `drift: committed TS missing at ${opts.tsOutPath} — run with --write and commit the regenerated file`
      );
    }
    if (readOk && committedTs !== regeneratedTs) {
      errors.push(
        `drift: ${opts.tsOutPath} differs from regenerated TS (${diffSummary(committedTs, regeneratedTs)}) — run with --write and commit the regenerated file`
      );
    }
  }
  if (opts.writeTs && regeneratedTs) {
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

/**
 * @param {string} a
 * @param {string} b
 */
function diffSummary(a, b) {
  const aLines = a.split(/\r?\n/).length;
  const bLines = b.split(/\r?\n/).length;
  return `committed=${aLines} lines, regenerated=${bLines} lines`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const yamlPath = process.argv[2];
  if (!yamlPath) {
    console.error("usage: validate-contracts.mjs <yaml> [<ts-out>] [--write]");
    process.exit(2);
  }
  const tsOutPath =
    process.argv[3] && !process.argv[3].startsWith("--")
      ? process.argv[3]
      : path.join(
          path.dirname(yamlPath),
          path.basename(yamlPath, ".openapi.yaml") + "-contracts.ts"
        );
  const writeTs = process.argv.includes("--write");
  const result = await validateContracts({
    yamlPath,
    tsOutPath,
    writeTs,
    runLint: true,
    checkDrift: !writeTs
  });
  if (!result.ok) {
    for (const e of result.errors) console.error("ERR:", e);
    process.exit(1);
  }
  console.log("OK");
}
