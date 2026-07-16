/**
 * tests/report-to-pr.test.ts — dev-team#227 report-to-PR contract
 *
 * Covers:
 *   - marker build/parse round-trip
 *   - fresh post creates one comment
 *   - idempotent update on second call (one comment, not two)
 *   - no-PR fallback to disk
 *   - gh-failure fallback to disk
 *
 * `gh` is stubbed directly via the injected `runGh` seam — no spawnSync, no
 * shim binary, no network, per the "testable without network" requirement.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildReportBody,
  containsReportMarker,
  parseReportBody,
  postReportToPr,
  REPORT_MARKER_END,
  REPORT_MARKER_START,
  type GhCallResult,
  type GhRunner,
  type ReportFields
} from "../scripts/lib/report-to-pr.ts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIELDS: ReportFields = {
  status: "DONE",
  agent: "aiplugin-dev",
  headline: "Shipped the report-to-PR contract.",
  files: ["scripts/lib/report-to-pr.ts", "scripts/report-to-pr.ts"],
  risks: "none",
  next: "reviewer pass"
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "report-to-pr-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function ok(stdout: string): GhCallResult {
  return { ok: true, status: 0, stdout, stderr: "" };
}

function fail(stderr: string, status = 1): GhCallResult {
  return { ok: false, status, stdout: "", stderr };
}

// ── Marker build/parse round-trip ───────────────────────────────────────────

describe("buildReportBody / parseReportBody round-trip", () => {
  it("parses back the exact fields that were built", () => {
    const body = buildReportBody(FIELDS);
    expect(body).toContain(REPORT_MARKER_START);
    expect(body).toContain(REPORT_MARKER_END);
    expect(containsReportMarker(body)).toBe(true);

    const parsed = parseReportBody(body);
    expect(parsed).toEqual(FIELDS);
  });

  it("round-trips with no files and no next (defaults)", () => {
    const fields: ReportFields = {
      status: "BLOCKED",
      headline: "Stuck.",
      files: [],
      risks: "none"
    };
    const body = buildReportBody(fields);
    const parsed = parseReportBody(body);
    expect(parsed).toEqual(fields);
  });

  it("returns null when the body carries no marker", () => {
    expect(parseReportBody("just a regular PR comment, no marker here")).toBeNull();
  });

  // Dispatch-memory-credit-loop (runner-plugin upstream request 2026-07-16):
  // the OPTIONAL memoriesUsed field round-trips through the MEMORIES: line.
  it("round-trips the optional memoriesUsed field", () => {
    const fields: ReportFields = { ...FIELDS, memoriesUsed: ["atom-1", "atom-2"] };
    const body = buildReportBody(fields);
    expect(body).toContain("MEMORIES: atom-1, atom-2");
    expect(parseReportBody(body)).toEqual(fields);
  });

  it("omits the MEMORIES line entirely when memoriesUsed is absent or empty (byte-identical to today)", () => {
    const withoutField = buildReportBody(FIELDS);
    const withEmptyArray = buildReportBody({ ...FIELDS, memoriesUsed: [] });
    expect(withoutField).not.toContain("MEMORIES:");
    expect(withEmptyArray).toBe(withoutField);
  });
});

// ── Fresh post ────────────────────────────────────────────────────────────────

describe("postReportToPr — fresh post", () => {
  it("creates exactly one comment on the resolved PR", () => {
    const calls: string[][] = [];
    const runGh: GhRunner = (args) => {
      calls.push(args);
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args[0] === "api" && args[1]?.includes("/comments") && !args.includes("-X")) {
        // list (no marker yet) vs create — distinguish by presence of "--paginate"
        if (args.includes("--paginate")) return ok("[]");
        return ok(JSON.stringify({ id: 501 }));
      }
      return fail("unexpected call");
    };

    const result = postReportToPr({
      repoPath: tmpDir,
      fields: FIELDS,
      prNumber: 42,
      runGh
    });

    expect(result.mode).toBe("pr-comment");
    expect(result.updated).toBe(false);
    expect(result.target).toBe("42");
    expect(result.commentId).toBe(501);

    const createCalls = calls.filter(
      (a) =>
        a[0] === "api" &&
        a[1] === "repos/astragenie/dev-team/issues/42/comments" &&
        !a.includes("-X") &&
        !a.includes("--paginate")
    );
    expect(createCalls.length).toBe(1);
  });
});

// ── Idempotent update ────────────────────────────────────────────────────────

describe("postReportToPr — idempotent update", () => {
  it("updates the existing marker comment on a second call instead of creating a new one", () => {
    const existingBody = buildReportBody({ ...FIELDS, headline: "stale first attempt" });
    let patchCalls = 0;
    let createCalls = 0;

    const runGh: GhRunner = (args) => {
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args.includes("--paginate")) {
        return ok(JSON.stringify([{ id: 501, body: existingBody }]));
      }
      if (args.includes("-X") && args.includes("PATCH")) {
        patchCalls += 1;
        return ok("");
      }
      if (args[0] === "api") {
        createCalls += 1;
        return ok(JSON.stringify({ id: 999 }));
      }
      return fail("unexpected call");
    };

    const result = postReportToPr({
      repoPath: tmpDir,
      fields: { ...FIELDS, headline: "second, real attempt" },
      prNumber: 42,
      runGh
    });

    expect(result.mode).toBe("pr-comment");
    expect(result.updated).toBe(true);
    expect(result.commentId).toBe(501);
    expect(patchCalls).toBe(1);
    expect(createCalls).toBe(0);
  });
});

// ── Multi-page comment list (regression — gh --paginate array-per-page shape) ──
//
// `gh api ... --paginate` streams ONE JSON array PER PAGE concatenated, not
// one merged array (confirmed via `gh api --help`: "Each page is a separate
// JSON array or object. Pass --slurp to wrap all pages ... into an outer
// JSON array."). A naive `JSON.parse(stdout)` on a multi-page response is
// invalid JSON and throws, which the original code silently swallowed as
// "no marker comment found" — on any PR/issue with more than one page of
// comments (30 by default), every re-run would create a fresh duplicate
// comment instead of updating the existing marker comment. This test stubs
// the real `--slurp`-wrapped shape (an array of per-page arrays) across two
// pages and confirms the marker comment on page 2 is still found.

describe("postReportToPr — multi-page comment list (pagination)", () => {
  it("finds the marker comment when results span more than one page", () => {
    const existingBody = buildReportBody({ ...FIELDS, headline: "stale first attempt" });
    const page1 = Array.from({ length: 30 }, (_, i) => ({
      id: 100 + i,
      body: `unrelated human comment #${i}`
    }));
    const page2 = [{ id: 999, body: existingBody }];

    let patchCalls = 0;
    const runGh: GhRunner = (args) => {
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args.includes("--paginate") && args.includes("--slurp")) {
        return ok(JSON.stringify([page1, page2]));
      }
      if (args.includes("-X") && args.includes("PATCH")) {
        patchCalls += 1;
        return ok("");
      }
      return fail("unexpected call");
    };

    const result = postReportToPr({
      repoPath: tmpDir,
      fields: { ...FIELDS, headline: "second, real attempt" },
      prNumber: 42,
      runGh
    });

    expect(result.mode).toBe("pr-comment");
    expect(result.updated).toBe(true);
    expect(result.commentId).toBe(999);
    expect(patchCalls).toBe(1);
  });
});

// ── No-PR fallback to disk ───────────────────────────────────────────────────

describe("postReportToPr — no PR for branch, no issue fallback", () => {
  it("falls back to disk and does not throw", () => {
    const runGh: GhRunner = (args) => {
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args[0] === "pr") return fail("no pull requests found for branch");
      return fail("unexpected call");
    };

    const result = postReportToPr({ repoPath: tmpDir, fields: FIELDS, runGh });

    expect(result.mode).toBe("disk");
    expect(result.updated).toBe(false);
    expect(result.path).toBeDefined();
    const written = readFileSync(result.path as string, "utf8");
    expect(written).toContain(REPORT_MARKER_START);
    expect(written).toContain(FIELDS.headline);
  });

  it("falls back to an issue comment when a PR is absent but an issue number is given", () => {
    const calls: string[][] = [];
    const runGh: GhRunner = (args) => {
      calls.push(args);
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args[0] === "pr") return fail("no pull requests found for branch");
      if (args.includes("--paginate")) return ok("[]");
      if (args[0] === "api") return ok(JSON.stringify({ id: 777 }));
      return fail("unexpected call");
    };

    const result = postReportToPr({ repoPath: tmpDir, fields: FIELDS, issueNumber: 227, runGh });

    expect(result.mode).toBe("issue-comment");
    expect(result.target).toBe("227");
    expect(result.commentId).toBe(777);
  });
});

// ── gh-failure fallback to disk ──────────────────────────────────────────────

describe("postReportToPr — gh unavailable / unauthenticated", () => {
  it("falls back to disk when gh repo view fails (e.g. unauthenticated)", () => {
    const runGh: GhRunner = () =>
      fail("gh: To use GitHub CLI in a GitHub Actions workflow, set...", 4);

    const result = postReportToPr({ repoPath: tmpDir, fields: FIELDS, prNumber: 42, runGh });

    expect(result.mode).toBe("disk");
    expect(result.reason).toContain("gh unavailable");
    const files = readdirSync(join(tmpDir, ".claude", "artifacts", "crew", "handoffs"));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/-report-fallback\.md$/);
  });

  it("falls back to disk when the gh api create call itself fails (rate limit)", () => {
    const runGh: GhRunner = (args) => {
      if (args[0] === "repo")
        return ok(JSON.stringify({ owner: { login: "astragenie" }, name: "dev-team" }));
      if (args.includes("--paginate")) return ok("[]");
      if (args[0] === "api") return fail("API rate limit exceeded", 1);
      return fail("unexpected call");
    };

    const result = postReportToPr({ repoPath: tmpDir, fields: FIELDS, prNumber: 42, runGh });

    expect(result.mode).toBe("disk");
    expect(result.reason).toContain("rate limit");
  });
});

// ── Same-second disk-fallback collision (regression, PR #231 review CRITICAL) ──
//
// Reproduces the exact scenario the review demonstrated empirically: two
// postReportToPr() calls with a FIXED now() (so wall-clock time gives zero
// entropy — the same failure mode as two real calls landing in the same
// millisecond during a `gh` outage) and a failing runGh. Before the fix, the
// fallback filename was derived only from the (millisecond-stripped) now()
// value, so both calls produced the IDENTICAL path and the second
// writeFileSync silently clobbered the first agent's report with zero error,
// zero warning, exit 0 — r1.path === r2.path was true, and agent A's report
// was gone. This test proves that no longer happens: two distinct files,
// each with its own intact content.

describe("postReportToPr — same-second disk-fallback collision (regression)", () => {
  it("two calls with an identical fixed now() and failing gh produce two distinct, intact files", () => {
    const fixedNow = () => new Date("2026-07-12T10:00:00.000Z");
    const runGh: GhRunner = () => fail("gh: not found", 127);

    const fieldsA: ReportFields = {
      ...FIELDS,
      agent: "agent-a",
      headline: "Agent A report — MUST survive"
    };
    const fieldsB: ReportFields = {
      ...FIELDS,
      agent: "agent-b",
      headline: "Agent B report — MUST survive"
    };

    const r1 = postReportToPr({
      repoPath: tmpDir,
      fields: fieldsA,
      prNumber: 42,
      now: fixedNow,
      runGh
    });
    const r2 = postReportToPr({
      repoPath: tmpDir,
      fields: fieldsB,
      prNumber: 42,
      now: fixedNow,
      runGh
    });

    expect(r1.mode).toBe("disk");
    expect(r2.mode).toBe("disk");
    expect(r1.path).toBeDefined();
    expect(r2.path).toBeDefined();

    // The bug, stated as an assertion: this must be false.
    expect(r1.path === r2.path).toBe(false);

    const handoffsDir = join(tmpDir, ".claude", "artifacts", "crew", "handoffs");
    const files = readdirSync(handoffsDir);
    expect(files.length).toBe(2);

    const bodyA = readFileSync(r1.path as string, "utf8");
    const bodyB = readFileSync(r2.path as string, "utf8");
    expect(bodyA).toContain("Agent A report — MUST survive");
    expect(bodyA).not.toContain("Agent B report");
    expect(bodyB).toContain("Agent B report — MUST survive");
    expect(bodyB).not.toContain("Agent A report");
  });
});
