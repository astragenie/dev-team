#!/usr/bin/env node
// validate-adr-template.ts — FEAT-142 SLICE-A (heading fixed, arch-review 2026-07-04 Finding 2.9)
// Walks docs/architecture/decisions/ADR-*.md (or a single file arg) and checks
// each has a well-formed `## Alternatives considered` section matching the
// convention both real ADRs already use:
//   - section exists and is non-empty
//   - >=1 `- **Option <label> (...):**` bullet entry
//   - each entry not explicitly marked "Accepted" carries non-trivial
//     rejection reasoning (more than a few words, not a boilerplate phrase)
//
// Modes:
//   --advisory (default): print findings, exit 0
//   --strict             : exit 2 if any finding
//   --repo <path>        : repo root (default: process.cwd())
//   <file-path>          : validate a single ADR file instead of walking
import fs from "node:fs/promises";
import path from "node:path";

export interface AdrFinding {
  file: string;
  severity: "error" | "warn";
  rule: string;
  detail: string;
}

const TRIVIAL_REJECTION_PATTERNS = [
  /^too\s+complex\.?$/i,
  /^not\s+preferred\.?$/i,
  /^too\s+expensive\.?$/i,
  /^not\s+a\s+fit\.?$/i,
  /^overkill\.?$/i,
  /^n\/a\.?$/i,
  /^-+$/,
  /^rejected\.?$/i
];

const MIN_REJECTION_WORDS = 5;

function extractAlternativesConsideredSection(md: string): string | null {
  const re = /(^|\n)##\s+Alternatives\s+considered\s*\r?\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i;
  const m = re.exec(md);
  return m?.[2]?.trim() ?? null;
}

/**
 * Split the section into `- **Option <label>...:** <body>` entries. Each
 * entry's body runs until the next top-level `- **Option` bullet.
 */
function listOptions(section: string): { heading: string; body: string }[] {
  const re = /(?:^|\n)-\s+\*\*Option\s+([^*]+?):\*\*\s*([\s\S]*?)(?=\n-\s+\*\*Option\s|$)/gi;
  const out: { heading: string; body: string }[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(section)) !== null) {
    out.push({ heading: (match[1] ?? "").trim(), body: (match[2] ?? "").trim() });
  }
  return out;
}

function isAccepted(body: string): boolean {
  return /\baccepted\b/i.test(body);
}

function rejectionReasoning(body: string): string | null {
  const m = /\brejected\b[.:;]?\s*(?:because\s+)?(.+)/is.exec(body);
  return m?.[1]?.trim().replace(/[.;,!?]+$/, "") ?? null;
}

export function validateAdr(filePath: string, md: string): AdrFinding[] {
  const findings: AdrFinding[] = [];
  const section = extractAlternativesConsideredSection(md);
  if (!section) {
    findings.push({
      file: filePath,
      severity: "error",
      rule: "missing-alternatives-considered",
      detail: "`## Alternatives considered` section is absent or empty"
    });
    return findings;
  }
  const options = listOptions(section);
  if (options.length < 1) {
    findings.push({
      file: filePath,
      severity: "error",
      rule: "insufficient-options",
      detail: `found ${options.length} \`- **Option <label>:**\` entries, require >=1`
    });
  }
  options.forEach((opt, idx) => {
    if (isAccepted(opt.body)) return; // the chosen option needs no rejection reasoning
    const reasoning = rejectionReasoning(opt.body);
    if (!reasoning) {
      findings.push({
        file: filePath,
        severity: "error",
        rule: "missing-rejection-reasoning",
        detail: `Option ${idx + 1} (${opt.heading}) is not marked "Accepted" and has no "Rejected ..." reasoning`
      });
      return;
    }
    const wordCount = reasoning.split(/\s+/).filter(Boolean).length;
    const isTrivial =
      wordCount < MIN_REJECTION_WORDS ||
      TRIVIAL_REJECTION_PATTERNS.some((re) => re.test(reasoning));
    if (isTrivial) {
      findings.push({
        file: filePath,
        severity: "warn",
        rule: "trivial-rejection-reasoning",
        detail: `Option ${idx + 1} (${opt.heading}): rejection reasoning is too vague ("${reasoning}") — name a specific failure mode`
      });
    }
  });
  return findings;
}

async function walkAdrDir(dir: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/^ADR-.*\.md$/i.test(e.name)) continue;
    out.push(path.join(dir, e.name));
  }
  return out.sort();
}

function parseArgs(argv: string[]): { repo: string; strict: boolean; single: string | null } {
  let repo = process.cwd();
  let strict = false;
  let single: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--repo") {
      repo = argv[++i] ?? repo;
    } else if (a === "--strict") {
      strict = true;
    } else if (a === "--advisory") {
      strict = false;
    } else if (a && !a.startsWith("--")) {
      single = a;
    }
  }
  return { repo, strict, single };
}

export async function run(argv: string[]): Promise<{ findings: AdrFinding[]; exitCode: number }> {
  const { repo, strict, single } = parseArgs(argv);
  const files: string[] = single
    ? [path.isAbsolute(single) ? single : path.join(repo, single)]
    : await walkAdrDir(path.join(repo, "docs", "architecture", "decisions"));
  const findings: AdrFinding[] = [];
  for (const f of files) {
    let md = "";
    try {
      md = await fs.readFile(f, "utf-8");
    } catch {
      continue;
    }
    findings.push(...validateAdr(path.relative(repo, f), md));
  }
  const errors = findings.filter((x) => x.severity === "error").length;
  return { findings, exitCode: strict && errors > 0 ? 2 : 0 };
}

// Run when invoked directly (not when imported by tests).
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("validate-adr-template.ts");
if (isMain) {
  const { findings, exitCode } = await run(process.argv.slice(2));
  for (const f of findings) {
    process.stdout.write(`[${f.severity.toUpperCase()}] ${f.file}: ${f.rule} — ${f.detail}\n`);
  }
  if (findings.length === 0)
    process.stdout.write(
      `adr-template: no findings (${process.argv.includes("--strict") ? "strict" : "advisory"} mode)\n`
    );
  process.exit(exitCode);
}
