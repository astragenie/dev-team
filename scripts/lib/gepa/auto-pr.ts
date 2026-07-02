/**
 * scripts/lib/gepa/auto-pr.ts — SLICE-105
 *
 * Orchestrates the GEPA auto-PR flow:
 *
 *   1. Check `gh auth status` — exit non-zero with manual commands if not auth'd.
 *   2. Call branch-protection-check.ts.
 *   3. Create branch `gepa/<agent>/<trial-id>` from main.
 *        - On collision, append `-retry-<n>` suffix (up to 5 attempts).
 *        - NEVER git push --force.
 *   4. Write provenance frontmatter to `agents/<agent>.md`.
 *   5. Commit the prompt edit + frontmatter.
 *   6. Push the branch (no --force).
 *   7. `gh pr create` with structured body.
 *   8. Apply labels via `gh pr edit --add-label`.
 *        - Always: `gepa`, `agent:<agent>`.
 *        - If protection present: `branch_protection_present`.
 *        - If missing: `branch_protection_missing` + open as --draft.
 *   9. Log `gepa_branch_protection_missing` event when protection absent.
 *
 * Constraints:
 *   - MUST NOT call `gh pr merge --auto` (S8b territory).
 *   - MUST NOT `git push --force` under any condition.
 *   - gh absent → print manual commands + exit non-zero.
 *   - No partial branch/commit left when gh auth fails.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  checkBranchProtection,
  GhAbsentError,
  type BranchProtectionCheckOpts
} from "./branch-protection-check.ts";
import {
  writeChampionProvenance,
  hashPromptBody,
  stripGepafrontmatter
} from "./champion-provenance-writer.ts";
import type { OptimizationResult } from "./optimize-runner.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutoPrOpts {
  /** Absolute path to the repo root. */
  repoPath: string;
  /** Agent name (e.g. "fullstack-dev"). */
  agent: string;
  /** Optimization run result containing the winner info. */
  result: OptimizationResult;
  /**
   * Override the `gh` binary path (useful for tests that shim the CLI).
   */
  ghPath?: string;
  /**
   * Override the `git` binary path (useful for tests).
   */
  gitPath?: string;
  /**
   * Override repo option for branch-protection-check (owner/name).
   * When omitted, resolved via `gh repo view`.
   */
  repo?: string;
}

export interface AutoPrResult {
  /** Whether a PR was actually opened. false on no-op (same prompt hash). */
  pr_opened: boolean;
  /** PR URL (when pr_opened=true). */
  pr_url?: string;
  /** Branch created (when pr_opened=true). */
  branch?: string;
  /** True when no PR was opened because the prompt hash was unchanged. */
  no_op_promotion?: boolean;
  /** The event that caused a non-fatal skip (e.g. gepa_branch_collision). */
  exit_event?: string;
}

export class GhAuthError extends Error {
  constructor(public readonly manualCommands: string[]) {
    super("gh CLI not authenticated — run `gh auth login`");
    this.name = "GhAuthError";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const EVENTS_LOG_PATH = ".claude/logs/events.jsonl";

function logEvent(repoPath: string, event: Record<string, unknown>): void {
  try {
    const dir = join(repoPath, ".claude", "logs");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const line = `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`;
    appendFileSync(join(repoPath, EVENTS_LOG_PATH), line, { flag: "a" });
  } catch {
    // Event log write must never propagate.
  }
}

function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: NodeJS.ProcessEnv }
): { ok: boolean; stdout: string; stderr: string; status: number } {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    windowsHide: true,
    env: opts.env ?? process.env
  });
  if (r.error) throw r.error;
  return {
    ok: r.status === 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    status: r.status ?? 1
  };
}

function checkGhAuth(ghPath: string, cwd: string): void {
  const r = spawnSync(ghPath, ["auth", "status"], {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  if (r.error) {
    if ((r.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GhAbsentError();
    }
    throw r.error;
  }
  if (r.status !== 0) {
    throw new GhAuthError(["gh auth login", "# Then retry the gepa-optimize command"]);
  }
}

function branchExists(gitPath: string, cwd: string, branch: string): boolean {
  const r = spawnSync(gitPath, ["ls-remote", "--exit-code", "--heads", "origin", branch], {
    cwd,
    encoding: "utf8",
    windowsHide: true
  });
  if (r.error) throw r.error;
  return r.status === 0;
}

function buildBranchName(agent: string, trialId: string, suffix = ""): string {
  const base = `gepa/${agent}/${trialId}`;
  return suffix ? `${base}${suffix}` : base;
}

function buildPrBody(result: OptimizationResult, runArtifactPath: string): string {
  const w = result.winner!;
  return [
    `## GEPA Promotion — ${result.agent}`,
    ``,
    `**Pareto rank**: ${w.pareto_rank}`,
    `**held-out pass**: ${w.pass}`,
    `**cost delta**: ${w.cost_usd.toFixed(6)} USD`,
    `**score**: ${w.score.toFixed(4)}`,
    `**latency**: ${w.latency_ms.toFixed(0)} ms`,
    ``,
    `### Eval artifact`,
    ``,
    `[${runArtifactPath}](./${runArtifactPath})`,
    ``,
    `### Cycle`,
    ``,
    `- cycle_id: ${result.cycle_id}`,
    `- run_id: ${result.run_id}`,
    `- candidates_evaluated: ${result.candidates_evaluated}`,
    `- winner_candidate_id: ${w.candidate_id}`,
    ``,
    `---`,
    `_Opened automatically by \`/crew:gepa-optimize\`. Do not merge without inspector review._`
  ].join("\n");
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Run the full auto-PR flow for a winning GEPA candidate.
 *
 * Throws:
 *   - GhAbsentError — gh not installed.
 *   - GhAuthError — gh not authenticated.
 *   - Error — git/gh command failure.
 *
 * Never calls `git push --force`.
 * Never calls `gh pr merge --auto`.
 */
// AC-7: Skip if winner prompt content == current champion content (no-op).
function isNoOpPromotion(agentPath: string, winnerPromptPath: string | undefined): boolean {
  if (!existsSync(agentPath) || !winnerPromptPath || !existsSync(winnerPromptPath)) return false;
  const currentBody = stripGepafrontmatter(readFileSync(agentPath, "utf8"));
  const winnerBody = readFileSync(winnerPromptPath, "utf8");
  return hashPromptBody(currentBody) === hashPromptBody(winnerBody);
}

const MAX_BRANCH_RETRIES = 5;

interface BranchResolution {
  branch: string;
  collision: boolean;
}

// Resolve a non-colliding branch name; returns { collision: true } if suffix
// chain exceeds MAX_BRANCH_RETRIES (caller emits `gepa_branch_collision`).
function resolveBranchName(
  gitPath: string,
  cwd: string,
  agent: string,
  trialId: string
): BranchResolution {
  let branch = buildBranchName(agent, trialId);
  let retry = 0;
  while (branchExists(gitPath, cwd, branch)) {
    retry++;
    if (retry > MAX_BRANCH_RETRIES) return { branch, collision: true };
    branch = buildBranchName(agent, trialId, `-retry-${retry}`);
  }
  return { branch, collision: false };
}

function createLocalBranch(gitPath: string, cwd: string, branch: string): void {
  const fromOrigin = run(gitPath, ["checkout", "-b", branch, "origin/main"], { cwd });
  if (fromOrigin.ok) return;
  const fromLocal = run(gitPath, ["checkout", "-b", branch, "main"], { cwd });
  if (!fromLocal.ok) {
    throw new Error(`git checkout -b ${branch} failed: ${fromOrigin.stderr || fromLocal.stderr}`);
  }
}

function commitAndPush(
  gitPath: string,
  cwd: string,
  agentPath: string,
  commitMsg: string,
  branch: string
): void {
  const add = run(gitPath, ["add", agentPath], { cwd });
  if (!add.ok) throw new Error(`git add failed: ${add.stderr}`);
  const commit = run(gitPath, ["commit", "-m", commitMsg], { cwd });
  if (!commit.ok) throw new Error(`git commit failed: ${commit.stderr}`);
  // Never --force.
  const push = run(gitPath, ["push", "origin", branch], { cwd });
  if (!push.ok) throw new Error(`git push failed: ${push.stderr}`);
}

// Body is written to a temp file and passed via --body-file rather than
// --body <string>. Multi-line body values are unreliable across shell layers
// — on Windows CMD in particular, arg expansion truncates at the first
// embedded newline. --body-file is the documented gh CLI pattern for
// multi-line bodies and works consistently across platforms.
function openPr(
  ghPath: string,
  cwd: string,
  repoPath: string,
  agent: string,
  cycleId: string,
  branch: string,
  result: OptimizationResult,
  protection: { enforced: boolean }
): string {
  const runArtifactPath = `.claude/artifacts/crew/gepa/opt/${result.run_id}.json`;
  const prBody = buildPrBody(result, runArtifactPath);
  const prTitle = `chore(gepa): promote ${agent} from cycle ${cycleId}`;
  const prBodyFile = join(repoPath, ".claude", "artifacts", "crew", "gepa", "pr-body.tmp");
  mkdirSync(join(repoPath, ".claude", "artifacts", "crew", "gepa"), { recursive: true });
  writeFileSync(prBodyFile, prBody, "utf8");

  const prArgs = ["pr", "create", "--title", prTitle, "--body-file", prBodyFile, "--head", branch];
  if (!protection.enforced) prArgs.push("--draft");
  const res = run(ghPath, prArgs, { cwd });
  if (!res.ok) throw new Error(`gh pr create failed: ${res.stderr}`);
  return res.stdout.trim();
}

function applyLabels(
  ghPath: string,
  cwd: string,
  repoPath: string,
  agent: string,
  branch: string,
  prUrl: string,
  repoLabel: string | undefined,
  protection: { enforced: boolean }
): void {
  const labels = ["gepa", `agent:${agent}`];
  if (protection.enforced) {
    labels.push("branch_protection_present");
  } else {
    labels.push("branch_protection_missing");
    // AC-3: log event when protection is missing.
    logEvent(repoPath, {
      event: "gepa_branch_protection_missing",
      agent,
      repo: repoLabel ?? "(resolved)",
      branch,
      pr_url: prUrl
    });
  }
  const res = run(ghPath, ["pr", "edit", prUrl, "--add-label", labels.join(",")], { cwd });
  if (!res.ok) {
    // Label failure is non-fatal — log but don't throw.
    logEvent(repoPath, {
      event: "gepa_label_apply_failed",
      agent,
      labels,
      pr_url: prUrl,
      stderr: res.stderr
    });
  }
}

export function runAutoPr(opts: AutoPrOpts): AutoPrResult {
  const { repoPath, agent, result } = opts;
  const gh = opts.ghPath ?? "gh";
  const git = opts.gitPath ?? "git";
  const cwd = repoPath;

  const winner = result.winner;
  if (!winner) throw new Error("runAutoPr called with no winner in OptimizationResult");

  const agentPath = join(repoPath, "agents", `${agent}.md`);
  if (isNoOpPromotion(agentPath, winner.prompt_path)) {
    return { pr_opened: false, no_op_promotion: true };
  }

  // Step 1: Check gh auth (BEFORE any branch creation — AC-9).
  checkGhAuth(gh, cwd);

  // Step 2: Branch-protection check.
  const protectionOpts: BranchProtectionCheckOpts = {
    ghPath: gh,
    ...(opts.repo !== undefined ? { repo: opts.repo } : {})
  };
  const protection = checkBranchProtection(protectionOpts);

  // Step 3: Resolve branch name (no force-push; collision → suffix).
  const trialId = winner.candidate_id;
  const cycleId = result.cycle_id;
  const { branch, collision } = resolveBranchName(git, cwd, agent, trialId);
  if (collision) {
    logEvent(repoPath, {
      event: "gepa_branch_collision",
      agent,
      branch,
      retries: MAX_BRANCH_RETRIES
    });
    return { pr_opened: false, exit_event: "gepa_branch_collision" };
  }

  createLocalBranch(git, cwd, branch);

  // Step 4: Write champion provenance frontmatter.
  const provenance = writeChampionProvenance({ agentPath, trialUuid: trialId });

  // Steps 5-6: Commit + push.
  commitAndPush(git, cwd, agentPath, `chore(gepa): promote ${agent} from cycle ${cycleId}`, branch);

  // Step 7: Open PR.
  const prUrl = openPr(gh, cwd, repoPath, agent, cycleId, branch, result, protection);

  // Step 8: Apply labels.
  applyLabels(gh, cwd, repoPath, agent, branch, prUrl, opts.repo, protection);

  logEvent(repoPath, {
    event: "gepa_auto_pr_opened",
    agent,
    branch,
    pr_url: prUrl,
    protection_enforced: protection.enforced,
    cycle_id: cycleId,
    run_id: result.run_id,
    prior_prompt_hash: provenance.priorPromptHash,
    promoted_at: provenance.promotedAt
  });

  return { pr_opened: true, pr_url: prUrl, branch };
}

// ── Manual-command printer ────────────────────────────────────────────────────

/**
 * Print manual git + gh commands to stdout when the auto-PR flow cannot run
 * (gh absent or not authenticated). Returns a non-zero exit code.
 */
export function printManualCommands(opts: {
  agent: string;
  result: OptimizationResult;
  reason: string;
}): void {
  const { agent, result, reason } = opts;
  const winner = result.winner;
  const trialId = winner?.candidate_id ?? "<trial-id>";
  const cycleId = result.cycle_id;
  const branch = `gepa/${agent}/${trialId}`;

  process.stdout.write(
    [
      ``,
      `gepa-auto-pr: ${reason}`,
      ``,
      `Run these commands manually to promote the champion:`,
      ``,
      `  git checkout -b ${branch} main`,
      `  # (write gepa: frontmatter to agents/${agent}.md)`,
      `  git add agents/${agent}.md`,
      `  git commit -m "chore(gepa): promote ${agent} from cycle ${cycleId}"`,
      `  git push origin ${branch}`,
      `  gh pr create --title "chore(gepa): promote ${agent} from cycle ${cycleId}" \\`,
      `    --body "Pareto rank: ${winner?.pareto_rank ?? "?"} | held-out pass: ${winner?.pass ?? "?"} | cost delta: ${winner?.cost_usd?.toFixed(6) ?? "?"}"`,
      ``
    ].join("\n")
  );
}
