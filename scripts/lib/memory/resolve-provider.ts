// scripts/lib/memory/resolve-provider.ts — FEAT-188 S2 + S4
//
// The wiring point S3 (recall injection) and S4 (astramemProvider) build on:
// parse config -> resolve enabled x provider precedence -> pick a provider
// instance. provider:"astramem" now routes to astramemProvider (S4), which
// itself falls back to fileProvider when astramem is unpaired/unreachable —
// see scripts/lib/memory/astramem-provider.ts.
import { astramemProvider } from "./astramem-provider.ts";
import { parseMemoryConfig, resolveEffectiveConfig } from "./config.ts";
import { fileProvider } from "./file-provider.ts";
import { noopProvider } from "./noop-provider.ts";
import type { MemoryProvider } from "./types.ts";

export function resolveProvider(rawConfig: unknown, repoPath: string): MemoryProvider {
  const config = parseMemoryConfig(rawConfig);
  const effective = resolveEffectiveConfig(config);

  if (!effective.captureEnabled) return noopProvider();

  if (effective.provider === "astramem") {
    return astramemProvider(repoPath, {
      dualWrite: effective.dualWrite,
      recall: { k: effective.recall.k, maxTokens: effective.recall.maxTokens }
    });
  }

  return fileProvider(repoPath, {
    recall: { k: effective.recall.k, maxTokens: effective.recall.maxTokens }
  });
}
