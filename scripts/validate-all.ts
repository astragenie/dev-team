#!/usr/bin/env node

// Runs all four core validators concurrently and reports results.
// Exits 0 only when every validator passes; exits 1 on any failure.
// Usage: node --experimental-strip-types scripts/validate-all.ts

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const validators = [
  "validate-manifests.ts",
  "validate-skills.ts",
  "validate-agents.ts",
  "validate-slices.ts"
];

interface ValidatorResult {
  script: string;
  ok: boolean;
  output: string;
}

function runValidator(script: string): Promise<ValidatorResult> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ["--experimental-strip-types", join(__dirname, script)], {
      stdio: "pipe"
    });
    let output = "";
    proc.stdout.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      output += d.toString();
    });
    proc.on("close", (code) => resolve({ script, ok: code === 0, output }));
  });
}

function printResults(results: ValidatorResult[]): void {
  for (const r of results) {
    if (r.ok) {
      process.stdout.write(`✓ ${r.script}\n`);
    } else {
      process.stderr.write(`✗ ${r.script}\n${r.output}\n`);
    }
  }
}

const results = await Promise.all(validators.map(runValidator));
const failures = results.filter((r) => !r.ok);

printResults(results);

if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} validator(s) failed.\n`);
  process.exit(1);
}

process.stdout.write(`All ${validators.length} validators passed.\n`);
