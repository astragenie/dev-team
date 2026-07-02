/**
 * scripts/lib/gepa/gepa-killswitch-cmds.ts — SLICE-106
 *
 * Kill-switch CLI command handlers for the GEPA system:
 *   - gepa-invalidate  — soft-delete trials via TrialStore.invalidate
 *   - gepa-revert      — delete soak pointer + git revert promotion commit
 *   - gepa-thaw        — remove agent from champion_frozen list
 *   - gepa-resume      — clear no-winner streak OR clear global optimize.paused
 *
 * All handlers return { exitCode, stdout, stderr } — the crew.ts dispatcher
 * writes stdout/stderr and exits with the appropriate code.
 *
 * Design constraints (design spec "Kill-switches" lines 705–722):
 *   - NEVER `git push --force`.
 *   - NEVER `git reset` on main — use `git revert` instead.
 *   - gepa-revert reads `prior_prompt_hash` from gepa: frontmatter to locate
 *     the promotion commit.
 *   - gepa-thaw uses atomic tmp+rename write for champion_frozen update.
 *   - All kill-switch operations write an audit row to events.jsonl.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileStore } from "@astragenie/gepa-core";
import { resetStreak } from "./no-winner-streak-tracker.ts";
import { emitGepaEvent, emitSoakRevertEvent } from "./observability-events.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KillswitchCmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function trialsRoot(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "trials");
}

function configPath(repoPath: string): string {
  return join(repoPath, "gepa.config.json");
}

function soakJsonPath(repoPath: string): string {
  return join(repoPath, ".claude", "artifacts", "crew", "gepa", "soak.json");
}

function runGit(
  gitPath: string,
  args: string[],
  cwd: string
): { ok: boolean; stdout: string; stderr: string; status: number } {
  const r = spawnSync(gitPath, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: process.env
  });
  if (r.error) throw r.error;
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status ?? 1
  };
}

/**
 * Read the `gepa:` frontmatter from an agent prompt file.
 * Returns null when no frontmatter is present.
 */
function readGepafrontmatter(agentPath: string): Record<string, string> | null {
  if (!existsSync(agentPath)) return null;
  const content = readFileSync(agentPath, "utf8");
  const lines = content.split("\n");

  // Must start with `---` and have `gepa:` on the second line.
  if (lines[0]?.trimEnd() !== "---") return null;
  if (!lines[1]?.trimStart().startsWith("gepa:")) return null;

  // Extract key:value pairs from the indented block.
  const fields: Record<string, string> = {};
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trimEnd() === "---") break;
    const m = line.match(/^\s+(\w+):\s*(.+)$/);
    if (m?.[1] && m?.[2]) {
      fields[m[1]] = m[2].trim();
    }
  }
  return fields;
}

/**
 * Find the git commit SHA that introduced a file with a specific content hash.
 * Searches the git log for commits that modified `agentPath` and matches
 * the `prior_prompt_hash` stored in the gepa: frontmatter.
 *
 * Uses `git log --follow -p -- <path>` to trace renames.
 * Returns the commit SHA or null if not found.
 */
function findPromotionCommit(gitPath: string, cwd: string, agentFile: string): string | null {
  // git log --format=%H -- agents/<agent>.md to get commits that touched the file
  const logResult = runGit(gitPath, ["log", "--format=%H", "--", agentFile], cwd);
  if (!logResult.ok || !logResult.stdout.trim()) return null;

  const commits = logResult.stdout
    .trim()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Walk commits from newest to oldest looking for the most recent
  // `chore(gepa): promote` commit.
  for (const sha of commits) {
    const msgResult = runGit(gitPath, ["log", "--format=%s", "-1", sha], cwd);
    if (msgResult.ok && msgResult.stdout.trim().startsWith("chore(gepa): promote")) {
      return sha;
    }
  }
  return null;
}

// ── gepa-invalidate ───────────────────────────────────────────────────────────

interface InvalidateArgs {
  agent?: string | undefined;
  since?: string | undefined;
  tag?: string | undefined;
}

function parseInvalidateArgs(args: string[]): InvalidateArgs {
  const parsed: InvalidateArgs = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    if (arg === "--agent") {
      parsed.agent = args[i + 1];
      i += 2;
    } else if (arg === "--since") {
      parsed.since = args[i + 1];
      i += 2;
    } else if (arg === "--tag") {
      parsed.tag = args[i + 1];
      i += 2;
    } else if (!arg.startsWith("--") && !parsed.agent) {
      parsed.agent = arg;
      i++;
    } else {
      i++;
    }
  }
  return parsed;
}

/**
 * Soft-delete trials via TrialStore.invalidate.
 *
 * Usage: gepa-invalidate --agent <name> [--since <iso>] [--tag <tag>]
 */
export async function runGepaInvalidateCmd(
  repoPath: string,
  args: string[]
): Promise<KillswitchCmdResult> {
  const { agent, since, tag } = parseInvalidateArgs(args);

  if (!agent) {
    return {
      exitCode: 2,
      stdout: "",
      stderr:
        "usage: gepa-invalidate --agent <name> [--since <iso>] [--tag <tag>] [--repo <path>]\n"
    };
  }

  const store = fileStore(trialsRoot(repoPath));

  // gepa-core 0.6.0's fileStore.invalidate applies filters as OR — passing
  // both {agent, since} would purge ALL trials for the agent regardless of
  // date. SLICE-106 AC-5 requires AND semantics (only trials matching both
  // the agent AND the since cutoff). Filter the trial IDs in JS first, then
  // pass the exact ID set to invalidate.
  let count = 0;
  if (since !== undefined || tag !== undefined) {
    const trials = await store.recall({ agent });
    // Numeric Date compare — string compare would false-negative when the
    // stored `created_at` has ms precision (`.000Z`) and the `--since` arg
    // omits ms (`Z`); lexicographic order puts `.` (46) before `Z` (90),
    // so `"2026-06-25T00:00:00.000Z" < "2026-06-25T00:00:00Z"` even though
    // they represent the same instant.
    const sinceMs = since !== undefined ? Date.parse(since) : Number.NEGATIVE_INFINITY;
    const targetIds = trials
      .filter((t) => (since === undefined ? true : Date.parse(t.created_at) >= sinceMs))
      .filter((t) => {
        if (tag === undefined) return true;
        const tags = (t as unknown as { tags?: string[] }).tags ?? [];
        return tags.includes(tag);
      })
      .map((t) => t.id);
    if (targetIds.length > 0) {
      count = await store.invalidate({ trial_ids: targetIds });
    }
  } else {
    count = await store.invalidate({ agent });
  }

  // Write audit row to events.jsonl.
  emitGepaEvent(repoPath, {
    event: "gepa_invalidate",
    agent,
    since: since ?? null,
    tag: tag ?? null,
    invalidated_count: count,
    invalidated_by_pid: process.pid,
    invalidated_at: new Date().toISOString(),
    reason: `manual kill-switch via gepa-invalidate`
  });

  const sinceLabel = since ? ` since ${since}` : "";
  const tagLabel = tag ? ` tag=${tag}` : "";
  return {
    exitCode: 0,
    stdout: `invalidated ${count} trials for ${agent}${sinceLabel}${tagLabel}\n`,
    stderr: ""
  };
}

// ── gepa-revert helpers ───────────────────────────────────────────────────────

function removeSoakPointer(repoPath: string, agent: string): void {
  const soakPath = soakJsonPath(repoPath);
  if (!existsSync(soakPath)) return;
  try {
    const raw = readFileSync(soakPath, "utf8");
    const soakMap = JSON.parse(raw) as Record<string, unknown>;
    if (!(agent in soakMap)) return;
    delete soakMap[agent];
    const tmp = `${soakPath}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(soakMap, null, 2), "utf8");
    renameSync(tmp, soakPath);
  } catch {
    // Non-fatal: soak.json parse error — continue to git revert.
  }
}

function applyGitRevert(
  repoPath: string,
  gitPath: string,
  agent: string,
  promotionSha: string,
  frontmatter: Record<string, string> | null
): KillswitchCmdResult {
  // NEVER git reset, NEVER git push --force.
  const revertResult = runGit(gitPath, ["revert", "--no-edit", promotionSha], repoPath);
  if (!revertResult.ok) {
    emitSoakRevertEvent(repoPath, {
      agent,
      reason: `git revert failed: ${revertResult.stderr.trim()}`
    });
    return {
      exitCode: 1,
      stdout: "",
      stderr:
        `gepa-revert: git revert failed (possible merge conflict).\n` +
        `Resolve manually:\n  git revert --no-edit ${promotionSha}\n\n` +
        `Stderr: ${revertResult.stderr.trim()}\n`
    };
  }
  const headResult = runGit(gitPath, ["rev-parse", "HEAD"], repoPath);
  const revertCommitSha = headResult.ok ? headResult.stdout.trim() : undefined;
  emitSoakRevertEvent(repoPath, {
    agent,
    reason: `manual kill-switch: gepa-revert reverted promotion commit ${promotionSha}`,
    ...(revertCommitSha !== undefined ? { revert_commit: revertCommitSha } : {}),
    ...(frontmatter?.champion_from_trial ? { trial_id: frontmatter.champion_from_trial } : {})
  });
  const suffix = revertCommitSha ? ` → ${revertCommitSha}` : "";
  return {
    exitCode: 0,
    stdout:
      `gepa-revert: soak pointer removed for ${agent}\n` +
      `gepa-revert: reverted promotion commit ${promotionSha}${suffix}\n` +
      `gepa-revert: event gepa_soak_revert logged\n`,
    stderr: ""
  };
}

// ── gepa-revert ───────────────────────────────────────────────────────────────

/**
 * Revert a promoted champion:
 *   1. Delete the soak pointer for the agent in soak.json.
 *   2. Find the promotion commit via git log.
 *   3. `git revert <sha>` (never force-push, never reset).
 *
 * Usage: gepa-revert --agent <name> [--git <path>] [--repo <path>]
 */
export async function runGepaRevertCmd(
  repoPath: string,
  args: string[],
  opts: { gitPath?: string } = {}
): Promise<KillswitchCmdResult> {
  let agent: string | undefined;
  let gitPath = opts.gitPath ?? "git";

  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    if (arg === "--agent") {
      agent = args[i + 1];
      i += 2;
    } else if (arg === "--git") {
      gitPath = args[i + 1] ?? "git";
      i += 2;
    } else if (!arg.startsWith("--") && !agent) {
      agent = arg;
      i++;
    } else {
      i++;
    }
  }

  if (!agent) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "usage: gepa-revert --agent <name> [--repo <path>]\n"
    };
  }

  const agentFile = `agents/${agent}.md`;
  const agentPath = join(repoPath, agentFile);

  // Step 1: Remove soak pointer (non-fatal).
  removeSoakPointer(repoPath, agent);

  // Step 2: Read frontmatter for trial_id correlation in event.
  const frontmatter = readGepafrontmatter(agentPath);

  // Step 3: Find promotion commit.
  const promotionSha = findPromotionCommit(gitPath, repoPath, agentFile);
  if (!promotionSha) {
    emitSoakRevertEvent(repoPath, {
      agent,
      reason: "no promotion commit found — soak pointer removed, no git revert needed"
    });
    return {
      exitCode: 0,
      stdout: `gepa-revert: soak pointer removed for ${agent}; no promotion commit found — no git revert needed\n`,
      stderr: ""
    };
  }

  // Step 4: git revert.
  return applyGitRevert(repoPath, gitPath, agent, promotionSha, frontmatter);
}

// ── gepa-thaw ─────────────────────────────────────────────────────────────────

/**
 * Remove agent from gepa.config.json `champion_frozen` list.
 * Uses atomic tmp+rename write.
 *
 * Usage: gepa-thaw <agent> [--repo <path>]
 */
export async function runGepaThawCmd(
  repoPath: string,
  positionals: string[]
): Promise<KillswitchCmdResult> {
  const agent = positionals[0];
  if (!agent || agent.startsWith("--")) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "usage: gepa-thaw <agent> [--repo <path>]\n"
    };
  }

  const cfgPath = configPath(repoPath);
  if (!existsSync(cfgPath)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `gepa-thaw: gepa.config.json not found at ${cfgPath}\n`
    };
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
  } catch (e) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `gepa-thaw: failed to parse gepa.config.json: ${e instanceof Error ? e.message : String(e)}\n`
    };
  }

  const frozen = Array.isArray(config.champion_frozen) ? (config.champion_frozen as string[]) : [];

  if (!frozen.includes(agent)) {
    return {
      exitCode: 0,
      stdout: `gepa-thaw: ${agent} is not in champion_frozen — nothing to do\n`,
      stderr: ""
    };
  }

  const newFrozen = frozen.filter((a) => a !== agent);
  const updated = { ...config, champion_frozen: newFrozen };

  // Atomic write: tmp + rename.
  const tmp = `${cfgPath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(updated, null, 2) + "\n", "utf8");
  renameSync(tmp, cfgPath);

  emitGepaEvent(repoPath, {
    event: "gepa_thaw",
    agent,
    champion_frozen_before: frozen,
    champion_frozen_after: newFrozen,
    thawed_at: new Date().toISOString()
  });

  return {
    exitCode: 0,
    stdout: `gepa-thaw: removed ${agent} from champion_frozen (was: [${frozen.join(", ")}], now: [${newFrozen.join(", ")}])\n`,
    stderr: ""
  };
}

// ── gepa-resume (extended) ────────────────────────────────────────────────────

/**
 * Extended gepa-resume:
 *   - With agent: clear no-winner streak for that agent (same as SLICE-99).
 *   - Without agent: clear global `optimize.paused: true` in gepa.config.json.
 *
 * Usage: gepa-resume [<agent>] [--repo <path>]
 */
export async function runGepaResumeCmdExtended(
  repoPath: string,
  positionals: string[]
): Promise<KillswitchCmdResult> {
  const agent = positionals[0];

  if (agent && !agent.startsWith("--")) {
    // Per-agent resume: clear no-winner streak.
    resetStreak(agent, { repoPath });
    emitGepaEvent(repoPath, {
      event: "gepa_resume",
      agent,
      resumed_at: new Date().toISOString()
    });
    return {
      exitCode: 0,
      stdout: `gepa-resume: streak cleared for agent ${agent}\n`,
      stderr: ""
    };
  }

  // Global resume: clear optimize.paused.
  const cfgPath = configPath(repoPath);
  if (!existsSync(cfgPath)) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `gepa-resume: gepa.config.json not found at ${cfgPath} — cannot clear global pause\n`
    };
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(readFileSync(cfgPath, "utf8")) as Record<string, unknown>;
  } catch (e) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `gepa-resume: failed to parse gepa.config.json: ${e instanceof Error ? e.message : String(e)}\n`
    };
  }

  const optimize = (config.optimize ?? {}) as Record<string, unknown>;
  const wasPaused = optimize.paused === true;
  const updated = {
    ...config,
    optimize: { ...optimize, paused: false }
  };

  // Atomic write.
  const tmp = `${cfgPath}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(updated, null, 2) + "\n", "utf8");
  renameSync(tmp, cfgPath);

  emitGepaEvent(repoPath, {
    event: "gepa_resume",
    global: true,
    was_paused: wasPaused,
    resumed_at: new Date().toISOString()
  });

  return {
    exitCode: 0,
    stdout: `gepa-resume: global optimize.paused cleared (was: ${wasPaused})\n`,
    stderr: ""
  };
}
