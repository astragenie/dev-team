// scripts/lib/memory/index.ts — FEAT-188 S2 barrel export.
export type {
  MemoryConfig,
  MemoryEntry,
  MemoryEntryInput,
  MemoryKind,
  MemoryProviderKind,
  MemorySeverity
} from "./schema.ts";
export { MemoryConfigSchema, MemoryEntrySchema, MemoryEntryInputSchema } from "./schema.ts";
export type { EffectiveMemoryConfig } from "./config.ts";
export { parseMemoryConfig, resolveEffectiveConfig } from "./config.ts";
export type { MemoryProvider, RecallQuery } from "./types.ts";
export { noopProvider } from "./noop-provider.ts";
export { fileProvider } from "./file-provider.ts";
export type { FileProviderOptions } from "./file-provider.ts";
export { resolveProvider } from "./resolve-provider.ts";
