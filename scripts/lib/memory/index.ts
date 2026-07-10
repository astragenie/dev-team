// scripts/lib/memory/index.ts — FEAT-188 S2 barrel export.
//
// W3b (dev-team consumes @astragenie/memory-provider, plugins-common#19):
// schema/types/config/noop-provider/ranking/legacy-adapter/file-provider/
// astramem-provider/resolve-provider now live in the published package —
// this barrel re-exports the package verbatim so every existing dev-team
// importer of "./lib/memory/index.ts" keeps working unchanged. Only
// capture-learning.ts, inject-recall.ts, and drift-check.ts stay
// dev-team-local (they write/read dev-team artifact paths + orchestration,
// not swappable provider internals) — re-exported explicitly below.
//
// Note: the package's own `appendJsonlEntry` (from its jsonl.ts) and this
// module's local capture-learning.ts `appendJsonlEntry` share a name. The
// explicit named re-export below wins over the `export *` for that name
// (local/explicit exports take precedence over star-export ambiguity) — so
// barrel consumers get the dev-team capture-learning.ts version, which is
// byte-parity-identical to the package's (same repoPath/segments/entry
// signature, same O_APPEND semantics) and writes into the same store.
export * from "@astragenie/memory-provider";
export {
  LEARNINGS_PATH,
  appendJsonlEntry,
  captureFailureLearning,
  type FailureEntryInput,
  type FailureSeverity
} from "./capture-learning.ts";
export { checkDrift } from "./drift-check.ts";
export type { DriftCheckOptions, DriftReport } from "./drift-check.ts";
export type { InjectRecallOptions } from "./inject-recall.ts";
export {
  buildRecallBlock,
  formatRecallBlock,
  injectRecall,
  loadMemoryConfig
} from "./inject-recall.ts";
