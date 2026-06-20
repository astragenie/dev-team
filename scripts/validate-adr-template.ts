#!/usr/bin/env node
// validate-adr-template.ts — FEAT-142 SLICE-A
// Walks docs/architecture/decisions/ADR-*.md (or a single file arg) and checks
// each has a well-formed `## Options Considered` section per the new template:
//   - section exists and is non-empty
//   - >=3 `### Option N:` H3 entries
//   - each non-chosen option has a `Why rejected:` line with non-trivial reasoning
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
  /^too\s+complex$/i,
  /^not\s+preferred$/i,
  /^too\s+expensive$/i,
  /^not\s+a\s+fit$/i,
  /^overkill$/i,
  /^n\/a$/i,
  /^\-+$/
];

function extractOptionsConsideredSection(md: string): string | null {
  const re = /(^|\n)##\s+Options\s+Considered\s*\r?\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i;
  const m = re.exec(md);
  return m?.[2]?.trim() ?? null;
}

function listOptions(section: string): { heading: string; body: string }[] {
  // Split on H3 `### Option N:` boundaries.
  const re = /(?:^|\n)###\s+Option\s+\d+:\s*(.+?)\r?\n([\s\S]*?)(?=\n###\s+Option\s+\d+:|$)/gi;
  const out: { heading: string; body: string }[] = [];
  let match: RegExpExecArray | null = null;
  while ((match = re.exec(section)) !== null) {
    out.push({ heading: (match[1] ?? "").trim(), body: (match[2] ?? "").trim() });
  }
  return out;
}

function findChosenOptionHint(md: string): number | null {
  // Look for `## Decision` mentioning Option N. If we can't tell, treat all as non-chosen.
  const dec = /(?:^|\n)##\s+Decision\s*\r?\n([\s\S]*?)(?=\n##\s|$)/i.exec(md);
  if (!dec) return null;
  const numMatch = /Option\s+(\d+)/i.exec(dec[1] ?? "");
  if (!numMatch) return null;
  return Number.parseInt(numMatch[1] ?? "0", 10);
}

function whyRejectedReasoning(body: string): string | null {
  const m = /Why\s+rejected:\s*(.+?)(?:\n|$)/i.exec(body);
  // Strip trailing punctuation so "Too complex." matches /^too\s+complex$/.
  return m?.[1]?.trim().replace(/[.;,!?]+$/, "") ?? null;
}

export function validateAdr(filePath: string, md: string): AdrFinding[] {
  const findings: AdrFinding[] = [];
  const section = extractOptionsConsideredSection(md);
  if (!section) {
    findings.push({
      file: filePath,
      severity: "error",
      rule: "missing-options-considered",
      detail: "`## Options Considered` section is absent or empty"
    });
    return findings;
  }
  const options = listOptions(section);
  if (options.length < 3) {
    findings.push({
      file: filePath,
      severity: "error",
      rule: "insufficient-options",
      detail: `found ${options.length} \`### Option N:\` entries, require >=3`
    });
  }
  const chosen = findChosenOptionHint(md);
  options.forEach((opt, idx) => {
    const optionNumber = idx + 1;
    if (chosen !== null && optionNumber === chosen) return; // skip chosen
    const reasoning = whyRejectedReasoning(opt.body);
    if (!reasoning) {
      findings.push({
        file: filePath,
        severity: "error",
        rule: "missing-why-rejected",
        detail: `Option ${optionNumber} (${opt.heading}) lacks a \`Why rejected:\` line`
      });
      return;
    }
    if (TRIVIAL_REJECTION_PATTERNS.some((re) => re.test(reasoning))) {
      findings.push({
        file: filePath,
        severity: "warn",
        rule: "trivial-rejection-reasoning",
        detail: `Option ${optionNumber}: rejection reasoning is too vague ("${reasoning}") — name a specific failure mode`
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
    try { md = await fs.readFile(f, "utf-8"); } catch { continue; }
    findings.push(...validateAdr(path.relative(repo, f), md));
  }
  const errors = findings.filter((x) => x.severity === "error").length;
  return { findings, exitCode: strict && errors > 0 ? 2 : 0 };
}

// Run when invoked directly (not when imported by tests).
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("validate-adr-template.ts");
if (isMain) {
  const { findings, exitCode } = await run(process.argv.slice(2));
  for (const f of findings) {
    process.stdout.write(`[${f.severity.toUpperCase()}] ${f.file}: ${f.rule} — ${f.detail}\n`);
  }
  if (findings.length === 0) process.stdout.write(`adr-template: no findings (${process.argv.includes("--strict") ? "strict" : "advisory"} mode)\n`);
  process.exit(exitCode);
}
