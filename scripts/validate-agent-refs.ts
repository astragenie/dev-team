#!/usr/bin/env node
// validate-agent-refs.ts — phantom agent/command reference sweep
// (crew-architecture-review 2026-07-04, Finding 2.1 + Section 8 fitness function).
//
// Scans commands/, skills/, agents/, and the durable loop-methodology markdown
// under .claude/loop/ for `crew:<name>` (and `crew:3rdparty:<name>`) dispatch
// tokens and fails if <name> does not resolve to a real command file
// (commands/<name>.md), a real agent file (agents/<name>.md), or a real
// 3rdparty agent/command file. This catches the exact failure mode the
// architecture review found: a rename or a copy-pasted community agent pack
// leaves behind a dispatch instruction that resolves to nothing, and nothing
// in CI notices until a live dispatch fails with "Agent type not found".
//
// .claude/loop/ is included because it ships the HARD RULE methodology that
// autonomous orchestrators (and consumer repos that install this plugin) read
// verbatim — a phantom `crew:<name>` there breaks a consumer repo exactly like
// one in commands/skills/agents would, and it shipped once already (a
// `crew:builder` phantom in .claude/loop/rules.md, fixed by hand before this
// scan existed). Only .claude/loop/**/*.md is scanned — never
// .claude/artifacts/**, .claude/logs/, or .claude/state/, which are run-local
// output, not durable authored methodology.
//
// Forward references (agents intentionally referenced before they exist, each
// with documented registry-fallback handling at its reference sites) live in
// docs/routing-table.yaml `forward_references:` — the single allowlist shared
// with validate-configs.ts via scripts/lib/dispatch/resolve-token.ts.
// Resolution semantics are also shared: agents/, commands/, skills/**/SKILL.md,
// then the forward-reference allowlist.
import fs from "node:fs/promises";
import { readdirSync, type Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTokenResolver, type TokenResolver } from "./lib/dispatch/resolve-token.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface AgentRefFinding {
  file: string;
  token: string;
  detail: string;
}

function listMdBasenames(dir: string): Set<string> {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return new Set();
  }
  return new Set(
    entries
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => path.basename(e.name, ".md"))
  );
}

async function walkMarkdown(dir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await walkMarkdown(full)));
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

const TOKEN_RE = /\bcrew:(?:(3rdparty):)?([a-zA-Z][\w-]*)\b/g;

interface KnownNames {
  resolver: TokenResolver;
  agentNames3rdparty: Set<string>;
  commandNames3rdparty: Set<string>;
}

/** Resolve a single `crew:...` token. Returns a finding, or null if it resolves. */
function resolveToken(
  label: string,
  is3rdparty: boolean,
  name: string,
  known: KnownNames
): AgentRefFinding | null {
  if (is3rdparty) {
    if (known.agentNames3rdparty.has(name) || known.commandNames3rdparty.has(name)) return null;
    return {
      file: label,
      token: `crew:3rdparty:${name}`,
      detail: `no agents/3rdparty/${name}.md or commands/3rdparty/${name}.md on disk`
    };
  }
  if (known.resolver.resolves(name)) return null;
  return {
    file: label,
    token: `crew:${name}`,
    detail:
      `no agents/${name}.md, commands/${name}.md, or skills/**/${name}/SKILL.md on disk, ` +
      "and not a documented forward_references entry in docs/routing-table.yaml"
  };
}

function scanFileForFindings(label: string, text: string, known: KnownNames): AgentRefFinding[] {
  const findings: AgentRefFinding[] = [];
  let match: RegExpExecArray | null = null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    const finding = resolveToken(label, match[1] === "3rdparty", match[2] as string, known);
    if (finding) findings.push(finding);
  }
  return findings;
}

export async function validateAgentRefs(repoRoot = REPO_ROOT) {
  const known: KnownNames = {
    resolver: await createTokenResolver(repoRoot),
    commandNames3rdparty: listMdBasenames(path.join(repoRoot, "commands", "3rdparty")),
    agentNames3rdparty: listMdBasenames(path.join(repoRoot, "agents", "3rdparty"))
  };

  const scanDirs = ["commands", "skills", "agents", path.join(".claude", "loop")];
  const files: string[] = [];
  for (const d of scanDirs) {
    files.push(...(await walkMarkdown(path.join(repoRoot, d))));
  }

  const findings: AgentRefFinding[] = [];
  for (const filePath of files) {
    const label = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    const text = await fs.readFile(filePath, "utf8");
    findings.push(...scanFileForFindings(label, text, known));
  }
  return { ok: findings.length === 0, findings };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateAgentRefs();
  if (!result.ok) {
    console.error(`Agent-ref validation failed: ${result.findings.length} phantom reference(s)`);
    for (const f of result.findings) {
      console.error(`  - ${f.file}: "${f.token}" — ${f.detail}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Agent-ref validation OK: no phantom crew: dispatch references found.");
  }
}
