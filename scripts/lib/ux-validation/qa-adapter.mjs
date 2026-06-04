// Build the gstack /qa CLI invocation string for the UX validation gate.
// Returns the literal command string the skill will run via Bash. The
// validator never writes the output file — /qa (as subprocess) does.

export function buildQaInvocation({ url, scenarios, baselineDir, outputPath }) {
  const scenariosJson = JSON.stringify(scenarios).replace(/'/g, "'\\''");
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
