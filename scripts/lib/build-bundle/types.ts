// Shared types for build-bundle module.
// Schema reference: docs/standards/build-bundle-schema.md

export type BuilderName =
  | "fullstack-dev"
  | "backend-dev"
  | "frontend-dev"
  | "aiplugin-dev"
  | "release-engineer";

// Legacy builder identities accepted by validate-bundles for historical
// bundles emitted before the v0.35.0 agent rename. Not valid for new bundles.
export const LEGACY_BUILDER_NAMES = ["builder", "builder-be", "builder-fe"] as const;
export type LegacyBuilderName = (typeof LEGACY_BUILDER_NAMES)[number];

export const CURRENT_BUILDER_NAMES = [
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "aiplugin-dev",
  "release-engineer"
] as const satisfies readonly BuilderName[];

export type SkipReason = "outside-repo" | "deleted" | "binary";

export interface FileReadSkipped {
  path: string;
  reason: SkipReason;
}

export interface DiffStat {
  files: number;
  additions: number;
  deletions: number;
}

export interface BundleFrontmatter {
  slice: string;
  builder: BuilderName;
  run_id: string;
  feat?: string;
  files_touched: string[];
  files_read: string[];
  files_read_skipped?: FileReadSkipped[];
  diff_stat: DiffStat;
  truncated: boolean;
  truncation_reason: "size-cap" | null;
  schema_version: number;
}

export interface BundleInputs {
  repoPath: string;
  sliceId: string;
  builderName: BuilderName;
  runId: string;
  feat?: string;
  handoffBody: string;
  filesTouched: string[];
  filesRead: string[];
  // When provided, used to derive LRU ordering + skip status. When omitted,
  // assembler falls back to repo working-tree mtimes for ordering.
  ledger?: ReadLedgerEntry[];
  sizeCapBytes?: number; // defaults to 200 * 1024
}

export interface ReadLedgerEntry {
  path: string;
  last_read_at: string; // ISO timestamp
}

export interface BundleOutput {
  path: string;
  bytes: number;
  truncated: boolean;
  filesReadSkipped: FileReadSkipped[];
}

export const SCHEMA_VERSION = 1 as const;
export const DEFAULT_SIZE_CAP_BYTES = 200 * 1024;
export const SECTION_HEADERS = {
  handoff: "## Handoff",
  diff: "## Diff",
  filesTouched: "## Files touched",
  filesRead: "## Files read"
} as const;

export const INLINE_HEADER = "## Builder context (preloaded — do not re-Read these files)";
export const INLINE_TRUNCATION_WARNING =
  "> NOTE: builder bundle was size-capped, reviewer should manually re-read suspect files";
