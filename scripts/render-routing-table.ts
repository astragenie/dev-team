#!/usr/bin/env node
// scripts/render-routing-table.ts — FEAT-crew-architecture-review Section 7
//
// Renders docs/routing-table.md from docs/routing-table.yaml (the
// authoritative machine-readable source). docs/routing-table.md is a
// generated view — never hand-edit it; edit the .yaml and re-run this
// script, or run `node scripts/render-routing-table.ts --check` in CI to
// assert the committed .md matches a fresh render (drift = fail), the same
// pattern already used by validate-contracts.ts's regenerated-file check.
//
// Static narrative content (intro, the builder-matrix rationale prose, the
// docs-comms migration note, Usage / Design principles) is NOT modeled in
// the YAML — it lives in this file as template strings, since it isn't
// signal -> route_to -> notes row data. Only the tabular routing rows are
// data-driven.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { parseRoutingTable, type RoutingRow, type RoutingSection } from "./lib/routing/schema.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const YAML_PATH = path.join(REPO_ROOT, "docs", "routing-table.yaml");
const MD_PATH = path.join(REPO_ROOT, "docs", "routing-table.md");

/** Escapes literal `|` so it can't be misread as a table-cell delimiter. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function tableRow(cells: string[]): string {
  return `| ${cells.map(escapeCell).join(" | ")} |`;
}

function renderTable(headers: string[], rows: string[][]): string {
  const lines = [tableRow(headers), tableRow(headers.map(() => "---"))];
  for (const row of rows) lines.push(tableRow(row));
  return lines.join("\n");
}

const SECTION_META: Record<
  Exclude<RoutingSection, "builder-matrix">,
  { heading: string; description: string }
> = {
  "workflow-signals": {
    heading: "### Workflow signals",
    description: "_New work, bugs, chores, ambiguous scope, release, and session-start routing._"
  },
  "review-gates": {
    heading: "### Review + quality gates",
    description:
      "_Code review, quality enforcement, TDD, security, model-selection, and validation-skip decisions._"
  },
  "code-language": {
    heading: "### Code & language",
    description: "_Language- and framework-specific build signals._"
  },
  architecture: {
    heading: "### Architecture",
    description: "_ADR authoring, system design, database, cloud infra, API contract decisions._"
  },
  "infra-ops": {
    heading: "### Infra & ops",
    description:
      "_CI/CD, IaC, Terraform, incident response, performance benchmarks, web UI validation._"
  },
  research: {
    heading: "### Research",
    description: "_Library lookups, MS docs, bug root cause, multi-source synthesis._"
  },
  "docs-comms": {
    heading: "### Docs & comms",
    description: "_API documentation, diagram authoring, commit messages, handoff CLI._"
  },
  ux: {
    heading: "### UX",
    description: "_UX design, interaction design, accessibility._"
  },
  "crew-internals": {
    heading: "### Crew internals",
    description:
      "_Plugin authoring, agent edits, cost analysis, model selection, autonomous_safe flags._"
  }
};

const DOCS_COMMS_MIGRATION_NOTE = `<!-- Migration note (FEAT-124, hero-crew v0.20.0, 2026-06-07 — TTL 2026-12-07):
     The prior hero-crew copywriter agent (subagent identifier: crew + colon
     + copywriter) was hard-removed in v0.20.0. Any external workflow still
     dispatching that identifier should migrate to subagent identifier
     loop + colon + document-writer. Loop v0.29.0 is the minimum required
     version (scope-extended to cover API docs + diagram captions). -->
`;

const HEADER = `# Routing Table

Prescriptive heuristic map that the dispatcher consults at session start to classify incoming work and dispatch to the right role(s). Each row maps an observed signal (task type, pattern, or condition) to a destination role and workflow guidance.

Anything ambiguous, blocked, or spanning multiple tiers routes to **the dispatcher** (re-scope inline; no agent involved) for re-scoping.

## Builder routing matrix (FEAT-170 SLICE-C)

\`commands/orchestrate-slice.md\` Step 3 dispatch consults the slice classifier (\`scripts/orchestrate-slice-classify.ts\`) which now exposes \`SPLIT_BUILD\`, \`FE_ONLY\`, \`BE_ONLY\` signals from FEAT/slice frontmatter \`tags\`:
`;

const BUILDER_MATRIX_OUTRO = `
Rationale: \`crew:fullstack-dev\` previously ate every untagged + every single-stack slice. The generalist agent paid every dispatch cost including specialist-territory slices. SLICE-C routes specialists when FEAT declares stack/surface tags. For untagged slices, \`classifyChangedFiles()\` in \`scripts/orchestrate-slice-classify.ts\` detects pure-TS-tooling work (script/test/eval edits) and routes to \`backend-dev\`, reserving fullstack-dev for genuine generalist use cases (agent/skill/hook/doc edits that lack surface/stack tags). See \`commands/orchestrate-slice.md\` "Builder routing" section for the full dispatch matrix.

---
`;

const FOOTER = `
## Usage

1. **At session start**: Dispatcher or verifier retrieves bounded context with \`crew:brief-me\`.
2. **Incoming work**: Classify the signal using the table above.
3. **Route to role**: Dispatch with clear scope boundary; cite this table in the handoff.
4. **Ambiguous or cross-cutting**: Route to the dispatcher (re-scope inline) for re-scoping instead of improvising scope.
5. **Production-bound**: Always escalate to explicit human approval before promoting.

## Design principles

- **One role per task** except for brief handoffs (dispatcher + fullstack-dev, reviewer + release-engineer).
- **Explicit is better than implicit** — ambiguous signal always goes to dispatcher.
- **No LLM router** — use heuristics + human judgment.
- **Humans stay in control of production** — no automation for live-customer promotions.
`;

// Render order derives from SECTION_META's key order — the compiler already
// forces every non-builder-matrix section enum member into SECTION_META, so
// deriving here means a new section cannot silently drop out of the render.
const SECTION_ORDER = Object.keys(SECTION_META) as Array<Exclude<RoutingSection, "builder-matrix">>;

function rowsFor(rows: RoutingRow[], section: RoutingSection): RoutingRow[] {
  return rows.filter((r) => r.section === section);
}

export function render(rows: RoutingRow[]): string {
  const parts: string[] = [HEADER];

  const builderRows = rowsFor(rows, "builder-matrix");
  parts.push(
    renderTable(
      ["Tags resolve to", "Changed-file signal", "Builder dispatch"],
      builderRows.map((r) => [r.signal, r.notes ?? "", r.route_to])
    )
  );
  parts.push(BUILDER_MATRIX_OUTRO);

  for (const section of SECTION_ORDER) {
    const meta = SECTION_META[section];
    parts.push(meta.heading, "", meta.description, "");
    if (section === "docs-comms") parts.push(DOCS_COMMS_MIGRATION_NOTE);
    const sectionRows = rowsFor(rows, section);
    parts.push(
      renderTable(
        ["Signal", "Route to", "Notes"],
        sectionRows.map((r) => [r.signal, r.route_to, r.notes ?? ""])
      )
    );
    parts.push("");
  }

  parts.push("---", FOOTER);
  return (
    parts
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const raw = await fs.readFile(YAML_PATH, "utf8");
  const data = parseYaml(raw);
  const table = parseRoutingTable(data); // throws on schema mismatch
  const rendered = render(table.rows);

  if (checkMode) {
    let committed: string;
    try {
      committed = await fs.readFile(MD_PATH, "utf8");
    } catch {
      console.error(`render-routing-table --check: ${MD_PATH} does not exist`);
      process.exitCode = 1;
      return;
    }
    if (committed !== rendered) {
      console.error(
        "render-routing-table --check: docs/routing-table.md is stale relative to docs/routing-table.yaml.\n" +
          "Run `node scripts/render-routing-table.ts` to regenerate, then commit the result."
      );
      process.exitCode = 1;
      return;
    }
    console.log("render-routing-table --check: OK (docs/routing-table.md matches a fresh render)");
    return;
  }

  await fs.writeFile(MD_PATH, rendered, "utf8");
  console.log(`Wrote ${MD_PATH} (${table.rows.length} rows)`);
}

// Only run as a CLI entry point — importers (e.g. validate-configs.ts) get
// just the `render` function, not the write-to-disk / --check side effect.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
