// tests/memory-recall-injection-completeness.test.ts
// FEAT-188 S3a completeness fitness test.
//
// Grep-based check across the known dispatch-assembly modules: each must
// reference the ONE recall-injection helper (scripts/lib/memory/inject-recall.ts,
// surfaced to markdown-driven dispatch commands via `node scripts/crew.ts
// recall-block`). If a new dispatch-assembly path is added to
// ASSEMBLY_MODULES below without wiring the helper, this test fails —
// that's the intended guardrail against a second, unwired dispatch path
// silently skipping recall injection.
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

interface AssemblyModule {
  relPath: string;
  /** Marker proving this module was wired to the recall-injection helper. */
  marker: RegExp;
}

// The dev-team dispatch-assembly sites named in FEAT-188 S3a's scope.
// dispatch.mts is wired via its own emitted `memory` field (no CLI call —
// it's a pure plan generator), so its marker differs from the markdown
// command files, which call the `recall-block` CLI surface directly.
const ASSEMBLY_MODULES: AssemblyModule[] = [
  { relPath: "commands/build.md", marker: /recall-block/ },
  { relPath: "commands/fix.md", marker: /recall-block/ },
  { relPath: "commands/ship.md", marker: /recall-block/ },
  { relPath: "commands/orchestrate-slice.md", marker: /recall-block/ },
  {
    relPath: "scripts/lib/slice-linker/dispatch.mts",
    marker: /inject-recall\.ts|DispatchMemoryHint/
  }
];

test("every known dispatch-assembly module references the recall-injection helper", async () => {
  for (const mod of ASSEMBLY_MODULES) {
    const targetPath = path.join(REPO_ROOT, mod.relPath);
    const content = await fs.readFile(targetPath, "utf8");
    assert.match(
      content,
      mod.marker,
      `${mod.relPath} is a declared dispatch-assembly site but does not reference the ` +
        `recall-injection helper (FEAT-188 S3a) — wire it via \`recall-block\` (CLI) or the ` +
        `\`memory\` DispatchMemoryHint (dispatch.mts), or remove it from ASSEMBLY_MODULES if it ` +
        `no longer assembles a dispatch instruction.`
    );
  }
});

test("the canonical assembly-module list matches FEAT-188 S3a's declared scope (5 sites)", () => {
  // Sanity guard: catches someone quietly shrinking ASSEMBLY_MODULES to
  // dodge the completeness check above, rather than actually wiring a new
  // or existing site.
  assert.equal(ASSEMBLY_MODULES.length, 5);
});
