#!/usr/bin/env node

// Contract artifact CI gate. See docs/standards/contract-artifact-schema.md.
//
// Enforces (errors fail CI):
//   - YAML is OpenAPI 3.1 (marker check on first line)
//   - redocly lint --extends recommended (when runLint)
//   - regenerated contracts.ts matches the committed copy (when checkDrift)
//
// CLI: validate-contracts.mjs <yaml> [<ts-out>] [--write]
//   --write regenerates contracts.ts and skips the drift check
//   without --write, runs lint + drift against the committed contracts.ts

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import openapiTS, { astToString } from "openapi-typescript";
import { parse as parseYaml } from "yaml";

async function runRedoclyLint(yamlPath: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["--no-install", "redocly", "lint", yamlPath], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32"
    });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => (output += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (output += d.toString()));
    proc.on("close", (code: number | null) => resolve({ ok: code === 0, output }));
  });
}

export async function validateContracts(opts: {
  yamlPath: string;
  tsOutPath: string;
  writeTs?: boolean;
  runLint?: boolean;
  checkDrift?: boolean;
}) {
  const errors: string[] = [];
  let yaml = "";
  try {
    yaml = await fs.readFile(opts.yamlPath, "utf8");
  } catch (err) {
    errors.push(`Cannot read ${opts.yamlPath}: ${(err as Error).message}`);
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
    errors.push(`Failed to generate TS from YAML: ${(err as Error).message}`);
  }
  // Drift only matters for an otherwise-valid spec. If lint failed (or the
  // spec is not 3.1, or TS generation failed) the committed-TS comparison is
  // meaningless noise — a negative fixture would fail for "drift" reasons on
  // top of its intended lint failure. Skip drift unless the spec is clean.
  if (opts.checkDrift && regeneratedTs && errors.length === 0) {
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

async function generateTs(yaml: string) {
  const doc = parseYaml(yaml);
  const ast = await openapiTS(doc as Parameters<typeof openapiTS>[0]);
  return astToString(ast);
}

function diffSummary(a: string, b: string) {
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
