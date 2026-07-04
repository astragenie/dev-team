#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { maybeEmitCostReport } from "./lib/cost-hygiene/emit-cost-report.ts";
import { costSliceHandler } from "./lib/cost-hygiene/cost-slice-handler.ts";
import { normalizeMsysPath } from "./lib/fs-utils.ts";
import { assertBunPresent } from "./lib/installer/bun-preflight.ts";

// Flag schema. Each entry maps a CLI flag to the flags-object key and the
// arity (whether it consumes a value). Aliases (e.g. `--verdict` → `decision`)
// are supported by giving two entries the same target key. parseArgs() drives
// off this table instead of a 350-line if-chain.
//
// Keep entries alphabetized within each arity group for diffability.
const FLAG_SPEC = {
  // Boolean flags (no value).
  "--aggregate-all": { key: "aggregateAll", boolean: true },
  "--allow-existing": { key: "allowExisting", boolean: true },
  "--artifact-only": { key: "artifactOnly", boolean: true },
  "--force": { key: "force", boolean: true },
  "--help": { key: "help", boolean: true },
  "-h": { key: "help", boolean: true },
  "--live": { key: "live", boolean: true },
  "--no-self": { key: "noSelf", boolean: true },
  "--non-code": { key: "nonCode", boolean: true },
  "--repo-context": { key: "repoContext", boolean: true },
  "--scaffold": { key: "scaffold", boolean: true },
  "--validate": { key: "validate", boolean: true },
  // Value-consuming flags.
  "--agent": { key: "agent" },
  "--alerts": { key: "alerts" },
  "--budget": { key: "budget" },
  "--approver": { key: "approver" },
  "--badge": { key: "badge" },
  "--blocked-by": { key: "blockedBy" },
  "--build": { key: "build" },
  "--builder": { key: "builder" },
  "--clues": { key: "clues" },
  "--commit-pattern": { key: "commitPattern" },
  "--completed-at": { key: "completedAt" },
  "--confidence": { key: "confidence" },
  "--decision": { key: "decision" },
  "--deliverable": { key: "deliverable" },
  "--deploy": { key: "deploy" },
  "--deployer": { key: "deployer" },
  "--discovery-status": { key: "discoveryStatus" },
  "--environment": { key: "environment" },
  "--environments": { key: "environments" },
  "--evidence": { key: "evidence" },
  "--external-deltas": { key: "externalDeltas" },
  "--extra-root": { key: "extraRoot" },
  "--feat": { key: "feat" },
  "--feature": { key: "feature" },
  "--features": { key: "features" },
  "--files": { key: "files" },
  "--files-read": { key: "filesRead" },
  "--findings": { key: "findings" },
  "--from": { key: "from" },
  "--goal": { key: "goal" },
  "--handoff": { key: "handoff" },
  "--id": { key: "id" },
  "--k": { key: "gepaK" },
  "--kind": { key: "kind" },
  "--logs": { key: "logs" },
  "--metrics": { key: "metrics" },
  "--missing": { key: "missing" },
  "--mode": { key: "mode" },
  "--next": { key: "next" },
  "--note": { key: "note" },
  "--out-of-scope": { key: "outOfScope" },
  "--out": { key: "out" },
  "--owner": { key: "owner" },
  "--pace": { key: "pace" },
  "--phase": { key: "phase" },
  "--preset": { key: "preset" },
  "--reason": { key: "reason" },
  "--refresh-when": { key: "refreshWhen" },
  "--repo": { key: "repo" },
  "--requester": { key: "requester" },
  "--resolver": { key: "resolver" },
  "--resource": { key: "resource" },
  "--revision": { key: "revision" },
  "--reviewer": { key: "reviewer" },
  "--reviewer-label": { key: "reviewerLabel" },
  "--risks": { key: "risks" },
  "--run": { key: "run" },
  "--run-steps": { key: "runSteps" },
  "--run-title": { key: "runTitle" },
  "--source": { key: "gepaSource" },
  "--source-project": { key: "sourceProject" },
  "--scope": { key: "scope" },
  "--limit": { key: "limit" },
  "--judge": { key: "judge" },
  "--split": { key: "split" },
  "--severity": { key: "severity" },
  "--slice": { key: "slice" },
  "--started-at": { key: "startedAt" },
  "--status": { key: "status" },
  "--summary": { key: "summary" },
  "--telemetry": { key: "telemetry" },
  "--test-summary": { key: "testSummary" },
  "--test-summary-skip-reason": { key: "testSummarySkipReason" },
  "--tier": { key: "tier" },
  "--title": { key: "title" },
  "--to": { key: "to" },
  "--trigger-filename": { key: "triggerFilename" },
  "--update": { key: "updatePath" },
  "--url": { key: "url" },
  "--validation-evidence": { key: "validationEvidence" },
  "--validator": { key: "validator" },
  "--verdict": { key: "decision" }, // alias of --decision
  "--verified-from": { key: "verifiedFrom" },
  "--weeks": { key: "weeks" },
  "--window": { key: "window" },
  "--role": { key: "role" },
  "--surface": { key: "surface" },
  "--stack": { key: "stack" },
  "--concern": { key: "concern" },
  "--lens": { key: "lens" },
  "--since": { key: "since" },
  "--tag": { key: "tag" }
} as const;

type FlagSpecValues = (typeof FLAG_SPEC)[keyof typeof FLAG_SPEC];
type FlagKey = Exclude<FlagSpecValues["key"], "repo">;
type Flags = {
  [K in FlagKey]: Extract<FlagSpecValues, { key: K }> extends { boolean: true }
    ? boolean
    : string | null;
} & { repo: string } & { [key: string]: string | boolean | null };

function buildDefaultFlags(): Flags {
  return {
    repo: process.cwd(),
    allowExisting: false,
    help: false,
    force: false,
    owner: null,
    requester: null,
    approver: null,
    resolver: null,
    kind: null,
    severity: null,
    summary: null,
    reason: null,
    note: null,
    status: "open",
    id: null,
    decision: null,
    title: null,
    goal: null,
    mode: null,
    pace: null,
    scope: null,
    outOfScope: null,
    files: null,
    evidence: null,
    externalDeltas: null,
    risks: null,
    runSteps: null,
    next: null,
    from: null,
    to: null,
    deliverable: null,
    confidence: null,
    reviewer: null,
    validator: null,
    deployer: null,
    environment: null,
    build: null,
    deploy: null,
    environments: null,
    logs: null,
    metrics: null,
    alerts: null,
    telemetry: null,
    clues: null,
    discoveryStatus: null,
    verifiedFrom: null,
    missing: null,
    refreshWhen: null,
    resource: null,
    url: null,
    revision: null,
    badge: null,
    preset: null,
    commitPattern: null,
    triggerFilename: null,
    reviewerLabel: null,
    startedAt: null,
    completedAt: null,
    runTitle: null,
    sourceProject: null,
    blockedBy: null,
    feature: null,
    features: null,
    nonCode: false,
    noSelf: false,
    aggregateAll: false,
    repoContext: false,
    scaffold: false,
    extraRoot: null,
    phase: null,
    testSummary: null,
    testSummarySkipReason: null,
    findings: null,
    validationEvidence: null,
    builder: null,
    feat: null,
    filesRead: null,
    handoff: null,
    run: null,
    slice: null,
    tier: null,
    updatePath: null,
    agent: null,
    window: null,
    role: null,
    surface: null,
    stack: null,
    concern: null,
    lens: null,
    gepaSource: null,
    limit: null,
    live: false,
    validate: false,
    judge: null,
    split: null,
    out: null,
    weeks: null,
    artifactOnly: false,
    budget: null,
    gepaK: null,
    since: null,
    tag: null
  };
}

// Apply a single token to flags/positionals. Returns the next index to read
// (usually `index + 1` or `index + 2` for value-consuming flags) or -1 to
// signal "stop the parse loop" (encountered `--` end-of-flags separator).
function applyFlagToken(
  rest: string[],
  index: number,
  flags: Flags,
  positionals: string[]
): number {
  const value = rest[index];
  if (value === undefined) return index + 1;
  if (value === "--") {
    for (let tail = index + 1; tail < rest.length; tail += 1) {
      const tailVal = rest[tail];
      if (tailVal !== undefined) positionals.push(tailVal);
    }
    return -1;
  }
  const spec = (FLAG_SPEC as Record<string, { key: string; boolean?: boolean }>)[value];
  if (spec) {
    const flagsRecord = flags as Record<string, string | boolean | null>;
    if (spec.boolean) {
      flagsRecord[spec.key] = true;
      return index + 1;
    }
    flagsRecord[spec.key] = rest[index + 1] ?? null;
    return index + 2;
  }
  if (value.startsWith("--")) {
    throw new Error(`Unknown argument: ${value}`);
  }
  positionals.push(value);
  return index + 1;
}

function resolveCommand(
  command: string | undefined,
  flags: Flags,
  positionals: string[]
): { command: string; helpTarget: string | null; flags: Flags; positionals: string[] } {
  if (!command || command === "--help" || command === "-h") {
    return { command: "help", helpTarget: null, flags, positionals };
  }
  if (flags.help) {
    return { command: "help", helpTarget: command, flags, positionals };
  }
  return { command, helpTarget: null, flags, positionals };
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags = buildDefaultFlags();
  const positionals: string[] = [];

  let index = 0;
  while (index < rest.length) {
    const nextIndex = applyFlagToken(rest, index, flags, positionals);
    if (nextIndex === -1) break;
    index = nextIndex;
  }

  return resolveCommand(command, flags, positionals);
}

function usage(target: string | null = null) {
  const subcommands = {
    "install-global": "  node scripts/crew.mjs install-global",
    audit: "  node scripts/crew.mjs audit --repo <path>",
    bootstrap: "  node scripts/crew.mjs bootstrap --repo <path>",
    init: "  node scripts/crew.mjs init --repo <path> [--allow-existing]",
    claim: "  node scripts/crew.mjs claim --repo <path> [--owner <name>] <files...>",
    release: "  node scripts/crew.mjs release --repo <path> [--owner <name>] [files...]",
    "show-claims": "  node scripts/crew.mjs show-claims --repo <path>",
    "show-conflicts":
      "  node scripts/crew.mjs show-conflicts --repo <path> [--owner <name>] [files...]",
    "request-approval":
      "  node scripts/crew.mjs request-approval --repo <path> --summary <text> [--kind <kind>] [--severity <level>] [--requester <name>] [--approver <name>] [--reason <text>]",
    "show-approvals":
      "  node scripts/crew.mjs show-approvals --repo <path> [--status open|resolved|all] [--approver <name>]",
    "resolve-approval":
      "  node scripts/crew.mjs resolve-approval --repo <path> --id <approval-id> --decision approved|rejected|canceled [--resolver <name>] [--note <text>]",
    "wake-up": "  node scripts/crew.mjs wake-up --repo <path>",
    "brief-me": "  node scripts/crew.mjs brief-me --repo <path>",
    "scope-estimate":
      "  node scripts/crew.mjs scope-estimate --files <path:lines[:eslintDisable],...>",
    "discover-deployment": "  node scripts/crew.mjs discover-deployment --repo <path>",
    "write-deployment-guidance":
      "  node scripts/crew.mjs write-deployment-guidance --repo <path> --title <text> [--discovery-status repo-derived|partial|live-verified] [--verified-from <a,b>] [--missing <a,b>] [--summary <text>] [--build <text>] [--deploy <text>]",
    "show-workflow-state": "  node scripts/crew.mjs show-workflow-state --repo <path>",
    "mark-badge":
      "  node scripts/crew.mjs mark-badge --repo <path> --badge review_required|review_passed|review_failed|review_skipped|validation_expected|validation_passed|validation_failed|validation_skipped|validation_stale|dev_deploy_expected|dev_checked|dev_failed|dev_skipped|prod_deploy_expected|prod_checked|prod_failed|prod_skipped|blocked|specialist_recommended|escalated_to_dispatcher|incident_resolved|rollback_executed [--note <text>] [--blocked-by <artifact-id>] (escalated_to_lead accepted as backward-compat alias)",
    "write-run-brief":
      "  node scripts/crew.mjs write-run-brief --repo <path> --title <text> [--goal <text>] [--mode <mode>] [--pace <pace>]",
    "write-build-bundle":
      "  node scripts/crew.ts write-build-bundle --repo <path> --slice <SLICE-NN> --builder <builder|builder-be|builder-fe> --run <YYYYMMDDTHHMMSSZ> --handoff <path> [--feat <FEAT-NNN>] [--files <a,b>] [--files-read <c,d>]",
    "write-handoff-and-bundle":
      "  node scripts/crew.ts write-handoff-and-bundle --repo <path> --title <text> --summary <text> --files <a,b> --confidence <high|medium|low> [--builder builder|builder-be|builder-fe] [--slice <SLICE-NN>] [--run <YYYYMMDDTHHMMSSZ>] [--feat <FEAT-NNN>] [--files-read <c,d>] [--risks <text>] [--next <text>]",
    "write-handoff":
      "  node scripts/crew.mjs write-handoff --repo <path> --title <text> [--from <role>] [--to <role>] [--files <a,b>]",
    "write-review-result":
      "  node scripts/crew.mjs write-review-result --repo <path> --title <text> [--reviewer <role>] [--decision <decision>] [--verdict <decision>]",
    "write-validation-plan":
      "  node scripts/crew.mjs write-validation-plan --repo <path> --title <text> [--validator <role>] [--environment <name>]",
    "write-validation-result":
      "  node scripts/crew.mjs write-validation-result --repo <path> --title <text> [--validator <role>] [--environment <name>] [--decision <decision>]",
    "write-deployment-check":
      "  node scripts/crew.mjs write-deployment-check --repo <path> --title <text> [--deployer <role>] [--environment dev|prod] [--resource <name>] [--url <service-url>] [--revision <id>] [--decision <decision>]",
    "write-final-synthesis":
      "  node scripts/crew.mjs write-final-synthesis --repo <path> --title <text> --external-deltas <text|none> [--summary <text>] [--run-steps <a,b>] [--files <a,b>] [--force]",
    "cost-slice":
      "  node scripts/crew.mjs cost-slice --repo <path> [--started-at <iso>] [--completed-at <iso>] [--run-title <text>] [--source-project <slug>] [--aggregate-all]",
    "cost-advise": "  node scripts/crew.mjs cost-advise --repo <path>",
    "agent-stats":
      "  node scripts/crew.ts agent-stats [--agent <name>] [--window last_n_slices:<N>] [--repo <path>]",
    "agent-route":
      "  node scripts/crew.ts agent-route [--role <r>] [--surface <s>] [--stack <s>] [--concern <c>] [--lens <l>] [--scope <s>] [--repo <path>]",
    "gepa-history":
      "  node scripts/crew.ts gepa-history <agent> [--source eval|captured|soak] [--limit N] [--repo <path>]",
    "gepa-eval":
      "  node scripts/crew.ts gepa-eval <agent> [--live] [--judge <name>] [--validate] [--split N/M] [--repo <path>]",
    "gepa-mine-reviewer":
      "  node scripts/crew.ts gepa-mine-reviewer [--weeks N] [--out <dir>] [--repo <path>]",
    "gepa-optimize":
      "  node scripts/crew.ts gepa-optimize <agent> --budget <usd> [--k <int>] [--artifact-only] [--repo <path>]",
    "gepa-resume":
      "  node scripts/crew.ts gepa-resume [<agent>] [--repo <path>]\n" +
      "    With <agent>: clears the no-winner streak counter for that agent.\n" +
      "    Without <agent>: clears the global optimize.paused flag in gepa.config.json.",
    "gepa-invalidate":
      "  node scripts/crew.ts gepa-invalidate --agent <name> [--since <iso>] [--tag <tag>] [--repo <path>]",
    "gepa-revert": "  node scripts/crew.ts gepa-revert --agent <name> [--repo <path>]",
    "gepa-thaw": "  node scripts/crew.ts gepa-thaw <agent> [--repo <path>]"
  };

  const subcommandsMap = subcommands as Record<string, string | undefined>;
  if (target && subcommandsMap[target]) {
    return ["Engineering OS installer", "", "Usage:", subcommandsMap[target]].join("\n");
  }

  return ["Engineering OS installer", "", "Usage:", ...Object.values(subcommands)].join("\n");
}

// Slug source priority: explicit --title → advisor target slice → advisor
// target runTitle → fallback "advise". --title lets the loop side pass the
// enriched FEAT/PHASE/SLICE tag so cost-advise filenames match the rest of
// the artifact surface.
function buildCostAdviseSlug(title: string | null, advisor: Record<string, unknown> | null) {
  const t = advisor?.["target"] as { sliceId?: string; runTitle?: string } | null | undefined;
  const source = title || t?.sliceId || t?.runTitle || "advise";
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Optional YAML frontmatter block; "" when both feature + phase absent so
// existing output stays byte-identical for legacy callers.
function buildOptionalFrontmatter(feature: string | null, phase: string | null) {
  const lines = [];
  if (phase !== null && phase !== undefined && String(phase).length > 0) {
    lines.push(`phase: ${JSON.stringify(String(phase))}`);
  }
  if (feature) lines.push(`feature: ${feature}`);
  if (lines.length === 0) return "";
  return ["---", ...lines, "---", ""].join("\n");
}

async function writeCostAdviseArtifact(
  repoPath: string,
  md: string,
  advisor: Record<string, unknown> | null,
  options: { title?: string | null; feature?: string | null; phase?: string | null } = {}
) {
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const { title = null, feature = null, phase = null } = options;
  const dir = pathMod.join(repoPath, ".claude", "artifacts", "crew", "cost-insights");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z");
  const slug = buildCostAdviseSlug(title, advisor);
  const fm = buildOptionalFrontmatter(feature, phase);
  const file = pathMod.join(dir, `${stamp}-cost-advise-${slug}.md`);
  await fs.writeFile(file, fm + md + "\n");
  return file;
}

// Auto-emit a cost-report artifact when a run window is available. Designed
// to be called immediately after write-final-synthesis. Failures here are
// non-fatal: they return null so the synthesis result still surfaces.
// Best-effort cost-advise emit. Returns a description object on success,
// `{ error }` on failure. Extracted from maybeEmitCostReport to keep its
// cyclomatic complexity under the eslint cap.
async function emitCostAdvise(
  repoPath: string,
  { title, feature, phase }: { title: string | null; feature: string | null; phase: string | null }
) {
  try {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.ts");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const advisePath = await writeCostAdviseArtifact(
      repoPath,
      md,
      advisor as unknown as Record<string, unknown>,
      {
        title,
        feature,
        phase
      }
    );
    return {
      path: advisePath,
      recommendations: advisor.recommendations?.length || 0,
      aggregateFlags: advisor.aggregateFlags?.length || 0
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

// Pull a subset of string flags into an args object, mapping null/missing
// to undefined. Keeps dispatch lambdas under the biome cognitive-complexity
// cap by hoisting the `flags.x ?? undefined` chain into a single helper.
function pickFlags<K extends string>(
  flags: Flags,
  keys: readonly K[]
): { [P in K]: string | undefined } {
  const result = {} as { [P in K]: string | undefined };
  const view = flags as Record<string, unknown>;
  for (const key of keys) {
    const value = view[key];
    result[key] = typeof value === "string" ? value : undefined;
  }
  return result;
}

// Resolve a builder name from a flag value, exiting with code 2 if invalid.
// Centralizes the validation that several write-* commands repeat.
function assertBuilderName(
  builder: string,
  command: string
): "fullstack-dev" | "backend-dev" | "frontend-dev" {
  const validBuilders = new Set(["fullstack-dev", "backend-dev", "frontend-dev"]);
  if (!validBuilders.has(builder)) {
    process.stderr.write(
      `[crew] ${command} refused: --builder must be one of ${[...validBuilders].join(", ")}.\n`
    );
    process.exit(2);
  }
  return builder as "fullstack-dev" | "backend-dev" | "frontend-dev";
}

// Split a comma-delimited flag into a trimmed, non-empty string list.
function splitCsv(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Read currentRun.slice from workflow-state.json with a graceful fallback.
async function resolveSliceFromState(repoPath: string, sliceFlag: string | null): Promise<string> {
  if (sliceFlag) return sliceFlag;
  try {
    const fs = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const statePath = pathMod.join(repoPath, ".claude", "state", "crew", "workflow-state.json");
    const state = JSON.parse(await fs.readFile(statePath, "utf8"));
    return state?.currentRun?.slice ?? "unknown";
  } catch {
    return "unknown";
  }
}

// Generate an ISO-like run id when --run is not supplied.
function generateRunId(runFlag: string | null): string {
  if (runFlag) return runFlag;
  return new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

// Assemble the build-bundle around a handoff, recovering gracefully if the
// bundle write fails (handoff path still returns successfully).
async function tryAssembleBundle(input: {
  repoPath: string;
  sliceId: string;
  builderName: "fullstack-dev" | "backend-dev" | "frontend-dev";
  runId: string;
  feat: string | null;
  handoffPath: string;
  filesTouched: string[];
  filesRead: string[];
}): Promise<{ path: string | null; error: string | null }> {
  try {
    const fs = await import("node:fs/promises");
    const { assembleBuildBundle } = await import("./lib/build-bundle/assemble.ts");
    const handoffBody = await fs.readFile(input.handoffPath, "utf8");
    const bundle = await assembleBuildBundle({
      repoPath: input.repoPath,
      sliceId: input.sliceId,
      builderName: input.builderName,
      runId: input.runId,
      ...(input.feat !== null ? { feat: input.feat } : {}),
      handoffBody,
      filesTouched: input.filesTouched,
      filesRead: input.filesRead
    });
    return { path: bundle.path, error: null };
  } catch (e) {
    return { path: null, error: e instanceof Error ? e.message : String(e) };
  }
}

// `write-handoff-and-bundle` body extracted from the dispatch lambda to keep
// cognitive complexity under the biome cap. Writes a handoff via writeArtifact,
// then assembles a build-bundle that references it (non-fatal on bundle error).
async function writeHandoffAndBundle({ repoPath, flags, positionals }: CommandContext): Promise<{
  kind: "handoff-and-bundle";
  handoff: string;
  bundle: string | null;
  bundleError: string | null;
}> {
  const { writeArtifact } = await import("./lib/artifacts/write.ts");
  const r = await writeArtifact(repoPath, "handoff", {
    title: flags.title || positionals.join(" ") || "Task Handoff",
    from: flags.from || flags.owner || "fullstack-dev",
    to: flags.to ?? "lead",
    status: flags.status !== "open" ? (flags.status ?? undefined) : undefined,
    repoContext: flags.repoContext,
    ...pickFlags(flags, [
      "goal",
      "summary",
      "scope",
      "outOfScope",
      "deliverable",
      "files",
      "confidence",
      "risks",
      "next",
      "feature",
      "phase",
      "updatePath"
    ])
  });
  if (!r.ok) throw r.error;
  const handoff = r.value as { path: string };

  const slice = await resolveSliceFromState(repoPath, flags.slice);
  const runId = generateRunId(flags.run);
  const builder = assertBuilderName(flags.builder ?? "fullstack-dev", "write-handoff-and-bundle");

  const bundle = await tryAssembleBundle({
    repoPath,
    sliceId: slice,
    builderName: builder,
    runId,
    feat: flags.feat,
    handoffPath: handoff.path,
    filesTouched: splitCsv(flags.files),
    filesRead: splitCsv(flags.filesRead)
  });

  return {
    kind: "handoff-and-bundle",
    handoff: handoff.path,
    bundle: bundle.path,
    bundleError: bundle.error
  };
}

interface CommandContext {
  repoPath: string;
  flags: Flags;
  positionals: string[];
}

// Command registry. Each entry is `(ctx) => Promise<result>` where
// `ctx = { repoPath, flags, positionals }`. main() dispatches by name; the
// table replaces a 240-line else-if chain. Adding a command = one entry.
const COMMANDS = {
  "install-global": async () => {
    assertBunPresent();
    const { installGlobal } = await import("./lib/installer.ts");
    return installGlobal();
  },
  audit: async ({ repoPath }: CommandContext) => {
    const { auditRepo } = await import("./lib/installer.ts");
    return auditRepo(repoPath);
  },
  bootstrap: async ({ repoPath }: CommandContext) => {
    assertBunPresent();
    const { bootstrapRepo } = await import("./lib/installer.ts");
    const result = await bootstrapRepo(repoPath);
    if (!result.ok) {
      console.error(`Repository path does not exist: ${repoPath}`);
      process.exit(1);
    }
    return result.value;
  },
  init: async ({ repoPath, flags }: CommandContext) => {
    assertBunPresent();
    const { initRepo } = await import("./lib/installer.ts");
    return initRepo(repoPath, { allowExisting: flags.allowExisting });
  },

  claim: async ({ repoPath, flags, positionals }: CommandContext) => {
    const { claimFiles } = await import("./lib/claims.ts");
    const result = await claimFiles(repoPath, positionals, {
      owner: flags.owner || "lead-session"
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },
  release: async ({ repoPath, flags, positionals }: CommandContext) => {
    const { releaseFiles } = await import("./lib/claims.ts");
    const result = await releaseFiles(
      repoPath,
      positionals,
      flags.owner !== null ? { owner: flags.owner } : {}
    );
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },
  "show-claims": async ({ repoPath }: CommandContext) => {
    const { listClaims } = await import("./lib/claims.ts");
    return { claims: await listClaims(repoPath) };
  },
  "show-conflicts": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { inspectClaims } = await import("./lib/claims.ts");
    return inspectClaims(repoPath, positionals, { owner: flags.owner || "lead-session" });
  },

  "request-approval": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { requestApproval } = await import("./lib/approvals.ts");
    return requestApproval(repoPath, {
      requester: flags.requester || "lead-session",
      approver: flags.approver ?? undefined,
      kind: flags.kind || "scope_change",
      severity: flags.severity || "medium",
      summary: flags.summary || positionals.join(" ") || "Approval requested",
      reason: flags.reason || ""
    });
  },
  "show-approvals": async ({ repoPath, flags }: CommandContext) => {
    const { listApprovals } = await import("./lib/approvals.ts");
    return {
      approvals: await listApprovals(repoPath, {
        status: flags.status ?? undefined,
        approver: flags.approver
      })
    };
  },
  "resolve-approval": async ({ repoPath, flags }: CommandContext) => {
    const { resolveApproval } = await import("./lib/approvals.ts");
    const result = await resolveApproval(repoPath, {
      id: flags.id ?? undefined,
      decision: flags.decision ?? undefined,
      resolver: flags.resolver || "lead-session",
      note: flags.note || ""
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return result.value;
  },

  "wake-up": async ({ repoPath }: CommandContext) => {
    const { buildWakeUpBrief } = await import("./lib/wakeup.mjs");
    return buildWakeUpBrief(repoPath);
  },
  "brief-me": async ({ repoPath }: CommandContext) => {
    const { buildBriefingReport } = await import("./lib/briefing.ts");
    return buildBriefingReport(repoPath);
  },
  "scope-estimate": async ({ flags, positionals }: CommandContext) => {
    const { estimateScope } = await import("./lib/scope-estimate.ts");
    const rawFiles = (flags.files || positionals.join(",") || "").split(",").filter(Boolean);
    const files = rawFiles.map((entry) => {
      const [p, linesStr, eslintDisableStr] = entry.split(":");
      return {
        path: p || "",
        lines: parseInt(linesStr ?? "0", 10) || 0,
        eslintDisable: eslintDisableStr === "true"
      };
    });
    return estimateScope({ files });
  },
  fleet: async ({ repoPath, flags }: CommandContext) => {
    const { buildFleetReport } = await import("./lib/fleet.ts");
    return buildFleetReport(repoPath, {
      extraRoots: flags.extraRoot ? [flags.extraRoot] : [],
      includeSelf: !flags.noSelf
    });
  },
  "discover-deployment": async ({ repoPath }: CommandContext) => {
    const { discoverDeploymentClues } = await import("./lib/deployment-guidance/read.ts");
    return discoverDeploymentClues(repoPath);
  },
  "write-deployment-guidance": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeDeploymentGuidance } = await import("./lib/deployment-guidance/write.ts");
    const r = await writeDeploymentGuidance(repoPath, {
      title: flags.title || positionals.join(" ") || "Repo Deployment Model",
      owner: flags.owner || "lead-session",
      ...pickFlags(flags, [
        "summary",
        "build",
        "deploy",
        "environments",
        "logs",
        "metrics",
        "alerts",
        "telemetry",
        "clues",
        "discoveryStatus",
        "verifiedFrom",
        "missing",
        "refreshWhen",
        "next"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },

  "show-workflow-state": async ({ repoPath }: CommandContext) => {
    const { loadWorkflowState, summarizeWorkflowState } = await import("./lib/workflow-state.ts");
    const workflowState = await loadWorkflowState(repoPath);
    return { workflowState, summary: summarizeWorkflowState(workflowState) };
  },
  "mark-badge": async ({ repoPath, flags }: CommandContext) => {
    const { markWorkflowBadge } = await import("./lib/workflow-state.ts");
    const result = await markWorkflowBadge(repoPath, {
      badge: flags.badge ?? undefined,
      note: flags.note || flags.reason || "",
      blockedBy: flags.blockedBy,
      title: flags.title ?? undefined,
      goal: flags.goal ?? undefined,
      mode: flags.mode ?? undefined,
      next: flags.next ?? undefined
    });
    if (!result.ok) {
      console.error(result.error.message);
      process.exit(1);
    }
    return { badge: flags.badge, currentRun: result.value };
  },

  "write-run-brief": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: any = {
      title: flags.title || positionals.join(" ") || "Run Brief",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "active" : (flags.status ?? undefined),
      ...pickFlags(flags, [
        "goal",
        "mode",
        "pace",
        "summary",
        "scope",
        "outOfScope",
        "files",
        "next",
        "feature",
        "phase"
      ])
    };
    if (flags.tier === "full" || flags.tier === "light") {
      fields.tier = flags.tier;
    }
    const r = await writeArtifact(repoPath, "run-brief", fields);
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-build-bundle": async ({ repoPath, flags }: CommandContext) => {
    const { assembleBuildBundle } = await import("./lib/build-bundle/assemble.ts");
    const fs = await import("node:fs/promises");

    const slice = flags.slice ?? "unknown";
    const builder = flags.builder;
    const run = flags.run;
    const handoffPath = flags.handoff;

    if (!builder || !run || !handoffPath) {
      process.stderr.write(
        "[crew] write-build-bundle refused: --builder, --run, and --handoff are required.\n"
      );
      process.exit(2);
    }
    const validBuilders = new Set(["fullstack-dev", "backend-dev", "frontend-dev"]);
    if (!validBuilders.has(builder)) {
      process.stderr.write(
        `[crew] write-build-bundle refused: --builder must be one of ${[...validBuilders].join(", ")}.\n`
      );
      process.exit(2);
    }

    const handoffBody = await fs.readFile(handoffPath, "utf8");
    const filesTouched = (flags.files ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const filesRead = (flags.filesRead ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result = await assembleBuildBundle({
      repoPath,
      sliceId: slice,
      builderName: builder as "fullstack-dev" | "backend-dev" | "frontend-dev",
      runId: run,
      ...(flags.feat !== null ? { feat: flags.feat } : {}),
      handoffBody,
      filesTouched,
      filesRead
    });
    return result.path;
  },
  "write-handoff": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "handoff", {
      title: flags.title || positionals.join(" ") || "Task Handoff",
      from: flags.from || flags.owner || "lead-session",
      // Only pass status if it's not the default "open" value from parseArgs
      // (the default "open" is for issue creation, not for artifacts).
      status: flags.status !== "open" ? (flags.status ?? undefined) : undefined,
      repoContext: flags.repoContext,
      ...pickFlags(flags, [
        "to",
        "goal",
        "summary",
        "scope",
        "outOfScope",
        "deliverable",
        "files",
        "confidence",
        "risks",
        "next",
        "feature",
        "phase",
        "updatePath"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-handoff-and-bundle": async ({ repoPath, flags, positionals }: CommandContext) =>
    writeHandoffAndBundle({ repoPath, flags, positionals }),
  "write-review-result": async ({ repoPath, flags, positionals }: CommandContext) => {
    const decision = flags.decision;
    const VALID_DECISIONS = new Set(["approved", "approved_with_notes", "rejected"]);
    if (decision && !VALID_DECISIONS.has(decision)) {
      process.stderr.write(
        `[crew] write-review-result refused: unknown decision "${decision}". Valid values: approved, approved_with_notes, rejected.\n`
      );
      process.exit(2);
    }
    const isApproved = decision === "approved" || decision === "approved_with_notes";
    const isCodeBearing = !flags.nonCode;
    if (isApproved && isCodeBearing && !flags.testSummary && !flags.testSummarySkipReason) {
      process.stderr.write(
        "[crew] write-review-result refused: --test-summary or --test-summary-skip-reason is required for approved code-bearing reviews. " +
          "Pass --non-code if the diff is doc-only.\n"
      );
      process.exit(2);
    }
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "review-result", {
      title: flags.title || positionals.join(" ") || "Review Result",
      reviewer: flags.reviewer || flags.owner || "reviewer",
      decision: decision ?? undefined,
      // Only pass status if it's not the default "open" value from parseArgs.
      status: flags.status !== "open" ? (flags.status ?? undefined) : undefined,
      nonCode: flags.nonCode ?? undefined,
      findings: flags.findings ?? null,
      scaffold: flags.scaffold ?? undefined,
      ...pickFlags(flags, [
        "summary",
        "evidence",
        "files",
        "risks",
        "next",
        "feature",
        "phase",
        "testSummary",
        "testSummarySkipReason",
        "validationEvidence",
        "updatePath"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-validation-plan": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "validation-plan", {
      title: flags.title || positionals.join(" ") || "Validation Plan",
      validator: flags.validator || flags.owner || "verifier",
      owner: flags.owner || "lead-session",
      ...pickFlags(flags, [
        "environment",
        "goal",
        "summary",
        "scope",
        "outOfScope",
        "evidence",
        "next",
        "feature",
        "phase"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-validation-result": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "validation-result", {
      title: flags.title || positionals.join(" ") || "Validation Result",
      validator: flags.validator || flags.owner || "verifier",
      // Only pass status if it's not the default "open" value from parseArgs.
      status: flags.status !== "open" ? (flags.status ?? undefined) : undefined,
      findings: flags.findings ?? null,
      scaffold: flags.scaffold ?? undefined,
      ...pickFlags(flags, [
        "environment",
        "decision",
        "goal",
        "summary",
        "evidence",
        "files",
        "risks",
        "next",
        "feature",
        "phase",
        "updatePath"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-deployment-check": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const r = await writeArtifact(repoPath, "deployment-check", {
      title: flags.title || positionals.join(" ") || "Deployment Check",
      deployer: flags.deployer || flags.owner || "release-engineer",
      findings: flags.findings ?? null,
      ...pickFlags(flags, [
        "environment",
        "resource",
        "url",
        "revision",
        "decision",
        "goal",
        "summary",
        "evidence",
        "files",
        "risks",
        "next",
        "feature",
        "phase"
      ])
    });
    if (!r.ok) throw r.error;
    return r.value;
  },
  "write-final-synthesis": async ({ repoPath, flags, positionals }: CommandContext) => {
    if (flags.externalDeltas === null || flags.externalDeltas === undefined) {
      throw new Error(
        "write-final-synthesis requires --external-deltas. " +
          "Enumerate sibling-config changes the synthesis depends on " +
          "(env var renames, terraform/helm updates, sibling-repo PRs, feature flags, DB migrations, IAM). " +
          "Pass --external-deltas none explicitly if there are none. " +
          "A silent default is how renamed env vars silently fall back to old defaults in prod."
      );
    }
    const { writeArtifact } = await import("./lib/artifacts/write.ts");
    const synthResult = await writeArtifact(repoPath, "final-synthesis", {
      title: flags.title || positionals.join(" ") || "Final Synthesis",
      owner: flags.owner || "lead-session",
      status: flags.status === "open" ? "completed" : (flags.status ?? undefined),
      force: flags.force ?? undefined,
      ...pickFlags(flags, [
        "summary",
        "files",
        "evidence",
        "externalDeltas",
        "runSteps",
        "risks",
        "next",
        "feature",
        "phase"
      ])
    });
    if (!synthResult.ok) throw synthResult.error;
    const synthesis = synthResult.value;
    const costArtifact = await maybeEmitCostReport(
      repoPath,
      {
        runTitle: flags.title || positionals.join(" ") || null,
        feature: flags.feature,
        phase: flags.phase
      },
      emitCostAdvise
    );
    return costArtifact ? { ...synthesis, costReport: costArtifact } : synthesis;
  },

  "cost-advise": async ({ repoPath, flags }: CommandContext) => {
    const { buildCostAdvisor, renderCostAdvisorMarkdown } = await import("./lib/cost-advisor.ts");
    const advisor = await buildCostAdvisor(repoPath, { limit: 10 });
    const md = renderCostAdvisorMarkdown(advisor);
    const writePath = await writeCostAdviseArtifact(
      repoPath,
      md,
      advisor as unknown as Record<string, unknown>,
      {
        title: flags.title,
        feature: flags.feature,
        phase: flags.phase
      }
    );
    return {
      target: advisor.target?.sliceId || advisor.target?.runTitle || null,
      recommendations: advisor.recommendations,
      aggregateFlags: advisor.aggregateFlags || [],
      baseline: advisor.baseline,
      reportsAnalyzed: advisor.reports.length,
      artifactPath: writePath
    };
  },
  "cost-slice": ({ repoPath, flags }: CommandContext) => costSliceHandler({ repoPath, flags }),

  "cost-setup": async ({ repoPath, flags }: CommandContext) => {
    const { parseFeatureOverrides, runCostSetup } = await import("./lib/cost-setup.ts");
    const featuresFlag = typeof flags.features === "string" ? flags.features : null;
    const overrides = parseFeatureOverrides(featuresFlag);
    return runCostSetup(repoPath, overrides);
  },

  "features-list": async () => {
    const { listFeatures } = await import("./lib/features-service.ts");
    return { features: listFeatures() };
  },

  "agent-stats": async ({ repoPath, flags }: CommandContext) => {
    const { aggregateAgentStats, writeAgentStatsArtifact, windowSlug } = await import(
      "./lib/agent-stats-aggregator.ts"
    );

    // Parse --window flag (default: last_n_slices:10 or env override).
    const rawWindow =
      flags.window ?? `last_n_slices:${process.env["CREW_AGENT_STATS_WINDOW"] ?? "10"}`;
    const windowMatch = /^last_n_slices:(\d+)$/.exec(rawWindow);
    if (!windowMatch) {
      process.stderr.write(
        `[crew] agent-stats: unsupported window spec "${rawWindow}". Expected last_n_slices:<N>.\n`
      );
      process.exit(2);
    }
    const n = parseInt(windowMatch[1] ?? "10", 10);
    const window = { kind: "last_n_slices" as const, n };

    // Optional agent filter.
    const agentFilter = flags.agent ? [flags.agent] : undefined;

    const rows = await aggregateAgentStats(
      agentFilter ? { repo: repoPath, window, agents: agentFilter } : { repo: repoPath, window }
    );
    const artifactPath = await writeAgentStatsArtifact(repoPath, rows, window);

    // Pretty-print table to stdout.
    const slug = windowSlug(window);
    const lines: string[] = [
      `Agent stats — window: ${slug} (${rows.length} agent(s))`,
      "",
      "Agent".padEnd(30) +
        "N".padStart(4) +
        "  pass%".padStart(7) +
        "  wallMs".padStart(9) +
        "  tokens".padStart(9) +
        "  rework%".padStart(10) +
        "  valfail%".padStart(11) +
        "  medDisp".padStart(10),
      "-".repeat(90)
    ];
    for (const r of rows) {
      lines.push(
        r.agent.padEnd(30) +
          String(r.sample_count).padStart(4) +
          `  ${(r.pass_rate * 100).toFixed(1)}%`.padStart(7) +
          `  ${r.mean_wall_ms}`.padStart(9) +
          `  ${r.mean_tokens}`.padStart(9) +
          `  ${(r.review_rework_rate * 100).toFixed(1)}%`.padStart(10) +
          `  ${(r.validation_fail_rate * 100).toFixed(1)}%`.padStart(11) +
          `  ${r.median_dispatches_to_pass}`.padStart(10)
      );
    }
    lines.push("", `Artifact written: ${artifactPath}`);

    // Print the table directly (not via JSON.stringify).
    process.stdout.write(lines.join("\n") + "\n");
    return artifactPath;
  },

  "agent-route": async ({ repoPath, flags }: CommandContext) => {
    const { loadAgentRegistry, routeByTags } = await import("./lib/agent-registry.ts");
    const registry = await loadAgentRegistry(repoPath);
    const query: import("./lib/agent-registry.ts").RouteQuery = {};
    if (flags.role) query.role = flags.role;
    if (flags.surface) query.surface = flags.surface;
    if (flags.stack) query.stack = flags.stack;
    if (flags.concern) query.concern = flags.concern;
    if (flags.lens) query.lens = flags.lens;
    if (flags.scope) query.scope = flags.scope;
    const matches = routeByTags(registry, query);
    const askedFilters = Object.values(query).filter(Boolean).length;

    const lines: string[] = [
      `Agent route — query: ${askedFilters === 0 ? "(none — listing all)" : JSON.stringify(query)} (${matches.length} match(es))`,
      "",
      "Rank  Score  Agent".padEnd(60) + "Matched dimensions",
      "-".repeat(110)
    ];
    matches.slice(0, 20).forEach((m, i) => {
      lines.push(
        `${String(i + 1).padStart(4)}  ${String(m.score).padStart(5)}  ${m.entry.name.padEnd(40)} ${m.matched.join(", ")}`
      );
    });
    if (matches.length > 20) lines.push("", `... ${matches.length - 20} more not shown`);
    process.stdout.write(lines.join("\n") + "\n");
    return { registryCount: registry.length, matchCount: matches.length };
  },

  "gepa-history": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runGepaHistoryCmd } = await import("./lib/gepa/history.ts");
    // Reconstruct raw-args array so history.ts can parse them uniformly.
    const rawArgs: string[] = [...positionals];
    if (flags.gepaSource) rawArgs.push("--source", flags.gepaSource);
    if (flags.limit) rawArgs.push("--limit", flags.limit);
    const result = await runGepaHistoryCmd(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-eval": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runGepaEvalCmd } = await import("./lib/gepa/eval.ts");
    const rawArgs: string[] = [...positionals];
    if (flags.live === true) rawArgs.push("--live");
    if (flags.validate === true) rawArgs.push("--validate");
    if (typeof flags.judge === "string" && flags.judge) rawArgs.push("--judge", flags.judge);
    if (typeof flags.split === "string" && flags.split) rawArgs.push("--split", flags.split);
    const result = await runGepaEvalCmd(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-mine-reviewer": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runMineReviewerBugCorpus } = await import("./lib/gepa/mine-reviewer-bug-corpus.ts");
    // Reconstruct raw-args for the mining module's own parser.
    const rawArgs: string[] = [...positionals];
    if (typeof flags.weeks === "string" && flags.weeks) rawArgs.push("--weeks", flags.weeks);
    if (typeof flags.out === "string" && flags.out) rawArgs.push("--out", flags.out);
    const result = await runMineReviewerBugCorpus(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-optimize": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runGepaOptimizeCmd } = await import("./lib/gepa/gepa-optimize-cmd.ts");
    const rawArgs: string[] = [...positionals];
    if (typeof flags.budget === "string" && flags.budget) rawArgs.push("--budget", flags.budget);
    if (typeof flags.gepaK === "string" && flags.gepaK) rawArgs.push("--k", flags.gepaK);
    if (flags.artifactOnly === true) rawArgs.push("--artifact-only");
    const result = await runGepaOptimizeCmd(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-resume": async ({ repoPath, positionals }: CommandContext) => {
    const { runGepaResumeCmdExtended } = await import("./lib/gepa/gepa-killswitch-cmds.ts");
    const result = await runGepaResumeCmdExtended(repoPath, positionals);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-invalidate": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runGepaInvalidateCmd } = await import("./lib/gepa/gepa-killswitch-cmds.ts");
    const rawArgs: string[] = [...positionals];
    if (typeof flags.agent === "string" && flags.agent) rawArgs.push("--agent", flags.agent);
    if (typeof flags.since === "string" && flags.since) rawArgs.push("--since", flags.since);
    if (typeof flags.tag === "string" && flags.tag) rawArgs.push("--tag", flags.tag);
    const result = await runGepaInvalidateCmd(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-revert": async ({ repoPath, flags, positionals }: CommandContext) => {
    const { runGepaRevertCmd } = await import("./lib/gepa/gepa-killswitch-cmds.ts");
    const rawArgs: string[] = [...positionals];
    if (typeof flags.agent === "string" && flags.agent) rawArgs.push("--agent", flags.agent);
    const result = await runGepaRevertCmd(repoPath, rawArgs);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  },

  "gepa-thaw": async ({ repoPath, positionals }: CommandContext) => {
    const { runGepaThawCmd } = await import("./lib/gepa/gepa-killswitch-cmds.ts");
    const result = await runGepaThawCmd(repoPath, positionals);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return result.stdout.trim();
  }
};

export async function runCrew(argv: string[]): Promise<{ code: number; output: string }> {
  try {
    const { command, helpTarget, flags, positionals } = parseArgs(argv);
    const repoPath = path.resolve(normalizeMsysPath(flags.repo));

    if (command === "help") {
      return { code: 0, output: usage(helpTarget) };
    }

    const handler = (COMMANDS as Record<string, (ctx: CommandContext) => Promise<unknown>>)[
      command
    ];
    if (!handler) {
      return { code: 1, output: `Unknown command: ${command}` };
    }

    const result = await handler({ repoPath, flags, positionals });
    // String results are printed as-is (e.g. file paths); everything else is JSON.
    const output = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return { code: 0, output };
  } catch (error) {
    return { code: 1, output: (error as Error).message };
  }
}

async function main() {
  const { code, output } = await runCrew(process.argv.slice(2));
  if (code === 0) {
    console.log(output);
  } else {
    console.error(output);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  void main();
}
