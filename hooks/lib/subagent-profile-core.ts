// hooks/lib/subagent-profile-core.ts
//
// Deterministic agent-profile injection at subagent dispatch (dev-team #235's
// "hook, not skill"). Fires from the SubagentStart hook: given the spawning
// agent's type, it loads that agent's ranked astramem profile
// (corrections/decisions/lessons) via the SAME tested buildProfileBlock the
// CLI uses, and returns it as `hookSpecificOutput.additionalContext` — a
// system reminder injected into the subagent's context, not model-discretionary.
//
// Unlike the command-md `crew profile-block` path (which the orchestrator must
// choose to run + append), this fires on EVERY matching dispatch. It also
// records the injected atom ids to a sidecar keyed by AGENT TYPE (the profile
// is agent-scoped, so the injected set is per-agent, not per-run), so the
// outcome-feedback step (`crew profile-feedback --agent <type>`) can credit
// usefulness on gate PASS.
//
// Fail-silent: ANY failure (bad payload, no agent, disabled config, unpaired
// daemon, empty profile) resolves to `null` — the caller writes nothing, so
// dispatch is byte-identical to today.

export interface SubagentProfileDeps {
  /** Injectable for tests; defaults to the real buildProfileBlock. */
  buildProfileBlock?: (opts: {
    repoPath: string;
    agent: string;
  }) => Promise<{ block: string; injectedIds: string[] }>;
  /** Injectable for tests; defaults to the real writeInjectedAtoms. */
  writeInjectedAtoms?: (repoPath: string, key: string, ids: string[]) => Promise<void>;
}

interface SubagentStartPayload {
  agent_type?: unknown;
  cwd?: unknown;
}

/**
 * Build the SubagentStart hook's stdout for a raw payload. Returns the JSON
 * string to emit (with `additionalContext`), or `null` to emit nothing.
 * Never throws.
 */
export async function runSubagentProfileInjection(
  raw: string,
  env: NodeJS.ProcessEnv,
  deps: SubagentProfileDeps = {}
): Promise<string | null> {
  try {
    const payload = JSON.parse(raw) as SubagentStartPayload;
    const agentType = typeof payload.agent_type === "string" ? payload.agent_type : "";
    if (!agentType) return null;

    const repoPath =
      (typeof payload.cwd === "string" && payload.cwd) ||
      env["CLAUDE_PROJECT_DIR"] ||
      process.cwd();

    const buildProfileBlock =
      deps.buildProfileBlock ??
      (await import("../../scripts/lib/memory/inject-profile.ts")).buildProfileBlock;

    const { block, injectedIds } = await buildProfileBlock({ repoPath, agent: agentType });
    if (!block) return null;

    const writeInjectedAtoms =
      deps.writeInjectedAtoms ??
      (await import("../../scripts/lib/memory/injected-atoms.ts")).writeInjectedAtoms;
    // Keyed by agent type (see header): the outcome-feedback step reads the
    // same key. Best-effort — writeInjectedAtoms never throws.
    await writeInjectedAtoms(repoPath, agentType, injectedIds);

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: block
      }
    });
  } catch {
    return null;
  }
}
