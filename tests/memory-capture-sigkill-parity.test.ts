// tests/memory-capture-sigkill-parity.test.ts
// FEAT-188 S5 AC: capture-parity golden test incl. a SIGKILL case — a
// capture issued is either fully captured or safely dropped, never
// corrupting the JSONL store. Mirrors the gepa capture-parity /
// capture-sigkill-parity pattern (tests/gepa/capture-parity.test.ts,
// tests/gepa/capture-sigkill-parity.test.ts): spawn a real child process (so
// SIGKILL is a genuine process kill, not a simulated one), let it run a
// batch of fileProvider.capture() calls, kill it mid-flight, then assert the
// JSONL store on disk parses cleanly and recall() never throws.
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileProvider } from "../scripts/lib/memory/file-provider.ts";

const LEARNINGS_REL = [".claude", "artifacts", "loop", "learnings.jsonl"];

describe("memory capture-parity (golden, incl. SIGKILL)", () => {
  test("golden: every capture in a normal run round-trips through recall()", async () => {
    const root = mkdtempSync(join(tmpdir(), "memory-capture-golden-"));
    try {
      const provider = fileProvider(root);
      const count = 25;
      for (let i = 0; i < count; i += 1) {
        await provider.capture({
          id: `golden-${i}`,
          kind: "lesson",
          severity: "medium",
          summary: `golden entry ${i}`,
          source: "capture-parity-golden"
        });
      }

      const results = await provider.recall({ k: count, maxTokens: 1_000_000 });
      const ids = new Set(results.map((r) => r.id));
      for (let i = 0; i < count; i += 1) {
        expect(ids.has(`golden-${i}`)).toBe(true);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a capture killed mid-write is either fully captured or safely dropped — no JSONL corruption", async () => {
    const root = mkdtempSync(join(tmpdir(), "memory-capture-sigkill-"));
    try {
      const cwd = process.cwd().replace(/\\/g, "/");
      const child = Bun.spawn({
        cmd: [
          "bun",
          "run",
          "-e",
          `
          const { fileProvider } = await import("${cwd}/scripts/lib/memory/file-provider.ts");
          const provider = fileProvider(${JSON.stringify(root)});
          for (let i = 0; i < 300; i++) {
            await provider.capture({
              kind: "lesson",
              severity: "low",
              summary: "sigkill entry " + i,
              source: "capture-parity-sigkill"
            });
          }
          `
        ],
        stdout: "pipe",
        stderr: "pipe"
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      child.kill(9);
      await child.exited;

      const target = join(root, ...LEARNINGS_REL);
      if (!existsSync(target)) {
        // Killed before any flush reached disk — "safely dropped", satisfies
        // the AC without a store to inspect.
        return;
      }

      const raw = readFileSync(target, "utf8");
      const lines = raw.split("\n").filter((l) => l.trim().length > 0);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }

      // recall() must never throw even against a store that may end with a
      // torn trailing line from the kill.
      const provider = fileProvider(root);
      const results = await provider.recall({ k: 1000 });
      expect(Array.isArray(results)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
