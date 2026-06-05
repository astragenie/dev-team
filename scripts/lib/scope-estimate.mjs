const LIGHT_LINES = 300;
const HEAVY_LINES = 800;
const HEAVY_FILES = 6;

/**
 * @typedef {{ path: string, lines: number, eslintDisable?: boolean }} FileEntry
 * @param {{ files: FileEntry[] }} options
 * @returns {{ tier: "light"|"standard"|"heavy", reason: string }}
 */
export function estimateScope({ files }) {
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  const fileCount = files.length;
  const hasEslintDisable = files.some((f) => f.eslintDisable === true);

  if (hasEslintDisable) {
    return { tier: "heavy", reason: "eslint-disable present in scope — complexity acknowledged" };
  }
  if (totalLines > HEAVY_LINES) {
    return {
      tier: "heavy",
      reason: `${totalLines} total lines exceeds heavy threshold (${HEAVY_LINES})`
    };
  }
  if (fileCount >= HEAVY_FILES) {
    return {
      tier: "heavy",
      reason: `${fileCount} files meets or exceeds heavy threshold (${HEAVY_FILES})`
    };
  }
  if (totalLines < LIGHT_LINES && fileCount <= 2) {
    return {
      tier: "light",
      reason: `${totalLines} total lines across ${fileCount} file(s) — well within light threshold`
    };
  }
  return { tier: "standard", reason: `${totalLines} total lines across ${fileCount} file(s)` };
}
