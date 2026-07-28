import { test, expect } from "bun:test";
// FEAT-152: parallel-gates helper tests.
import {
  aggregateGateExitCodes,
  emitParallelGatesBlock,
  type GateSpec
} from "../scripts/lib/parallel-gates.ts";

test("aggregateGateExitCodes: all zeros -> 0", () => {
  expect(aggregateGateExitCodes([0, 0, 0])).toBe(0);
});

test("aggregateGateExitCodes: any non-zero -> 1", () => {
  expect(aggregateGateExitCodes([0, 1, 0])).toBe(1);
  expect(aggregateGateExitCodes([2, 0, 0])).toBe(1);
});

test("aggregateGateExitCodes: empty input -> 0 (no gates, nothing failed)", () => {
  expect(aggregateGateExitCodes([])).toBe(0);
});

test("emitParallelGatesBlock: emits launch line per gate with timeout + temp log", () => {
  const gates: GateSpec[] = [
    { name: "lint", cmd: "bun run lint" },
    { name: "typecheck", cmd: "bun run typecheck" }
  ];
  const block = emitParallelGatesBlock(gates);
  expect(block).toMatch(/LOGS=\$\(mktemp -d\)/);
  expect(block).toMatch(
    /timeout \$\{CREW_BASH_GATE_TIMEOUT_S:-60\} bash -c 'bun run lint' > "\$LOGS\/lint\.log"/
  );
  expect(block).toMatch(
    /timeout \$\{CREW_BASH_GATE_TIMEOUT_S:-60\} bash -c 'bun run typecheck' > "\$LOGS\/typecheck\.log"/
  );
  // both launches must be backgrounded
  const launchLines = block
    .split("\n")
    .filter((l) => /timeout \$\{CREW_BASH_GATE_TIMEOUT_S/.test(l));
  expect(launchLines.length).toBe(2);
  for (const line of launchLines) expect(line).toMatch(/ &$/);
  // single wait for all
  expect(block).toMatch(/\nwait\n/);
});

test("emitParallelGatesBlock: aggregator loops gates and tails failing log", () => {
  const block = emitParallelGatesBlock([{ name: "lint", cmd: "bun run lint" }]);
  expect(block).toMatch(/for g in lint; do/);
  expect(block).toMatch(/--- \$g failed \(exit \$code\) ---/);
  expect(block).toMatch(/tail -50 "\$LOGS\/\$g\.log"/);
  expect(block).toMatch(/exit \$fail/);
});

test("emitParallelGatesBlock: rejects empty gates list", () => {
  expect(() => emitParallelGatesBlock([])).toThrow(/must be non-empty/);
});

test("emitParallelGatesBlock: rejects gate names with shell metachars", () => {
  expect(() => emitParallelGatesBlock([{ name: "lint;rm -rf /", cmd: "x" }])).toThrow(
    /invalid gate name/
  );
});

test("emitParallelGatesBlock: escapes single quotes inside cmd", () => {
  const block = emitParallelGatesBlock([{ name: "g", cmd: `echo 'hi'` }]);
  // single quote split-escape pattern: '\''
  expect(block).toMatch(/'echo '\\''hi'\\''/);
});
