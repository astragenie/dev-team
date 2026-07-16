// FEAT-193 S3 — gepa-corpus-optimize feed-to-optimize bridge (AC-9 human gate).
import { test, expect } from "bun:test";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  runCorpusOptimizeCmd,
  type CorpusOptimizeDeps
} from "../scripts/lib/gepa/corpus-optimize.ts";

const cliPath = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  "scripts",
  "crew.ts"
);

/** Records every delegate call so tests can assert composition + arg threading. */
function spyDeps(): {
  deps: CorpusOptimizeDeps;
  reportCalls: string[][];
  optimizeCalls: string[][];
} {
  const reportCalls: string[][] = [];
  const optimizeCalls: string[][] = [];
  const deps: CorpusOptimizeDeps = {
    report: async (_repo, args) => {
      reportCalls.push(args);
      return { stdout: "DIGEST-BODY\n", stderr: "", exitCode: 0 };
    },
    optimize: async (_repo, args) => {
      optimizeCalls.push(args);
      return { stdout: "OPTIMIZE-BODY\n", stderr: "", exitCode: 0 };
    }
  };
  return { deps, reportCalls, optimizeCalls };
}

test("missing agent → exit 2, never touches delegates", async () => {
  const { deps, reportCalls, optimizeCalls } = spyDeps();
  const res = await runCorpusOptimizeCmd("/tmp", ["--budget", "5"], deps);
  expect(res.exitCode).toBe(2);
  expect(res.stderr).toMatch(/usage: gepa-corpus-optimize/);
  expect(reportCalls.length).toBe(0);
  expect(optimizeCalls.length).toBe(0);
});

test("missing --budget → exit 2 (spends real judge tokens); neither delegate runs", async () => {
  const { deps, reportCalls, optimizeCalls } = spyDeps();
  const res = await runCorpusOptimizeCmd("/tmp", ["fullstack-dev"], deps);
  expect(res.exitCode).toBe(2);
  expect(res.stderr).toMatch(/--budget is required/);
  expect(reportCalls.length, "no analyze/digest before the budget guard").toBe(0);
  expect(optimizeCalls.length).toBe(0);
});

test("happy path: renders digest THEN optimizes the aggregated corpus", async () => {
  const { deps, reportCalls, optimizeCalls } = spyDeps();
  const res = await runCorpusOptimizeCmd(
    "/tmp",
    ["backend-dev", "--budget", "5", "--k", "3"],
    deps
  );
  expect(res.exitCode).toBe(0);
  // Digest rendered first, optimize body after — analyze-before-adjust order.
  const digestIdx = res.stdout.indexOf("DIGEST-BODY");
  const optIdx = res.stdout.indexOf("OPTIMIZE-BODY");
  expect(digestIdx >= 0 && optIdx >= 0, "both sections present").toBeTruthy();
  expect(digestIdx < optIdx, "digest must render before the optimize cycle").toBeTruthy();
  // Report scoped to the one agent; optimize got agent + budget + k.
  expect(reportCalls[0]).toEqual(["backend-dev"]);
  expect(optimizeCalls[0]?.slice(0, 4)).toEqual(["backend-dev", "--budget", "5", "--k"]);
});

test("AC-9 gate: bridge ALWAYS forces --artifact-only, never a promote flag", async () => {
  const { deps, optimizeCalls } = spyDeps();
  await runCorpusOptimizeCmd("/tmp", ["frontend-dev", "--budget", "2"], deps);
  const args = optimizeCalls[0] ?? [];
  expect(args.includes("--artifact-only"), "artifact-only must be forced").toBeTruthy();
  expect(
    !args.some((a) => /promote|no-artifact-only/.test(a)),
    "no promote / no-artifact-only flag may ever be threaded"
  ).toBeTruthy();
});

test("optimize exit code propagates; digest is advisory", async () => {
  const deps: CorpusOptimizeDeps = {
    report: async () => ({ stdout: "D\n", stderr: "", exitCode: 0 }),
    optimize: async () => ({ stdout: "", stderr: "boom\n", exitCode: 3 })
  };
  const res = await runCorpusOptimizeCmd("/tmp", ["a", "--budget", "5"], deps);
  expect(res.exitCode, "bridge exit == optimize exit").toBe(3);
  expect(res.stderr).toMatch(/boom/);
});

test("never throws: a delegate that rejects surfaces as exit 1 + stderr", async () => {
  const deps: CorpusOptimizeDeps = {
    report: async () => {
      throw new Error("trial store unreadable");
    },
    optimize: async () => ({ stdout: "", stderr: "", exitCode: 0 })
  };
  const res = await runCorpusOptimizeCmd("/tmp", ["a", "--budget", "5"], deps);
  expect(res.exitCode, "rejection must not propagate as an unhandled error").toBe(1);
  expect(res.stderr).toMatch(/gepa-corpus-optimize failed: trial store unreadable/);
});

test("CLI: gepa-corpus-optimize is wired (no 'Unknown argument'); guards budget", async () => {
  // No --budget → the bridge's arg guard fires (exit 2) BEFORE any judge call,
  // so this stays hermetic. CLI runs on Node per ADR-002.
  const res = spawnSync(
    "node",
    [
      "--experimental-strip-types",
      cliPath,
      "gepa-corpus-optimize",
      "somebody",
      "--repo",
      os.tmpdir()
    ],
    { encoding: "utf8", timeout: 60_000 }
  );
  expect(res.stderr ?? "", "flags must be registered").not.toMatch(/Unknown argument/);
  expect(res.stderr ?? "", "budget guard reached via CLI").toMatch(/--budget is required/);
  expect(res.status).toBe(2);
});
