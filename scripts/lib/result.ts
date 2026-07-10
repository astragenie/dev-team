/**
 * Typed Result for domain operations with expected failure modes.
 *
 * Use for: validation errors, business-rule violations, not-found, conflicts.
 * Do NOT use for: infrastructure errors (fs ENOENT, network) — those still throw
 * and are caught at the CLI entrypoint and mapped to exit codes.
 *
 * W2 adoption: the implementation now lives in `@astragenie/plugin-std` (this
 * module was the original seed for it). Re-exported here so the ~7 in-repo
 * importers keep their `./result.ts` path unchanged. plugin-std's `Result`
 * defaults `E = PluginError`; every dev-team call site supplies `E` explicitly,
 * so the default is inert and behavior is identical.
 *
 * See: standards/typescript/coding-conventions.md §Result, §Discriminated unions.
 */
export { ok, err, map, flatMap } from "@astragenie/plugin-std";
export type { Result } from "@astragenie/plugin-std";
