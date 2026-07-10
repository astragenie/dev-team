// Resolves the canonical (main) repo root for state that must be visible
// across linked worktrees — e.g. cross-lane file claims (#163: concurrent
// chore-branch worktree support). Mirrors the pattern already shipped in
// astragenie/runner-plugin's resolveCanonicalRepoRoot (src/scripts/lib/
// learnings.mts, FEAT-188 S1b) for the identical worktree-isolation
// problem: a linked worktree's `.claude/state/` is a separate directory on
// disk, invisible to sibling worktrees, so state meant to be shared across
// lanes must redirect to the main worktree instead of writing a
// worktree-local copy nobody else can see. Not yet promoted to
// plugins-common (FEAT-188 S1b/S3b flagged MemoryProvider as the first
// extraction candidate) — duplicated here deliberately small.
import path from "node:path";
import { runGit } from "@astragenie/plugin-std/git";

async function gitText(args: string[], cwd: string): Promise<string | null> {
  try {
    const result = await runGit(args, { cwd, maxBuffer: 64 * 1024 });
    return result.ok ? result.stdout.trim() : null;
  } catch {
    return null;
  }
}

const canonicalRootCache = new Map<string, Promise<string>>();

export async function resolveCanonicalRepoRoot(repoPath: string): Promise<string> {
  let cached = canonicalRootCache.get(repoPath);
  if (!cached) {
    cached = computeCanonicalRepoRoot(repoPath);
    canonicalRootCache.set(repoPath, cached);
  }
  return cached;
}

async function computeCanonicalRepoRoot(repoPath: string): Promise<string> {
  const [commonDir, gitDir] = await Promise.all([
    gitText(["rev-parse", "--git-common-dir"], repoPath),
    gitText(["rev-parse", "--git-dir"], repoPath)
  ]);
  // Not a git repo (or git unavailable, e.g. a plain test fixture) — use as-is.
  if (commonDir === null || gitDir === null) return repoPath;
  const commonAbs = path.resolve(repoPath, commonDir);
  const gitAbs = path.resolve(repoPath, gitDir);
  // Equal means repoPath is the main worktree already — no redirect.
  if (commonAbs === gitAbs) return repoPath;
  // Standard layout: the common dir is <mainRepo>/.git — its parent is the
  // main worktree root. Anything else (bare repo, unusual layout) falls
  // back to repoPath rather than guessing.
  return path.basename(commonAbs) === ".git" ? path.dirname(commonAbs) : repoPath;
}

// Test-only: the memoization cache is keyed by repoPath string, which test
// fixtures reuse across runs (tmpdir names collide rarely but the cache
// would otherwise pin a stale answer if a path were ever reused).
export function __clearCanonicalRootCacheForTests(): void {
  canonicalRootCache.clear();
}
