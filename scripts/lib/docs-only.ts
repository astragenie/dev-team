// #163 S3 — right-sized gates for the quick-win chore lane.
//
// A docs/artifact/comment-only change has no runtime surface to validate, so
// paying the full verifier ceremony (and the pre-push PASS-artifact gate) for
// it is pure ceremony tax (issue ask #3). This module classifies a change set
// as docs-only by path, and resolves the file set a push would publish, so the
// pre-push hook can skip validation for a genuinely docs-only push.
//
// Path-based on purpose: it is conservative and deterministic. A change that
// touches ANY non-docs path is NOT docs-only and pays the normal gate — we
// never want a loose classifier to wave real code past validation.

import { runGit as runGitStd } from "@astragenie/plugin-std/git";

// A file is "docs" iff its repo-relative path matches one of these. Kept tight:
// Markdown/text, the docs/ tree, committed crew artifacts, and the canonical
// CHANGELOG/LICENSE. Anything else (source, config, tests) fails the check.
const DOCS_PATTERNS: RegExp[] = [
  /\.mdx?$/i,
  /\.txt$/i,
  /^docs\//,
  /^\.claude\/artifacts\//,
  /(^|\/)CHANGELOG(\.[A-Za-z]+)?$/,
  /(^|\/)LICENSE(\.[A-Za-z]+)?$/
];

function isDocsPath(file: string): boolean {
  const normalized = file.trim().split("\\").join("/");
  return DOCS_PATTERNS.some((pattern) => pattern.test(normalized));
}

// True iff `files` is non-empty and EVERY entry is a docs path. An empty list
// is not docs-only (nothing to reason about → let the normal gate decide).
export function isDocsOnlyDiff(files: string[]): boolean {
  const meaningful = files.map((f) => f.trim()).filter(Boolean);
  if (meaningful.length === 0) return false;
  return meaningful.every(isDocsPath);
}

async function gitText(args: string[], cwd: string): Promise<string | null> {
  try {
    const result = await runGitStd(args, { cwd, maxBuffer: 1024 * 1024 });
    return result.ok ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

// The ref a push would publish against: the branch's configured upstream, else
// a conventional origin/main / origin/HEAD. Returns null when none resolves —
// callers treat that as "indeterminate", NOT docs-only.
async function resolveUpstream(repoRoot: string): Promise<string | null> {
  const tracked = await gitText(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
    repoRoot
  );
  if (tracked) return tracked;
  for (const ref of ["origin/main", "origin/HEAD"]) {
    if (await gitText(["rev-parse", "--verify", "--quiet", ref], repoRoot)) return ref;
  }
  return null;
}

// The set of files this branch adds over its upstream (three-dot: changes on
// HEAD since the merge-base). Returns null when the range can't be resolved
// (no upstream, git failure) so the caller can fall back to the normal gate.
export async function pushedFileset(repoRoot: string): Promise<string[] | null> {
  const upstream = await resolveUpstream(repoRoot);
  if (!upstream) return null;
  const out = await gitText(["diff", "--name-only", `${upstream}...HEAD`], repoRoot);
  if (out === null) return null;
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// True iff the push range resolves to a non-empty, entirely-docs file set.
// Indeterminate ranges and any non-docs file yield false → normal gate applies.
export async function isDocsOnlyPush(repoRoot: string): Promise<boolean> {
  const files = await pushedFileset(repoRoot);
  if (files === null) return false;
  return isDocsOnlyDiff(files);
}
