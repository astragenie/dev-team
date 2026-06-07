/**
 * Branded string types for domain identifiers. Prevents accidental string-mixing
 * at call sites — e.g. passing a SliceId where a FeatId is expected is now a
 * compile error.
 *
 * See: standards/typescript/coding-conventions.md §Branded types for IDs.
 */

declare const __brand: unique symbol;
export type Brand<T, B> = T & { readonly [__brand]: B };

export type RepoPath = Brand<string, 'RepoPath'>;
export type SliceId = Brand<string, 'SliceId'>;
export type FeatId = Brand<string, 'FeatId'>;
export type ArtifactPath = Brand<string, 'ArtifactPath'>;
export type CostReportPath = Brand<string, 'CostReportPath'>;
export type BadgeName = Brand<string, 'BadgeName'>;

export const RepoPath = (s: string): RepoPath => s as RepoPath;
export const SliceId = (s: string): SliceId => s as SliceId;
export const FeatId = (s: string): FeatId => s as FeatId;
export const ArtifactPath = (s: string): ArtifactPath => s as ArtifactPath;
export const CostReportPath = (s: string): CostReportPath => s as CostReportPath;
export const BadgeName = (s: string): BadgeName => s as BadgeName;
