/**
 * scripts/lib/gepa/branch-protection-check.ts — SLICE-105
 *
 * Checks whether the target repo's `main` branch has protection rules
 * configured by calling `gh api repos/:owner/:repo/branches/main/protection`.
 *
 * Returns:
 *   { enforced: true,  requiredChecks: string[] }  — protection configured
 *   { enforced: false, requiredChecks: [] }         — no protection (404) or
 *                                                     gh absent / auth error
 *
 * The caller (auto-pr.ts) uses `enforced` to decide whether to open a draft PR.
 *
 * Design constraints:
 *   - 404 → enforced: false (no protection — treat as missing).
 *   - gh absent → throw GhAbsentError so auto-pr.ts can print manual cmds.
 *   - Any other non-zero exit from `gh api` → throw with the stderr for forensics.
 *   - Requires `repo:status` OAuth scope on the gh token for the protection endpoint.
 */

import { spawnSync } from "node:child_process";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BranchProtectionResult {
  /** True when branch protection is configured with at least one required check. */
  enforced: boolean;
  /** Required status check context names. Empty when enforced=false. */
  requiredChecks: string[];
}

export class GhAbsentError extends Error {
  constructor(message = "gh CLI not found — install from https://cli.github.com") {
    super(message);
    this.name = "GhAbsentError";
  }
}

export class GhApiError extends Error {
  readonly exitCode: number;
  readonly stderr: string;
  // Explicit fields, not parameter properties — Node strip-only mode (ADR-002
  // consumer runtime) cannot erase them.
  constructor(message: string, exitCode: number, stderr: string) {
    super(message);
    this.name = "GhApiError";
    this.exitCode = exitCode;
    this.stderr = stderr;
  }
}

// ── gh resolution helper ─────────────────────────────────────────────────────

/**
 * Resolve the `owner/name` string for the current repo using `gh repo view`.
 * Throws GhAbsentError if gh is not on PATH.
 * Throws GhApiError if gh exits non-zero.
 */
export function resolveRepo(opts: { ghPath?: string } = {}): string {
  const gh = opts.ghPath ?? "gh";
  const result = spawnSync(gh, ["repo", "view", "--json", "owner,name"], {
    encoding: "utf8",
    windowsHide: true
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GhAbsentError();
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new GhApiError(
      `gh repo view failed (exit ${result.status ?? "?"})`,
      result.status ?? 1,
      result.stderr ?? ""
    );
  }

  const parsed = JSON.parse(result.stdout ?? "{}") as {
    owner?: { login?: string };
    name?: string;
  };
  const owner = parsed.owner?.login ?? "";
  const name = parsed.name ?? "";
  if (!owner || !name) {
    throw new GhApiError("gh repo view returned empty owner/name", 1, "");
  }
  return `${owner}/${name}`;
}

// ── Main check ───────────────────────────────────────────────────────────────

export interface BranchProtectionCheckOpts {
  /**
   * Repository in `owner/name` format.
   * When omitted, resolved via `gh repo view --json owner,name`.
   */
  repo?: string;
  /**
   * Override the `gh` binary path (useful for tests).
   */
  ghPath?: string;
}

/**
 * Check whether the target repo's `main` branch has protection rules.
 *
 * Throws GhAbsentError when `gh` is not on PATH.
 * Throws GhApiError on unexpected gh failures (non-404 error responses).
 */
export function checkBranchProtection(
  opts: BranchProtectionCheckOpts = {}
): BranchProtectionResult {
  const gh = opts.ghPath ?? "gh";
  const repo = opts.repo ?? resolveRepo({ ghPath: gh });

  const apiPath = `repos/${repo}/branches/main/protection`;
  const result = spawnSync(gh, ["api", apiPath], {
    encoding: "utf8",
    windowsHide: true
  });

  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new GhAbsentError();
    }
    throw result.error;
  }

  // 404 = no protection configured — return enforced: false.
  if (result.status !== 0) {
    const stderr = result.stderr ?? "";
    const stdout = result.stdout ?? "";
    // gh returns 404 as a non-zero exit with "Not Found" in stderr or stdout.
    if (stderr.includes("Not Found") || stdout.includes("Not Found") || stderr.includes("404")) {
      return { enforced: false, requiredChecks: [] };
    }
    throw new GhApiError(
      `gh api ${apiPath} failed (exit ${result.status ?? "?"})`,
      result.status ?? 1,
      stderr
    );
  }

  // Parse the protection response to extract required status checks.
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(result.stdout ?? "{}") as Record<string, unknown>;
  } catch {
    // Malformed JSON → treat as no protection.
    return { enforced: false, requiredChecks: [] };
  }

  const requiredChecks = extractRequiredChecks(parsed);
  const enforced = requiredChecks.length > 0;

  return { enforced, requiredChecks };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extract required status check context names from the GitHub branch protection
 * API response. The response shape is:
 *
 *   {
 *     required_status_checks: {
 *       contexts: string[],
 *       checks: Array<{ context: string, app_id: number | null }>
 *     }
 *   }
 *
 * We prefer `checks[].context` over `contexts[]` (newer API — more precise),
 * falling back to `contexts` when `checks` is absent.
 */
function extractRequiredChecks(protection: Record<string, unknown>): string[] {
  const rsc = protection.required_status_checks as Record<string, unknown> | null | undefined;
  if (!rsc) return [];

  // Prefer newer `checks` array (GH API v3+).
  const checks = rsc.checks;
  if (Array.isArray(checks) && checks.length > 0) {
    return checks
      .map((c) =>
        typeof c === "object" && c !== null ? (c as Record<string, unknown>).context : undefined
      )
      .filter((c): c is string => typeof c === "string" && c.length > 0);
  }

  // Fall back to legacy `contexts` array.
  const contexts = rsc.contexts;
  if (Array.isArray(contexts)) {
    return contexts.filter((c): c is string => typeof c === "string" && c.length > 0);
  }

  return [];
}
