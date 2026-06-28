import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GepaConfigSchema, type GepaConfig } from "@astragenie/gepa-core";

export async function loadGepaConfig(repoPath: string): Promise<GepaConfig | null> {
  const path = join(repoPath, "gepa.config.json");
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    const result = GepaConfigSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}
