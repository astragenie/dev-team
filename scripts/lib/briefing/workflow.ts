import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { parseFrontmatter } from "@astragenie/plugin-std";
import { getCachedArtifact } from "../artifact-cache.mjs";
import { pathExists } from "../fs-utils.ts";

const execFile = promisify(execFileCallback);

// ---------------------------------------------------------------------------
// Exported interfaces
// ---------------------------------------------------------------------------

export interface ArtifactSummary {
  path: string;
  title: string;
  updatedAt: string;
  goal: string;
  mode: string;
  next: string;
  findings: unknown;
}

export interface ArtifactEntry {
  kind: string;
  label: string;
  title: string;
  updatedAt: string;
  path: string;
  goal?: string;
  mode?: string;
  next?: string;
  findings?: unknown;
}

export interface WakeUpBriefLike {
  latestArtifacts?: Record<string, unknown>;
  workflowState?: {
    currentRun?: {
      artifacts?: {
        runBrief?: string;
        finalSynthesis?: string;
        reviewResult?: string;
        validationPlan?: string;
        validationResult?: string;
        deploymentChecks?: { dev?: string; prod?: string };
        handoffs?: string[];
      };
    };
  };
  hookHealth?: unknown;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function collectArtifactActivity(wakeUpBrief: WakeUpBriefLike): ArtifactEntry[] {
  const labels: Record<string, string> = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };

  return Object.entries(wakeUpBrief.latestArtifacts ?? {})
    .filter(([, artifact]) => Boolean(artifact))
    .map(([kind, artifact]) => {
      const a = artifact as { title?: string; updatedAt?: string; path?: string };
      return {
        kind,
        label: labels[kind] ?? kind,
        title: a.title ?? "",
        updatedAt: a.updatedAt ?? "",
        path: a.path ?? ""
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function extractMarkdownField(body: string, label: string): string {
  const match = body.match(new RegExp(`^\\*\\*${label}\\*\\*:\\s*(.+)$`, "m"));
  return match ? (match[1] ?? "").trim() : "";
}

// getCachedArtifact's `body` is the raw, unstripped file text (fm + body
// together) — strip the fence here for heading extraction only. parseFrontmatter
// throws on an unterminated fence; fall back to the 3-char slice the old
// `body.slice(body.indexOf("\n---", 3) + 4)` one-liner produced in that case
// (indexOf returns -1, so -1 + 4 = 3) so malformed input degrades identically.
function stripFrontmatterBody(raw: string): string {
  if (!raw.startsWith("---")) return raw;
  try {
    return parseFrontmatter(raw).body;
  } catch {
    return raw.slice(3);
  }
}

async function readArtifactSummary(
  filePath: string,
  fallbackTitle = ""
): Promise<ArtifactSummary | null> {
  if (!filePath) return null;
  let cached;
  try {
    cached = await getCachedArtifact(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  const { fm, body, mtimeMs } = cached;
  const bodyAfterFm = stripFrontmatterBody(body);
  const [heading = ""] = bodyAfterFm.split("\n");
  return {
    path: filePath,
    title: heading.replace(/^#\s+/, "").trim() || fallbackTitle,
    updatedAt: new Date(mtimeMs).toISOString(),
    goal: extractMarkdownField(body, "Goal"),
    mode: extractMarkdownField(body, "Mode"),
    next: extractMarkdownField(body, "Next"),
    findings: (fm as Record<string, unknown>)["findings"] ?? null
  };
}

async function resolveRunArtifacts(
  runArtifacts: {
    runBrief?: string;
    finalSynthesis?: string;
    reviewResult?: string;
    validationPlan?: string;
    validationResult?: string;
    deploymentChecks?: { dev?: string; prod?: string };
    handoffs?: string[];
  },
  labels: Record<string, string>
): Promise<ArtifactEntry[]> {
  const candidates: Array<[string, string | undefined]> = [
    ["runBrief", runArtifacts.runBrief],
    ["finalSynthesis", runArtifacts.finalSynthesis],
    ["review", runArtifacts.reviewResult],
    ["validationPlan", runArtifacts.validationPlan],
    ["validationResult", runArtifacts.validationResult],
    ["deploymentCheck", runArtifacts.deploymentChecks?.dev ?? runArtifacts.deploymentChecks?.prod],
    ["handoff", runArtifacts.handoffs?.slice(-1)[0]]
  ];
  const summaries = await Promise.all(
    candidates.map(async ([kind, artifactPath]): Promise<ArtifactEntry | null> => {
      const summary = await readArtifactSummary(artifactPath ?? "");
      if (!summary) return null;
      return {
        kind,
        label: labels[kind] ?? kind,
        title: summary.title,
        updatedAt: summary.updatedAt,
        path: summary.path,
        goal: summary.goal,
        mode: summary.mode,
        next: summary.next,
        findings: summary.findings ?? null
      };
    })
  );
  return summaries.filter((s): s is ArtifactEntry => s !== null);
}

export async function findAutonomousLoopCli(): Promise<string | null> {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"];
  if (!home) return null;
  const cacheDirs = [
    `${home}/.claude/plugins/cache/astra/loop`,
    `${home}/.claude/plugins/cache/autonomous-loop-dev/autonomous-loop`,
    `${home}/.claude/plugins/cache/autonomous-loop/autonomous-loop`
  ];
  const { promises: fsLocal } = await import("node:fs");
  const perDirCandidates = await Promise.all(
    cacheDirs.map(async (cacheDir): Promise<string | null> => {
      let entries: string[];
      try {
        entries = await fsLocal.readdir(cacheDir);
      } catch {
        return null;
      }
      const versions = entries.sort().reverse();
      for (const v of versions) {
        const newName = `${cacheDir}/${v}/scripts/loop.mjs`;
        const legacyName = `${cacheDir}/${v}/scripts/autonomous-loop.mjs`;
        if (await pathExists(newName)) return newName;
        if (await pathExists(legacyName)) return legacyName;
      }
      return null;
    })
  );
  return perDirCandidates.find((c) => c !== null) ?? null;
}

// ---------------------------------------------------------------------------
// Exported collectors (with FEAT-129 Promise.all verbatim)
// ---------------------------------------------------------------------------

export async function collectRelevantArtifacts(
  wakeUpBrief: WakeUpBriefLike
): Promise<ArtifactEntry[]> {
  const runArtifacts = wakeUpBrief.workflowState?.currentRun?.artifacts;
  if (!runArtifacts) {
    return collectArtifactActivity(wakeUpBrief);
  }

  const labels: Record<string, string> = {
    runBrief: "Run brief",
    finalSynthesis: "Final synthesis",
    handoff: "Handoff",
    review: "Review result",
    validationPlan: "Validation plan",
    validationResult: "Validation result",
    deploymentCheck: "Deployment check"
  };
  const present = await resolveRunArtifacts(runArtifacts, labels);
  return present.length > 0 ? present : collectArtifactActivity(wakeUpBrief);
}

export async function fetchAutonomousLoopBrief(repoPath: string): Promise<unknown> {
  try {
    const cli = await findAutonomousLoopCli();
    if (!cli) return null;
    const { stdout } = await execFile("node", [cli, "brief", "--repo", repoPath], {
      maxBuffer: 1024 * 1024
    });
    return JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
}
