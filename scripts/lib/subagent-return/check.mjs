// Pure check library for subagent-return cost-discipline enforcement (FEAT-032).
// No I/O. All functions are exported named exports.

/**
 * Parse the CREW_SUBAGENT_INLINE_THRESHOLD env value to a numeric byte threshold.
 *
 * - `"0"` → returns 0 (caller treats as disabled).
 * - Non-numeric / undefined → returns `defaultBytes`.
 * - Numeric string → returns parsed integer.
 *
 * @param {string | undefined} envValue
 * @param {number} [defaultBytes=512]
 * @returns {number}
 */
export function parseThreshold(envValue, defaultBytes = 512) {
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

/**
 * Returns true if `body` contains a `.claude/artifacts/crew/SUBDIR/FILE.md` path reference.
 * Both POSIX and Windows separators are accepted.
 *
 * @param {string} body
 * @returns {boolean}
 */
export function hasArtifactPath(body) {
  return ARTIFACT_PATH_RE.test(body);
}

/**
 * Check a subagent return body against the cost-discipline artifact-path rule.
 *
 * Logic:
 * - body UTF-8 byte length ≤ threshold → no warn
 * - body > threshold AND `hasArtifactPath(body)` → no warn
 * - body > threshold AND no artifact path → one warn citing byte count + rule #2
 *
 * @param {{ body: string; threshold: number }} opts
 * @returns {{ warnings: string[] }}
 */
export function checkSubagentReturn({ body, threshold }) {
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
