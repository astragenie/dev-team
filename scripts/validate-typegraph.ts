#!/usr/bin/env node
// Phase 0 advisory gate: runs tsc --noEmit and reports.
// Becomes blocking in Phase 5 once every .mjs has migrated.
// See: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md §Testing strategy.

import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsc", "--noEmit"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status === 0) {
  console.log("validate-typegraph: PASS");
  process.exit(0);
}

console.error("validate-typegraph: type errors above (advisory in Phase 0)");
process.exit(0); // advisory — does not fail the build yet
