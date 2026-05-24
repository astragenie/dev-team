import fs from "node:fs/promises";
import path from "node:path";

const SLICE_RE = /SLICE[-_](\d+)/i;

/** @param {any} text */
function extractSliceId(text) {
  if (!text) return null;
  const m = String(text).match(SLICE_RE);
  return m ? `SLICE-${String(Number(m[1])).padStart(2, "0")}` : null;
}

/** @param {string} file */
async function readIfExists(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

/** @param {string} dir */
async function listIfExists(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

// Parse score lines like "- architecture_quality: 0.85" out of the body even
// when frontmatter scores is null.
/** @param {string | null} text */
function parseScoresFromBody(text) {
  if (!text) return null;
  const dimensions = [
    "architecture_quality",
    "reliability",
    "observability",
    "production_readiness",
    "security",
    "test_confidence",
    "product_completeness"
  ];
  /** @type {Record<string, number>} */
  const out = {};
  for (const dim of dimensions) {
    const re = new RegExp(`^-\\s+${dim}:\\s*([0-9.]+)`, "m");
    const m = text.match(re);
    if (m) out[dim] = Number(m[1]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** @param {Record<string, number> | null} scores */
function avgScores(scores) {
  if (!scores) return null;
  const vals = Object.values(scores).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3));
}

/** @param {string} dir @param {string} sliceNumber */
async function findLatestMatching(dir, sliceNumber) {
  const files = await listIfExists(dir);
  const pat = new RegExp(`slice[-_]?0*${sliceNumber}\\b`, "i");
  const matches = files.filter((f) => pat.test(f));
  if (matches.length === 0) return null;
  matches.sort();
  return path.join(dir, matches[matches.length - 1]);
}

/** @param {string | null} text */
function parseDecision(text) {
  if (!text) return null;
  const m = text.match(/^-\s*Decision:\s*([\w_-]+)/im) || text.match(/^decision:\s*([\w_-]+)/im);
  return m ? m[1] : null;
}

// Given a slice id or run title, gather the outcome signals visible in
// docs/grades + .claude/artifacts/crew/{reviews,validations}.
/** @param {string} repoPath @param {string} runTitle */
export async function collectOutcomeLinkage(repoPath, runTitle) {
  const sliceId = extractSliceId(runTitle);
  if (!sliceId) return /** @type {{ sliceId: null }} */ ({ sliceId: null });

  const sliceNumber = sliceId.replace(/^SLICE-/, "").replace(/^0+/, "") || "0";

  const gradePath = path.join(repoPath, "docs/grades", `${sliceId}-grade.md`);
  const gradeText = await readIfExists(gradePath);
  const scores = parseScoresFromBody(gradeText);
  const gradeAvg = avgScores(scores);

  const reviewsDir = path.join(repoPath, ".claude/artifacts/crew/reviews");
  const validationsDir = path.join(repoPath, ".claude/artifacts/crew/validations");
  const reviewPath = await findLatestMatching(reviewsDir, sliceNumber);
  const validationPath = await findLatestMatching(validationsDir, sliceNumber);
  const reviewDecision = parseDecision(await readIfExists(reviewPath));
  const validationDecision = parseDecision(await readIfExists(validationPath));

  return {
    sliceId,
    gradePath: gradeText ? gradePath : null,
    scores,
    gradeAvg,
    reviewPath,
    reviewDecision,
    validationPath,
    validationDecision
  };
}
