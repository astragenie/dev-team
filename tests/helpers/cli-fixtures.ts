import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export const execFile = promisify(execFileCallback);
export const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const cliPath = path.join(repoRoot, "scripts", "crew.ts");

export async function makeTempDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export async function loadState(repoPath: string) {
  const raw = await fs.readFile(
    path.join(repoPath, ".claude", "state", "crew", "workflow-state.json"),
    "utf8"
  );
  return JSON.parse(raw);
}
