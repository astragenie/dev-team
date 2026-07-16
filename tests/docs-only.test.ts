// #163 S3 — docs-only diff classifier + push-range resolution.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { test, expect } from "bun:test";

import { isDocsOnlyDiff, pushedFileset, isDocsOnlyPush } from "../scripts/lib/docs-only.ts";

process.env.GIT_CEILING_DIRECTORIES = os.tmpdir();

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@test.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@test.com"
};

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, env: GIT_ENV, stdio: "pipe" }).toString().trim();
}

test("isDocsOnlyDiff — pure path classification", () => {
  // All-docs sets → true.
  expect(isDocsOnlyDiff(["README.md", "docs/architecture/x.md"])).toBe(true);
  expect(isDocsOnlyDiff(["CHANGELOG.md", "LICENSE"])).toBe(true);
  expect(isDocsOnlyDiff([".claude/artifacts/crew/reviews/r.md"])).toBe(true);
  expect(isDocsOnlyDiff(["notes.txt", "docs/guide.mdx"])).toBe(true);
  // Backslash paths (Windows-style) normalize.
  expect(isDocsOnlyDiff(["docs\\a.md"])).toBe(true);

  // Any non-docs path → false.
  expect(isDocsOnlyDiff(["README.md", "scripts/lib/x.ts"])).toBe(false);
  expect(isDocsOnlyDiff(["package.json"])).toBe(false);
  expect(isDocsOnlyDiff(["docs.ts"])).toBe(false); // not under docs/, .ts extension
  expect(isDocsOnlyDiff(["src/readme.md.ts"])).toBe(false);

  // Empty → false (nothing to reason about).
  expect(isDocsOnlyDiff([])).toBe(false);
  expect(isDocsOnlyDiff(["  "])).toBe(false);
});

async function makeRepoWithUpstream(label: string): Promise<string> {
  // "remote" acts as the upstream origin; "work" is a clone that branches off.
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), `docs-remote-${label}-`));
  git(["init", "-q", "-b", "main", "--bare"], remote);

  const work = await fs.mkdtemp(path.join(os.tmpdir(), `docs-work-${label}-`));
  git(["init", "-q", "-b", "main"], work);
  git(["config", "user.email", "test@test.com"], work);
  git(["config", "user.name", "Test"], work);
  await fs.writeFile(path.join(work, "README.md"), "# test\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "init"], work);
  git(["remote", "add", "origin", remote], work);
  git(["push", "-q", "-u", "origin", "main"], work);
  return work;
}

test("pushedFileset resolves the branch's added files against upstream", async () => {
  const work = await makeRepoWithUpstream("fileset");
  git(["checkout", "-q", "-b", "chore/lane"], work);
  await fs.writeFile(path.join(work, "docs.md"), "docs\n");
  await fs.mkdir(path.join(work, "docs"), { recursive: true });
  await fs.writeFile(path.join(work, "docs", "guide.md"), "guide\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "docs"], work);
  // Track upstream so @{u} resolves.
  git(["branch", "--set-upstream-to=origin/main", "chore/lane"], work);

  const files = await pushedFileset(work);
  expect(files).not.toBe(null);
  expect((files ?? []).sort()).toEqual(["docs.md", "docs/guide.md"]);
});

test("isDocsOnlyPush — true for a docs-only branch, false when code is mixed in", async () => {
  const work = await makeRepoWithUpstream("push");
  git(["checkout", "-q", "-b", "chore/lane"], work);
  await fs.writeFile(path.join(work, "NOTES.md"), "notes\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "docs"], work);
  git(["branch", "--set-upstream-to=origin/main", "chore/lane"], work);
  expect(await isDocsOnlyPush(work)).toBe(true);

  // Add a code file → no longer docs-only.
  await fs.writeFile(path.join(work, "index.ts"), "export const x = 1;\n");
  git(["add", "-A"], work);
  git(["commit", "-q", "-m", "code"], work);
  expect(await isDocsOnlyPush(work)).toBe(false);
});

test("isDocsOnlyPush — false (indeterminate) when no upstream can be resolved", async () => {
  const solo = await fs.mkdtemp(path.join(os.tmpdir(), "docs-solo-"));
  git(["init", "-q", "-b", "main"], solo);
  git(["config", "user.email", "test@test.com"], solo);
  git(["config", "user.name", "Test"], solo);
  await fs.writeFile(path.join(solo, "a.md"), "a\n");
  git(["add", "-A"], solo);
  git(["commit", "-q", "-m", "init"], solo);
  // No remote, no upstream → indeterminate → false (normal gate applies).
  expect(await pushedFileset(solo)).toBe(null);
  expect(await isDocsOnlyPush(solo)).toBe(false);
});
