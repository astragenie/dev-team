import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGepaHistoryCmd } from "../../scripts/lib/gepa/history.ts";

describe("gepa-history CLI", () => {
  test("prints last N trials desc by created_at, default limit 10", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-"));
    try {
      const dir = join(root, ".claude/artifacts/crew/gepa/trials");
      mkdirSync(dir, { recursive: true });
      const now = Date.now();
      const lines: string[] = [];
      for (let i = 0; i < 12; i++) {
        lines.push(
          JSON.stringify({
            id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
            agent: "fullstack-dev",
            phase: "build",
            candidate_prompt_hash: "h",
            candidate_prompt_path: null,
            input: {},
            output: {},
            score: { pass: i % 2 === 0, score: 0.5, cost_usd: 0.01, latency_ms: 100 },
            source: "captured",
            pareto_rank: null,
            created_at: new Date(now - (12 - i) * 1000).toISOString(),
          }),
        );
      }
      writeFileSync(join(dir, "fullstack-dev.jsonl"), `${lines.join("\n")}\n`);

      const out = await runGepaHistoryCmd(root, ["fullstack-dev", "--limit", "5"]);
      expect(out.exitCode).toBe(0);
      const rows = out.stdout.trim().split("\n");
      expect(rows).toHaveLength(5);
      expect(rows[0]).toContain("00000011-"); // most recent first
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("--source captured filters", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-src-"));
    try {
      const dir = join(root, ".claude/artifacts/crew/gepa/trials");
      mkdirSync(dir, { recursive: true });
      const trials = ["eval", "captured", "soak"].map((src, i) =>
        JSON.stringify({
          id: `${String(i).padStart(8, "0")}-1111-4111-8111-111111111111`,
          agent: "x",
          phase: "build",
          candidate_prompt_hash: "h",
          candidate_prompt_path: null,
          input: {},
          output: {},
          score: { pass: true, score: 1, cost_usd: 0, latency_ms: 0 },
          source: src,
          pareto_rank: null,
          created_at: "2026-06-27T00:00:00.000Z",
        }),
      );
      writeFileSync(join(dir, "x.jsonl"), `${trials.join("\n")}\n`);

      const out = await runGepaHistoryCmd(root, ["x", "--source", "captured"]);
      expect(out.exitCode).toBe(0);
      const rows = out.stdout.trim().split("\n");
      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain("captured");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("exits 2 on missing agent argument", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-history-noarg-"));
    try {
      const out = await runGepaHistoryCmd(root, []);
      expect(out.exitCode).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
