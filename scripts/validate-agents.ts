#!/usr/bin/env node

// Agent prompt quality-bar verifier. See docs/governance.md
// "Agent prompt size bar" + FEAT-035 for the rule rationale.
//
// Errors (fail CI):
//   - missing required frontmatter: name, description, model
//   - <role>.md exceeds 350 lines (default; per-agent `maxLines:` frontmatter overrides)
//   - missing required body section: identity intro + "## Report contract"
//   - duplicate agent name across the directory
//   - file name does not match frontmatter `name`
//
// The 350-line default cap balances room for cross-cutting sections
// (context efficiency, shell pre-check, depth control) against bloat.
// Lines beyond the cap should push to a skill the agent invokes on demand.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");
const MAX_LINES = 350;

function parseFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (kv) fm[kv[1] as string] = (kv[2] ?? "").trim();
  }
  return fm;
}

async function findAgentFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.join(root, entry.name));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return out;
}

function checkRequiredFields(fm: Record<string, string>, label: string, errors: string[]) {
  for (const field of ["name", "description", "model"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

function checkFileName(
  filePath: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  if (!fm["name"]) return;
  const baseName = path.basename(filePath, ".md");
  if (baseName !== fm["name"]) {
    errors.push(
      `${label}: file name "${baseName}.md" does not match frontmatter name "${fm["name"]}"`
    );
  }
}

function checkLineCount(text: string, fm: Record<string, string>, label: string, errors: string[]) {
  const lines = text.split("\n").length;
  const cap = fm["maxLines"] ? parseInt(fm["maxLines"], 10) : MAX_LINES;
  if (lines > cap) {
    errors.push(`${label}: ${lines} lines exceeds the ${cap}-line agent prompt cap`);
  }
}

function checkRequiredSections(
  text: string,
  _fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  if (!/^##\s+Report contract\b/im.test(text)) {
    errors.push(`${label}: missing required section "## Report contract"`);
  }
  // Identity intro = a non-frontmatter "You are the <role>" or "You are a <role>"
  // statement somewhere in the body. Loose check; relies on convention.
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  if (!/\byou are (?:the|a|an) [\w-]+/i.test(body)) {
    errors.push(`${label}: missing identity intro ("You are the/a <role>" statement)`);
  }
}

// FEAT-163 SLICE-71 + SLICE-73 + SLICE-75: agents that explicitly carry the Agent tool in
// their frontmatter `tools:` list MUST also carry a `## Peer dispatch` section
// with whitelist, blacklist, and budget lines. SLICE-71 added document-writer
// and refactor (SLICE-A). SLICE-73 adds the advisory tier (SLICE-B):
// architect, uxdesigner, qa-expert, performance-engineer. SLICE-75 adds the
// implementer + release-engineer tier (SLICE-C/D):
// backend-dev, frontend-dev, fullstack-dev, release-engineer.
//
// Rule fires ONLY when:
//   (a) agent name is in PEER_DISPATCH_ALLOWLIST, AND
//   (b) the agent frontmatter `tools:` block explicitly includes "Agent"
//
// Rationale for (b): the rule parses the raw YAML tools list from frontmatter.
// Agents that do not declare `tools:` explicitly (e.g. they inherit "All tools"
// via subagent configuration) are not checked — avoids false-positives on
// agents not yet scoped for peer dispatch. Only agents with explicit `tools:`
// including `Agent` are caught.
//
// Note: backend-dev and frontend-dev carry `disallowedTools: Agent` (not `tools:`)
// so the rule correctly does not fire for them at runtime. Their Peer dispatch
// sections are forward-looking documentation for when the restriction is lifted.
const PEER_DISPATCH_ALLOWLIST = new Set([
  "document-writer",
  "refactor",
  "architect",
  "uxdesigner",
  "qa-expert",
  "performance-engineer",
  "backend-dev",
  "frontend-dev",
  "fullstack-dev",
  "release-engineer"
]);

function parseFrontmatterTools(text: string): string[] {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return [];
  const fmBlock = match[1];
  // Inline YAML array format: tools: [Read, Grep, Agent]
  const inlineMatch = fmBlock.match(/^tools:\s*\[(.*?)\]\s*$/m);
  if (inlineMatch && inlineMatch[1] !== undefined) {
    return inlineMatch[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  // Block-list format:
  //   tools:
  //     - Read
  //     - Agent
  const toolsMatch = fmBlock.match(/^tools:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m);
  if (!toolsMatch || toolsMatch[1] === undefined) return [];
  return toolsMatch[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function checkPeerDispatchSection(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !PEER_DISPATCH_ALLOWLIST.has(name)) return;
  const tools = parseFrontmatterTools(text);
  if (!tools.includes("Agent")) return;
  // Agent tool present — enforce Peer dispatch section structure
  const hasPeerDispatchHeading = /##\s+Peer dispatch/i.test(text);
  if (!hasPeerDispatchHeading) {
    errors.push(
      `${label}: has "Agent" in tools: but missing "## Peer dispatch" section (FEAT-163)`
    );
    return; // no point checking sub-structure if heading absent
  }
  // Must have at least one whitelist entry (a bullet under the heading).
  // Tightened (FEAT-163 SLICE-73 inspector MEDIUM): split `afterPeerDispatch`
  // at the "MUST NOT dispatch" boundary so that backtick-formatted blacklist
  // entries do NOT satisfy the whitelist-entry check. Only the content BEFORE
  // the blacklist region is tested for "- `peer`" bullets.
  const peerDispatchIdx = text.search(/##\s+Peer dispatch/i);
  const afterPeerDispatch = text.slice(peerDispatchIdx);
  const blacklistSplitIdx = afterPeerDispatch.search(/MUST NOT dispatch/i);
  const whitelistRegion =
    blacklistSplitIdx > -1 ? afterPeerDispatch.slice(0, blacklistSplitIdx) : afterPeerDispatch;
  const hasWhitelistEntry = /\n- `[^`]+`/.test(whitelistRegion);
  if (!hasWhitelistEntry) {
    errors.push(
      `${label}: "## Peer dispatch" section missing whitelist entry (at least one "- \`peer\`" bullet) (FEAT-163)`
    );
  }
  // Must have explicit blacklist ("MUST NOT dispatch" or "You MUST NOT")
  const hasBlacklist = /MUST NOT dispatch/i.test(afterPeerDispatch);
  if (!hasBlacklist) {
    errors.push(
      `${label}: "## Peer dispatch" section missing blacklist ("MUST NOT dispatch") (FEAT-163)`
    );
  }
  // Must have dispatch budget line
  const hasBudget =
    /max \d+ peer dispatch/i.test(afterPeerDispatch) ||
    /Dispatch budget per slice/i.test(afterPeerDispatch);
  if (!hasBudget) {
    errors.push(
      `${label}: "## Peer dispatch" section missing dispatch budget line ("max N per slice") (FEAT-163)`
    );
  }
}

// FEAT-167 SLICE-A: agents whose role participates in the eval harness.
// These agents MUST carry an `evals:` field (string; path existence NOT checked
// this slice — enforced in SLICE-B).
// TODO(FEAT-167 SLICE-B): enforce path existence here once evals/ tree lands
const EVALS_REQUIRED_AGENT_NAMES = new Set([
  "fullstack-dev", // builder (primary)
  "backend-dev", // builder
  "frontend-dev", // builder
  "refactor", // builder (transform)
  "inspector", // reviewer
  "inspector-verifier", // reviewer + validator
  "verifier", // validator
  "integrator", // validator (merge gate)
  "release-engineer" // deployer
]);

// FEAT-167 SLICE-A: validate prompt_id (kebab-slug) and version (semver).
function checkPromptIdAndVersion(fm: Record<string, string>, label: string, errors: string[]) {
  const promptId = fm["prompt_id"];
  if (!promptId) {
    errors.push(`${label}: missing required frontmatter "prompt_id"`);
  } else if (!/^[a-z][a-z0-9-]*$/.test(promptId) || /--/.test(promptId) || promptId.endsWith("-")) {
    errors.push(
      `${label}: prompt_id "${promptId}" must be kebab-slug ([a-z0-9-]+, no leading/trailing -)`
    );
  }
  const version = fm["version"];
  if (!version) {
    errors.push(`${label}: missing required frontmatter "version"`);
  } else if (!/^\d+\.\d+\.\d+$/.test(version)) {
    errors.push(`${label}: version "${version}" must be semver MAJOR.MINOR.PATCH`);
  }
}

// FEAT-167 SLICE-A: validate evals field for EVALS_REQUIRED agents.
// TODO(FEAT-167 SLICE-B): enforce path existence here once evals/ tree lands
function checkEvalsRequiredForRole(fm: Record<string, string>, label: string, errors: string[]) {
  const name = fm["name"];
  if (name === undefined || !EVALS_REQUIRED_AGENT_NAMES.has(name)) return;
  const evals = fm["evals"];
  if (!evals || evals.trim() === "") {
    errors.push(
      `${label}: agent name "${name}" requires "evals" frontmatter field (FEAT-167 SLICE-A — path existence enforced in SLICE-B)`
    );
  }
}

// FEAT-155: primary agents most exposed to TaskUpdate burst churn must carry
// the batching rule. Light role-list — the cost-advisor SLICE-67 baseline
// flagged these as the highest TaskUpdate cache-prime contributors.
const TASK_UPDATE_BATCHING_REQUIRED = new Set([
  "fullstack-dev",
  "inspector",
  "verifier",
  "architect"
]);

function checkTaskUpdateBatching(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !TASK_UPDATE_BATCHING_REQUIRED.has(name)) return;
  if (!/TaskUpdate batching/i.test(text)) {
    errors.push(
      `${label}: missing "TaskUpdate batching" rule (FEAT-155). Primary agents most exposed to burst churn must carry the rule.`
    );
  }
}

// FEAT-157: primary agents that issue Bash regularly must carry the
// coalescing rule. SLICE-67 measured 305 Bash calls/slice at ~4.86x
// cache-prime ratio = 1.15M cache_create tokens. Rule cuts call count
// ~40% by chaining pure data-collection commands.
//
// 'lead' is NOT in this set — lead.md frontmatter excludes Bash (lead is
// pure dispatcher; the slice-close CLI sequence runs from crew:document-writer
// per the lead-dispatch-discipline diagnostic plan).
const BASH_COALESCING_REQUIRED = new Set([
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "inspector",
  "verifier",
  "architect",
  "release-engineer",
  "integrator",
  "researcher"
]);

function checkBashCoalescing(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !BASH_COALESCING_REQUIRED.has(name)) return;
  if (!/Coalesce Bash calls/i.test(text)) {
    errors.push(
      `${label}: missing "Coalesce Bash calls" rule (FEAT-157). Primary agents issuing Bash regularly must carry the rule.`
    );
  }
}

// Backlog-id discipline: agent prompts must not embed FEAT-NNN / DEC-NNN /
// SLICE-NN references — ids rot, skill pointers don't. Applied as a hard
// gate only to agents in NO_BACKLOG_IDS_REQUIRED (the prompts that have
// already been swept). Other agents emit no error so CI stays green while
// the cleanup fans out. Expand the allowlist as each agent is cleaned.
//
// Implementation note: the validator scans the entire file (frontmatter +
// body). Frontmatter does not legitimately carry FEAT-NNN ids — eval paths
// follow `evals/agents/<role>.yaml`, not backlog ids — so scanning whole-
// file is safe and catches stray ids that slip into prompt_id / version
// comments or anywhere else.
const NO_BACKLOG_IDS_REQUIRED = new Set([
  "backend-dev",
  "frontend-dev",
  "fullstack-dev",
  "aiplugin-dev",
  "inspector"
]);

function checkNoBacklogIds(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !NO_BACKLOG_IDS_REQUIRED.has(name)) return;
  const matches = text.match(/\b(FEAT-\d+|DEC-\d+|SLICE-\d+)\b/g);
  if (matches && matches.length > 0) {
    const uniq = [...new Set(matches)].sort();
    errors.push(
      `${label}: backlog ids must not appear in agent prompts (ids rot; cite skills instead). Found: ${uniq.join(", ")}`
    );
  }
}

// Hard cut: active agents must not contain lead-agent caller assumptions.
// Applied to all active agents in agents/*.md (not agents/3rdparty/).
// Catches phrases like "the lead", "to the lead", "by the lead", "crew:lead"
// in agent bodies. These assumptions broke when lead was removed.
const NO_LEAD_REF_REQUIRED = new Set([
  "architect",
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "aiplugin-dev",
  "inspector",
  "inspector-verifier",
  "verifier",
  "integrator",
  "release-engineer",
  "document-writer",
  "refactor",
  "researcher",
  "investigator",
  "qa-expert",
  "performance-engineer",
  "uxdesigner",
  "parallel-runner",
  "c-sharp-reviewer",
  "typescript-reviewer",
  "dev-lite",
  "inspector-lite"
]);

function checkNoLeadRef(text: string, fm: Record<string, string>, label: string, errors: string[]) {
  const name = fm["name"];
  if (name === undefined || !NO_LEAD_REF_REQUIRED.has(name)) return;
  // Strip frontmatter before checking
  const body = text.replace(/^---[\s\S]*?---\n/, "");
  const matches = body.match(/\bthe lead\b|\bto the lead\b|\bby the lead\b|\bcrew:lead\b/gi);
  if (matches?.length) {
    errors.push(
      `${label}: must not reference 'lead' agent. Found: ${[...new Set(matches)].join(", ")}`
    );
  }
}

/**
 * SLICE-76 FEAT-153: detect drift between the marker hash in the injected
 * pre-loaded-universals block and the rendered hash. Skips agents without
 * the marker. Tolerates absence of the universals source cache (CI may not
 * have plugin caches) via advisory note rather than hard error.
 */
/**
 * Cached at module scope so we compute the expected hash once per validator run.
 * `null` means "not yet checked"; `""` means "source cache absent — skip drift check".
 */
let cachedExpectedHash: string | null = null;

async function getExpectedUniversalsHash(): Promise<string> {
  if (cachedExpectedHash !== null) return cachedExpectedHash;
  const { spawnSync } = await import("node:child_process");
  const scriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "render-universal-skills.ts"
  );
  const res = spawnSync("bun", [scriptPath, "--print-hash"], { encoding: "utf8" });
  if (res.status !== 0) {
    cachedExpectedHash = ""; // CI / source-cache absent → skip drift check
    return cachedExpectedHash;
  }
  cachedExpectedHash = (res.stdout ?? "").trim();
  return cachedExpectedHash;
}

// SLICE-76 FEAT-153: explicit allowlist of agents that MUST carry the
// pre-loaded-universals block. Mirrors PEER_DISPATCH_ALLOWLIST. SLICE-77
// will expand this as the fan-out injects the remaining agents.
const UNIVERSALS_DRIFT_REQUIRED = new Set(["verifier"]);

async function checkUniversalsHash(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !UNIVERSALS_DRIFT_REQUIRED.has(name)) return;
  const beginRe = /<!-- pre-loaded-universals:BEGIN hash=([0-9a-f]{64}) -->/;
  const m = text.match(beginRe);
  if (!m) {
    errors.push(
      `${label}: agent is in UNIVERSALS_DRIFT_REQUIRED but missing pre-loaded-universals marker. ` +
        `Inject via: bun scripts/render-universal-skills.ts --inject agents/${name}.md`
    );
    return;
  }
  const foundHash = m[1];
  if (foundHash === undefined) return; // regex guarantee, but satisfy strict TS
  const expectedHash = await getExpectedUniversalsHash();
  if (expectedHash === "") return; // advisory: source cache absent
  if (foundHash !== expectedHash) {
    errors.push(
      `${label}: pre-loaded-universals hash drift — found ${foundHash}, expected ${expectedHash}. ` +
        `Re-render via: bun scripts/render-universal-skills.ts --inject ${label}`
    );
  }
}

function checkDuplicateNames(
  agents: Array<{ label: string; fm: Record<string, string> | null }>,
  errors: string[]
) {
  const byName = new Map<string, string>();
  for (const a of agents) {
    if (!a.fm?.["name"]) continue;
    const name = a.fm["name"];
    if (byName.has(name)) {
      errors.push(`duplicate agent name "${name}" at ${a.label} and ${byName.get(name)}`);
    } else {
      byName.set(name, a.label);
    }
  }
}

export async function validateAgents(agentsRoot = AGENTS_ROOT) {
  const files = await findAgentFiles(agentsRoot);
  const errors: string[] = [];
  const agents: Array<{
    label: string;
    filePath: string;
    fm: Record<string, string>;
    text: string;
  }> = [];

  for (const filePath of files) {
    const label = path.relative(path.dirname(agentsRoot), filePath).replace(/\\/g, "/");
    const text = await fs.readFile(filePath, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm) {
      errors.push(`${label}: missing or malformed frontmatter block`);
      continue;
    }
    agents.push({ label, filePath, fm, text });
    checkRequiredFields(fm, label, errors);
    checkPromptIdAndVersion(fm, label, errors);
    checkEvalsRequiredForRole(fm, label, errors);
    checkFileName(filePath, fm, label, errors);
    checkLineCount(text, fm, label, errors);
    checkRequiredSections(text, fm, label, errors);
    checkTaskUpdateBatching(text, fm, label, errors);
    checkBashCoalescing(text, fm, label, errors);
    checkNoBacklogIds(text, fm, label, errors);
    checkNoLeadRef(text, fm, label, errors);
    checkPeerDispatchSection(text, fm, label, errors);
    await checkUniversalsHash(text, fm, label, errors);
  }
  checkDuplicateNames(agents, errors);
  return { ok: errors.length === 0, errors, agentCount: agents.length };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateAgents();
  if (!result.ok) {
    console.error(`Agent validation failed: ${result.errors.length} error(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`Agents OK: ${result.agentCount} agent(s) checked.`);
  }
}
