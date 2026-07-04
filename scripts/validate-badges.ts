#!/usr/bin/env node

// Badge single-source-of-truth validator. See FEAT-181 / SLICE-194 for the
// drift this closes: adding a workflow badge touches three unlinked places
// (BADGE_TABLE in scripts/lib/workflow-state.ts, the `mark-badge` CLI
// help/accept text in scripts/crew.ts, and docs/standards/badge-catalog.md)
// with nothing enforcing they agree. BADGE_TABLE is the runtime authority;
// this validator cross-checks the other two against it.
//
// Errors (fail CI):
//   - a badge in BADGE_TABLE is missing from the CLI help/accept list
//   - a badge in BADGE_TABLE is missing from the catalog doc
//   - the CLI help/accept list names a badge with no BADGE_TABLE entry
//   - the catalog doc lists a badge with no BADGE_TABLE entry

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_WORKFLOW_STATE_PATH = path.join(REPO_ROOT, "scripts", "lib", "workflow-state.ts");
const DEFAULT_CREW_CLI_PATH = path.join(REPO_ROOT, "scripts", "crew.ts");
const DEFAULT_CATALOG_PATH = path.join(REPO_ROOT, "docs", "standards", "badge-catalog.md");

/** Extract the badge names keyed at the top level of BADGE_TABLE. Exported for testability. */
export function extractBadgeTableNames(text: string, label = "workflow-state.ts"): string[] {
  const startMarker = "const BADGE_TABLE: Record<string, BadgeSpec> = {";
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`${label}: BADGE_TABLE declaration not found`);
  }
  const braceStart = startIdx + startMarker.length - 1;
  let depth = 0;
  let endIdx = -1;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    throw new Error(`${label}: could not find closing brace for BADGE_TABLE`);
  }
  const body = text.slice(braceStart + 1, endIdx);
  const names: string[] = [];
  const keyRe = /^\s*(\w+):\s*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = keyRe.exec(body)) !== null) {
    names.push(match[1] as string);
  }
  return names;
}

/** Extract the badge names the `mark-badge` CLI help text advertises (main list + noted aliases). */
export function extractCliBadgeNames(text: string, label = "crew.ts"): string[] {
  const helpMatch = text.match(/"mark-badge":\s*"((?:[^"\\]|\\.)*)"/s);
  if (!helpMatch || helpMatch[1] === undefined) {
    throw new Error(`${label}: "mark-badge" help entry not found`);
  }
  const help = helpMatch[1];
  const listMatch = help.match(/--badge ([\w|]+)/);
  if (!listMatch || listMatch[1] === undefined) {
    throw new Error(`${label}: "mark-badge" help text has no --badge accept-list`);
  }
  const names = listMatch[1].split("|");
  const aliasRe = /\((\w+) accepted as backward-compat alias\)/g;
  let aliasMatch: RegExpExecArray | null;
  while ((aliasMatch = aliasRe.exec(help)) !== null) {
    names.push(aliasMatch[1] as string);
  }
  return names;
}

/** Extract the badge names listed in the catalog doc's `| \`name\` | ... |` table rows. */
export function extractCatalogBadgeNames(text: string): string[] {
  const names: string[] = [];
  const rowRe = /^\|\s*`(\w+)`\s*\|/gm;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(text)) !== null) {
    names.push(match[1] as string);
  }
  return names;
}

function diffSets(sourceOfTruth: Set<string>, other: Set<string>, otherLabel: string): string[] {
  const errors: string[] = [];
  for (const name of sourceOfTruth) {
    if (!other.has(name)) errors.push(`"${name}" is in BADGE_TABLE but missing from ${otherLabel}`);
  }
  for (const name of other) {
    if (!sourceOfTruth.has(name)) {
      errors.push(`"${name}" is in ${otherLabel} but has no BADGE_TABLE handler`);
    }
  }
  return errors;
}

export interface ValidateBadgesOptions {
  workflowStatePath?: string;
  crewCliPath?: string;
  catalogPath?: string;
}

export async function validateBadges(options: ValidateBadgesOptions = {}) {
  const workflowStatePath = options.workflowStatePath ?? DEFAULT_WORKFLOW_STATE_PATH;
  const crewCliPath = options.crewCliPath ?? DEFAULT_CREW_CLI_PATH;
  const catalogPath = options.catalogPath ?? DEFAULT_CATALOG_PATH;

  const [workflowStateText, crewCliText, catalogText] = await Promise.all([
    fs.readFile(workflowStatePath, "utf8"),
    fs.readFile(crewCliPath, "utf8"),
    fs.readFile(catalogPath, "utf8")
  ]);

  const badgeTableNames = new Set(extractBadgeTableNames(workflowStateText));
  const cliNames = new Set(extractCliBadgeNames(crewCliText));
  const catalogNames = new Set(extractCatalogBadgeNames(catalogText));

  const errors = [
    ...diffSets(badgeTableNames, cliNames, "the mark-badge CLI accept-list"),
    ...diffSets(badgeTableNames, catalogNames, "docs/standards/badge-catalog.md")
  ];

  return { ok: errors.length === 0, errors, badgeCount: badgeTableNames.size };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateBadges();
  if (!result.ok) {
    console.error(`Badge validation failed: ${result.errors.length} drift(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Badges OK: ${result.badgeCount} badge(s) aligned across BADGE_TABLE, CLI, and catalog.`
    );
  }
}
