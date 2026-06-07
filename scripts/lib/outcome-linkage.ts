// outcome-linkage.ts — collect outcome signals for cost-report linkage.
// Migrated from outcome-linkage.mjs (AC-2).

import fs from "node:fs/promises";
import path from "node:path";

const SLICE_RE = /SLICE[-_](\d+)/i;

function extractSliceId(text: unknown): string | null {
  if (!text) return null;
  const m = String(text).match(SLICE_RE);
  return m ? `SLICE-${String(Number(m[1])).padStart(2, "0")}` : null;
}

async function readIfExists(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function listIfExists(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

// Parse score lines like "- architecture_quality: 0.85" out of the body even
// when frontmatter scores is null.
function parseScoresFromBody(text: string | null): Record<string, number> | null {
  if (!text) return null;
  const dimensions = [
    "architecture_quality",
    "reliability",
    "observability",
    "production_readiness",
    "security",
    "test_confidence",
    "product_completeness"
  ] as const;
  const out: Record<string, number> = {};
  for (const dim of dimensions) {
    const re = new RegExp(`^-\\s+${dim}:\\s*([0-9.]+)`, "m");
    const m = text.match(re);
    if (m && m[1] !== undefined) out[dim] = Number(m[1]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function avgScores(scores: Record<string, number> | null): number | null {
  if (!scores) return null;
  const vals = Object.values(scores).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
}

async function findLatestMatching(dir: string, sliceNumber: string): Promise<string | null> {
  const files = await listIfExists(dir);
  const pat = new RegExp(`slice[-_]?0*${sliceNumber}\\b`, "i");
  const matches = files.filter((f) => pat.test(f));
  if (matches.length === 0) return null;
  matches.sort();
  return path.join(dir, matches[matches.length - 1] as string);
}

function parseDecision(text: string | null): string | null {
  if (!text) return null;
  const m =
    text.match(/^-\s*Decision:\s*([\w_-]+)/im) || text.match(/^decision:\s*([\w_-]+)/im);
  return m && m[1] !== undefined ? m[1] : null;
}

export interface OutcomeLinkageResult {
  sliceId: string | null;
  gradePath?: string | null;
  scores?: Record<string, number> | null;
  gradeAvg?: number | null;
  reviewPath?: string | null;
  reviewDecision?: string | null;
  validationPath?: string | null;
  validationDecision?: string | null;
}

async function findArtifactDecision(dir: string, sliceNumber: string): Promise<{
  filePath: string | null;
  decision: string | null;
}> {
  const filePath = await findLatestMatching(dir, sliceNumber);
  const decision = parseDecision(await readIfExists(filePath ?? ""));
  return { filePath, decision };
}

// Given a slice id or run title, gather the outcome signals visible in
// docs/grades + .claude/artifacts/crew/{reviews,validations}.
export async function collectOutcomeLinkage(
  repoPath: string,
  runTitle: string
): Promise<OutcomeLinkageResult> {
  const sliceId = extractSliceId(runTitle);
  if (!sliceId) return { sliceId: null };

  const sliceNumber = sliceId.replace(/^SLICE-/, "").replace(/^0+/, "") || "0";
  const gradePath = path.join(repoPath, "docs/grades", `${sliceId}-grade.md`);
  const gradeText = await readIfExists(gradePath);
  const scores = parseScoresFromBody(gradeText);
  const gradeAvg = avgScores(scores);

  const reviewsDir = path.join(repoPath, ".claude/artifacts/crew/reviews");
  const validationsDir = path.join(repoPath, ".claude/artifacts/crew/validations");
  const review = await findArtifactDecision(reviewsDir, sliceNumber);
  const validation = await findArtifactDecision(validationsDir, sliceNumber);

  return {
    sliceId,
    gradePath: gradeText ? gradePath : null,
    scores,
    gradeAvg,
    reviewPath: review.filePath,
    reviewDecision: review.decision,
    validationPath: validation.filePath,
    validationDecision: validation.decision
  };
}
