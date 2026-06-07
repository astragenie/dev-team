/**
 * Typed Result for domain operations with expected failure modes.
 *
 * Use for: validation errors, business-rule violations, not-found, conflicts.
 * Do NOT use for: infrastructure errors (fs ENOENT, network) — those still throw
 * and are caught at the CLI entrypoint and mapped to exit codes.
 *
 * See: standards/typescript/coding-conventions.md §Result, §Discriminated unions.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  r.ok ? ok(f(r.value)) : r;

export const flatMap = <T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> =>
  r.ok ? f(r.value) : r;
