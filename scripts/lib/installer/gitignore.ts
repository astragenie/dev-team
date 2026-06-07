// .gitignore marker-block management. Lines outside the
// `# crew:start`/`# crew:end` block belong to the user and are preserved;
// lines inside are owned by this plugin and refresh on each install.

import fs from "node:fs/promises";
import path from "node:path";

import { writeFileIfChanged } from "./util.ts";
import { GITIGNORE_BLOCK, GITIGNORE_MARKER_END, GITIGNORE_MARKER_START } from "./templates.ts";

export async function updateGitignore(repoPath: string, writes: string[]): Promise<void> {
  const ignorePath = path.join(repoPath, ".gitignore");
  const existing = await fs.readFile(ignorePath, "utf8").catch((): null => null);

  if (existing === null) {
    const contents = `${GITIGNORE_BLOCK}\n`;
    await writeFileIfChanged(ignorePath, contents);
    writes.push(path.relative(repoPath, ignorePath));
    return;
  }

  // Replace the marker block in place when present; else append.
  const startIdx = existing.indexOf(GITIGNORE_MARKER_START);
  const endIdx = existing.indexOf(GITIGNORE_MARKER_END);
  let next: string;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + GITIGNORE_MARKER_END.length);
    next = `${before}${GITIGNORE_BLOCK}${after}`;
  } else {
    next = `${existing.trimEnd()}\n\n${GITIGNORE_BLOCK}\n`;
  }

  const changed = await writeFileIfChanged(ignorePath, next);
  if (changed) {
    writes.push(path.relative(repoPath, ignorePath));
  }
}
