/**
 * scripts/lib/gepa/critical-agent-allowlist.ts — SLICE-106
 *
 * Hard-coded list of agents that must NEVER be auto-merged by the GEPA
 * promotion gate. These agents have compounding effects; their failures
 * cascade across the entire engineering loop.
 *
 * Per design spec line 44: this list is NOT configurable in v1.
 * Operators who need different critical-agent sets must modify this file
 * and cut a new plugin release (v1.1 deferral documented in SLICE-106 Risks).
 *
 * Canonical members: inspector, verifier, architect.
 */

/** Agents that are always left as draft PRs — never auto-merged. */
export const CRITICAL_AGENT_ALLOWLIST: readonly string[] = [
  "inspector",
  "verifier",
  "architect"
] as const;

/**
 * Returns true when `agent` is in the critical-agent allowlist.
 *
 * O(n) but the list is a constant 3 — no map needed.
 */
export function isCriticalAgent(agent: string): boolean {
  return CRITICAL_AGENT_ALLOWLIST.includes(agent as (typeof CRITICAL_AGENT_ALLOWLIST)[number]);
}
