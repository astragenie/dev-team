#!/usr/bin/env bun
/**
 * render-universal-skills.ts — Build-time CLI for pre-rendered universals.
 * Renders a ≤35-line "essentials" block from three universal skill files
 * and injects/checks/prints it for agent prompts.
 *
 * Usage:
 *   bun run scripts/render-universal-skills.ts --render-only [--sources-root <path>]
 *   bun run scripts/render-universal-skills.ts --check [<glob>] [--sources-root <path>]
 *   bun run scripts/render-universal-skills.ts --inject [<glob>] [--sources-root <path>]
 *
 * Exit codes:
 *   0 = success / no drift
 *   1 = drift detected (--check) or validation error
 *   2 = unexpected error
 *   3 = source skill file missing
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import os from "node:os";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Error types ────────────────────────────────────────────────────────────────

export class SourceSkillNotFoundError extends Error {
  constructor(
    public readonly skillName: string,
    public readonly searchedPaths: string[]
  ) {
    super(`Source skill not found: ${skillName} (searched: ${searchedPaths.join(", ")})`);
    this.name = "SourceSkillNotFoundError";
  }
}

export class RenderedBodyTooLargeError extends Error {
  constructor(public readonly lines: number) {
    super(`Rendered body exceeds 35-line cap: got ${lines} lines`);
    this.name = "RenderedBodyTooLargeError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SourcePaths {
  usingSuperpowers: string;
  verificationBeforeCompletion: string;
  loopDiscipline: string;
}

export interface RenderResult {
  body: string;
  hash: string;
}

export interface DriftResult {
  drift: boolean;
  expected: string;
  found: string | null;
}

// ── Marker pattern ─────────────────────────────────────────────────────────────

const MARKER_BEGIN_RE = /<!-- pre-loaded-universals:BEGIN hash=([0-9a-f]{64}) -->/;
const MARKER_END = "<!-- pre-loaded-universals:END -->";
const MARKER_BLOCK_RE =
  /<!-- pre-loaded-universals:BEGIN hash=[0-9a-f]{64} -->[\s\S]*?<!-- pre-loaded-universals:END -->/;

// ── Source path resolution ────────────────────────────────────────────────────

const SKILL_NAMES: Record<keyof SourcePaths, string> = {
  usingSuperpowers: "using-superpowers",
  verificationBeforeCompletion: "verification-before-completion",
  loopDiscipline: "loop-discipline"
};

const PLUGIN_NAMESPACES: Record<keyof SourcePaths, string> = {
  usingSuperpowers: "superpowers",
  verificationBeforeCompletion: "superpowers",
  loopDiscipline: "loop"
};

/**
 * Find the lexicographically highest matching SKILL.md under a namespace directory.
 * Pattern: <cacheBase>/<ns>/<version>/skills/<skillName>/SKILL.md
 * We walk one level of version subdirs (no wildcard glob needed).
 */
async function findNewestSkill(
  cacheBase: string,
  ns: string,
  skillName: string
): Promise<string | null> {
  const nsDir = path.join(cacheBase, ns);
  let versions: string[];
  try {
    const entries = await fs.readdir(nsDir, { withFileTypes: true });
    versions = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
      .reverse(); // highest version first
  } catch {
    return null;
  }
  for (const ver of versions) {
    const candidate = path.join(nsDir, ver, "skills", skillName, "SKILL.md");
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // not found in this version, try next
    }
  }
  return null;
}

async function resolveSourcePaths(sourcesRoot: string | undefined): Promise<SourcePaths> {
  if (sourcesRoot !== undefined) {
    // Test/CI override: expect SKILL.md files at fixed names in the root
    const paths = {
      usingSuperpowers: path.join(sourcesRoot, "using-superpowers.SKILL.md"),
      verificationBeforeCompletion: path.join(
        sourcesRoot,
        "verification-before-completion.SKILL.md"
      ),
      loopDiscipline: path.join(sourcesRoot, "loop-discipline.SKILL.md")
    };
    // Validate existence; throw SourceSkillNotFoundError if missing
    for (const [key, filePath] of Object.entries(paths)) {
      try {
        await fs.access(filePath);
      } catch {
        throw new SourceSkillNotFoundError(key, [filePath]);
      }
    }
    return paths;
  }
  // Different plugin families live under different cache roots:
  // superpowers → cache/claude-plugins-official/, loop → cache/astra/
  const pluginsRoot = path.join(os.homedir(), ".claude", "plugins", "cache");
  const NAMESPACE_CACHE: Record<string, string> = {
    superpowers: path.join(pluginsRoot, "claude-plugins-official"),
    loop: path.join(pluginsRoot, "astra")
  };
  const keys = Object.keys(SKILL_NAMES) as Array<keyof SourcePaths>;
  const resolvedEntries: Array<[keyof SourcePaths, string]> = [];
  for (const key of keys) {
    const ns = PLUGIN_NAMESPACES[key] as string;
    const cacheBase = NAMESPACE_CACHE[ns];
    if (cacheBase === undefined) {
      throw new SourceSkillNotFoundError(SKILL_NAMES[key] as string, [
        `unknown plugin namespace: ${ns}`
      ]);
    }
    const skillName = SKILL_NAMES[key] as string;
    const searchedPath = path.join(cacheBase, ns, "<version>", "skills", skillName, "SKILL.md");
    const found = await findNewestSkill(cacheBase, ns, skillName);
    if (!found) {
      throw new SourceSkillNotFoundError(skillName, [searchedPath]);
    }
    resolvedEntries.push([key, found]);
  }
  if (resolvedEntries.length !== keys.length) {
    throw new SourceSkillNotFoundError("partial-resolution", []);
  }
  const obj = Object.fromEntries(resolvedEntries);
  if (
    typeof obj["usingSuperpowers"] !== "string" ||
    typeof obj["verificationBeforeCompletion"] !== "string" ||
    typeof obj["loopDiscipline"] !== "string"
  ) {
    throw new SourceSkillNotFoundError("partial-resolution", []);
  }
  return {
    usingSuperpowers: obj["usingSuperpowers"],
    verificationBeforeCompletion: obj["verificationBeforeCompletion"],
    loopDiscipline: obj["loopDiscipline"]
  };
}

// ── Compression rule (v1) ──────────────────────────────────────────────────────

const MUST_RE = /\b(MUST|HARD|Iron Law|cannot|never|always)\b/i;
const HEADING_RE = /^## /;

function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

// Walk rawLines once, emitting MUST-bearing lines and the preceding `## `
// heading (once per heading) as a contiguous entry.
function collectMustEntries(rawLines: string[]): Array<{ lineNo: number; lines: string[] }> {
  const kept: Array<{ lineNo: number; lines: string[] }> = [];
  let lastHeading: string | null = null;
  let headingEmitted = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? "";
    if (HEADING_RE.test(line)) {
      lastHeading = line;
      headingEmitted = false;
      continue;
    }
    if (!MUST_RE.test(line)) continue;
    const entry: string[] = [];
    if (lastHeading !== null && !headingEmitted) {
      entry.push(lastHeading);
      headingEmitted = true;
    }
    entry.push(line);
    kept.push({ lineNo: i, lines: entry });
  }
  return kept;
}

// Flatten the kept entries and cap at `max` output lines.
function flattenAndCap(kept: Array<{ lineNo: number; lines: string[] }>, max: number): string[] {
  const flat: string[] = [];
  for (const item of kept) {
    for (const l of item.lines) {
      if (flat.length >= max) return flat;
      flat.push(l);
    }
  }
  return flat;
}

function compressSkill(content: string, skillName: string): string[] {
  const body = stripFrontmatter(content);
  const rawLines = body.split(/\r?\n/);
  const kept = collectMustEntries(rawLines);
  kept.sort((a, b) => a.lineNo - b.lineNo);
  const flat = flattenAndCap(kept, 12);
  const result = [`### ${skillName}`];
  for (const l of flat) {
    if (l.trim() !== "") result.push(l);
  }
  return result;
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Render the universals block from source SKILL.md files.
 * Hash is computed over the canonical source concatenation (not the rendered body).
 */
export function renderUniversals(opts: {
  sources: SourcePaths;
  contents: Record<keyof SourcePaths, string>;
}): RenderResult {
  const { contents } = opts;

  // Compute hash over source contents joined by boundary
  const canonical = [
    contents.usingSuperpowers,
    contents.verificationBeforeCompletion,
    contents.loopDiscipline
  ].join("\n---SKILL-BOUNDARY---\n");
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");

  // Build rendered body
  const sections: string[] = [
    ...compressSkill(contents.usingSuperpowers, "using-superpowers"),
    "",
    ...compressSkill(contents.verificationBeforeCompletion, "verification-before-completion"),
    "",
    ...compressSkill(contents.loopDiscipline, "loop-discipline")
  ];

  // Remove trailing blank lines
  while (sections.length > 0 && sections[sections.length - 1]?.trim() === "") {
    sections.pop();
  }

  if (sections.length > 35) {
    throw new RenderedBodyTooLargeError(sections.length);
  }

  const body = sections.join("\n");
  return { body, hash };
}

/**
 * Read source files and render.
 */
async function renderFromPaths(sources: SourcePaths): Promise<RenderResult> {
  const contents = {
    usingSuperpowers: await fs.readFile(sources.usingSuperpowers, "utf8"),
    verificationBeforeCompletion: await fs.readFile(sources.verificationBeforeCompletion, "utf8"),
    loopDiscipline: await fs.readFile(sources.loopDiscipline, "utf8")
  };
  return renderUniversals({ sources, contents });
}

/**
 * Build the full marker block string (BEGIN + body + END).
 */
function buildMarkerBlock(body: string, hash: string): string {
  return [
    `<!-- pre-loaded-universals:BEGIN hash=${hash} -->`,
    `## Pre-loaded universals`,
    ``,
    body,
    MARKER_END
  ].join("\n");
}

/**
 * Check if an agent file has drifted from the expected hash.
 */
export function checkUniversalsHash(agentContent: string, expectedHash: string): DriftResult {
  const match = agentContent.match(MARKER_BEGIN_RE);
  if (!match || match[1] === undefined) {
    return { drift: true, expected: expectedHash, found: null };
  }
  const found = match[1];
  return { drift: found !== expectedHash, expected: expectedHash, found };
}

// ── Glob agent files ──────────────────────────────────────────────────────────

/**
 * Resolve agent files from a glob pattern or an absolute file path.
 * Uses readdir for single-level patterns (agents/*.md) to avoid Bun fs.glob limitations.
 */
async function findAgentFiles(globPattern: string, repoRoot: string): Promise<string[]> {
  // If the pattern has no wildcard, treat it as a single-file path (absolute or relative-to-repo).
  if (!globPattern.includes("*")) {
    const abs = path.isAbsolute(globPattern) ? globPattern : path.join(repoRoot, globPattern);
    try {
      await fs.access(abs);
      return [abs];
    } catch {
      return [];
    }
  }

  // Handle single-level glob: "agents/*.md" → readdir agents/ and filter *.md
  const absBase = path.isAbsolute(globPattern)
    ? path.dirname(globPattern)
    : path.join(repoRoot, path.dirname(globPattern));
  const ext = path.extname(globPattern); // ".md"
  const files: string[] = [];
  try {
    const entries = await fs.readdir(absBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(ext)) {
        files.push(path.join(absBase, entry.name));
      }
    }
  } catch {
    // directory doesn't exist → empty
  }
  files.sort();
  return files;
}

// ── Injection ─────────────────────────────────────────────────────────────────

/**
 * Idempotently inject/replace the marker block into an agent file,
 * inserting immediately after the frontmatter close line.
 */
async function injectIntoAgent(
  agentPath: string,
  markerBlock: string,
  expectedHash: string,
  obs: boolean
): Promise<boolean> {
  const content = await fs.readFile(agentPath, "utf8");

  // Check if already has a block with matching hash (idempotent)
  const existing = MARKER_BLOCK_RE.exec(content);
  if (existing) {
    const existingHash = MARKER_BEGIN_RE.exec(existing[0]);
    if (existingHash && existingHash[1] === expectedHash) {
      // Already up-to-date, no write needed
      return false;
    }
    // Replace existing block
    const updated = content.replace(MARKER_BLOCK_RE, markerBlock);
    await fs.writeFile(agentPath, updated, "utf8");
    if (obs) {
      process.stderr.write(
        `RENDER-UNIVERSALS injected: ${agentPath} hash=${expectedHash.slice(0, 8)}\n`
      );
    }
    return true;
  }

  // Insert after frontmatter close (first --- ... --- block)
  const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!fmMatch) {
    process.stderr.write(`RENDER-UNIVERSALS skip: ${agentPath} — no frontmatter found\n`);
    return false;
  }
  const insertPos = fmMatch[0].length;
  const updated = content.slice(0, insertPos) + markerBlock + "\n" + content.slice(insertPos);
  await fs.writeFile(agentPath, updated, "utf8");
  if (obs) {
    process.stderr.write(
      `RENDER-UNIVERSALS injected: ${agentPath} hash=${expectedHash.slice(0, 8)}\n`
    );
  }
  return true;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface CliArgs {
  mode: "check" | "inject" | "render-only" | "print-hash";
  glob: string;
  sourcesRoot: string | undefined;
  obs: boolean;
}

// Peek at argv[i+1] and consume it as a positional value iff it exists and
// isn't another --flag. Returns the new cursor index (advances on consume).
function peekValueArg(
  argv: string[],
  i: number,
  requireNonFlag: boolean
): { value: string | null; nextIndex: number } {
  const next = argv[i + 1];
  if (!next) return { value: null, nextIndex: i };
  if (requireNonFlag && next.startsWith("--")) return { value: null, nextIndex: i };
  return { value: next, nextIndex: i + 1 };
}

interface CliState {
  mode: "check" | "inject" | "render-only" | "print-hash";
  glob: string;
  sourcesRoot: string | undefined;
  obs: boolean;
}

// Apply one CLI argument to state. Returns the new index (advances by 2 when
// a value was consumed, otherwise by 1).
function applyCliArg(argv: string[], i: number, state: CliState): number {
  const arg = argv[i];
  if (arg === "--check" || arg === "--inject") {
    state.mode = arg === "--check" ? "check" : "inject";
    const consumed = peekValueArg(argv, i, true);
    if (consumed.value !== null) {
      state.glob = consumed.value;
      return consumed.nextIndex + 1;
    }
    return i + 1;
  }
  if (arg === "--render-only") {
    state.mode = "render-only";
    return i + 1;
  }
  if (arg === "--print-hash") {
    state.mode = "print-hash";
    return i + 1;
  }
  if (arg === "--sources-root") {
    const consumed = peekValueArg(argv, i, false);
    if (consumed.value !== null) {
      state.sourcesRoot = consumed.value;
      return consumed.nextIndex + 1;
    }
    return i + 1;
  }
  if (arg === "--emit-observability") {
    state.obs = true;
  }
  return i + 1;
}

function parseCliArgs(argv: string[]): CliArgs {
  const state: CliState = {
    mode: "check",
    glob: "agents/*.md",
    sourcesRoot: undefined,
    obs: false
  };
  let i = 0;
  while (i < argv.length) {
    i = applyCliArg(argv, i, state);
  }
  return state;
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  const { mode, sourcesRoot, obs } = args;

  // Resolve source paths
  const sources = await resolveSourcePaths(sourcesRoot);
  const rendered = await renderFromPaths(sources);
  const { body, hash } = rendered;

  if (mode === "render-only") {
    process.stdout.write(body + "\n");
    process.stderr.write(
      `RENDER-UNIVERSALS rendered: hash=${hash} lines=${body.split("\n").length}\n`
    );
    return;
  }

  if (mode === "print-hash") {
    process.stdout.write(hash + "\n");
    return;
  }

  const markerBlock = buildMarkerBlock(body, hash);
  const agentFiles = await findAgentFiles(args.glob, REPO_ROOT);

  if (mode === "inject") {
    for (const agentPath of agentFiles) {
      await injectIntoAgent(agentPath, markerBlock, hash, obs);
    }
    return;
  }

  // mode === "check"
  let hasDrift = false;
  for (const agentPath of agentFiles) {
    const content = await fs.readFile(agentPath, "utf8");
    const result = checkUniversalsHash(content, hash);
    if (result.drift) {
      hasDrift = true;
      const foundStr = result.found !== null ? result.found.slice(0, 8) : "none";
      process.stderr.write(
        `RENDER-UNIVERSALS drift: ${agentPath} expected=${hash.slice(0, 8)} found=${foundStr}\n`
      );
    }
  }
  if (hasDrift) {
    process.exitCode = 1;
  }
}

function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  await main().catch((err: unknown) => {
    if (err instanceof SourceSkillNotFoundError) {
      process.stderr.write(
        `RENDER-UNIVERSALS source missing: ${err.skillName} (searched: ${err.searchedPaths.join(", ")})\n`
      );
      process.exitCode = 3;
      return;
    }
    if (err instanceof RenderedBodyTooLargeError) {
      process.stderr.write(`RENDER-UNIVERSALS error: ${err.message}\n`);
      process.exitCode = 2;
      return;
    }
    process.stderr.write(`RENDER-UNIVERSALS error: ${String(err)}\n`);
    process.exitCode = 2;
  });
}
