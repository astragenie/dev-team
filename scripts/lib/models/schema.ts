// scripts/lib/models/schema.ts — FEAT-crew-architecture-review Section 7, Decision 4
//
// Zod schema for models.yaml — the tier-name -> concrete-model-id map used by
// scripts/apply-model-profile.ts. Neutral tier names (reasoning/standard/light)
// let an agent's frontmatter `model:` field be authored against a profile
// rather than a hardcoded id; applying a different profile rewrites the
// concrete value, but an agent file always carries a concrete `model:` at
// rest — there is no runtime dependency on this file or its profile concept.

import { z } from "zod";

export const MODEL_TIERS = ["reasoning", "standard", "light"] as const;
export const ModelTierSchema = z.enum(MODEL_TIERS);
export type ModelTier = z.infer<typeof ModelTierSchema>;

export const ModelProfileSchema = z.object({
  reasoning: z.string().min(1),
  standard: z.string().min(1),
  light: z.string().min(1)
});
export type ModelProfile = z.infer<typeof ModelProfileSchema>;

export const ModelsConfigSchema = z
  .object({
    /** Semver. Bump MAJOR on breaking shape changes (tier removed, etc.). */
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be MAJOR.MINOR.PATCH"),
    /** Profile used when no --profile / CREW_MODEL_PROFILE is given. */
    default_profile: z.string().min(1),
    profiles: z.record(z.string(), ModelProfileSchema)
  })
  .refine((cfg) => cfg.default_profile in cfg.profiles, {
    message: "default_profile must name a profile present in 'profiles'",
    path: ["default_profile"]
  });
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

/** Parses and validates raw YAML-decoded data. Throws ZodError on shape mismatch. */
export function parseModelsConfig(data: unknown): ModelsConfig {
  return ModelsConfigSchema.parse(data);
}
