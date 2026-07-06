// scripts/lib/memory/resolve-provider.ts — FEAT-188 S2
//
// The wiring point S3 (recall injection) and S4 (astramemProvider) build on:
// parse config -> resolve enabled x provider precedence -> pick a provider
// instance. S2 only ships noop + file; provider:"astramem" falls back to
// fileProvider here, matching S4's own eventual "unpaired falls back to
// file" contract (astramem-plugin#23, blocked) — forward-compatible, not a
// regression, since no real astramem transport exists to route to yet.
import { parseMemoryConfig, resolveEffectiveConfig } from "./config.ts";
import { fileProvider } from "./file-provider.ts";
import { noopProvider } from "./noop-provider.ts";
import type { MemoryProvider } from "./types.ts";

export function resolveProvider(rawConfig: unknown, repoPath: string): MemoryProvider {
  const config = parseMemoryConfig(rawConfig);
  const effective = resolveEffectiveConfig(config);

  if (!effective.captureEnabled) return noopProvider();

  // provider: "file" | "astramem" (S4 not implemented yet -> file fallback).
  return fileProvider(repoPath, {
    recall: { k: effective.recall.k, maxTokens: effective.recall.maxTokens }
  });
}
