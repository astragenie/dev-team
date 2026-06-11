// FEAT-152: parallel-gates helper tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateGateExitCodes,
  emitParallelGatesBlock,
  type GateSpec
} from "../scripts/lib/parallel-gates.ts";

test("aggregateGateExitCodes: all zeros -> 0", () => {
  assert.equal(aggregateGateExitCodes([0, 0, 0]), 0);
});

test("aggregateGateExitCodes: any non-zero -> 1", () => {
  assert.equal(aggregateGateExitCodes([0, 1, 0]), 1);
  assert.equal(aggregateGateExitCodes([2, 0, 0]), 1);
});

test("aggregateGateExitCodes: empty input -> 0 (no gates, nothing failed)", () => {
  assert.equal(aggregateGateExitCodes([]), 0);
});

test("emitParallelGatesBlock: emits launch line per gate with timeout + temp log", () => {
  const gates: GateSpec[] = [
    { name: "lint", cmd: "bun run lint" },
    { name: "typecheck", cmd: "bun run typecheck" }
  ];
  const block = emitParallelGatesBlock(gates);
  assert.match(block, /LOGS=\$\(mktemp -d\)/);
  assert.match(
    block,
    /timeout \$\{CREW_BASH_GATE_TIMEOUT_S:-60\} bash -c 'bun run lint' > "\$LOGS\/lint\.log"/
  );
  assert.match(
    block,
    /timeout \$\{CREW_BASH_GATE_TIMEOUT_S:-60\} bash -c 'bun run typecheck' > "\$LOGS\/typecheck\.log"/
  );
  // both launches must be backgrounded
  const launchLines = block
    .split("\n")
    .filter((l) => /timeout \$\{CREW_BASH_GATE_TIMEOUT_S/.test(l));
  assert.equal(launchLines.length, 2);
  for (const line of launchLines) assert.match(line, / &$/);
  // single wait for all
  assert.match(block, /\nwait\n/);
});

test("emitParallelGatesBlock: aggregator loops gates and tails failing log", () => {
  const block = emitParallelGatesBlock([{ name: "lint", cmd: "bun run lint" }]);
  assert.match(block, /for g in lint; do/);
  assert.match(block, /--- \$g failed \(exit \$code\) ---/);
  assert.match(block, /tail -50 "\$LOGS\/\$g\.log"/);
  assert.match(block, /exit \$fail/);
});

test("emitParallelGatesBlock: rejects empty gates list", () => {
  assert.throws(() => emitParallelGatesBlock([]), /must be non-empty/);
});

test("emitParallelGatesBlock: rejects gate names with shell metachars", () => {
  assert.throws(
    () => emitParallelGatesBlock([{ name: "lint;rm -rf /", cmd: "x" }]),
    /invalid gate name/
  );
});

test("emitParallelGatesBlock: escapes single quotes inside cmd", () => {
  const block = emitParallelGatesBlock([{ name: "g", cmd: `echo 'hi'` }]);
  // single quote split-escape pattern: '\''
  assert.match(block, /'echo '\\''hi'\\''/);
});
