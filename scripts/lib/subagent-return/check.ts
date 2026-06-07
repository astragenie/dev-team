// Pure check library for subagent-return cost-discipline enforcement (FEAT-032).
// No I/O. All functions are exported named exports.

interface SubagentReturnInput {
  body: string;
  threshold: number;
}

interface CheckResult {
  warnings: string[];
}

export function parseThreshold(envValue: string | undefined, defaultBytes = 512): number {
  if (envValue === undefined || envValue === null || envValue === "") {
    return defaultBytes;
  }
  if (envValue === "0") {
    return 0;
  }
  const n = Number(envValue);
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return defaultBytes;
  }
  return Math.floor(n);
}

/**
 * Regex that matches any `.claude/artifacts/crew/SUBDIR/FILENAME.md` reference,
 * with both POSIX (`/`) and Windows (`\`) separators.
 *
 * Subdirs: handoffs, reviews, validations, deployments, runs, cost, cost-insights, agents.
 */
const ARTIFACT_PATH_RE =
  /\.claude[\\/]artifacts[\\/]crew[\\/](?:handoffs|reviews|validations|deployments|runs|cost|cost-insights|agents)[\\/][^\s)"']+\.md/;

export function hasArtifactPath(body: string): boolean {
  return ARTIFACT_PATH_RE.test(body);
}

export function checkSubagentReturn({ body, threshold }: SubagentReturnInput): CheckResult {
  const byteLen = Buffer.byteLength(body, "utf8");
  if (byteLen <= threshold) {
    return { warnings: [] };
  }
  if (hasArtifactPath(body)) {
    return { warnings: [] };
  }
  return {
    warnings: [
      `subagent return body is ${byteLen} bytes with no handoff artifact path; write the report to .claude/artifacts/crew/handoffs/<ts>-handoff-*.md and return only the absolute path (cost-discipline rule #2)`
    ]
  };
}
