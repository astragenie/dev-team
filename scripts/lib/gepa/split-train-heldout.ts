/**
 * scripts/lib/gepa/split-train-heldout.ts — SLICE-98
 *
 * Deterministic train/heldOut splitter for eval cases. Hash-based so the
 * same case always lands in the same split across runs (same seed) — no
 * accidental drift between cycles. Caller picks how many cases land in
 * each tranche via the `train` + `heldOut` opts.
 *
 * Why deterministic: held-out cases are the ones the optimizer CANNOT see
 * during training. If split membership shifts run-to-run, today's held-out
 * case becomes tomorrow's training case and the drift signal is poisoned.
 * Hash-of-case-id + seed pins membership.
 *
 * Why not just slice the array: when cases are added or reordered later,
 * positional slicing would shuffle the entire held-out set. Hash-based
 * keeps the existing splits stable as the corpus grows.
 */

import { createHash } from "node:crypto";

export interface Splittable {
  /** Stable case id — drives the hash. */
  id: string;
}

export interface SplitOpts {
  /** Target count in the train tranche. */
  train: number;
  /** Target count in the heldOut tranche. */
  heldOut: number;
  /**
   * Optional seed to vary the bucketing without changing the case set.
   * Default: empty string (= no seed mixing). Change the seed to rotate
   * which cases land in each tranche while keeping the split deterministic.
   */
  seed?: string;
}

export interface SplitResult<T extends Splittable> {
  train: T[];
  heldOut: T[];
}

/**
 * Split `cases` into train + heldOut tranches by hashing `id` + seed.
 *
 * If `opts.train + opts.heldOut < cases.length`, the leftover cases go
 * into `train` (default biased toward training data). If
 * `train + heldOut > cases.length`, both tranches are filled in order
 * until cases run out — `heldOut` is filled first (so the held-out
 * signal is preserved at small corpus sizes).
 *
 * Function is pure: same input + seed always returns same partition.
 */
export function splitTrainHeldout<T extends Splittable>(
  cases: T[],
  opts: SplitOpts,
): SplitResult<T> {
  const seed = opts.seed ?? "";
  // Sort by hash(seed + id). Stable ordering = deterministic membership.
  const sorted = [...cases].sort((a, b) => hashKey(seed, a.id).localeCompare(hashKey(seed, b.id)));

  // heldOut gets first slice (so small corpora still have a held-out set).
  const heldOutCount = Math.min(opts.heldOut, sorted.length);
  const heldOut = sorted.slice(0, heldOutCount);

  const remaining = sorted.slice(heldOutCount);
  const trainCount = Math.min(opts.train, remaining.length);
  const train = remaining.slice(0, trainCount);

  return { train, heldOut };
}

function hashKey(seed: string, id: string): string {
  return createHash("sha256").update(seed).update(":").update(id).digest("hex");
}

/**
 * Parse a `--split N/M` CLI flag into a SplitOpts (train=N, heldOut=M).
 * Returns null on malformed input — caller decides how to error.
 */
export function parseSplitFlag(arg: string): SplitOpts | null {
  const match = arg.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;
  const train = Number.parseInt(match[1] ?? "0", 10);
  const heldOut = Number.parseInt(match[2] ?? "0", 10);
  if (!Number.isFinite(train) || !Number.isFinite(heldOut)) return null;
  return { train, heldOut };
}
