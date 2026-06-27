import { describe, expect, test } from "bun:test";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGepaConfig } from "../../scripts/lib/gepa/load-config.ts";

describe("loadGepaConfig", () => {
  test("returns null when gepa.config.json is absent", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns a typed config when the file is present and valid", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ capture: { enabled: true } }),
      );
      const config = await loadGepaConfig(root);
      expect(config).not.toBeNull();
      expect(config?.capture.enabled).toBe(true);
      expect(config?.storage.backend).toBe("file"); // schema default
      expect(config?.judge.provider).toBe("ollama"); // schema default
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns null when gepa.config.json is malformed JSON", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(join(root, "gepa.config.json"), "{ not valid json");
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns null when gepa.config.json fails Zod validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "gepa-cfg-"));
    try {
      writeFileSync(
        join(root, "gepa.config.json"),
        JSON.stringify({ judge: { provider: "unknown-provider", model: "x" } }),
      );
      const config = await loadGepaConfig(root);
      expect(config).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
