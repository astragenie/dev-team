// write.ts — writeDeploymentGuidance.
// Part of the split from deployment-guidance.mjs (AC-3).

import fs from "node:fs/promises";
import path from "node:path";
import { ok, err } from "../result.ts";
import type { Result } from "../result.ts";
import { discoverDeploymentClues, guidancePath } from "./read.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function toList(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniq(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

function renderField(label: string, value: string | null | undefined): string {
  return `- ${label}: ${value || "-"}`;
}

function renderListField(label: string, value: string | string[] | null | undefined): string {
  const items = Array.isArray(value) ? value : toList(value);
  if (items.length === 0) {
    return `- ${label}: -`;
  }
  return [`- ${label}:`, ...items.map((item) => `  - ${item}`)].join("\n");
}

export interface DeploymentGuidanceFields {
  title?: string;
  owner?: string;
  discoveryStatus?: string;
  verifiedFrom?: string;
  summary?: string;
  build?: string;
  deploy?: string;
  environments?: string;
  logs?: string;
  metrics?: string;
  alerts?: string;
  telemetry?: string;
  clues?: string;
  missing?: string;
  refreshWhen?: string;
  next?: string;
}

export interface DeploymentGuidanceResult {
  kind: string;
  path: string;
  title: string;
  clues: string[];
}

/**
 * Write the deployment guidance file.
 * Returns Result<DeploymentGuidanceResult, Error>.
 */
export async function writeDeploymentGuidance(
  repoPath: string,
  fields: DeploymentGuidanceFields = {}
): Promise<Result<DeploymentGuidanceResult, Error>> {
  try {
    const filePath = guidancePath(repoPath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    const discovered = await discoverDeploymentClues(repoPath);
    const mergedClues = uniq([...discovered.clues, ...toList(fields.clues)]);
    const contents = [
      `# Deployment Guidance: ${fields.title || "Repo Deployment Model"}`,
      "",
      renderField("Updated", nowIso()),
      renderField("Owner", fields.owner || "lead-session"),
      renderField("Discovery Status", fields.discoveryStatus || "repo-derived"),
      renderListField("Verified From", fields.verifiedFrom),
      renderField("Summary", fields.summary),
      renderField("Build Path", fields.build),
      renderField("Deploy Path", fields.deploy),
      renderListField("Environments", fields.environments),
      renderField("Logs", fields.logs),
      renderField("Metrics", fields.metrics),
      renderField("Alerts / Incidents", fields.alerts),
      renderField("Telemetry / Events", fields.telemetry),
      renderListField("Source Clues", mergedClues),
      renderListField("Still Missing", fields.missing),
      renderField("Refresh When", fields.refreshWhen || fields.next),
      ""
    ].join("\n");

    await fs.writeFile(filePath, `${contents}\n`);

    return ok({
      kind: "deployment-guidance",
      path: filePath,
      title: fields.title || "Repo Deployment Model",
      clues: mergedClues
    });
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
