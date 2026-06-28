// TDD: Task 7 — AC-1 capture-absent parity.
// Correction vs plan: writeArtifact takes ArtifactFields (owner/slice/title), not
// { payload }. Uses real "handoff" dispatch kind so the tee is exercised.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeArtifact } from "../../scripts/lib/artifacts/write.ts";
import type { ArtifactFields } from "../../scripts/lib/artifacts/types.ts";

function listAllFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      if (name.isDirectory()) walk(full);
      else out.push(full.replace(root, ""));
    }
  }
  walk(root);
  return out.sort();
}

function normalizeVolatile(content: string): string {
  // Strip per-call volatile fields (Created timestamps embedded by writeArtifact's
  // nowIso() calls). Two back-to-back calls cross ms boundaries on Linux but
  // not Windows; without this filter the byte-identical assertion is flaky.
  return content.replace(/^- Created:.*$/gm, "- Created: <NORMALIZED>");
}

function copyTreeContent(root: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const rel of listAllFiles(root)) {
    map[rel] = normalizeVolatile(readFileSync(join(root, rel), "utf8"));
  }
  return map;
}

function fullstackFields(): ArtifactFields {
  return {
    title: "test-run",
    owner: "fullstack-dev",
    slice: "S2",
    cost: { usd: 0.01 }
  };
}

function filterNonGepa(rels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(rels).filter(
      ([rel]) =>
        rel.includes(".claude/artifacts/crew/") && !rel.includes(".claude/artifacts/crew/gepa/")
    )
  );
}

describe("capture-absent parity", () => {
  test("no gepa.config.json → artifact tree byte-identical to control", async () => {
    const a = mkdtempSync(join(tmpdir(), "gepa-control-"));
    const b = mkdtempSync(join(tmpdir(), "gepa-absent-"));
    try {
      await writeArtifact(a, "handoff", fullstackFields());
      await writeArtifact(b, "handoff", fullstackFields());
      expect(filterNonGepa(copyTreeContent(a))).toEqual(filterNonGepa(copyTreeContent(b)));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });

  test("capture.enabled: false → no gepa/ subtree appears", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-disabled-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: false } })
      );
      await writeArtifact(root, "handoff", fullstackFields());
      const all = listAllFiles(root);
      expect(all.some((p) => p.includes(".claude/artifacts/crew/gepa/"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
