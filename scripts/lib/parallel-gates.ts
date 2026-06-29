// FEAT-152: parallel bash gates helper.
//
// Emits a bash block that runs N quality gates concurrently via `&` + `wait`
// with per-gate temp logs, hard timeout via CREW_BASH_GATE_TIMEOUT_S (env var
// introduced in FEAT-154), and a final aggregator that prints the failed-gate
// header + log tail for any non-zero exit.
//
// Currently validator runs gates serially (~33 s on a typical slice).
// Parallel execution drops that to ~12 s — typecheck dominates the critical
// path.
//
// Helper exports both the bash emitter (used by validator / reviewer /
// inspector-verifier prompts) and the JS-side aggregator (so tests can
// validate the exit-code reduction without spawning bash).

export interface GateSpec {
  /** Short name used as the log filename + aggregator label. */
  readonly name: string;
  /** Shell command to run inside the timeout wrapper. */
  readonly cmd: string;
}

/**
 * Pure JS-side mirror of the bash aggregator. Returns 0 if every gate exited
 * 0, else 1. Used by tests to validate behavior without spawning bash.
 */
export function aggregateGateExitCodes(codes: readonly number[]): number {
  for (const c of codes) {
    if (c !== 0) return 1;
  }
  return 0;
}

const TAIL_LINES = 50;

function escapeForSingleQuotedBash(s: string): string {
  // POSIX single-quoted strings cannot contain a single quote; close the
  // quoted segment, emit an escaped quote, then re-open.
  return s.replace(/'/g, `'\\''`);
}

/**
 * Emits a bash block. Each gate runs concurrently. Per-gate stdout+stderr lands
 * in a temp file; per-gate exit code lands in a sibling file. The aggregator
 * iterates the gates, prints `--- <name> failed (exit <code>) ---` + the last
 * 50 lines of the failing gate's log, and exits 0 if every gate passed.
 *
 * Empty input is a programmer error — fail loud at emit time rather than
 * shipping a bash block that no-ops silently.
 */
export function emitParallelGatesBlock(gates: readonly GateSpec[]): string {
  if (gates.length === 0) {
    throw new Error("emitParallelGatesBlock: gates must be non-empty");
  }
  for (const g of gates) {
    if (!/^[A-Za-z0-9_-]+$/.test(g.name)) {
      throw new Error(`emitParallelGatesBlock: invalid gate name "${g.name}"`);
    }
  }
  const launches = gates
    .map((g) => {
      const safeCmd = escapeForSingleQuotedBash(g.cmd);
      return `(timeout \${CREW_BASH_GATE_TIMEOUT_S:-60} bash -c '${safeCmd}' > "$LOGS/${g.name}.log" 2>&1; echo $? > "$LOGS/${g.name}.code") &`;
    })
    .join("\n");
  const names = gates.map((g) => g.name).join(" ");
  return [
    `LOGS=$(mktemp -d)`,
    `trap 'rm -rf "$LOGS"' EXIT`,
    launches,
    `wait`,
    `fail=0`,
    `for g in ${names}; do`,
    `  code=$(cat "$LOGS/$g.code")`,
    `  if [ "$code" != "0" ]; then`,
    `    echo "--- $g failed (exit $code) ---"`,
    `    tail -${TAIL_LINES} "$LOGS/$g.log"`,
    `    fail=1`,
    `  fi`,
    `done`,
    `exit $fail`
  ].join("\n");
}

/**
 * CLI entry: `bun run scripts/lib/parallel-gates.ts --emit lint,typecheck`
 * prints the bash block to stdout so the operator can pipe it into bash.
 * Each gate name is mapped to `bun run <name>` by default; pass `--cmd
 * <name>=<command>` to override.
 */
function parseEmitNames(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Parse a `name=command` override and store it on `overrides`. Returns false
// if the value doesn't contain `=` (caller treats as fatal arg error).
function applyCmdOverride(value: string, overrides: Record<string, string>): boolean {
  const eq = value.indexOf("=");
  if (eq === -1) return false;
  overrides[value.slice(0, eq)] = value.slice(eq + 1);
  return true;
}

// Parse one --emit or --cmd argument. Returns the new index and updated names,
// or null to signal a fatal arg error.
function handleArg(
  argv: readonly string[],
  index: number,
  overrides: Record<string, string>,
  currentNames: string[] | null
): { nextIndex: number; names: string[] | null } | null {
  const flag = argv[index];
  if (flag === "--emit") {
    const v = argv[index + 1];
    if (v === undefined) return null;
    return { nextIndex: index + 2, names: parseEmitNames(v) };
  }
  if (flag === "--cmd") {
    const v = argv[index + 1];
    if (v === undefined) return null;
    if (!applyCmdOverride(v, overrides)) return null;
    return { nextIndex: index + 2, names: currentNames };
  }
  return { nextIndex: index + 1, names: currentNames };
}

function parseCli(argv: readonly string[]): { gates: GateSpec[] } | null {
  let names: string[] | null = null;
  const overrides: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const step = handleArg(argv, i, overrides, names);
    if (step === null) return null;
    names = step.names;
    i = step.nextIndex;
  }
  if (names === null || names.length === 0) return null;
  return {
    gates: names.map((n) => ({ name: n, cmd: overrides[n] ?? `bun run ${n}` }))
  };
}

function isMainEntry(): boolean {
  if (!process.argv[1]) return false;
  return (
    process.argv[1].endsWith("parallel-gates.ts") || process.argv[1].endsWith("parallel-gates.mjs")
  );
}

if (isMainEntry()) {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed === null) {
    console.error("usage: parallel-gates.ts --emit <name>,<name>,... [--cmd name=command ...]");
    process.exit(2);
  } else {
    console.log(emitParallelGatesBlock(parsed.gates));
  }
}
