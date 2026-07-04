// scripts/lib/dispatch/peer-dispatch-allowlist.ts — FEAT-crew-architecture-review Section 7
//
// Single source of truth for which agents carry the `Agent` tool and may
// dispatch peers (FEAT-163 DEC-022/DEC-023), plus the documented bidirectional
// exception pair. Previously this Set was hand-duplicated in both
// scripts/validate-agents.ts (peer-dispatch section-shape lint) and
// scripts/validate-dispatch-graph.ts (DAG cycle detector) with a
// "must be kept in sync" comment as the only enforcement — a desync between
// the two would silently under- or over-scope one validator relative to the
// other. Both validators now import from here instead.
//
// SLICE-71 added document-writer + refactor. SLICE-73 added the advisory tier
// (architect, uxdesigner, qa-expert, performance-engineer). SLICE-75 added the
// implementer + release-engineer tier (backend-dev, frontend-dev,
// fullstack-dev, release-engineer).
export const PEER_DISPATCH_ALLOWLIST = new Set([
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

/**
 * Documented bidirectional pairs that are intentional and MUST NOT trigger
 * validate-dispatch-graph.ts's cycle detector. Format: [agentA, agentB] —
 * order within the pair is irrelevant (both directions are covered).
 *
 * qa-expert <-> performance-engineer: both roles are advisory / non-gating
 * per FEAT-163 line 50 — the bidirectional coordination is intentional, not
 * a routing bug.
 */
export const BIDIRECTIONAL_ALLOWED: Array<[string, string]> = [
  ["qa-expert", "performance-engineer"]
];

/**
 * Review/validation-gate agents. No entry in PEER_DISPATCH_ALLOWLIST may name
 * one of these in its own peer-dispatch whitelist — gates are
 * orchestrator-only per FEAT-163 line 40 (no agent may dispatch its own
 * reviewer). Kept alongside the allowlist since both are "who may dispatch
 * whom" policy read by the same validators.
 */
export const GATE_AGENTS = new Set([
  "reviewer",
  "reviewer-lite",
  "csharp-reviewer",
  "typescript-reviewer",
  "verifier"
]);
