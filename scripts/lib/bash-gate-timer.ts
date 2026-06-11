// Bash gate timer helper for per-gate wall-clock telemetry (FEAT-150).
// Phase 1 of slice perf 2-3x spec. Pure additive — no behavior change to existing code.
import fs from "node:fs/promises";
import path from "node:path";

const PATTERNS: Array<[RegExp, string]> = [
  [/\bbun(?:\s+run)?\s+lint(?:\s|$)/, "lint"],
  [/\bbun(?:\s+run)?\s+format:check(?:\s|$)/, "format:check"],
  [/\bbun(?:\s+run)?\s+typecheck(?:\s|$)/, "typecheck"],
  [/\bbun(?:\s+run)?\s+test(?:\s|$)/, "test"],
  [/\bbun\s+audit(?:\s|$)/, "audit"],
  [/\bbun(?:\s+run)?\s+validate:all(?:\s|$)/, "validate:all"],
  [/\bnpm\s+ci(?:\s|$)/, "npm-ci"]
];

export function classifyBashGate(cmd: string): string | null {
  for (const [re, gate] of PATTERNS) if (re.test(cmd)) return gate;
  return null;
}

export type GateHandle = { gate: string; startMs: number };

export function startGateTimer(cmd: string): GateHandle | null {
  const gate = classifyBashGate(cmd);
  if (gate === null) return null;
  return { gate, startMs: Date.now() };
}

export function endGateTimer(handle: GateHandle, exitCode: number): void {
  const row = { gate: handle.gate, durationMs: Date.now() - handle.startMs, exitCode };
  const logPath =
    process.env["CREW_BASH_GATE_LOG"] ??
    path.join(
      process.env["CLAUDE_PLUGIN_ROOT"] ?? process.cwd(),
      ".claude",
      "logs",
      "bash-gates.jsonl"
    );
  void fs
    .mkdir(path.dirname(logPath), { recursive: true })
    .then(() => fs.appendFile(logPath, JSON.stringify(row) + "\n", "utf-8"))
    .catch(() => undefined);
}
