#!/usr/bin/env node
// Validates that no final-synthesis artifact contains stale placeholder text,
// and (FEAT-188 S1a AC-1, extended by FEAT-199a) that no grade file is a
// placeholder-rotted template — 27% of grade files were found unfilled
// ("- bullet" template text, all-zero AC scores, unrendered `<title>` /
// `DEC-TBD: Short decision title` / `(narrative)` markers from
// docs/grades/grade-template.md), letting slices close silently on a
// rotted grade. This is advisory in CI today (see .github/workflows/test.yml
// advisory-validators); runner:close (runner-plugin, out of scope here) is
// expected to surface the same check as `grade_incomplete` at close time.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const RUNS_DIR = [".claude", "artifacts", "crew", "runs"];
const GRADES_DIR = [".claude", "artifacts", "loop", "grades"];
const STALE_PATTERNS = [/Grade missing/, /<timestamp>/];

// FEAT-199b grandfather set. FEAT-199a grandfathered rotted *grade* files by
// timestamp cutoff but left rotted *final-synthesis* artifacts hard-failing —
// 76 pre-existing syntheses carry `Grade missing` / `<timestamp>` placeholders
// that predate this gate, so the check flipped red on inherited history.
// Freeze that known set here: a synthesis whose basename is listed warns
// (grandfathered) instead of failing, while any NEW rotted synthesis (basename
// NOT listed) still hard-fails — the gate keeps catching fresh rot. Remove
// entries as FEAT-199b backfills the real grades; delete the set once empty.
const SYNTHESIS_ROT_GRANDFATHER = new Set<string>([
  "20260605T105041Z-final-synthesis-feat-045-observability-hook-health-synthesis-fixes.md",
  "feat029-slice54-final-synthesis.md",
  "feat037-slice17-final-synthesis.md",
  "feat046-slice18-final-synthesis.md",
  "feat100-slice16-final-synthesis.md",
  "feat101-slice19-final-synthesis.md",
  "feat102-slice20-final-synthesis.md",
  "feat103-slice21-final-synthesis.md",
  "feat104-slice22-final-synthesis.md",
  "feat105-slice23-final-synthesis.md",
  "feat105-slice28-final-synthesis.md",
  "feat106-slice29-final-synthesis.md",
  "feat107-slice30-final-synthesis.md",
  "feat108-slice32-final-synthesis.md",
  "feat109-slice33-final-synthesis.md",
  "feat110-slice34-final-synthesis.md",
  "feat111-slice35-final-synthesis.md",
  "feat112-slice36-final-synthesis.md",
  "feat113-slice37-final-synthesis.md",
  "feat114-slice38-final-synthesis.md",
  "feat115-slice39-final-synthesis.md",
  "feat116-slice40-final-synthesis.md",
  "feat117-slice41-final-synthesis.md",
  "feat118-slice42-final-synthesis.md",
  "feat119-slice43-final-synthesis.md",
  "feat120-slice44-final-synthesis.md",
  "feat121-slice45-final-synthesis.md",
  "feat122-slice52-final-synthesis.md",
  "feat123-slice53-final-synthesis.md",
  "feat124-slice46-final-synthesis.md",
  "feat124-slice47-final-synthesis.md",
  "feat125-slice51-final-synthesis.md",
  "feat126-slice48-final-synthesis.md",
  "feat126-slice49-final-synthesis.md",
  "feat126-slice50-final-synthesis.md",
  "feat127-slice55-final-synthesis.md",
  "feat128-slice56-final-synthesis.md",
  "feat129-slice57-final-synthesis.md",
  "feat130-slice58-final-synthesis.md",
  "feat131-slice59-final-synthesis.md",
  "feat132-slice60-final-synthesis.md",
  "feat134-slice61-final-synthesis.md",
  "feat135-slice62-final-synthesis.md",
  "feat136-slice64-final-synthesis.md",
  "feat137-slice65-final-synthesis.md",
  "feat138-slice63-final-synthesis.md",
  "feat139-slice75-final-synthesis.md",
  "feat140-slice69-final-synthesis.md",
  "feat141-slice68-final-synthesis.md",
  "feat142-slice87-final-synthesis.md",
  "feat146-slice67-final-synthesis.md",
  "feat153-slice76-final-synthesis.md",
  "feat158-slice74-final-synthesis.md",
  "feat159-slice84-final-synthesis.md",
  "feat159-slice85-final-synthesis.md",
  "feat160-slice86-final-synthesis.md",
  "feat161-slice70-final-synthesis.md",
  "feat161-slice72-final-synthesis.md",
  "feat162-slice80-final-synthesis.md",
  "feat163-slice71-final-synthesis.md",
  "feat163-slice73-final-synthesis.md",
  "feat165-slice77-final-synthesis.md",
  "feat165-slice81-final-synthesis.md",
  "feat166-slice78-final-synthesis.md",
  "feat166-slice82-final-synthesis.md",
  "feat168-slice83-final-synthesis.md",
  "feat193-slice109-final-synthesis.md",
  "feat196-slice110-final-synthesis.md",
  "feat197-slice111-final-synthesis.md",
  "feat202-slice112-final-synthesis.md",
  "feat203-slice113-final-synthesis.md",
  "slice107-final-synthesis.md",
  "slice108-final-synthesis.md",
  "slice79-final-synthesis.md",
  "slice94-final-synthesis.md",
  "slice95-final-synthesis.md"
]);

// Matches the grade-template.md placeholder lines verbatim: "- bullet",
// "- bullet 1", "- bullet 2" (Lessons/Surprises/Followups sections).
const GRADE_PLACEHOLDER_LINE = /^- bullet(?: \d+)?\s*$/m;

// FEAT-199a: the remaining unrendered markers from docs/grades/grade-template.md
// that "- bullet" doesn't already cover. `<title>` is the H1 title bracket
// placeholder — anchored to the actual heading shape (`# SLICE-NN: <title>
// — Grade`), not a bare substring match, because "<title>" can legitimately
// appear inside prose (e.g. a grade referencing a `cost-report-<title>.md`
// filename pattern — see 20260602T142422Z-slice13-grade.md line 20).
// "Short decision title" is the exact unfilled subtitle that follows
// `### DEC-TBD:` (the bare `DEC-TBD:` prefix alone is legitimate — real
// grades use it pre-DEC-id-assignment, see grade-template.md line 59-60 and
// 20260607T093509Z-slice16-grade.md — so we key on the placeholder title
// text, not the prefix); "(narrative)" is the literal unfilled marker for the
// "What went well/wrong/differently" prose sections.
const GRADE_TITLE_PLACEHOLDER = /^#\s*SLICE-\S+:\s*<title>\s*—\s*Grade\s*$/m;
const GRADE_DECISION_TITLE_PLACEHOLDER = /Short decision title/;
const GRADE_NARRATIVE_PLACEHOLDER = /^\(narrative\)\s*$/m;

// FEAT-199a/199b grandfather cutoff. Pre-existing grade files carry unfilled
// template rot predating this gate. Hard-failing on them immediately would flip
// this validator red for pre-existing history before FEAT-199b's backfill
// lands. Grade filenames follow `<ISO-basic-timestamp>-<slice>-grade.md` (e.g.
// 20260708T081627Z-slice110-grade.md); files timestamped at/after the cutoff
// — i.e. everything written from that point onward — are held to the full
// standard with no grace. Files whose name doesn't carry a parseable leading
// timestamp (never expected from the grading ceremony) are treated as new
// and NOT grandfathered, erring toward catching rot rather than hiding it.
// Advanced to 2026-07-09 (FEAT-199b) to cover slice112/113 grade files (dated
// 2026-07-08 afternoon) whose real retrospective data can only be backfilled
// by the slice owner, not fabricated here. Remove this cutoff once 199b lands.
const GRADE_ROT_GRANDFATHER_CUTOFF = new Date("2026-07-09T00:00:00Z");
const GRADE_FILENAME_TIMESTAMP = /^(\d{8}T\d{6}Z)-/;

function parseGradeFilenameTimestamp(name: string): Date | null {
  const match = name.match(GRADE_FILENAME_TIMESTAMP);
  if (!match) return null;
  const raw = match[1]!; // e.g. "20260708T081627Z"
  const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function extractFrontmatter(text: string): string | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? (match[1] ?? null) : null;
}

// "Unfilled AC" — the grade template's scores default to all-0; a grade
// file left at that default never had its acceptance-criteria dimensions
// actually scored.
function scoresAllZero(text: string): boolean {
  const fm = extractFrontmatter(text);
  if (!fm) return false;
  let parsed: unknown;
  try {
    parsed = parseYaml(fm);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const scores = (parsed as Record<string, unknown>).scores;
  if (!scores || typeof scores !== "object") return false;
  const values = Object.values(scores as Record<string, unknown>);
  if (values.length === 0) return false;
  return values.every((v) => typeof v === "number" && v === 0);
}

// Returns the grade_incomplete reason for a rotted grade file, or null if
// the file looks genuinely filled in. First match wins (mirrors the
// pre-existing bullet/all-zero ordering) — AC-1 only requires one reason
// per offending path, not every reason that happens to apply.
function gradeRotReason(text: string): string | null {
  if (GRADE_PLACEHOLDER_LINE.test(text)) {
    return 'grade_incomplete — unfilled placeholder text ("- bullet")';
  }
  if (GRADE_TITLE_PLACEHOLDER.test(text)) {
    return 'grade_incomplete — unrendered template placeholder ("<title>")';
  }
  if (GRADE_DECISION_TITLE_PLACEHOLDER.test(text)) {
    return 'grade_incomplete — unfilled decision placeholder ("DEC-TBD: Short decision title")';
  }
  if (GRADE_NARRATIVE_PLACEHOLDER.test(text)) {
    return 'grade_incomplete — unfilled narrative placeholder ("(narrative)")';
  }
  if (scoresAllZero(text)) {
    return "grade_incomplete — all AC scores are unfilled (0)";
  }
  return null;
}

async function validateGradeFiles(
  repoPath: string
): Promise<{ errors: string[]; grandfathered: string[] }> {
  const gradesDir = path.join(repoPath, ...GRADES_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(gradesDir);
  } catch {
    return { errors: [], grandfathered: [] };
  }
  const gradeFiles = entries.filter((name) => name.endsWith("-grade.md"));
  const errors: string[] = [];
  const grandfathered: string[] = [];
  for (const name of gradeFiles) {
    const text = await fs.readFile(path.join(gradesDir, name), "utf8");
    const reason = gradeRotReason(text);
    if (!reason) continue;
    const timestamp = parseGradeFilenameTimestamp(name);
    if (timestamp && timestamp < GRADE_ROT_GRANDFATHER_CUTOFF) {
      grandfathered.push(
        `${name}: ${reason} (grandfathered pre-FEAT-199a rot — see FEAT-199b backfill)`
      );
      continue;
    }
    errors.push(`${name}: ${reason}`);
  }
  return { errors, grandfathered };
}

export async function validateSyntheses(
  repoPath: string
): Promise<{ errors: string[]; grandfatheredGradeRot: string[]; grandfatheredSynth: string[] }> {
  const runsDir = path.join(repoPath, ...RUNS_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(runsDir);
  } catch {
    entries = [];
  }
  const synthFiles = entries.filter((name) => name.includes("final-synthesis"));
  const errors: string[] = [];
  const grandfatheredSynth: string[] = [];
  for (const name of synthFiles) {
    const text = await fs.readFile(path.join(runsDir, name), "utf8");
    for (const pat of STALE_PATTERNS) {
      if (pat.test(text)) {
        const message = `${name}: contains stale placeholder matching ${pat}`;
        if (SYNTHESIS_ROT_GRANDFATHER.has(name)) {
          grandfatheredSynth.push(
            `${message} (grandfathered pre-gate rot — see FEAT-199b backfill)`
          );
        } else {
          errors.push(message);
        }
        break;
      }
    }
  }
  const gradeResult = await validateGradeFiles(repoPath);
  errors.push(...gradeResult.errors);
  return { errors, grandfatheredGradeRot: gradeResult.grandfathered, grandfatheredSynth };
}

// Cross-platform CLI main-guard: `new URL(import.meta.url).pathname` yields a
// leading-slash forward-slash path on Windows that never equals argv[1]'s
// native path, silently skipping the CLI body (AC-1 "cannot close silently"
// was broken on win32). Mirror the canonical validate-agents/validate-skills guard.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoPath = process.argv[2] || process.cwd();
  const { errors, grandfatheredGradeRot, grandfatheredSynth } = await validateSyntheses(repoPath);
  if (grandfatheredSynth.length > 0) {
    console.warn(
      `validate-syntheses: ${grandfatheredSynth.length} pre-existing final-synthesis file(s) grandfathered ` +
        "(rot predates the gate; backfill tracked in FEAT-199b):"
    );
    grandfatheredSynth.forEach((g) => console.warn("  " + g));
  }
  if (grandfatheredGradeRot.length > 0) {
    console.warn(
      `validate-syntheses: ${grandfatheredGradeRot.length} pre-existing grade file(s) grandfathered ` +
        "(rot predates the FEAT-199a cutoff; backfill tracked in FEAT-199b):"
    );
    grandfatheredGradeRot.forEach((g) => console.warn("  " + g));
  }
  if (errors.length > 0) {
    console.error("validate-syntheses: stale placeholders found:");
    errors.forEach((e) => console.error("  " + e));
    process.exit(1);
  } else {
    console.log("validate-syntheses: all synthesis files clean");
  }
}
