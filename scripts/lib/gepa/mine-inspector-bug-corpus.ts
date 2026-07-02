/**
 * scripts/lib/gepa/mine-inspector-bug-corpus.ts — SLICE-103
 *
 * CLI helper that walks `.claude/artifacts/crew/reviews/` for review artifacts
 * containing CRITICAL or HIGH findings, extracts structured bug cases, and
 * emits candidate EvalCase JSONL seeds under a configurable output directory.
 *
 * CLI:
 *   node scripts/crew.ts gepa-mine-inspector --weeks 8 --out agents/inspector/.gepa/eval/
 *
 * AC-5: --weeks 0 → exit 0, no files written, helpful message.
 * AC-9: Progress logged to stderr (one line per review artifact processed).
 *
 * Security note: all extracted strings are passed through redactRationale()
 * before write to prevent secret leakage from review text.
 */

import { readdir, readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { redactRationale } from "@astragenie/gepa-core";

// ---------------------------------------------------------------------------
// Schema types (matches EvalCaseSchema in gepa-core with inspector extensions)
// ---------------------------------------------------------------------------

/** Structured notes embedded in each EvalCase as a JSON string (matches EvalCaseSchema.notes: string). */
export interface InspectorEvalCaseNotes {
  bug_class: string | null;
  severity_expected: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
  provenance: string;
  verdict_expected: string;
}

export interface InspectorEvalCase {
  id: string;
  input: {
    diff: string;
    context: string;
  };
  expected_output: {
    verdict: "approve" | "approve_with_notes" | "request_changes";
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
    rationale: string;
  };
  rubric: string[];
  held_out: boolean;
  /** JSON-serialized InspectorEvalCaseNotes — matches EvalCaseSchema.notes: string. */
  notes: string;
}

// ---------------------------------------------------------------------------
// Mined seed (raw extraction before EvalCase shape)
// ---------------------------------------------------------------------------

export interface MinedSeed {
  /** Review artifact filename (basename). */
  sourceFile: string;
  /** Extracted decision from the review. */
  decision: string;
  /** Extracted risks/findings text from the review. */
  risks: string;
  /** Extracted required-follow-up text. */
  followUp: string;
  /** Inferred bug class from content. */
  bugClass: string | null;
  /** Inferred severity. */
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null;
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------

export interface MineArgs {
  weeks: number;
  out: string;
  repoPath: string;
  invalid?: string;
}

/** Parse --weeks flag. Returns parsed week count or an error string. */
function parseWeeksFlag(args: string[], i: number): { weeks: number; invalid?: string } {
  const val = args[i + 1];
  if (!val || val.startsWith("--")) {
    return { weeks: 0, invalid: "--weeks requires a numeric value" };
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0) {
    return { weeks: 0, invalid: "--weeks must be a non-negative number" };
  }
  return { weeks: Math.floor(n) };
}

/** Parse --out flag. Returns parsed path or an error string. */
function parseOutFlag(args: string[], i: number): { out: string; invalid?: string } {
  const val = args[i + 1];
  if (!val || val.startsWith("--")) {
    return { out: "", invalid: "--out requires a directory path" };
  }
  return { out: val };
}

export function parseMineArgs(args: string[], repoPath: string): MineArgs {
  let weeks = 8;
  let out = join(repoPath, "agents", "inspector", ".gepa", "eval");

  let i = 0;
  while (i < args.length) {
    const arg = args[i] ?? "";
    if (arg === "--weeks") {
      const result = parseWeeksFlag(args, i);
      if (result.invalid) return { weeks: 0, out, repoPath, invalid: result.invalid };
      weeks = result.weeks;
      i += 2;
      continue;
    }
    if (arg === "--out") {
      const result = parseOutFlag(args, i);
      if (result.invalid) return { weeks: 0, out, repoPath, invalid: result.invalid };
      out = result.out;
      i += 2;
      continue;
    }
    i += 1;
  }

  return { weeks, out, repoPath };
}

// ---------------------------------------------------------------------------
// Review artifact reader
// ---------------------------------------------------------------------------

const DECISION_RE = /^[-*]\s*Decision:\s*(.+)$/im;
const FRONTMATTER_DECISION_RE = /^decision:\s*(.+)$/im;
const RISKS_RE = /^[-*]\s*Risks?:\s*(.+)$/im;
const FOLLOWUP_RE = /^[-*]\s*Required Follow-up:\s*(.+)$/ims;

/** Extract the first matched group from a regex or return null. */
function extractFirst(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

/** Infer bug class from risk/rationale text. */
function inferBugClass(text: string): string | null {
  const lower = text.toLowerCase();
  if (/race.condition|concurren|mutex|deadlock|thread.safe/.test(lower)) return "race";
  if (/secret|credential|api.key|token.leak|pii|password/.test(lower)) return "security";
  if (/timeout|hang.indefinitely|infinite.wait|no.*timeout/.test(lower)) return "timeout";
  if (/permission|access.denied|unauthorized|privilege/.test(lower)) return "permission";
  if (/out.of.memory|oom|resource.exhaustion|memory.leak|fd.leak/.test(lower))
    return "resource-exhaustion";
  if (/corrupt|partial.write|truncat|atomic|json.parse.*invalid|data.loss/.test(lower))
    return "data-corruption";
  if (/external.dep|third.party|npm.package|dependency.break|import.fail/.test(lower))
    return "external-dep";
  if (/integration|module.level|import.side.effect|test.harness/.test(lower))
    return "integration-failure";
  if (/perf|performance|slow|latency|n\+1|quadratic/.test(lower)) return "perf";
  if (/false.positive|null.deref|guard|wrong.logic|incorrect.condition/.test(lower))
    return "logic-error";
  return null;
}

/** Parse severity from review text. Returns the highest severity found, or null. */
function parseSeverity(text: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null {
  const prefixOrder: Array<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW"> = [
    "CRITICAL",
    "HIGH",
    "MEDIUM",
    "LOW"
  ];
  for (const s of prefixOrder) {
    if (text.includes(s)) return s;
  }
  return null;
}

/** Check if an artifact was modified within the past N weeks. */
async function isWithinWeeks(filePath: string, weeks: number): Promise<boolean> {
  try {
    const s = await stat(filePath);
    const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
    return s.mtimeMs >= cutoff;
  } catch {
    return false;
  }
}

/** Mine a single review artifact for bug candidates. Returns null if not a bug case. */
async function mineReviewArtifact(filePath: string): Promise<MinedSeed | null> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  const decision =
    extractFirst(text, DECISION_RE) ?? extractFirst(text, FRONTMATTER_DECISION_RE) ?? "";

  // Only mine from rejected decisions (indicate bugs that blocked the review)
  const isRejected = /^rejected/i.test(decision.trim());
  if (!isRejected) return null;

  const risks = extractFirst(text, RISKS_RE) ?? "";
  if (!risks) return null;

  const sev = parseSeverity(risks);
  // Only mine CRITICAL or HIGH findings for the corpus
  if (sev !== "CRITICAL" && sev !== "HIGH") return null;

  const followUp = extractFirst(text, FOLLOWUP_RE) ?? "";
  const bugClass = inferBugClass(risks + " " + followUp);

  const basename = filePath.split(/[\\/]/).pop() ?? filePath;
  return {
    sourceFile: basename,
    decision: decision.trim(),
    risks: redactRationale(risks.slice(0, 2000)),
    followUp: redactRationale(followUp.slice(0, 2000)),
    bugClass,
    severity: sev
  };
}

/** Convert a MinedSeed to a stub EvalCase (caller fills diff/context). */
function seedToStub(seed: MinedSeed, index: number): InspectorEvalCase {
  const id = `inspector-bug-mined-${String(index + 1).padStart(3, "0")}`;
  const verdict =
    seed.severity === "CRITICAL" || seed.severity === "HIGH"
      ? ("request_changes" as const)
      : ("approve_with_notes" as const);

  return {
    id,
    input: {
      diff: "# PLACEHOLDER: operator must provide a representative diff from the reviewed PR",
      context: `Mined from ${seed.sourceFile}. Original decision: ${seed.decision}. Provide a synthetic or extracted diff that demonstrates this bug class.`
    },
    expected_output: {
      verdict,
      severity: seed.severity,
      rationale: seed.risks || seed.followUp || "See source review artifact for rationale."
    },
    rubric: [
      "verdict-accuracy",
      "evidence-citation-correctness",
      "risk-class-named",
      "rationale-actionability",
      "escalation-appropriateness"
    ],
    held_out: false,
    notes: JSON.stringify({
      bug_class: seed.bugClass,
      severity_expected: seed.severity,
      provenance: `mined from ${seed.sourceFile}`,
      verdict_expected: verdict
    })
  };
}

// ---------------------------------------------------------------------------
// Main mining function (exported for tests)
// ---------------------------------------------------------------------------

export interface MineResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Number of seeds mined. */
  mined: number;
  /** Files written. */
  written: string[];
}

export async function runMineInspectorBugCorpus(
  repoPath: string,
  args: string[]
): Promise<MineResult> {
  const parsed = parseMineArgs(args, repoPath);

  if (parsed.invalid) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `gepa-mine-inspector: ${parsed.invalid}\n`,
      mined: 0,
      written: []
    };
  }

  // AC-5: --weeks 0 → helpful message, no files written
  if (parsed.weeks === 0) {
    return {
      exitCode: 0,
      stdout:
        "gepa-mine-inspector: --weeks 0 produces no results.\n" +
        "Set --weeks to a positive integer (e.g., --weeks 8) to mine recent review artifacts.\n" +
        "Alternatively, hand-author eval cases directly under agents/inspector/.gepa/eval/.\n",
      stderr: "",
      mined: 0,
      written: []
    };
  }

  const reviewsDir = join(repoPath, ".claude", "artifacts", "crew", "reviews");
  let files: string[];
  try {
    files = await readdir(reviewsDir);
  } catch {
    return {
      exitCode: 0,
      stdout:
        `gepa-mine-inspector: reviews directory not found at ${reviewsDir}.\n` +
        "No seeds mined. Hand-author eval cases under agents/inspector/.gepa/eval/.\n",
      stderr: "",
      mined: 0,
      written: []
    };
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const seeds: MinedSeed[] = [];
  const stderr: string[] = [];

  // AC-9: log progress to stderr, one line per PR
  for (const f of mdFiles) {
    const abs = join(reviewsDir, f);

    // Filter by week window
    if (!(await isWithinWeeks(abs, parsed.weeks))) continue;

    stderr.push(`gepa-mine-inspector: processing ${f}\n`);
    const seed = await mineReviewArtifact(abs);
    if (seed) {
      seeds.push(seed);
    }
  }

  if (seeds.length === 0) {
    return {
      exitCode: 0,
      stdout:
        `gepa-mine-inspector: no CRITICAL/HIGH rejected reviews found in the past ${parsed.weeks} weeks.\n` +
        "Hand-author eval cases under agents/inspector/.gepa/eval/.\n",
      stderr: stderr.join(""),
      mined: 0,
      written: []
    };
  }

  // Write seeds to output directory
  await mkdir(parsed.out, { recursive: true });
  const written: string[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    if (!seed) continue;
    const stub = seedToStub(seed, i);
    const filename = `${stub.id}.jsonl`;
    const outPath = join(parsed.out, filename);
    await writeFile(outPath, JSON.stringify(stub) + "\n", "utf8");
    written.push(outPath);
  }

  const stdout =
    `gepa-mine-inspector: mined ${seeds.length} seed(s) from the past ${parsed.weeks} weeks.\n` +
    `Written to: ${parsed.out}\n` +
    `Files: ${written.map((w) => w.split(/[\\/]/).pop()).join(", ")}\n` +
    `\nNOTE: Seeds contain PLACEHOLDER diffs — operator must review and replace\n` +
    `each diff with a representative TypeScript/JS snippet before adding to\n` +
    `the eval corpus. See SLICE-103 design notes for mining heuristics.\n`;

  return {
    exitCode: 0,
    stdout,
    stderr: stderr.join(""),
    mined: seeds.length,
    written
  };
}
