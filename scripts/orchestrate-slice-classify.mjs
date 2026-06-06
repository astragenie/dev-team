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

/**
 * @param {object} opts
 * @param {string} opts.slicePath
 */
export async function classifySlice(opts) {
  const text = await fs.readFile(opts.slicePath, "utf8");
  const fm = parseFrontmatter(text);
  /** @type {string[]} */
  const tags = Array.isArray(fm?.tags) ? fm.tags : [];
  const skip = Array.isArray(fm?.skip) ? fm.skip : [];

  const FE = hasFrontend(tags);
  const BE = hasBackend(tags);

  const NEEDS_CONTRACT = computeNeedsContract(fm, tags, FE, BE);
  const NEEDS_UX = computeNeedsUx(fm, FE);
  const SPLIT_BUILD = FE && BE && !skip.includes("split-build");

  return { SPLIT_BUILD, NEEDS_CONTRACT, NEEDS_UX, tags, skip };
}

/**
 * @param {string[]} tags
 * @param {Set<string>} set
 */
function tagsHaveAny(tags, set) {
  return tags.some((t) => set.has(t));
}

/** @param {string[]} tags */
function hasFrontend(tags) {
  return tagsHaveAny(tags, FE_SURFACE) || tagsHaveAny(tags, FE_STACK);
}

/** @param {string[]} tags */
function hasBackend(tags) {
  return tagsHaveAny(tags, BE_SURFACE) || tagsHaveAny(tags, BE_STACK);
}

/**
 * @param {any} fm
 * @param {string[]} tags
 * @param {boolean} FE
 * @param {boolean} BE
 */
function computeNeedsContract(fm, tags, FE, BE) {
  if (fm?.needs_contract === true) return true;
  if (fm?.needs_contract === false) return false;
  return tagsHaveAny(tags, BE_SURFACE) || (FE && BE);
}

/**
 * @param {any} fm
 * @param {boolean} FE
 */
function computeNeedsUx(fm, FE) {
  if (fm?.needs_ux === true) return true;
  if (fm?.needs_ux === false) return false;
  return FE;
}

/** @param {string} text */
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return parseYaml(m[1]);
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
