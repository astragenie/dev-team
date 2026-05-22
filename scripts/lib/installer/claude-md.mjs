// CLAUDE.md update logic. Handles three states:
//   1. file does not exist -> create with the import block
//   2. legacy `<!-- engineering-os:start -->` marker -> replace in place
//      (one-shot migration to the `<!-- crew:start -->` marker)
//   3. current `<!-- crew:start -->` marker -> idempotent no-op
//   4. file exists but no marker -> append the import block to the end

import fs from "node:fs/promises";
import path from "node:path";

import { writeFileIfChanged } from "./util.mjs";
import {
  CLAUDE_IMPORT_BLOCK,
  LEGACY_CLAUDE_MARKER_END,
  LEGACY_CLAUDE_MARKER_START
} from "./templates.mjs";

function replaceLegacyMarkerBlock(existing) {
  const startIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_START);
  const endIndex = existing.indexOf(LEGACY_CLAUDE_MARKER_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return null;
  }
  const before = existing.slice(0, startIndex).trimEnd();
  const after = existing.slice(endIndex + LEGACY_CLAUDE_MARKER_END.length).trimStart();
  const parts = [before, CLAUDE_IMPORT_BLOCK];
  if (after) {
    parts.push(after);
  }
  return `${parts.join("\n\n")}\n`;
}

export async function updateClaudeMd(repoPath, writes) {
  const claudePath = path.join(repoPath, "CLAUDE.md");
  const existing = await fs.readFile(claudePath, "utf8").catch(() => null);

  if (existing === null) {
    const contents = [
      "# Repo Instructions",
      "",
      "This repository uses the Crew harness.",
      "",
      CLAUDE_IMPORT_BLOCK,
      ""
    ].join("\n");
    await writeFileIfChanged(claudePath, contents);
    writes.push(path.relative(repoPath, claudePath));
    return;
  }

  if (existing.includes("<!-- crew:start -->")) {
    return;
  }

  if (existing.includes(LEGACY_CLAUDE_MARKER_START)) {
    const upgraded = replaceLegacyMarkerBlock(existing);
    if (upgraded !== null) {
      await writeFileIfChanged(claudePath, upgraded);
      writes.push(path.relative(repoPath, claudePath));
      return;
    }
  }

  const next = `${existing.trimEnd()}\n\n${CLAUDE_IMPORT_BLOCK}\n`;
  await writeFileIfChanged(claudePath, next);
  writes.push(path.relative(repoPath, claudePath));
}
