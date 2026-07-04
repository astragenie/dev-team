---
description: Run a per-agent eval suite under a fileLockManager guard. Wraps `bun run evals` so concurrent runs for the same agent cannot corrupt the trial JSONL store.
allowed-tools: Bash
---

# /crew:gepa-eval

Run the eval suite for a single agent under a `fileLockManager` lock (from `@astragenie/gepa-core`). The lock prevents two concurrent runs writing the same `<agent>.jsonl` file in the trial store.

## Usage

```
/crew:gepa-eval <agent> [--live] [--judge <name>] [--validate] [--split N/M]
```

Flags:
- `<agent>` — required. Agent name (e.g. `fullstack-dev`, `reviewer`, `verifier`).
- `--live` — actually call the judge (vs. dry-run mode). Default: dry-run.
- `--judge <name>` — override the judge configured in `evals/agents/<agent>.yaml`.
- `--validate` — fire validate_with chain (cross-judge disagreement detection).
- `--split N/M` — split eval cases into train/heldOut tranches via deterministic hashing. `N` cases land in train, `M` in heldOut. See `scripts/lib/gepa/split-train-heldout.ts`.

## Behavior

1. Resolve `<agent>` to a spec file at `evals/agents/crew-<agent>.yaml`.
2. Acquire `fileLockManager.acquire(agent, "eval")` lock.
3. If lock returns `null` (another run holds it), exit code 2 with `lock_held_by_other_process`.
4. Run `bun run evals --prompt <agent>` with passed flags.
5. Release the lock on exit (success OR failure).

## Exit codes

- `0` — eval completed; result JSON written under `evals/runs/`.
- `1` — eval failed (judge error, fixture missing, etc.); lock released.
- `2` — bad args OR lock could not be acquired.

## See also

- `commands/gepa-history.md` — inspect recent trials.
- `evals/agents/crew-<agent>.yaml` — per-agent eval config.
- `scripts/lib/gepa/run-with-lock.ts` — lock-wrap implementation.
- `scripts/lib/gepa/split-train-heldout.ts` — train/heldOut splitter.
