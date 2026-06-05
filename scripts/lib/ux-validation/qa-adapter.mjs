// Build the gstack /qa CLI invocation string for the UX validation gate.
// Returns the literal command string the skill will run via Bash. The
// validator never writes the output file — /qa (as subprocess) does.
// When scenario_chain is provided it is used in place of scenarios (journey mode).

/**
 * @param {{
 *   url: string,
 *   scenarios: Array<Record<string, unknown>>,
 *   baselineDir: string,
 *   outputPath: string,
 *   scenario_chain?: Array<{step: number, verb: string, target: string, expect: string, ac_id: string | null}>
 * }} params
 * @returns {string}
 */
export function buildQaInvocation({ url, scenarios, baselineDir, outputPath, scenario_chain }) {
  const effectiveScenarios = scenario_chain ?? scenarios;
  const scenariosJson = JSON.stringify(effectiveScenarios).replace(/'/g, "'\\''");
  return [
    "gstack:/qa",
    `--url ${url}`,
    `--scenarios '${scenariosJson}'`,
    "--accessibility-scan",
    "--capture-console",
    "--capture-network",
    `--visual-baseline ${baselineDir}`,
    `--output ${outputPath}`
  ].join(" \\\n  ");
}
