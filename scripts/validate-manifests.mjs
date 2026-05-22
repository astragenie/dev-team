#!/usr/bin/env node

// Lightweight manifest sanity check. Not a replacement for the full
// `claude plugin validate`, which needs an authenticated Claude CLI and is
// not available in headless CI. This script checks the invariants we have
// hit in practice: required fields present, version fields in sync,
// marketplace entries reference real plugin names, version strings are
// parseable as semver-ish.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
function fail(msg) {
  failures.push(msg);
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, "utf8"));
}

const pluginPath = path.join(repoRoot, ".claude-plugin", "plugin.json");
const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");
const packagePath = path.join(repoRoot, "package.json");

const plugin = await readJson(pluginPath);
const marketplace = await readJson(marketplacePath);
const pkg = await readJson(packagePath);

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

for (const [label, manifest, requiredFields] of [
  ["plugin.json", plugin, ["name", "version", "description", "author", "license"]],
  ["marketplace.json", marketplace, ["name", "owner", "plugins"]]
]) {
  for (const field of requiredFields) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === "") {
      fail(`${label}: missing required field "${field}"`);
    }
  }
}

if (!SEMVER_RE.test(plugin.version))
  fail(`plugin.json: version "${plugin.version}" is not parseable semver`);
if (!SEMVER_RE.test(pkg.version))
  fail(`package.json: version "${pkg.version}" is not parseable semver`);

if (plugin.version !== pkg.version) {
  fail(`version drift: plugin.json=${plugin.version}, package.json=${pkg.version}`);
}

const ownEntry = marketplace.plugins.find((entry) => entry.name === plugin.name);
if (!ownEntry) {
  fail(`marketplace.json: no entry for own plugin name "${plugin.name}"`);
} else if (ownEntry.version !== plugin.version) {
  fail(
    `marketplace.json: entry "${plugin.name}" version=${ownEntry.version} but plugin.json=${plugin.version}`
  );
}

for (const entry of marketplace.plugins) {
  if (!entry.name) fail(`marketplace.json: a plugins[] entry is missing "name"`);
  if (!entry.version || !SEMVER_RE.test(entry.version)) {
    fail(
      `marketplace.json: entry "${entry.name}" version "${entry.version}" is not parseable semver`
    );
  }
  if (!entry.source) fail(`marketplace.json: entry "${entry.name}" missing "source"`);
}

if (failures.length > 0) {
  console.error("Manifest validation failed:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log("Manifests OK:");
console.log(`  plugin.json     ${plugin.name}@${plugin.version}`);
console.log(`  package.json    ${pkg.name}@${pkg.version}`);
console.log(`  marketplace.json (${marketplace.plugins.length} entries)`);
for (const entry of marketplace.plugins) {
  console.log(`    - ${entry.name}@${entry.version}`);
}
