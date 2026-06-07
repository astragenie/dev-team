// .claude/settings.json management: merges this plugin's hooks into the
// user's existing hooks config without duplicating Crew-owned entries and
// without dropping anything the user added themselves.
//
// isCrewHook recognizes both the current ("crew:") and legacy
// ("engineering-os:") namespaces so a re-run after the namespace rename
// cleanly replaces legacy registrations.

import fs from "node:fs/promises";
import path from "node:path";

import { indentJson, writeFileIfChanged } from "./util.ts";
import { DEFAULT_SETTINGS } from "./templates.ts";

interface HookEntry {
  command?: string;
  description?: string;
  hooks?: Array<{ command?: string; description?: string }>;
  [key: string]: unknown;
}

type HooksMap = Record<string, HookEntry[]>;

export function isCrewHook(entry: HookEntry | null | undefined): boolean {
  const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
  return hooks.some((hook) => {
    const command = hook?.command ?? "";
    const description = hook?.description ?? "";
    return (
      command.includes(".claude/hooks/log_event.sh") ||
      command.includes(".claude/hooks/check_git_gate.sh") ||
      description.startsWith("crew:") ||
      description.startsWith("engineering-os:")
    );
  });
}

export function mergeHooks(existingHooks: HooksMap = {}, desiredHooks: HooksMap = {}): HooksMap {
  const result: HooksMap = { ...existingHooks };
  for (const [eventName, hookDefs] of Object.entries(desiredHooks)) {
    const current = Array.isArray(result[eventName]) ? (result[eventName] as HookEntry[]) : [];
    const preserved = current.filter((entry) => !isCrewHook(entry));
    const nextEntries = [...preserved];
    const seen = new Set(nextEntries.map((item) => JSON.stringify(item)));
    for (const hookDef of hookDefs) {
      const serialized = JSON.stringify(hookDef);
      if (!seen.has(serialized)) {
        nextEntries.push(hookDef);
        seen.add(serialized);
      }
    }
    result[eventName] = nextEntries;
  }
  return result;
}

export async function updateSettings(repoPath: string, writes: string[]): Promise<void> {
  const settingsPath = path.join(repoPath, ".claude", "settings.json");
  const existing = await fs.readFile(settingsPath, "utf8").catch((): null => null);
  const current: { hooks?: HooksMap; [key: string]: unknown } = existing
    ? (JSON.parse(existing) as { hooks?: HooksMap; [key: string]: unknown })
    : {};
  const next = {
    ...current,
    hooks: mergeHooks(current.hooks, DEFAULT_SETTINGS.hooks as HooksMap)
  };

  const changed = await writeFileIfChanged(settingsPath, indentJson(next));
  if (changed) {
    writes.push(path.relative(repoPath, settingsPath));
  }
}
