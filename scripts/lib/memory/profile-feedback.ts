// scripts/lib/memory/profile-feedback.ts — outcome-gated, positive-only
// usefulness feedback for profile-injected atoms. v1 tracking = outcome
// backstop: on gate PASS, credit every injected atom used:true. Reference-
// detection is a documented phase-2 refinement. Fail-silent throughout.
import { readInjectedAtoms } from "./injected-atoms.ts";
import type { ProfileCapableProvider } from "./profile-types.ts";

export interface SubmitOutcomeFeedbackOptions {
  repoPath: string;
  runId: string;
  outcome: "pass" | "fail";
  rawConfig?: unknown;
  provider?: ProfileCapableProvider;
}

function feedbackEnabled(rawConfig: unknown): boolean {
  if (typeof rawConfig !== "object" || rawConfig === null) return false;
  const f = (rawConfig as Record<string, unknown>).feedback;
  return typeof f === "object" && f !== null && (f as Record<string, unknown>).enabled === true;
}

export async function submitOutcomeFeedback(opts: SubmitOutcomeFeedbackOptions): Promise<{ credited: string[] }> {
  const credited: string[] = [];
  try {
    if (opts.outcome !== "pass") return { credited };

    const { loadMemoryConfig } = await import("./inject-recall.ts");
    const rawConfig = opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    if (!feedbackEnabled(rawConfig)) return { credited };

    let provider = opts.provider;
    if (!provider) {
      const { resolveProvider } = await import("@astragenie/memory-provider");
      provider = resolveProvider(rawConfig, opts.repoPath) as unknown as ProfileCapableProvider;
    }
    if (typeof provider.feedback !== "function") return { credited };

    const ids = await readInjectedAtoms(opts.repoPath, opts.runId);
    for (const id of ids) {
      try {
        const ok = await provider.feedback(id, { used: true });
        if (ok) credited.push(id);
      } catch { /* per-id fail-silent */ }
    }
    return { credited };
  } catch {
    return { credited };
  }
}
