/**
 * scripts/lib/cost/cost-report-renderer.test.ts
 *
 * SLICE-112 (FEAT-186 S3) — snapshot tests for renderCostReport.
 *
 * Covers 4 cases per AC-1..AC-4:
 *   1. dual-pipeline  — two rows, both with tokens+cache
 *   2. eval-only      — single row, tokens+cache present (single-row degenerate AC-2)
 *   3. gepa-only      — single row, no tokens, no cache (pre-186 legacy AC-3)
 *   4. legacy-eval-only / legacy-gepa-only — real pre-186 fixture shapes (AC-3)
 *
 * AC-4: Each fixture is read at test startup and asserted to contain only
 * LF line endings (no CRLF), guarding against silent Windows checkout drift.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderCostReport } from "./cost-report-renderer.ts";
import type { CostEntry } from "./cost-report-renderer.ts";

// ---------------------------------------------------------------------------
// Fixture loader + AC-4 LF assertion
// ---------------------------------------------------------------------------

const FIXTURE_DIR = join(import.meta.dir, "../../../tests/fixtures/cost-reports");

function loadFixture(name: string): CostEntry[] {
  const absPath = join(FIXTURE_DIR, name);
  const raw = readFileSync(absPath, "utf8");

  // AC-4: assert no CRLF in fixture file (catches Windows checkout drift
  // before the fixture can silently affect snapshot output).
  if (raw.includes("\r\n")) {
    throw new Error(
      `AC-4 violation: fixture ${name} contains CRLF line endings. ` +
        "Check .gitattributes — tests/fixtures/cost-reports/** must pin text=lf."
    );
  }

  return JSON.parse(raw) as CostEntry[];
}

// ---------------------------------------------------------------------------
// AC-1: dual-pipeline — two-row table with full tokens+cache
// ---------------------------------------------------------------------------

describe("renderCostReport — dual-pipeline", () => {
  const entries = loadFixture("dual-pipeline.json");

  test("produces header + separator + 2 data rows + totals row", () => {
    const output = renderCostReport(entries);
    const lines = output.split("\n");
    // header, separator, 2 data rows, 1 totals row = 5 lines
    expect(lines.length).toBe(5);
  });

  test("header row contains all expected column names", () => {
    const output = renderCostReport(entries);
    const header = output.split("\n")[0]!;
    expect(header).toContain("pipeline");
    expect(header).toContain("provider");
    expect(header).toContain("usd");
    expect(header).toContain("latency_ms");
    expect(header).toContain("tokens");
    expect(header).toContain("cache");
  });

  test("first data row contains eval/anthropic values", () => {
    const output = renderCostReport(entries);
    const row = output.split("\n")[2]!;
    expect(row).toContain("eval");
    expect(row).toContain("anthropic");
    expect(row).toContain("0.0312");
    expect(row).toContain("843");
    expect(row).toContain("1024/256");
    expect(row).toContain("hit");
  });

  test("second data row contains gepa/groq values", () => {
    const output = renderCostReport(entries);
    const row = output.split("\n")[3]!;
    expect(row).toContain("gepa");
    expect(row).toContain("groq");
    expect(row).toContain("0.0007");
    expect(row).toContain("312");
    expect(row).toContain("512/128");
    expect(row).toContain("miss");
  });

  test("totals row sums usd and latency_ms", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[4]!;
    // 0.0312 + 0.0007 = 0.0319
    expect(totalsRow).toContain("0.0319");
    // 843 + 312 = 1155
    expect(totalsRow).toContain("1155");
  });

  test("totals row sums tokens when all rows have them", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[4]!;
    // in: 1024+512=1536, out: 256+128=384
    expect(totalsRow).toContain("1536/384");
  });

  test("totals row shows cache aggregate when all rows have it", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[4]!;
    // 1 hit (anthropic), 1 miss (groq)
    expect(totalsRow).toContain("1 hit / 1 miss");
  });

  test("snapshot", () => {
    expect(renderCostReport(entries)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// AC-2: single-row degenerate — eval-only with full tokens+cache
// ---------------------------------------------------------------------------

describe("renderCostReport — eval-only single-row degenerate", () => {
  const entries: CostEntry[] = [
    {
      pipeline: "eval",
      provider: "anthropic",
      usd: 0.05,
      latency_ms: 1200,
      tokens: { in: 800, out: 200 },
      cache: { hit: true, tokens_saved: 750 }
    }
  ];

  test("renders exactly 4 lines (header + sep + 1 data + totals)", () => {
    const output = renderCostReport(entries);
    const lines = output.split("\n");
    expect(lines.length).toBe(4);
  });

  test("no undefined cells in output", () => {
    const output = renderCostReport(entries);
    expect(output).not.toContain("undefined");
  });

  test("totals row still present with correct values", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[3]!;
    expect(totalsRow).toContain("0.0500");
    expect(totalsRow).toContain("1200");
    expect(totalsRow).toContain("800/200");
    expect(totalsRow).toContain("hit");
  });
});

// ---------------------------------------------------------------------------
// AC-3: backward-compat — legacy pre-186 fixtures (no tokens, no cache)
// ---------------------------------------------------------------------------

describe("renderCostReport — legacy-eval-only (pre-186 shape)", () => {
  // Real values sourced from
  // .claude/artifacts/crew/cost/20260607T093433Z-cost-report-slice-feat100-slice16.md
  // usd: 3.0367, duration_ms: 559106 — eval pipeline, anthropic provider.
  // tokens and cache are absent (pre-186 shape).
  const entries = loadFixture("legacy-eval-only.json");

  test("renders without crash", () => {
    expect(() => renderCostReport(entries)).not.toThrow();
  });

  test("no undefined cells", () => {
    const output = renderCostReport(entries);
    expect(output).not.toContain("undefined");
  });

  test("tokens column shows dash", () => {
    const output = renderCostReport(entries);
    const dataRow = output.split("\n")[2]!;
    expect(dataRow).toContain("| - |");
  });

  test("cache column shows dash", () => {
    const output = renderCostReport(entries);
    const dataRow = output.split("\n")[2]!;
    // Last column before trailing pipe
    expect(dataRow).toMatch(/\|\s*-\s*\|/);
  });

  test("totals row tokens and cache both dash", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[3]!;
    // tokens and cache totals must be "-" when any row lacks them
    expect(totalsRow).toContain("| - |");
  });

  test("totals usd matches entry usd (single entry)", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[3]!;
    expect(totalsRow).toContain("3.0367");
  });

  test("snapshot", () => {
    expect(renderCostReport(entries)).toMatchSnapshot();
  });
});

describe("renderCostReport — legacy-gepa-only (pre-186 shape)", () => {
  // Real values sourced from
  // .claude/artifacts/crew/cost/20260607T095151Z-cost-report-slice-feat037-slice17.md
  // usd: 1.928, duration_ms: 554179 — gepa pipeline, anthropic provider.
  // tokens and cache are absent (pre-186 shape).
  const entries = loadFixture("legacy-gepa-only.json");

  test("renders without crash", () => {
    expect(() => renderCostReport(entries)).not.toThrow();
  });

  test("no undefined cells", () => {
    const output = renderCostReport(entries);
    expect(output).not.toContain("undefined");
  });

  test("totals row tokens and cache both dash", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[3]!;
    expect(totalsRow).toContain("| - |");
  });

  test("totals usd matches entry usd (single entry)", () => {
    const output = renderCostReport(entries);
    const totalsRow = output.split("\n")[3]!;
    expect(totalsRow).toContain("1.9280");
  });

  test("snapshot", () => {
    expect(renderCostReport(entries)).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("renderCostReport — edge cases", () => {
  test("empty entries array renders 3 lines (header + sep + totals)", () => {
    const output = renderCostReport([]);
    const lines = output.split("\n");
    expect(lines.length).toBe(3);
  });

  test("empty entries totals row shows 0.0000 usd and 0 latency", () => {
    const output = renderCostReport([]);
    const totalsRow = output.split("\n")[2]!;
    expect(totalsRow).toContain("0.0000");
    expect(totalsRow).toContain("**0**");
  });

  test("tokens_saved omitted in cache column when not present on hit", () => {
    const entries: CostEntry[] = [
      {
        pipeline: "eval",
        provider: "anthropic",
        usd: 0.01,
        latency_ms: 100,
        tokens: { in: 50, out: 25 },
        cache: { hit: true }
      }
    ];
    const output = renderCostReport(entries);
    const dataRow = output.split("\n")[2]!;
    // Should say "hit" but NOT "(saved)" when tokens_saved is absent
    expect(dataRow).toContain("hit");
    expect(dataRow).not.toContain("saved");
  });
});
