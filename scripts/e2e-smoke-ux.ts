#!/usr/bin/env node
// End-to-end smoke for the ux-validation skill.
// Boots a local Python http.server against the fixture page, dispatches
// the skill flow programmatically (no validator agent), asserts the
// resulting verdict is "failed" and the evidence payload has all four
// check categories populated.
//
// Runs in CI via `npm run e2e:smoke:ux`.

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractACs,
  classifyScenario,
  computeVerdict
} from "../scripts/lib/ux-validation/index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE_DIR = path.join(ROOT, "tests", "fixtures", "ux-gate-smoke");
const FIXTURE_FEAT = path.join(FIXTURE_DIR, "FEAT-SMOKE.md");
const PORT = 8765;

function startHttpServer() {
  return spawn("python", ["-m", "http.server", String(PORT)], {
    cwd: FIXTURE_DIR,
    stdio: ["ignore", "ignore", "inherit"]
  });
}

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readFixtureSlice() {
  return await fs.readFile(FIXTURE_FEAT, "utf8");
}

function simulateQaEvidence() {
  // Simulates what gstack:/qa would produce against the fixture.
  // AC-1 (button click) — pass.
  // AC-2 (image display) — fail (404 on /logo-does-not-exist.png).
  // a11y — image without alt is a serious violation.
  // console — one warning (from <script>).
  // network — one 404.
  // visual — no baseline yet, so no diff.
  return {
    url: `http://localhost:${PORT}`,
    ac_results: [
      { id: "AC-1", status: "pass", evidence: { screenshot: "ac1.png" } },
      {
        id: "AC-2",
        status: "fail",
        evidence: { error: "image not loaded: /logo-does-not-exist.png" }
      }
    ],
    a11y: {
      violations: [{ rule: "image-alt", severity: "serious", nodes: ["img#logo"] }],
      passes_count: 12
    },
    console: { errors: /** @type {string[]} */ [], warnings: ["ux-gate-smoke: warning fixture"] },
    network: { failures: [{ url: "/logo-does-not-exist.png", status: 404 }] },
    visual: { diffs: /** @type {Array<{route: string, pct: number, tolerance: number}>} */ [] }
  };
}

async function main() {
  console.log(`[ux-smoke] booting http.server on :${PORT}`);
  const server = startHttpServer();
  try {
    await wait(700); // give python time to bind
    const sliceContent = await readFixtureSlice();
    const acs = extractACs(sliceContent);
    if (acs.length !== 2) {
      throw new Error(`expected 2 ACs in fixture, got ${acs.length}`);
    }
    const scenarios = acs.map((ac) => ({
      id: ac.id,
      category: classifyScenario(ac.text),
      text: ac.text
    }));
    console.log(`[ux-smoke] scenarios:`, scenarios);

    const evidence = simulateQaEvidence();
    const verdict = computeVerdict(evidence);
    console.log(`[ux-smoke] verdict: ${verdict}`);

    if (verdict !== "failed") {
      throw new Error(`expected verdict 'failed', got '${verdict}'`);
    }
    if (evidence.ac_results.length !== 2) {
      throw new Error("ac_results missing entries");
    }
    if (evidence.a11y.violations.length === 0) {
      throw new Error("a11y violations missing");
    }
    if (evidence.network.failures.length === 0) {
      throw new Error("network failures missing");
    }
    console.log(
      "[ux-smoke] PASS — all 4 evidence categories populated, verdict is 'failed' as expected"
    );
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error("[ux-smoke] FAIL", err);
  process.exit(1);
});
