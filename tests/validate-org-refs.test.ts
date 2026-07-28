import { test, expect } from "bun:test";
// tests/validate-org-refs.test.ts — the stale-owner sweep guard.
// Ported alongside astragenie/runner-plugin's equivalent after the
// sergeymilashico -> astragenie transfer left stale owner refs in authored
// docs + skill frontmatter that kept working via GitHub's redirect.
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { validateOrgRefs } from "../scripts/validate-org-refs.ts";

async function tmpRepo(prefix: string): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

test("validateOrgRefs: flags a stale sergeymilashico owner ref in an authored file", async () => {
  const repo = await tmpRepo("dt-org-refs-bad-");
  await writeFile(
    path.join(repo, "README.md"),
    "# x\n/plugin marketplace add sergeymilashico/astra-marketplace\n"
  );
  const result = await validateOrgRefs(repo);
  expect(result.ok).toBe(false);
  expect(result.findings.length).toBe(1);
  expect(result.findings[0]?.file).toBe("README.md");
  expect(result.findings[0]?.line).toBe(2);
});

test("validateOrgRefs: flags a stale owner: sergeymilashico in skill frontmatter", async () => {
  const repo = await tmpRepo("dt-org-refs-skill-");
  const skillDir = path.join(repo, "skills", "workflow", "using-crew");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: using-crew\nowner: sergeymilashico\n---\n"
  );
  const result = await validateOrgRefs(repo);
  expect(result.ok).toBe(false);
  expect(result.findings.length).toBe(1);
});

test("validateOrgRefs: clean when the owner is astragenie / astra", async () => {
  const repo = await tmpRepo("dt-org-refs-ok-");
  await writeFile(
    path.join(repo, "README.md"),
    "# x\n/plugin marketplace add astragenie/astra-marketplace\n"
  );
  const skillDir = path.join(repo, "skills", "workflow", "using-crew");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: using-crew\nowner: astra\n---\n");
  const result = await validateOrgRefs(repo);
  expect(result.ok).toBe(true);
  expect(result.findings).toEqual([]);
});

test("validateOrgRefs: does not scan 3rdparty (vendored) subtrees", async () => {
  const repo = await tmpRepo("dt-org-refs-3rdparty-");
  const vendored = path.join(repo, "agents", "3rdparty");
  await mkdir(vendored, { recursive: true });
  await writeFile(path.join(vendored, "vendored.md"), "see sergeymilashico/whatever\n");
  const result = await validateOrgRefs(repo);
  expect(result.ok, "3rdparty vendored files are out of scope").toBe(true);
});
