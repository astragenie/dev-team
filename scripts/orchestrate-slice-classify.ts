#!/usr/bin/env node

// Pure classification logic extracted from commands/orchestrate-slice.md so it
// is testable and reusable across the CLI + the command prompt. The command
// prompt mirrors the same logic; this module is the source of truth.

import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const FE_SURFACE = new Set(["surface:ui"]);
const FE_STACK = new Set(["stack:react"]);
const BE_SURFACE = new Set(["surface:api", "surface:schema"]);
const BE_STACK = new Set(["stack:csharp", "stack:node", "stack:python", "stack:go"]);

export async function classifySlice(opts: { slicePath: string }) {
  const text = await fs.readFile(opts.slicePath, "utf8");
  const fm = parseFrontmatter(text);
  const tags = Array.isArray(fm?.tags) ? (fm.tags as string[]) : [];
  const skip = Array.isArray(fm?.skip) ? (fm.skip as string[]) : [];

  const FE = hasFrontend(tags);
  const BE = hasBackend(tags);

  const NEEDS_CONTRACT = computeNeedsContract(fm, tags, FE, BE);
  const NEEDS_UX = computeNeedsUx(fm, FE);
  const SPLIT_BUILD = FE && BE && !skip.includes("split-build");

  return { SPLIT_BUILD, NEEDS_CONTRACT, NEEDS_UX, tags, skip };
}

function tagsHaveAny(tags: string[], set: Set<string>) {
  return tags.some((t) => set.has(t));
}

function hasFrontend(tags: string[]) {
  return tagsHaveAny(tags, FE_SURFACE) || tagsHaveAny(tags, FE_STACK);
}

function hasBackend(tags: string[]) {
  return tagsHaveAny(tags, BE_SURFACE) || tagsHaveAny(tags, BE_STACK);
}

function computeNeedsContract(
  fm: Record<string, unknown> | null,
  tags: string[],
  FE: boolean,
  BE: boolean
) {
  if (fm?.needs_contract === true) return true;
  if (fm?.needs_contract === false) return false;
  return tagsHaveAny(tags, BE_SURFACE) || (FE && BE);
}

function computeNeedsUx(fm: Record<string, unknown> | null, FE: boolean) {
  if (fm?.needs_ux === true) return true;
  if (fm?.needs_ux === false) return false;
  return FE;
}

function parseFrontmatter(text: string) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m || m[1] === undefined) return null;
  return parseYaml(m[1]) as Record<string, unknown> | null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const p = process.argv[2];
  if (!p) {
    console.error("usage: orchestrate-slice-classify.mjs <slice-path>");
    process.exit(2);
  }
  const r = await classifySlice({ slicePath: p });
  console.log(JSON.stringify(r, null, 2));
}
