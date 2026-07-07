// TDD: Wave 1.5 — fix runner-plugin issue #360.
//
// writeArtifact's fire-and-forget capture-tee call (fireCaptureTeeSilent)
// was previously (a) unguarded — a cold @astragenie/gepa-core parse could
// block the write for multiple seconds — and (b) inline-awaited inside
// writeArtifact, so even a *bounded* guard would still delay every
// artifact write's return by up to the guard ceiling. This suite proves:
//   1. writeArtifact returns promptly even when the underlying capture is
//      slow (via an injectable test seam — mirrors the __resolveRemote
//      pattern in astramem-provider.ts — never touched by production
//      callers).
//   2. capture still fires on the fast/normal path (the guard must not
//      silently disable capture).
//   3. production behavior (no overrides passed) is unaffected — the
//      default loader is used, byte-identical to pre-seam behavior.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { __drainPendingCaptures, writeArtifact } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function guardTestFields(): ArtifactFields {
  return {
    title: "guard-test",
    owner: "fullstack-dev",
    slice: "S2",
    cost: { usd: 0.001 }
  };
}

function writeEnabledConfig(root: string): void {
  writeFileSync(
    join(root, "gepa.config.json"),
    JSON.stringify({
      capture: { enabled: true, walltime_ms: 2000 },
      storage: { backend: "file", file_root: ".claude/artifacts/crew/gepa/trials" }
    })
  );
}

describe("writeArtifact capture guard (issue #360)", () => {
  test("returns promptly even when the injected captureTee loader is slow/cold", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-guard-slow-"));
    try {
      writeEnabledConfig(root);
      // Simulates a cold @astragenie/gepa-core dynamic import: slow but
      // REAL (a plain, ref'd setTimeout — never unref'd, matching how real
      // production work behaves; only the guard's own ceiling timer is
      // unref'd, see guarded-fire.ts).
      const slowLoader = () =>
        new Promise<{ captureTee: (...args: unknown[]) => Promise<void> }>((resolve) => {
          setTimeout(() => resolve({ captureTee: async () => {} }), 800);
        });

      const t0 = performance.now();
      const result = await writeArtifact(root, "handoff", guardTestFields(), {
        __captureTeeLoader: slowLoader,
        __guardTimeoutMs: 50
      });
      const elapsed = performance.now() - t0;

      expect(result.ok).toBe(true);
      // Must return long before the 800ms slow loader — and well under
      // even the 50ms guard ceiling, because the call is detached, not
      // awaited.
      expect(elapsed).toBeLessThan(300);
    } finally {
      await __drainPendingCaptures();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("still fires capture on the fast/normal path (guard doesn't silently disable capture)", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-guard-fast-"));
    try {
      writeEnabledConfig(root);
      const result = await writeArtifact(root, "handoff", guardTestFields());
      expect(result.ok).toBe(true);

      await __drainPendingCaptures();

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      const raw = readFileSync(trialFile, "utf8").trim();
      expect(raw.length).toBeGreaterThan(0);
      const trial = JSON.parse(raw.split("\n")[0]!);
      expect(trial.agent).toBe("fullstack-dev");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("production path (no overrides) is unaffected — capture still lands after draining", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-guard-prod-"));
    try {
      writeEnabledConfig(root);
      // No overrides object at all — exercises the exact call shape every
      // existing production caller (scripts/crew.ts) uses.
      const result = await writeArtifact(root, "handoff", guardTestFields());
      expect(result.ok).toBe(true);

      await __drainPendingCaptures();

      const trialFile = join(root, ".claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl");
      expect(readFileSync(trialFile, "utf8").trim().length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
