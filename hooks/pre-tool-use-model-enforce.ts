#!/usr/bin/env node
// PreToolUse hook on Agent. HARD-enforces the resolved builder-tier model
// (FEAT-194 S2b): when a builder-tier subagent (crew:fullstack-dev,
// crew:backend-dev, crew:frontend-dev, crew:aiplugin-dev, crew:dev-lite) is
// dispatched without an explicit `model:`, injects the tier resolved from
// .claude/loop.json loop.modelRouting via the FEAT-194 S2 resolver
// (scripts/lib/models/resolve-model.ts). See hooks/lib/model-routing-enforce.ts
// for the honest limitation note on updatedInput support.
//
// Fail-open by construction: any parse/read/resolve error falls through to
// pass-through (allow, unmodified) — this hook must never block a legitimate
// dispatch. Default-ON; opt out via CREW_MODEL_ROUTING_ENFORCE=0.
import fs from "node:fs/promises";
import path from "node:path";
import { logHookError } from "./hook-error.ts";
import {
  parseAgentDispatchInput,
  decideModelEnforcement,
  buildHookOutput
} from "./lib/model-routing-enforce.ts";
import type { LoopModelRoutingConfig } from "../scripts/lib/models/resolve-model.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function parseCwd(raw: string): string {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return typeof obj["cwd"] === "string" ? obj["cwd"] : process.cwd();
  } catch {
    return process.cwd();
  }
}

async function readLoopConfig(repoPath: string): Promise<LoopModelRoutingConfig | null> {
  try {
    const raw = await fs.readFile(path.join(repoPath, ".claude", "loop.json"), "utf8");
    return JSON.parse(raw) as LoopModelRoutingConfig;
  } catch {
    return null; // missing/malformed loop.json — treated as "not configured"
  }
}

async function main(): Promise<void> {
  if (process.env["CREW_MODEL_ROUTING_ENFORCE"] === "0") {
    process.stdin.resume();
    return;
  }

  const raw = await readStdin();
  const dispatch = parseAgentDispatchInput(raw);
  if (dispatch === null) return; // not an Agent dispatch, or malformed — pass through

  try {
    const repoPath = parseCwd(raw);
    const loopConfig = await readLoopConfig(repoPath);
    const decision = decideModelEnforcement(dispatch, loopConfig);
    const out = buildHookOutput(dispatch, decision);
    if (out !== null) process.stdout.write(out);
  } catch (err) {
    // Fail-open: a resolver failure must never block a legitimate dispatch.
    await logHookError(process.cwd(), "pre-tool-use-model-enforce", err);
  }
}

main().catch(async (err) => {
  await logHookError(process.cwd(), "pre-tool-use-model-enforce", err);
  process.exit(0);
});
