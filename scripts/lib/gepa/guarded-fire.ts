// guarded-fire.ts — shared timeout-race helper for fire-and-forget capture
// paths (runner-plugin issue #360 fix-forward).
//
// Root cause this module fixes: capture-failure-trial-guard.ts's original
// Promise.race([work, timeoutAfter(ms)]) bounded the LOGICAL await (the
// promise a caller sees resolves at min(work duration, ms)) but did NOT
// bound OS-process wall-time. A plain `setTimeout` is a *ref'd* handle by
// default — Promise.race does not cancel the losing branch, so even after
// the race resolves via `work` finishing first, the timer keeps ticking in
// the background until it naturally fires at `ms`. Because Node only exits
// once every ref'd handle has drained, a caller who never explicitly calls
// process.exit() (e.g. scripts/crew.ts's `void main()` entrypoint) pays the
// FULL ceiling in wall-clock process lifetime on every single call — even
// on the fast/warm path where the real work finished in a few ms. That is
// what made every ceremony + gate write slower repo-wide.
//
// Fix: `.unref()` the race timer. This does not change when the timer
// fires or when the returned promise resolves (Promise.race semantics are
// untouched) — it only tells Node "don't count this handle when deciding
// whether to keep the process alive." Combined with detaching the
// fire-and-forget call at the use site (never inline-awaited), a slow/cold
// capture can no longer add wall-time to either the logical caller's await
// chain or the OS process's exit.
//
// Trade accepted (documented at every fire-and-forget call site): if the
// process exits before a detached guarded call settles, the underlying
// work (import + write) is abandoned mid-flight and its result is dropped.
// These captures are always derived duplicates of a source of truth
// (astramem for learnings, the GEPA trial corpus for reflection) — a
// dropped capture is a correctness no-op, never a data-loss incident.

export const DEFAULT_GUARD_TIMEOUT_MS = 1500;

function timeoutAfter(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve("timeout"), ms);
    // Never let this timer, by itself, keep the process alive — see header.
    timer.unref?.();
  });
}

/**
 * Race `run()` against a `timeoutMs` ceiling. Never throws, never blocks
 * the caller beyond `timeoutMs` — on timeout OR error, the result is
 * simply dropped (silently, matching the fire-and-forget contract every
 * capture point in this codebase follows). The race timer is `.unref()`'d,
 * so an unawaited (fire-and-forget) call never holds the OS process open
 * on its own.
 */
export async function fireGuarded(
  run: () => Promise<void>,
  timeoutMs: number = DEFAULT_GUARD_TIMEOUT_MS
): Promise<void> {
  try {
    await Promise.race([run(), timeoutAfter(timeoutMs)]);
  } catch {
    // Fire-and-forget: never propagate.
  }
}
