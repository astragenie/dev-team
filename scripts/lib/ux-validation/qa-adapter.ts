type ScenarioStep = {
  step: number;
  verb: string;
  target: string;
  expect: string;
  ac_id: string | null;
};

export function buildQaInvocation({
  url,
  scenarios,
  baselineDir,
  outputPath,
  scenario_chain
}: {
  url: string;
  scenarios: Array<Record<string, unknown>>;
  baselineDir: string;
  outputPath: string;
  scenario_chain?: ScenarioStep[];
}): string {
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
