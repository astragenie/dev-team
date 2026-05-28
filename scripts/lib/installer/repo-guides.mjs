// Writes the repo-local framework memory files under .claude/crew/. These are
// repo-scoped copies of the framework constitution and workflow so the
// harness is self-contained in the repo (the global copies under
// ~/.claude/crew/ remain authoritative for users who set them up globally).

import path from "node:path";

import { writeFileIfChanged } from "./util.mjs";
import { CONSTITUTION_TEMPLATE, PROTOCOL_TEMPLATE, WORKFLOW_TEMPLATE } from "./templates.mjs";

/**
 * @param {string} repoPath
 * @param {string[]} writes
 */
export async function writeRepoLocalGuides(repoPath, writes) {
  const guides = [
    [path.join(repoPath, ".claude", "crew", "constitution.md"), `${CONSTITUTION_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "workflow.md"), `${WORKFLOW_TEMPLATE}\n`],
    [path.join(repoPath, ".claude", "crew", "protocol.md"), `${PROTOCOL_TEMPLATE}\n`]
  ];
  for (const [filePath, contents] of guides) {
    const changed = await writeFileIfChanged(filePath, contents);
    if (changed) {
      writes.push(path.relative(repoPath, filePath));
    }
  }
}
