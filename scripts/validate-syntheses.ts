#!/usr/bin/env node
// Validates that no final-synthesis artifact contains stale placeholder text.
import fs from "node:fs/promises";
import path from "node:path";

const RUNS_DIR = [".claude", "artifacts", "crew", "runs"];
const STALE_PATTERNS = [/Grade missing/, /<timestamp>/];

export async function validateSyntheses(repoPath: string): Promise<{ errors: string[] }> {
  const runsDir = path.join(repoPath, ...RUNS_DIR);
  let entries;
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    return { errors: [] };
  }
  const synthFiles = entries.filter((name) => name.includes("final-synthesis"));
  const errors = [];
  for (const name of synthFiles) {
    const text = await fs.readFile(path.join(runsDir, name), "utf8");
    for (const pat of STALE_PATTERNS) {
      if (pat.test(text)) {
        errors.push(`${name}: contains stale placeholder matching ${pat}`);
        break;
      }
    }
  }
  return { errors };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const repoPath = process.argv[2] || process.cwd();
  const { errors } = await validateSyntheses(repoPath);
  if (errors.length > 0) {
    console.error("validate-syntheses: stale placeholders found:");
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  } else {
    console.log("validate-syntheses: all synthesis files clean");
  }
}
