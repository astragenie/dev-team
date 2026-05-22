#!/usr/bin/env node

// Lightweight manifest sanity check. Not a replacement for the full
// `claude plugin validate`, which needs an authenticated Claude CLI and is
// not available in headless CI. This script checks the invariants we have
// hit in practice: required fields present, version fields in sync,
// marketplace entries reference real plugin names, version strings are
// parseable as semver-ish.
//
// validateManifests() is exported so the same checks can run from a test
// without spawning a subprocess. The entry point at the bottom prints +
// sets process.exitCode on failure; it does NOT call process.exit, so
// callers that `await import` this module are not killed.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function checkRequiredFields(manifest, label, requiredFields, fail) {
  for (const field of requiredFields) {
    if (isMissing(manifest[field])) {
      fail(`${label}: missing required field "${field}"`);
    }
  }
}

function checkVersions(plugin, pkg, fail) {
  if (!SEMVER_RE.test(plugin.version)) {
    fail(`plugin.json: version "${plugin.version}" is not parseable semver`);
  }
  if (!SEMVER_RE.test(pkg.version)) {
    fail(`package.json: version "${pkg.version}" is not parseable semver`);
  }
  if (plugin.version !== pkg.version) {
    fail(`version drift: plugin.json=${plugin.version}, package.json=${pkg.version}`);
  }
}

function checkOwnMarketplaceEntry(plugin, marketplace, fail) {
  const ownEntry = marketplace.plugins.find((entry) => entry.name === plugin.name);
  if (!ownEntry) {
    fail(`marketplace.json: no entry for own plugin name "${plugin.name}"`);
    return;
  }
  if (ownEntry.version !== plugin.version) {
    fail(
      `marketplace.json: entry "${plugin.name}" version=${ownEntry.version} but plugin.json=${plugin.version}`
    );
  }
}

function checkMarketplaceEntries(marketplace, fail) {
  for (const entry of marketplace.plugins) {
    if (!entry.name) fail(`marketplace.json: a plugins[] entry is missing "name"`);
    if (!entry.version || !SEMVER_RE.test(entry.version)) {
      fail(
        `marketplace.json: entry "${entry.name}" version "${entry.version}" is not parseable semver`
      );
    }
    if (!entry.source) fail(`marketplace.json: entry "${entry.name}" missing "source"`);
  }
}

export async function validateManifests(repoRoot) {
  const failures = [];
  const fail = (msg) => failures.push(msg);

  const plugin = await readJson(path.join(repoRoot, ".claude-plugin", "plugin.json"));
  const marketplace = await readJson(path.join(repoRoot, ".claude-plugin", "marketplace.json"));
  const pkg = await readJson(path.join(repoRoot, "package.json"));

  checkRequiredFields(
    plugin,
    "plugin.json",
    ["name", "version", "description", "author", "license"],
    fail
  );
  checkRequiredFields(marketplace, "marketplace.json", ["name", "owner", "plugins"], fail);
  checkVersions(plugin, pkg, fail);
  checkOwnMarketplaceEntry(plugin, marketplace, fail);
  checkMarketplaceEntries(marketplace, fail);

  return { ok: failures.length === 0, failures, plugin, marketplace, pkg };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  const entryPath = path.resolve(process.argv[1]);
  const thisPath = fileURLToPath(import.meta.url);
  return entryPath === thisPath;
}

if (isMainEntry()) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validateManifests(repoRoot);
  if (!result.ok) {
    console.error("Manifest validation failed:");
    for (const f of result.failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("Manifests OK:");
    console.log(`  plugin.json     ${result.plugin.name}@${result.plugin.version}`);
    console.log(`  package.json    ${result.pkg.name}@${result.pkg.version}`);
    console.log(`  marketplace.json (${result.marketplace.plugins.length} entries)`);
    for (const entry of result.marketplace.plugins) {
      console.log(`    - ${entry.name}@${entry.version}`);
    }
  }
}
