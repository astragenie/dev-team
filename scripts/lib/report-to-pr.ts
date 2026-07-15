/**
 * scripts/lib/report-to-pr.ts — dev-team#227 report-to-PR contract
 *
 * The substrate for the report-to-PR contract: a dispatched agent's report
 * must survive the agent dying before its final turn. Four agents lost their
 * reports in one session (2026-07-12) because the report was the LAST thing
 * they did — truncation only destroys what happens after the report, so the
 * fix is to post the report right after the commit, before any remaining
 * risky step (push, open PR, cleanup).
 *
 * Channel priority:
 *   1. PR comment (marker-delimited, idempotent — re-push updates, never spams).
 *   2. Issue comment, when no PR exists yet (read-only investigations, or a
 *      reviewer running before a PR exists) and an issue number is known.
 *   3. Disk, under `.claude/artifacts/crew/handoffs/` — best-effort fallback
 *      when `gh` is absent, unauthenticated, rate-limited, offline, or there
 *      is no PR/issue to target. Never a hard dependency, never a build-blocker.
 *
 * Testable without network: pass `runGh` to stub the `gh` invocation directly
 * (no real gh binary, no shim executable, no spawnSync in tests).
 */

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Marker + body build/parse ───────────────────────────────────────────────
//
// NOTE: the marker literal is deliberately NOT `crew:report` — that shape
// (`crew:<word>`) is the same shape validate-agent-refs.ts's TOKEN_RE treats
// as a dispatch token, and the agent prompts below quote this marker literal
// in prose. `crew:report` resolves to nothing on disk (no agents/report.md,
// commands/report.md, skills/**/report/SKILL.md), so it read as 4 phantom
// dispatch references — a real CI-red finding, not a validator bug. Renamed
// once, pre-merge, before any agent has posted a live comment against the
// old marker (see dev-team PR #231 review, HIGH finding).

export const REPORT_MARKER_START = "<!-- dev-team:report -->";
export const REPORT_MARKER_END = "<!-- /dev-team:report -->";

export type ReportStatus = "DONE" | "BLOCKED" | "HELP" | "IN-PROGRESS";

export interface ReportFields {
  status: ReportStatus;
  agent?: string;
  headline: string;
  files: string[];
  risks: string;
  next?: string;
}

/** True when `body` carries the report marker (used to find the report comment to update). */
export function containsReportMarker(body: string): boolean {
  return body.includes(REPORT_MARKER_START);
}

export function buildReportBody(fields: ReportFields): string {
  const lines: string[] = [REPORT_MARKER_START, `STATUS: ${fields.status}`];
  if (fields.agent) lines.push(`AGENT: ${fields.agent}`);
  lines.push(`FILES: ${fields.files.length > 0 ? fields.files.join(", ") : "(none)"}`);
  lines.push(`RISKS: ${fields.risks || "none"}`);
  if (fields.next) lines.push(`NEXT: ${fields.next}`);
  lines.push("");
  lines.push(fields.headline);
  lines.push(REPORT_MARKER_END);
  return lines.join("\n");
}

const FIELD_KEYS = ["STATUS", "AGENT", "FILES", "RISKS", "NEXT"] as const;

/** Inverse of buildReportBody. Returns null when `body` carries no marker. */
export function parseReportBody(body: string): ReportFields | null {
  const startIdx = body.indexOf(REPORT_MARKER_START);
  if (startIdx === -1) return null;
  const endIdx = body.indexOf(REPORT_MARKER_END, startIdx);
  const inner =
    endIdx === -1
      ? body.slice(startIdx + REPORT_MARKER_START.length)
      : body.slice(startIdx + REPORT_MARKER_START.length, endIdx);

  const lines = inner.split("\n").map((l) => l.trim());
  const get = (key: string): string | undefined => {
    const line = lines.find((l) => l.startsWith(`${key}: `));
    return line ? line.slice(key.length + 2) : undefined;
  };

  const status = get("STATUS");
  if (!status) return null;

  const filesRaw = get("FILES") ?? "(none)";
  const files =
    filesRaw === "(none)" || filesRaw === "" ? [] : filesRaw.split(",").map((f) => f.trim());
  const risks = get("RISKS") ?? "none";
  const agent = get("AGENT");
  const next = get("NEXT");

  const headlineLine = lines.find(
    (l) => l.length > 0 && !FIELD_KEYS.some((k) => l.startsWith(`${k}: `))
  );

  return {
    status: status as ReportStatus,
    headline: headlineLine ?? "",
    files,
    risks,
    ...(agent ? { agent } : {}),
    ...(next ? { next } : {})
  };
}

// ── gh invocation (injectable) ──────────────────────────────────────────────

export interface GhCallResult {
  ok: boolean;
  status: number;
  stdout: string;
  stderr: string;
}

export type GhRunner = (args: string[]) => GhCallResult;

const GH_TIMEOUT_MS = 10_000;

function defaultGhRunner(ghPath: string, cwd: string): GhRunner {
  return (args: string[]): GhCallResult => {
    const r = spawnSync(ghPath, args, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      timeout: GH_TIMEOUT_MS
    });
    if (r.error) {
      return { ok: false, status: -1, stdout: "", stderr: (r.error as Error).message };
    }
    return {
      ok: r.status === 0,
      status: r.status ?? 1,
      stdout: r.stdout ?? "",
      stderr: r.stderr ?? ""
    };
  };
}

function resolveRepoSlug(runGh: GhRunner): string | null {
  const r = runGh(["repo", "view", "--json", "owner,name"]);
  if (!r.ok) return null;
  try {
    const parsed = JSON.parse(r.stdout) as { owner?: { login?: string }; name?: string };
    if (!parsed.owner?.login || !parsed.name) return null;
    return `${parsed.owner.login}/${parsed.name}`;
  } catch {
    return null;
  }
}

function resolveCurrentPrNumber(runGh: GhRunner): number | null {
  const r = runGh(["pr", "view", "--json", "number"]);
  if (!r.ok) return null;
  try {
    const parsed = JSON.parse(r.stdout) as { number?: number };
    return typeof parsed.number === "number" ? parsed.number : null;
  } catch {
    return null;
  }
}

function findExistingCommentId(
  runGh: GhRunner,
  repoSlug: string,
  targetNumber: number
): number | null {
  // `--paginate` alone streams one JSON array PER PAGE, concatenated
  // (`gh api --help`: "Each page is a separate JSON array or object.").
  // GitHub's REST API pages at 30 comments by default, so any PR/issue with
  // more than one page's worth of comments would make the raw output
  // multiple back-to-back JSON arrays (e.g. `[...][...]`) — invalid input to
  // a single JSON.parse(), which would throw, get swallowed by the catch
  // below, and read as "no marker comment yet" — silently causing a
  // duplicate-comment spam instead of the intended idempotent update.
  // `--slurp` wraps every page into one outer array; `.flat()` merges that
  // down to a single flat comment list (and is a no-op for the single-page
  // shape too, so it's safe regardless of comment count).
  const r = runGh([
    "api",
    `repos/${repoSlug}/issues/${targetNumber}/comments`,
    "--paginate",
    "--slurp"
  ]);
  if (!r.ok) return null;
  try {
    const pages = JSON.parse(r.stdout) as Array<{ id: number; body: string }[]>;
    const comments = pages.flat();
    const found = comments.find((c) => containsReportMarker(c.body ?? ""));
    return found ? found.id : null;
  } catch {
    return null;
  }
}

// ── Disk fallback ────────────────────────────────────────────────────────────

const MAX_FALLBACK_WRITE_ATTEMPTS = 20;

/**
 * Write the disk-fallback report under a name that cannot collide across
 * concurrent calls, even when `now()` is fixed/mocked or two real calls land
 * in the same wall-clock millisecond (the exact scenario a `gh` outage with
 * many concurrent builders produces — dev-team PR #231 review, CRITICAL
 * finding).
 *
 * Uniqueness does not depend on `now()` at all: `process.pid` +
 * `process.hrtime.bigint()` (monotonic, nanosecond resolution, per-process)
 * + a random suffix. `now()` still seeds the human-readable timestamp
 * prefix (millisecond precision preserved, never stripped) purely for
 * sortability/readability.
 *
 * `wx` (exclusive create) is the hard backstop: a collision FAILS LOUDLY
 * (EEXIST) instead of silently overwriting a prior report via a plain
 * writeFileSync, and is retried with fresh entropy. A collision must never
 * be able to destroy a report.
 */
function writeDiskFallback(
  repoPath: string,
  body: string,
  reason: string,
  now: () => Date
): { path?: string; writeError?: string } {
  const dir = join(repoPath, ".claude", "artifacts", "crew", "handoffs");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const ts = now().toISOString().replace(/[-:]/g, "");
  const content = `<!-- report-to-pr fallback reason: ${reason} -->\n\n${body}\n`;

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_FALLBACK_WRITE_ATTEMPTS; attempt += 1) {
    const unique = `${process.pid}-${process.hrtime.bigint()}-${randomBytes(4).toString("hex")}`;
    const path = join(dir, `${ts}-${unique}-report-fallback.md`);
    try {
      writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
      return { path };
    } catch (err) {
      lastError = err;
      if ((err as NodeJS.ErrnoException)?.code !== "EEXIST") break;
      // EEXIST — genuinely unexpected given the entropy above, but retry
      // with fresh randomness rather than falling through to an overwrite.
    }
  }
  return { writeError: lastError instanceof Error ? lastError.message : String(lastError) };
}

/**
 * Build the "disk" PostReportResult, folding in a write failure (should be
 * effectively unreachable given writeDiskFallback's entropy, but never
 * throws or blocks the build even if it happens).
 */
function diskFallbackResult(
  repoPath: string,
  body: string,
  reason: string,
  now: () => Date
): PostReportResult {
  const { path, writeError } = writeDiskFallback(repoPath, body, reason, now);
  return {
    mode: "disk",
    updated: false,
    reason: writeError ? `${reason}; disk fallback write also failed: ${writeError}` : reason,
    ...(path ? { path } : {})
  };
}

function ensureBodyFile(repoPath: string, body: string): string {
  const dir = join(repoPath, ".claude", "artifacts", "crew");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, "report-body.tmp");
  writeFileSync(path, body, "utf8");
  return path;
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface PostReportOpts {
  repoPath: string;
  fields: ReportFields;
  /** Override the `gh` binary path. Ignored when `runGh` is supplied. */
  ghPath?: string;
  /** Explicit PR number — skips auto-detection via `gh pr view`. */
  prNumber?: number;
  /** Fallback target when no PR exists yet (e.g. a reviewer dispatch pre-PR). */
  issueNumber?: number;
  /** Override `owner/name` — skips `gh repo view` resolution. */
  repo?: string;
  /** Inject the gh invocation directly — the supported test seam (no network, no shim binary). */
  runGh?: GhRunner;
  now?: () => Date;
}

export type PostReportMode = "pr-comment" | "issue-comment" | "disk";

export interface PostReportResult {
  mode: PostReportMode;
  /** true when an existing marker comment was updated in place; false when newly created or disk. */
  updated: boolean;
  target?: string;
  commentId?: number;
  path?: string;
  reason?: string;
}

/**
 * Post or idempotently update the `<!-- dev-team:report -->` marker comment.
 * Never throws — every failure path degrades to the disk fallback.
 */
export function postReportToPr(opts: PostReportOpts): PostReportResult {
  const now = opts.now ?? (() => new Date());
  const runGh = opts.runGh ?? defaultGhRunner(opts.ghPath ?? "gh", opts.repoPath);
  const body = buildReportBody(opts.fields);

  const repoSlug = opts.repo ?? resolveRepoSlug(runGh);
  if (!repoSlug) {
    const reason = "gh unavailable, unauthenticated, or repo not resolvable";
    return diskFallbackResult(opts.repoPath, body, reason, now);
  }

  let targetNumber = opts.prNumber ?? resolveCurrentPrNumber(runGh);
  let mode: PostReportMode = "pr-comment";
  if (!targetNumber && opts.issueNumber) {
    targetNumber = opts.issueNumber;
    mode = "issue-comment";
  }

  if (!targetNumber) {
    const reason = "no PR found for the current branch and no issue fallback given";
    return diskFallbackResult(opts.repoPath, body, reason, now);
  }

  const bodyFile = ensureBodyFile(opts.repoPath, body);
  const existingId = findExistingCommentId(runGh, repoSlug, targetNumber);

  if (existingId) {
    // -F (typed field), not -f (raw-field): only -F expands "@<path>" into
    // the file's contents. -f posts the literal string "@<path>" as the
    // body — a real bug caught by exercising this against a live PR rather
    // than trusting the (gh-stubbed) unit tests: the marker comment was
    // never actually written, so idempotent-update detection always missed
    // and every retry spammed a fresh, garbled comment. See gh api --help.
    const r = runGh([
      "api",
      `repos/${repoSlug}/issues/comments/${existingId}`,
      "-X",
      "PATCH",
      "-F",
      `body=@${bodyFile}`
    ]);
    if (!r.ok) {
      const reason = `gh api PATCH failed: ${r.stderr.slice(0, 200)}`;
      return diskFallbackResult(opts.repoPath, body, reason, now);
    }
    return { mode, updated: true, target: String(targetNumber), commentId: existingId };
  }

  const createR = runGh([
    "api",
    `repos/${repoSlug}/issues/${targetNumber}/comments`,
    "-F",
    `body=@${bodyFile}`
  ]);
  if (!createR.ok) {
    const reason = `gh api POST comment failed: ${createR.stderr.slice(0, 200)}`;
    return diskFallbackResult(opts.repoPath, body, reason, now);
  }

  let commentId: number | undefined;
  try {
    const parsed = JSON.parse(createR.stdout) as { id?: number };
    commentId = parsed.id;
  } catch {
    // Non-JSON response (e.g. a test stub) — commentId stays unset.
  }

  return {
    mode,
    updated: false,
    target: String(targetNumber),
    ...(commentId !== undefined ? { commentId } : {})
  };
}
