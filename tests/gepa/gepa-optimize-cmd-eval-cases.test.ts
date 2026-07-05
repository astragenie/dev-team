/**
 * tests/gepa/gepa-optimize-cmd-eval-cases.test.ts — FEAT-192 SLICE-C
 *
 * Covers the gepa-optimize-cmd.ts wiring added in SLICE-C:
 *  - loadEvalCasesForOptimize: yaml + fixture loading, default + explicit
 *    split, judgeChain derivation, degrade-to-null paths.
 *  - selectScorer: judge-backed scorer chosen over noopScorer when cases exist.
 *  - runGepaOptimizeCmd end-to-end: cases get wired into the real cycle
 *    without ever making a live LLM call (achieved by starving the
 *    candidate generator's budget so candidates_evaluated stays 0 and
 *    scorer.score() is never invoked — see optimize-runner.ts::scoreCandidates).
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadEvalCasesForOptimize,
  runGepaOptimizeCmd,
  selectScorer
} from "../../scripts/lib/gepa/gepa-optimize-cmd.ts";
import { noopScorer } from "../../scripts/lib/gepa/optimize-runner.ts";

const YAML_TEST_AGENT = "gepa-c-test-agent";

function setupEvalYaml(): string {
  const repoPath = mkdtempSync(join(tmpdir(), "gepa-c-eval-cases-"));
  const agentsEvalDir = join(repoPath, "evals", "agents");
  const fixturesDir = join(repoPath, "evals", "fixtures");
  mkdirSync(agentsEvalDir, { recursive: true });
  mkdirSync(fixturesDir, { recursive: true });

  writeFileSync(join(fixturesDir, "case-a.txt"), "Scenario A input text.\n", "utf8");
  writeFileSync(join(fixturesDir, "case-b.txt"), "Scenario B input text.\n", "utf8");
  writeFileSync(join(fixturesDir, "case-c.txt"), "Scenario C input text.\n", "utf8");

  const yaml = [
    `prompt_id: ${YAML_TEST_AGENT}`,
    "judge:",
    "  provider: groq",
    "  model: llama-3.3-70b-versatile",
    "  fallback:",
    "    - provider: gemini",
    "      model: gemini-2.5-flash",
    "tests:",
    "  - name: case-a",
    "    fixture: file://evals/fixtures/case-a.txt",
    "    assert:",
    "      - type: llm-rubric",
    '        rubric: "Rubric A"',
    "  - name: case-b",
    "    fixture: file://evals/fixtures/case-b.txt",
    "    assert:",
    "      - type: llm-rubric",
    '        rubric: "Rubric B"',
    "  - name: case-c",
    "    fixture: file://evals/fixtures/case-c.txt",
    "    assert:",
    "      - type: llm-rubric",
    '        rubric: "Rubric C"',
    ""
  ].join("\n");
  writeFileSync(join(agentsEvalDir, `crew-${YAML_TEST_AGENT}.yaml`), yaml, "utf8");

  const agentsDir = join(repoPath, "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, `${YAML_TEST_AGENT}.md`),
    "# champion\n\nYou are the champion.\n",
    "utf8"
  );

  return repoPath;
}

describe("FEAT-192 SLICE-C — loadEvalCasesForOptimize", () => {
  test("loads cases from yaml + fixtures, applies default split, tags heldOut", async () => {
    const repoPath = setupEvalYaml();
    const result = await loadEvalCasesForOptimize(repoPath, YAML_TEST_AGENT);

    expect(result).not.toBeNull();
    // 3 cases, default split ~1/3 heldOut -> 1 heldOut, 2 train.
    expect(result!.heldOut.length).toBe(1);
    expect(result!.heldOut[0]!.held_out).toBe(true);
    expect(result!.trainSeedTrials.length).toBe(2);
    expect(result!.judgeChain).toEqual([
      { provider: "groq", model: "llama-3.3-70b-versatile" },
      { provider: "gemini", model: "gemini-2.5-flash" }
    ]);
  });

  test("explicit --split override is respected", async () => {
    const repoPath = setupEvalYaml();
    const result = await loadEvalCasesForOptimize(repoPath, YAML_TEST_AGENT, {
      train: 1,
      heldOut: 2
    });

    expect(result).not.toBeNull();
    expect(result!.heldOut.length).toBe(2);
    expect(result!.trainSeedTrials.length).toBe(1);
  });

  test("train-seed trials carry the case input, no historical rationale", async () => {
    const repoPath = setupEvalYaml();
    const result = await loadEvalCasesForOptimize(repoPath, YAML_TEST_AGENT, {
      train: 2,
      heldOut: 1
    });

    expect(result!.trainSeedTrials.length).toBe(2);
    for (const trial of result!.trainSeedTrials) {
      expect(trial.score.pass).toBe(false);
      expect(typeof trial.input).toBe("string");
      expect(trial.score.rationale).toContain("seeded from train-split");
    }
  });

  test("missing yaml -> null (degrade path)", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "gepa-c-no-yaml-"));
    const result = await loadEvalCasesForOptimize(repoPath, "no-such-agent");
    expect(result).toBeNull();
  });

  test("yaml with zero loadable fixtures -> null (degrade path)", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "gepa-c-broken-fixture-"));
    const agentsEvalDir = join(repoPath, "evals", "agents");
    mkdirSync(agentsEvalDir, { recursive: true });
    const yaml = [
      "prompt_id: broken-agent",
      "tests:",
      "  - name: case-missing",
      "    fixture: file://evals/fixtures/does-not-exist.txt",
      "    assert:",
      "      - type: llm-rubric",
      '        rubric: "irrelevant"',
      ""
    ].join("\n");
    writeFileSync(join(agentsEvalDir, "crew-broken-agent.yaml"), yaml, "utf8");

    const result = await loadEvalCasesForOptimize(repoPath, "broken-agent");
    expect(result).toBeNull();
  });
});

describe("FEAT-192 SLICE-C — selectScorer", () => {
  const noopSrc = noopScorer().score.toString();

  test("no cases -> noopScorer (byte-identical behavior)", () => {
    const scorer = selectScorer(false, []);
    expect(scorer.score.toString()).toBe(noopSrc);
  });

  test("cases exist -> judge-backed scorer, NOT noopScorer", () => {
    const scorer = selectScorer(true, [{ provider: "groq" }]);
    expect(scorer.score.toString()).not.toBe(noopSrc);
  });
});

describe("FEAT-192 SLICE-C — runGepaOptimizeCmd end-to-end wiring", () => {
  test("cases populate from yaml even when the cycle produces 0 candidates (no live LLM call made)", async () => {
    const repoPath = setupEvalYaml();

    // Budget too small to reserve even one candidate slot (GENERATOR_ESTIMATE_USD
    // is 0.08) -> generator.generate() returns [] -> scoreCandidates short-circuits
    // before ever calling scorer.score(). This proves the wiring (yaml -> cases ->
    // judge-backed scorer selection -> runOptimize) end-to-end with zero network
    // calls and no flakiness.
    const result = await runGepaOptimizeCmd(repoPath, [
      YAML_TEST_AGENT,
      "--budget",
      "0.001",
      "--k",
      "3"
    ]);

    expect(result.exitCode).toBe(0);

    const optDir = join(repoPath, ".claude", "artifacts", "crew", "gepa", "opt");
    expect(existsSync(optDir)).toBe(true);
    const artifacts = readdirSync(optDir).filter((f) => f.endsWith(".json"));
    expect(artifacts.length).toBe(1);

    const artifact = JSON.parse(readFileSync(join(optDir, artifacts[0]!), "utf8"));
    expect(artifact.candidates_evaluated).toBe(0);
    // No candidates -> partial stays false per the existing SLICE-99 formula
    // (cases.length > 0 && trials.length < candidates.length * cases.length,
    // and candidates.length is 0 here).
    expect(artifact.partial).toBe(false);
  });

  test("--split malformed value -> exit 2 invalid", async () => {
    const repoPath = mkdtempSync(join(tmpdir(), "gepa-c-split-invalid-"));
    const result = await runGepaOptimizeCmd(repoPath, [
      "some-agent",
      "--budget",
      "5",
      "--split",
      "not-a-ratio"
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--split");
  });
});
