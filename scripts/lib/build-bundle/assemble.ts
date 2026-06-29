import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";

import {
  type BundleInputs,
  type BundleOutput,
  type BundleFrontmatter,
  type FileReadSkipped,
  type DiffStat,
  DEFAULT_SIZE_CAP_BYTES,
  SCHEMA_VERSION,
  SECTION_HEADERS
} from "./types.ts";

const ORPHAN_SLICE = "unknown";
const BUNDLES_REL = path.join(".claude", "artifacts", "crew", "bundles");

function bundleDir(repo: string, sliceId: string): string {
  const slice = sliceId === ORPHAN_SLICE ? "orphan" : sliceId;
  return path.join(repo, BUNDLES_REL, slice);
}

function bundleFile(repo: string, inputs: BundleInputs): string {
  return path.join(
    bundleDir(repo, inputs.sliceId),
    `${inputs.builderName}-${inputs.runId}-build-bundle.md`
  );
}

function isInsideRepo(repo: string, candidate: string): boolean {
  const rel = path.relative(repo, path.resolve(repo, candidate));
  return !rel.startsWith("..") && !path.isAbsolute(rel);
}

function computeDiffStat(repo: string): DiffStat {
  try {
    const out = execFileSync("git", ["diff", "--numstat"], {
      cwd: repo,
      encoding: "utf8"
    });
    let files = 0;
    let additions = 0;
    let deletions = 0;
    for (const line of out.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [a, d] = line.split(/\s+/, 2);
      const aNum = Number(a);
      const dNum = Number(d);
      if (Number.isFinite(aNum)) additions += aNum;
      if (Number.isFinite(dNum)) deletions += dNum;
      files += 1;
    }
    return { files, additions, deletions };
  } catch {
    return { files: 0, additions: 0, deletions: 0 };
  }
}

function gitDiff(repo: string): string {
  try {
    return execFileSync("git", ["diff"], { cwd: repo, encoding: "utf8" });
  } catch {
    return "";
  }
}

interface SectionBuild {
  body: string;
  skipped: FileReadSkipped[];
}

const BINARY_DETECT_BYTES = 8192;

async function readFileMaybeBinary(
  abs: string
): Promise<{ content: string; isBinary: boolean; size: number; sha?: string }> {
  const stat = await fs.stat(abs);
  const handle = await fs.open(abs, "r");
  try {
    const buf = Buffer.alloc(Math.min(BINARY_DETECT_BYTES, stat.size));
    await handle.read(buf, 0, buf.length, 0);
    if (buf.includes(0)) {
      const all = await fs.readFile(abs);
      const sha = crypto.createHash("sha256").update(all).digest("hex").slice(0, 16);
      return { content: "", isBinary: true, size: stat.size, sha };
    }
  } finally {
    await handle.close();
  }
  const content = await fs.readFile(abs, "utf8");
  return { content, isBinary: false, size: stat.size };
}

async function buildFileListSection(
  repo: string,
  files: string[],
  treatOutsideRepoAsSkip: boolean
): Promise<SectionBuild> {
  const skipped: FileReadSkipped[] = [];
  const sorted = [...files].sort();
  const parts: string[] = [];
  for (const rel of sorted) {
    if (treatOutsideRepoAsSkip && !isInsideRepo(repo, rel)) {
      skipped.push({ path: rel, reason: "outside-repo" });
      continue;
    }
    const abs = path.resolve(repo, rel);
    try {
      const { content, isBinary, size, sha } = await readFileMaybeBinary(abs);
      if (isBinary) {
        parts.push(`### ${rel}\n\n\`\`\`\n<binary file, ${size} bytes, sha=${sha}>\n\`\`\`\n`);
      } else {
        parts.push(`### ${rel}\n\n\`\`\`\n${content}\n\`\`\`\n`);
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        skipped.push({ path: rel, reason: "deleted" });
        continue;
      }
      throw err;
    }
  }
  return { body: parts.join("\n"), skipped };
}

function yamlList(items: string[]): string {
  if (items.length === 0) return "[]";
  return `[${items.map((s) => JSON.stringify(s)).join(", ")}]`;
}

function renderFrontmatter(fm: BundleFrontmatter): string {
  const lines = ["---", `slice: ${fm.slice}`, `builder: ${fm.builder}`, `run_id: ${fm.run_id}`];
  if (fm.feat) lines.push(`feat: ${fm.feat}`);
  lines.push(`files_touched: ${yamlList(fm.files_touched)}`);
  lines.push(`files_read: ${yamlList(fm.files_read)}`);
  if (fm.files_read_skipped && fm.files_read_skipped.length > 0) {
    lines.push("files_read_skipped:");
    for (const s of fm.files_read_skipped) {
      lines.push(`  - { path: ${JSON.stringify(s.path)}, reason: ${s.reason} }`);
    }
  }
  lines.push(
    `diff_stat: { files: ${fm.diff_stat.files}, additions: ${fm.diff_stat.additions}, deletions: ${fm.diff_stat.deletions} }`
  );
  lines.push(`truncated: ${fm.truncated}`);
  lines.push(`truncation_reason: ${fm.truncation_reason ?? "null"}`);
  lines.push(`schema_version: ${fm.schema_version}`);
  lines.push("---");
  return lines.join("\n");
}

async function atomicWrite(file: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, file);
}

export async function assembleBuildBundle(inputs: BundleInputs): Promise<BundleOutput> {
  const cap = inputs.sizeCapBytes ?? DEFAULT_SIZE_CAP_BYTES;

  const touched = await buildFileListSection(inputs.repoPath, inputs.filesTouched, false);
  const read = await buildFileListSection(inputs.repoPath, inputs.filesRead, true);

  const diffStat = computeDiffStat(inputs.repoPath);
  const diffBody = gitDiff(inputs.repoPath);

  // Files that survived in each list (not skipped).
  const survivingTouched = inputs.filesTouched.filter(
    (p) => !touched.skipped.some((s) => s.path === p)
  );
  const survivingRead = inputs.filesRead
    .filter((p) => !read.skipped.some((s) => s.path === p))
    .sort();

  const allSkipped = [...touched.skipped, ...read.skipped];

  let truncated = false;
  let frontmatter: BundleFrontmatter = {
    slice: inputs.sliceId,
    builder: inputs.builderName,
    run_id: inputs.runId,
    ...(inputs.feat !== undefined ? { feat: inputs.feat } : {}),
    files_touched: [...survivingTouched].sort(),
    files_read: survivingRead,
    ...(allSkipped.length > 0 ? { files_read_skipped: allSkipped } : {}),
    diff_stat: diffStat,
    truncated,
    truncation_reason: null,
    schema_version: SCHEMA_VERSION
  };

  const composeBody = (
    handoff: string,
    diff: string,
    touchedBody: string,
    readBody: string
  ): string =>
    [
      renderFrontmatter(frontmatter),
      "",
      SECTION_HEADERS.handoff,
      "",
      handoff,
      SECTION_HEADERS.diff,
      "",
      "```diff",
      diff,
      "```",
      "",
      SECTION_HEADERS.filesTouched,
      "",
      touchedBody,
      SECTION_HEADERS.filesRead,
      "",
      readBody
    ].join("\n");

  let body = composeBody(inputs.handoffBody, diffBody, touched.body, read.body);

  if (Buffer.byteLength(body, "utf8") > cap) {
    truncated = true;
    const dropResult = await truncateFilesReadToFitCap({
      inputs,
      cap,
      frontmatter,
      composeBody,
      diffBody,
      touched,
      body
    });
    frontmatter = dropResult.frontmatter;
    body = dropResult.body;

    if (Buffer.byteLength(body, "utf8") > cap) {
      const touchedDropResult = await truncateFilesTouchedToFitCap({
        inputs,
        cap,
        frontmatter,
        composeBody,
        diffBody,
        body
      });
      frontmatter = touchedDropResult.frontmatter;
      body = touchedDropResult.body;
    }
  }

  const file = bundleFile(inputs.repoPath, inputs);
  await atomicWrite(file, body);
  return {
    path: file,
    bytes: Buffer.byteLength(body, "utf8"),
    truncated,
    filesReadSkipped: allSkipped
  };
}

// Drop files_read entries until the bundle fits under the size cap.
// LRU order if a ledger is available, otherwise the natural files_read order.
async function truncateFilesReadToFitCap(args: {
  inputs: BundleInputs;
  cap: number;
  frontmatter: BundleFrontmatter;
  composeBody: (handoff: string, diff: string, touchedBody: string, readBody: string) => string;
  diffBody: string;
  touched: { body: string };
  body: string;
}): Promise<{ frontmatter: BundleFrontmatter; body: string }> {
  let { frontmatter, body } = args;
  const lru = args.inputs.ledger
    ? [...args.inputs.ledger]
        .sort((a, b) => a.last_read_at.localeCompare(b.last_read_at))
        .map((e) => e.path)
    : [...frontmatter.files_read];
  const keepRead = new Set(frontmatter.files_read);
  while (Buffer.byteLength(body, "utf8") > args.cap && keepRead.size > 0 && lru.length > 0) {
    const drop = lru.shift();
    if (drop) keepRead.delete(drop);
    const filtered = await buildFileListSection(args.inputs.repoPath, [...keepRead], true);
    frontmatter = {
      ...frontmatter,
      files_read: [...keepRead].sort(),
      truncated: true,
      truncation_reason: "size-cap"
    };
    body = args.composeBody(
      args.inputs.handoffBody,
      args.diffBody,
      args.touched.body,
      filtered.body
    );
  }
  return { frontmatter, body };
}

// Drop files_touched entries (alphabetical, last-named first) until under cap.
async function truncateFilesTouchedToFitCap(args: {
  inputs: BundleInputs;
  cap: number;
  frontmatter: BundleFrontmatter;
  composeBody: (handoff: string, diff: string, touchedBody: string, readBody: string) => string;
  diffBody: string;
  body: string;
}): Promise<{ frontmatter: BundleFrontmatter; body: string }> {
  let { frontmatter, body } = args;
  const keepTouched = [...frontmatter.files_touched].sort();
  while (Buffer.byteLength(body, "utf8") > args.cap && keepTouched.length > 0) {
    keepTouched.pop();
    const filtered = await buildFileListSection(args.inputs.repoPath, keepTouched, false);
    frontmatter = {
      ...frontmatter,
      files_touched: keepTouched,
      truncated: true,
      truncation_reason: "size-cap"
    };
    body = args.composeBody(args.inputs.handoffBody, args.diffBody, filtered.body, "");
  }
  return { frontmatter, body };
}
