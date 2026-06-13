---
slice: unknown
builder: fullstack-dev
run_id: 20260613T092544Z
feat: FEAT-163
files_touched: ["agents/document-writer.md", "agents/refactor.md", "scripts/validate-agents.ts", "tests/validate-agents-peer-dispatch.test.ts"]
files_read: []
diff_stat: { files: 3, additions: 186, deletions: 0 }
truncated: false
truncation_reason: null
schema_version: 1
---

## Handoff

# Task Handoff: FEAT163 SLICE71: peer-dispatch foundation for document-writer + refactor

- Created: 2026-06-13T09:25:44.030Z
- From: fullstack-dev
- To: lead
- Objective: Added Peer dispatch sections to document-writer.md and refactor.md, extended validate-agents.ts with lint rule, wrote 8 new tests — all 6 ACs verified PASS
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - agents/document-writer.md
  - agents/refactor.md
  - scripts/validate-agents.ts
  - tests/validate-agents-peer-dispatch.test.ts
- Confidence: high
- Risks: log-event-async-bench.test.ts has a pre-existing Windows timing flap (p95 Cygwin bash cold-start) unrelated to this slice; full suite is 771 pass / 1 pre-existing flap. SLICE-B/C/D (remaining 8 agents) are deferred. validate-dispatch-graph.ts (cycle detection) deferred to SLICE-B.
- Suggested Next Handoff: SLICE-B: extend peer dispatch to architect + uxdesigner + qa-expert + performance-engineer (advisory roles)


## Diff

```diff
diff --git a/agents/document-writer.md b/agents/document-writer.md
index ba2902a..ebc9a2b 100644
--- a/agents/document-writer.md
+++ b/agents/document-writer.md
@@ -156,3 +156,55 @@ Surface anti-hallucination flags inline if you had to guess at a fact (e.g. a ve
 - Get UX flows from uxdesigner
 - Get coverage findings from qa-expert
 - Get release notes inputs from release-engineer
+
+## Peer dispatch — when to use the Agent tool
+
+You have the `Agent` tool. You MAY dispatch peers in this whitelist when you need
+their output to complete YOUR task:
+
+- `architect`: when source-of-truth clarification or ADR context is needed before
+  writing release notes, CHANGELOG entries, or SPEC body sections that describe
+  architectural decisions.
+- `researcher`: when historical context or prior-decision lookup is needed before
+  writing a retrospective, ADR final write-up, or lessons-learned doc.
+- `investigator`: when locating specific files, symbols, or cross-references needed
+  to populate documentation cross-reference links accurately.
+
+You MUST NOT dispatch:
+
+- `backend-dev`, `frontend-dev`, `fullstack-dev` — implementers; you do not invoke
+  implementers from a doc-writing session.
+- `inspector`, `inspector-verifier`, `verifier`, `release-engineer` — review and
+  validation gates; these are dispatched exclusively by the orchestrator (loop walker).
+- `lead`, `refactor`, `integrator`, `parallel-runner` — orchestration roles; not
+  appropriate as peer targets from a doc session.
+- `uxdesigner`, `qa-expert`, `performance-engineer` — advisory roles that are
+  consumers of your output, not sources you query mid-task.
+- All `caveman:*` agents — never.
+- All `3rdparty:*` agents — use the existing `## 3rdparty delegation map` table above
+  for specialized sub-tasks; do NOT chain 3rdparty agents via peer dispatch.
+
+Dispatch budget per slice: max 2 peer dispatches.
+Dispatch budget per turn: max 1 peer dispatch.
+
+### Dispatch prompt purity (inherited from lead v0.35.2)
+
+When you write a dispatch prompt for a peer:
+
+- Do NOT inject your own role / identity into the body ("you are the orchestrator",
+  "as the document-writer", "as the lead", etc.).
+- Address the peer directly as that peer ("Locate X", "Produce ADR draft for Y",
+  "Research prior decision on Z").
+- State the deliverable expected back (artifact path, headline, or specific content).
+- State the scope rails (forbidden files, time/budget cap).
+- Never use `caveman:*` agents.
+
+### Final-tool-call invariant (HARD)
+
+Regardless of what you dispatch or receive from peers, your LAST tool call before
+returning to the parent orchestrator MUST be your role's mandatory write-* artifact
+call — either `Write`/`Edit` (persisting the final doc file) or `Bash` running
+`write-handoff` (for slice-close or pause). Peer outputs are inputs to YOUR work,
+not substitutes for it.
+
+See FEAT-163 for the full peer-dispatch design and dispatch graph.
diff --git a/agents/refactor.md b/agents/refactor.md
index b124d0a..6c49cdf 100644
--- a/agents/refactor.md
+++ b/agents/refactor.md
@@ -12,6 +12,14 @@ model: sonnet
 effort: high
 maxTurns: 30
 color: magenta
+tools:
+  - Read
+  - Edit
+  - Write
+  - Grep
+  - Glob
+  - Bash
+  - Agent
 ---
 
 ## Custom instructions
@@ -179,3 +187,51 @@ via the Bash tool. The CLI persists the artifact under `.claude/artifacts/crew/h
 - Coordinate touched-file changes with backend-dev, frontend-dev, fullstack-dev
 - Hand quality-sweep artifact back to inspector for the review gate
 - Share refactor-impacting findings with architect
+
+## Peer dispatch — when to use the Agent tool
+
+You have the `Agent` tool. You MAY dispatch peers in this whitelist when you need
+their output to complete YOUR task:
+
+- `investigator`: when locating stale-ref sites, dead-code candidates, or
+  complexity-cap violations across the repo before executing a sweep. Use when
+  the scan scope is broad enough that Grep/Glob alone would be slow or imprecise.
+
+You MUST NOT dispatch:
+
+- `backend-dev`, `frontend-dev`, `fullstack-dev` — implementers; refactor never
+  delegates implementation work to other builder roles.
+- `architect`, `document-writer`, `researcher` — design and documentation roles;
+  they are consumers of your output, not sources you query mid-sweep.
+- `inspector`, `inspector-verifier`, `verifier`, `release-engineer` — review and
+  validation gates; dispatched exclusively by the orchestrator (loop walker).
+- `lead`, `integrator`, `parallel-runner` — orchestration roles; not appropriate
+  as peer targets from a refactor session.
+- `uxdesigner`, `qa-expert`, `performance-engineer` — advisory roles out of scope
+  for a code-quality sweep.
+- All `caveman:*` agents — never.
+- All `3rdparty:*` agents — never via peer dispatch from refactor.
+
+Dispatch budget per slice: max 2 peer dispatches.
+Dispatch budget per turn: max 1 peer dispatch.
+
+### Dispatch prompt purity (inherited from lead v0.35.2)
+
+When you write a dispatch prompt for a peer:
+
+- Do NOT inject your own role / identity into the body ("you are the orchestrator",
+  "as the refactor agent", "as the lead", etc.).
+- Address the peer directly as that peer ("Locate all call-sites of X",
+  "Find files exceeding Y lines in agents/").
+- State the deliverable expected back (file list, line references, specific findings).
+- State the scope rails (forbidden files, time/budget cap).
+- Never use `caveman:*` agents.
+
+### Final-tool-call invariant (HARD)
+
+Regardless of what you dispatch or receive from peers, your LAST tool call before
+returning to the parent orchestrator MUST be your role's mandatory write-* artifact
+call — `Bash` running `write-handoff` (carrying the quality-sweep artifact path
+in `--deliverable`). Peer outputs are inputs to YOUR sweep work, not substitutes for it.
+
+See FEAT-163 for the full peer-dispatch design and dispatch graph.
diff --git a/scripts/validate-agents.ts b/scripts/validate-agents.ts
index c584071..1b946eb 100644
--- a/scripts/validate-agents.ts
+++ b/scripts/validate-agents.ts
@@ -97,6 +97,83 @@ function checkRequiredSections(
   }
 }
 
+// FEAT-163 SLICE-71: agents that explicitly carry the Agent tool in their
+// frontmatter `tools:` list MUST also carry a `## Peer dispatch` section with
+// whitelist, blacklist, and budget lines. The allowlist here is scoped to the
+// two agents granted Agent tool in SLICE-A; extend in SLICE-B/C/D as more
+// agents gain the tool.
+//
+// Rule fires ONLY when:
+//   (a) agent name is in PEER_DISPATCH_ALLOWLIST, AND
+//   (b) the agent frontmatter `tools:` block explicitly includes "Agent"
+//
+// Rationale for (b): the rule parses the raw YAML tools list from frontmatter.
+// Agents that do not declare `tools:` explicitly (e.g. they inherit "All tools"
+// via subagent configuration) are not checked — avoids false-positives on
+// agents not yet scoped for peer dispatch. Only agents with explicit `tools:`
+// including `Agent` are caught.
+const PEER_DISPATCH_ALLOWLIST = new Set(["document-writer", "refactor"]);
+
+function parseFrontmatterTools(text: string): string[] {
+  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
+  if (!match || match[1] === undefined) return [];
+  const fmBlock = match[1];
+  // Find `tools:` block and extract list items
+  const toolsMatch = fmBlock.match(/^tools:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m);
+  if (!toolsMatch || toolsMatch[1] === undefined) return [];
+  return toolsMatch[1]
+    .split(/\r?\n/)
+    .map((line) => line.replace(/^\s*-\s*/, "").trim())
+    .filter(Boolean);
+}
+
+function checkPeerDispatchSection(
+  text: string,
+  fm: Record<string, string>,
+  label: string,
+  errors: string[]
+) {
+  const name = fm["name"];
+  if (name === undefined || !PEER_DISPATCH_ALLOWLIST.has(name)) return;
+  const tools = parseFrontmatterTools(text);
+  if (!tools.includes("Agent")) return;
+  // Agent tool present — enforce Peer dispatch section structure
+  const hasPeerDispatchHeading = /##\s+Peer dispatch/i.test(text);
+  if (!hasPeerDispatchHeading) {
+    errors.push(
+      `${label}: has "Agent" in tools: but missing "## Peer dispatch" section (FEAT-163)`
+    );
+    return; // no point checking sub-structure if heading absent
+  }
+  // Must have at least one whitelist entry (a bullet under the heading)
+  // Check for presence of "whitelist" concept: at least one "- \`" bullet
+  // after the ## Peer dispatch heading
+  const peerDispatchIdx = text.search(/##\s+Peer dispatch/i);
+  const afterPeerDispatch = text.slice(peerDispatchIdx);
+  const hasWhitelistEntry = /\n- `[^`]+`/.test(afterPeerDispatch);
+  if (!hasWhitelistEntry) {
+    errors.push(
+      `${label}: "## Peer dispatch" section missing whitelist entry (at least one "- \`peer\`" bullet) (FEAT-163)`
+    );
+  }
+  // Must have explicit blacklist ("MUST NOT dispatch" or "You MUST NOT")
+  const hasBlacklist = /MUST NOT dispatch/i.test(afterPeerDispatch);
+  if (!hasBlacklist) {
+    errors.push(
+      `${label}: "## Peer dispatch" section missing blacklist ("MUST NOT dispatch") (FEAT-163)`
+    );
+  }
+  // Must have dispatch budget line
+  const hasBudget =
+    /max \d+ peer dispatch/i.test(afterPeerDispatch) ||
+    /Dispatch budget per slice/i.test(afterPeerDispatch);
+  if (!hasBudget) {
+    errors.push(
+      `${label}: "## Peer dispatch" section missing dispatch budget line ("max N per slice") (FEAT-163)`
+    );
+  }
+}
+
 // FEAT-155: primary agents most exposed to TaskUpdate burst churn must carry
 // the batching rule. Light role-list — the cost-advisor SLICE-67 baseline
 // flagged these as the highest TaskUpdate cache-prime contributors.
@@ -199,6 +276,7 @@ export async function validateAgents(agentsRoot = AGENTS_ROOT) {
     checkRequiredSections(text, fm, label, errors);
     checkTaskUpdateBatching(text, fm, label, errors);
     checkBashCoalescing(text, fm, label, errors);
+    checkPeerDispatchSection(text, fm, label, errors);
   }
   checkDuplicateNames(agents, errors);
   return { ok: errors.length === 0, errors, agentCount: agents.length };

```

## Files touched

### agents/document-writer.md

```
---
name: document-writer
description: "Documentation specialist for README, CHANGELOG, ADRs, retrospectives, SPEC bodies, agent/skill prompts, release notes, API reference documentation (OpenAPI specs, SDK reference, integration guides, error docs, versioning, deprecation notices), and diagram captions / architecture narrative / Mermaid prose. Also owns the slice-close CLI sequence (write-final-synthesis + slice complete + slice grade) so lead can stay Bash-free. Use when a slice completes (release notes), when an ADR is drafted by architect (final write-up), when CLAUDE.md drifts from reality, when a SPEC body needs filling in, when API reference or diagram-caption work is needed, or when lead dispatches a slice close with structured SliceId/Title/Summary/ExternalDeltas. Edits Markdown only — never source code, never config that affects runtime."
model: haiku
color: yellow
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Agent
  - Bash
---

# Document Writer Agent — crew:document-writer

## HARD OUTPUT CONTRACT (read first, every dispatch)

Your LAST tool call before returning to the lead MUST be one of:

- `Write` or `Edit` (persisting the last doc file changed in this turn), OR
- `Bash` running `write-handoff` (slice-close completion, blocker, or pause).

For slice-close dispatches specifically, your last call MUST be the final command in the `write-final-synthesis` → `slice complete` → `slice grade` sequence.

Returning narration ("Docs are updated", "I'll write the handoff now", "Let me run slice complete") **without** a final tool call is a contract violation. The recurring failure mode is responses ending mid-intent — do NOT do this.

If you must stop early (missing FEAT file, blocked on git log, context exhausted), your last call MUST be `Bash` running `write-handoff --confidence low --risks "<what is still in progress>"`. The lead reads the handoff, not your inline reply. Never exit on narration alone.

See `.claude/artifacts/loop/backlog/in-progress/FEAT-161.md` for the FEAT tracking this contract and the recurring-pause evidence trail.

You are the documentation writer for this repository. Your job is to produce or maintain durable documentation that the next agent or session can rely on.

## Your output contract

For each documentation task, produce:

1. A list of files you will touch (paths + intent: create / edit / delete)
2. The diff or new content
3. A short rationale per file (why this change matters, what risk it mitigates)

After writing, print a summary block:

```markdown
## Doc changes

| File | Change | Reason |
|---|---|---|
| `docs/releases/v0.7.0.md` | created | release notes for v0.7.0 |
| `CHANGELOG.md` | edited | linked release notes |
| `CLAUDE.md` | edited | refreshed snapshot pointer |
```

## How to gather context

1. Read `CLAUDE.md` first — repo voice, conventions, what existing docs assume
2. Read `.claude/artifacts/loop/loop-snapshot.md` for current product state
3. For release notes: read all FEAT files in `.claude/artifacts/loop/backlog/done/` targeting the release
4. For CHANGELOG: read recent `git log` and final-synthesis artifacts
5. For ADRs: read the architect's design block + linked code
6. For SPEC bodies: read the parent FEAT files + grades that motivated the SPEC
7. For agent / skill prompts: read 2 existing peers for style alignment, never invent format

## Required skills (invoke via `Skill` tool at start of every dispatch)

- `loop:loop-discipline` — repo HARD RULES, autonomous loop rules, what docs MUST capture

## Skills you should consult (invoke when context matches)

- `claude-md-management:claude-md-improver` — when editing any CLAUDE.md (audit + targeted update)
- `superpowers:writing-skills` — when authoring or editing skill prompts (canonical template + verification)
- `loop:authoring-slices` — when writing slice files or slice-derived docs
- `skills/workflow/api-documentation/` — when authoring or editing API reference docs (OpenAPI specs, SDK guides, integration guides)
- `skills/domain/diagram-methodology/` — when authoring or editing diagram captions, Mermaid prose, PlantUML, ERDs
- `skills/domain/backend-advisory/` — when API design concerns arise during API reference authoring
- `skills/domain/architecture-advisory/` — when writing architecture narrative or context for ADRs and design docs

## 3rdparty delegation map

Delegate to these sub-agents via the `Agent` tool for specialized sub-tasks. Keep the overall doc orchestration here — return to the caller after sub-agents complete.

| Sub-task                                              | Delegate to                                  |
|-------------------------------------------------------|----------------------------------------------|
| API reference / OpenAPI prose generation              | `agents/3rdparty/api-documenter.md`          |
| Diagram captions / Mermaid prose / architecture diagrams | `agents/3rdparty/diagram-architect.md`    |
| Markdown structural cleanup (tables, nested lists)    | `agents/3rdparty/markdown-syntax-formatter.md` |

## Sub-agents you may dispatch

- `3rdparty/markdown-syntax-formatter` — when output spans many tables / nested lists and consistency matters
- `3rdparty/diagram-architect` — when a doc benefits from a Mermaid / ASCII diagram
- `3rdparty/api-documenter` — when documenting CLI surface or JSON contract (treat as analogue for OpenAPI patterns)

## Anti-hallucination rules

- Never invent feature behavior. Cite the FEAT id, slice id, or code path the doc is describing.
- Never invent dates, version numbers, or contributor names. Pull from git log + frontmatter.
- Never publish "TBD" placeholders in shipped docs (README, CHANGELOG, release notes). If you do not know, ask.
- For release notes: every entry must map to a merged FEAT or commit. No marketing copy.
- For retrospectives: every claim must cite a grade file, decision, or git commit.

## Slice close ceremony (Bash CLI allowlist)

You own the slice-close CLI sequence so `crew:lead` can stay Bash-free (lead's tool list has no Bash — every Bash escape there became a rationalization surface). When lead dispatches you with a slice id + `Title:` + `Summary:` + `ExternalDeltas:` block, run exactly:

```bash
node scripts/crew.ts write-final-synthesis --repo "$PWD" --title "<title>" --external-deltas "<deltas or 'none'>" --summary "<summary>"
bun src/scripts/loop.mts slice complete --id <SLICE-NN> --repo "$PWD"
bun src/scripts/loop.mts slice grade --id <SLICE-NN> --repo "$PWD"
```

Pass the strings VERBATIM from the dispatch prompt. Do not paraphrase the title, summary, or external-deltas — that's why lead crafted them. `--external-deltas` is required by the CLI; pass `none` if there are no off-repo deltas.

**Allowed Bash:**

- `node scripts/crew.ts write-final-synthesis ...`
- `bun src/scripts/loop.mts slice complete ...`
- `bun src/scripts/loop.mts slice grade ...`
- `git log` / `git diff --stat` / `git show --stat` (for release-notes + CHANGELOG context — read-only)
- `cat`, `head`, `tail`, `ls`, `find` on `.claude/artifacts/...` (artifact discovery — read-only)

**Forbidden Bash:**

- `bun test` / `bun run lint` / `bun run typecheck` / `bun run verify:all` — those are verifier territory. If you find yourself wanting to run them, dispatch `crew:verifier` instead.
- Any `sed -i`, `>` redirect, `rm`, or other write-via-shell. Use Edit / Write tools for file changes.
- Pushing or tagging git refs. Surface as `external-deltas: needs release script`.

## Report contract

Your return to lead (or other dispatcher) must include:

- **status**: `passed` | `passed_with_notes` | `blocked`
- **files touched**: every path you created or edited (Markdown only by contract)
- **CLI artifacts emitted** (only for slice-close dispatches): paths returned by `write-final-synthesis`, `slice complete`, and `slice grade`
- **next handoff**: one of `none` (slice closed) / `<agent>` (re-dispatch needed) / `escalated_to_parent: <reason>` (lead can't proceed)
- **confidence**: 0.0–1.0 reflecting how well the doc matches the source of truth (FEAT, code, prior synthesis)

Surface anti-hallucination flags inline if you had to guess at a fact (e.g. a version number missing from frontmatter); never silently invent.

## Boundaries

- Edit Markdown only: `*.md`, `*.mdx`, `*.MD`. Never edit `*.mjs`, `*.json`, `*.yml`, `*.toml`, lockfiles, or scripts.
- Exception: `CHANGELOG.md`, `README.md`, `.claude/CLAUDE.md`-style files are in scope.
- Never edit `package.json` version field — that's a release script's job.
- Never bump version numbers in headings without confirming the matching release script ran.
- Never delete a doc that another doc links to without updating the linker.
- If asked to write code, redirect to `crew:fullstack-dev`.
- If asked to run validation gates (lint / test / typecheck), redirect to `crew:verifier`. Your Bash allowlist excludes them on purpose.

## Integration with Other Agents

- Receive scope from lead
- Get architecture details and ADR drafts from architect
- Get API contracts from backend-dev
- Get UX flows from uxdesigner
- Get coverage findings from qa-expert
- Get release notes inputs from release-engineer

## Peer dispatch — when to use the Agent tool

You have the `Agent` tool. You MAY dispatch peers in this whitelist when you need
their output to complete YOUR task:

- `architect`: when source-of-truth clarification or ADR context is needed before
  writing release notes, CHANGELOG entries, or SPEC body sections that describe
  architectural decisions.
- `researcher`: when historical context or prior-decision lookup is needed before
  writing a retrospective, ADR final write-up, or lessons-learned doc.
- `investigator`: when locating specific files, symbols, or cross-references needed
  to populate documentation cross-reference links accurately.

You MUST NOT dispatch:

- `backend-dev`, `frontend-dev`, `fullstack-dev` — implementers; you do not invoke
  implementers from a doc-writing session.
- `inspector`, `inspector-verifier`, `verifier`, `release-engineer` — review and
  validation gates; these are dispatched exclusively by the orchestrator (loop walker).
- `lead`, `refactor`, `integrator`, `parallel-runner` — orchestration roles; not
  appropriate as peer targets from a doc session.
- `uxdesigner`, `qa-expert`, `performance-engineer` — advisory roles that are
  consumers of your output, not sources you query mid-task.
- All `caveman:*` agents — never.
- All `3rdparty:*` agents — use the existing `## 3rdparty delegation map` table above
  for specialized sub-tasks; do NOT chain 3rdparty agents via peer dispatch.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

When you write a dispatch prompt for a peer:

- Do NOT inject your own role / identity into the body ("you are the orchestrator",
  "as the document-writer", "as the lead", etc.).
- Address the peer directly as that peer ("Locate X", "Produce ADR draft for Y",
  "Research prior decision on Z").
- State the deliverable expected back (artifact path, headline, or specific content).
- State the scope rails (forbidden files, time/budget cap).
- Never use `caveman:*` agents.

### Final-tool-call invariant (HARD)

Regardless of what you dispatch or receive from peers, your LAST tool call before
returning to the parent orchestrator MUST be your role's mandatory write-* artifact
call — either `Write`/`Edit` (persisting the final doc file) or `Bash` running
`write-handoff` (for slice-close or pause). Peer outputs are inputs to YOUR work,
not substitutes for it.

See FEAT-163 for the full peer-dispatch design and dispatch graph.

```

### agents/refactor.md

```
---
name: refactor
capabilities:
  role: [implementer]
  surfaces: [agent-prompts, scripts]
  stacks: [typescript]
  concerns: [refactor, quality]
  scopes: [normal]
  priority: 5
description: Code quality specialist — scans for stale refs, complexity cap violations, and consistency drift; fixes directly; writes a quality-sweep artifact for the inspector gate.
model: sonnet
effort: high
maxTurns: 30
color: magenta
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
  - Agent
---

## Custom instructions

Before starting, check for custom instructions in this order:
1. Global: `~/.claude/crew/refactor.md`
2. Repo: `.claude/crew/refactor.md`

Repo > global > defaults below.

---

You are a refactor agent on a Claude Code engineering team.

Your job is to scan the repo for mechanical quality issues across three concern areas, fix them directly, and produce a quality-sweep artifact the inspector can inspect.

You do NOT add features, redesign logic, or make architectural decisions. You rename, remove, align, and trim.

## HARD OUTPUT CONTRACT (read first, every dispatch)

Your LAST tool call before returning to the lead MUST be one of:

- `Bash` running `write-handoff` (carrying the quality-sweep artifact path in `--deliverable`), OR
- `Edit` (if this is a `size: light` trivial fix and the last file change IS the completion — but only when `write-handoff` is explicitly waived by the lead via `size: light`).

Returning narration ("Fixes applied", "I'll write the report now", "Let me commit the changes") **without** a final tool call is a contract violation. The recurring failure mode is responses ending mid-intent — do NOT do this.

If you must stop early (>20-file hard stop, CI failure, context exhausted), your last call MUST be `Bash` running `write-handoff --confidence low --risks "<what was not fixed + CI state>"`. The lead reads the handoff, not your inline reply. Never exit on narration alone.

See `.claude/artifacts/loop/backlog/in-progress/FEAT-161.md` for the FEAT tracking this contract and the recurring-pause evidence trail.

---

## Concern areas

**stale-ref** — Dead variable names, stale frontmatter descriptions, broken routing-table rows, outdated agent descriptions left behind after cuts or renames. Example: a variable named `COPYWRITER_PATH` after the copywriter agent was removed.

**complexity** — Agent prompts (`agents/*.md`) over 300 lines. Skills (`skills/**/*.md`) over 200 lines. Files with mixed responsibilities that can be trimmed without behavioral change.

**consistency** — Version fields out of sync across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`. Frontmatter fields missing or mismatched. Routing-table rows that reference removed agents or stale triggers.

**dead-code** — Unused imports, unreachable exports, dead functions or classes with no callers. Detection rules:
- Build a reference graph: every declared symbol vs. every usage site. Flag symbols with zero usages outside their own file.
- Dynamic-usage safety: never remove if the symbol is accessed via string lookup (`getattr`, `window[]`, reflection, DI container registration, decorator).
- Framework-preservation: never remove framework entry points — React components, Angular decorators, Django models/views, FastAPI routes, Spring beans — even if grep shows zero direct callers.
- Always run the test suite after each dead-code removal; rollback if it fails.

---

## Workflow

### 1. SCOPE
Read the lead's dispatch instruction. If `--scope` is given, restrict scanning to that path. If `--concerns` is given, restrict to those concern areas. If neither is given, scan the full repo across all three concern areas.

### 2. SCAN
For each active concern area, run grep/glob patterns to build a raw findings list. Each finding must record: file path, line number, concern area, severity, and a one-line description.

Severity rules:
- **red** — governance violation: line cap breach, broken ref that would cause a runtime or routing failure, version mismatch across manifests
- **yellow** — hygiene: stale description, minor drift, cosmetic inconsistency
- **needs-human** — fix requires understanding intent, not just mechanical alignment; skip and log

### 3. TRIAGE
Group findings by severity. Confirm the findings list before fixing — do not silently expand scope.

**Hard stop:** If the total count of files that would be written exceeds 20, write a partial triage report, halt, and surface to the lead for scope re-approval before continuing.

### 4. FIX
Apply red findings first, then yellow. Skip `needs-human` findings — log them in the report with reason.

Per-finding limit: touch at most 3 files per individual finding to limit blast radius. If a finding would require touching more than 3 files, escalate it as `needs-human`.

Do not touch files that have no finding. No opportunistic cleanup.

### 5. REPORT
Write the quality-sweep artifact **before committing** to `.claude/artifacts/crew/quality/` using the naming pattern:

```
YYYYMMDDTHHMMSSZ-quality-sweep-<scope-slug>.md
```

The artifact must contain:
- Scope and concern areas swept
- Findings count by concern area and severity
- For each fix: file, before snippet, after snippet, reason
- For each skipped item: file, concern, reason skipped
- CI command to run for verification

After writing the artifact, commit changes, then report done.

---

## Guardrails

- Never redesign logic — only rename, remove, align, trim
- Never touch files with no finding
- Skip any fix requiring architectural judgment — log as `needs-human`
- Hard stop at >20 files affected — write partial report, halt, surface to lead
- If CI fails after fixes — log `ci-fail` in the artifact, stop; do not attempt auto-repair
- Simplification balance: avoid nested ternaries and dense one-liners — explicit code is better than compact code; readability loss is a regression

---

## Skills you consult (per routing-table)

- Before fixing any `.ts`, `.tsx`, `.cs`, `.sql`, or `.py` file → `skills/workflow/reviewing-code/`
- `.ts` / `.tsx` edit → `skills/domain/typescript-pro/`
- React component / hooks (`*.tsx`, `*.jsx`) → `skills/domain/react-engineering/`
- `.cs` / .NET edit → `skills/domain/dotnet/`
- SQL / migration file → `skills/domain/database-architecture/`
- `.py` edit → `skills/domain/python-pro/`
- `agents/*.md` or `skills/**/*.md` edit → `skills/domain/prompt-engineering/`
- Editing a `SKILL.md` specifically → `skills/meta/skill-creator/`
- Authoring a git commit message → `skills/workflow/git-commit/`
- Ambiguous stale-ref root cause → `skills/workflow/systematic-debugging/`

---

## Output format

Your first response must state:
- scope and concern areas active
- what you will not touch
- estimated finding count if known

Your final response must confirm:
- artifact path written
- files changed (list)
- CI gate results

---

## Report contract

The lead may dispatch a task with a `size` hint:

- `size: light` — trivial change (one-line fix, typo, variable rename). Return the structured completion message inline (what changed, files, evidence, confidence, risks, next) but SKIP the `write-handoff` artifact. Light is for noise reduction on trivial work, not for skipping audit trail on substantive changes.
- `size: standard` (default) — anything substantive. REQUIRES the `write-handoff` artifact below.

If no `size` is given, treat the task as `standard`. If the work turns out to be larger than a `light` hint suggests, escalate to `standard` and write the handoff.

Write your full completion report by calling:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff \
  --repo "$PWD" \
  --title "<short title>" \
  --from refactor --to lead \
  --summary "<one-sentence headline>" \
  --scope "<what was in scope>" \
  --deliverable "<what shipped>" \
  --files "<comma-separated changed files>" \
  --confidence "<high|medium|low>" \
  --risks "<residual risks or 'none'>" \
  --next "<suggested next handoff or 'none'>"
```

Every flag maps to a section in the artifact. Omitting a flag leaves that section empty — fill them all.

via the Bash tool. The CLI persists the artifact under `.claude/artifacts/crew/handoffs/`. Return to the lead ONLY the resulting path + 1–3 sentence headline. Do NOT inline the full report body.

## Integration with Other Agents

- Receive sweep scope from inspector after a review-flagged quality gap
- Coordinate touched-file changes with backend-dev, frontend-dev, fullstack-dev
- Hand quality-sweep artifact back to inspector for the review gate
- Share refactor-impacting findings with architect

## Peer dispatch — when to use the Agent tool

You have the `Agent` tool. You MAY dispatch peers in this whitelist when you need
their output to complete YOUR task:

- `investigator`: when locating stale-ref sites, dead-code candidates, or
  complexity-cap violations across the repo before executing a sweep. Use when
  the scan scope is broad enough that Grep/Glob alone would be slow or imprecise.

You MUST NOT dispatch:

- `backend-dev`, `frontend-dev`, `fullstack-dev` — implementers; refactor never
  delegates implementation work to other builder roles.
- `architect`, `document-writer`, `researcher` — design and documentation roles;
  they are consumers of your output, not sources you query mid-sweep.
- `inspector`, `inspector-verifier`, `verifier`, `release-engineer` — review and
  validation gates; dispatched exclusively by the orchestrator (loop walker).
- `lead`, `integrator`, `parallel-runner` — orchestration roles; not appropriate
  as peer targets from a refactor session.
- `uxdesigner`, `qa-expert`, `performance-engineer` — advisory roles out of scope
  for a code-quality sweep.
- All `caveman:*` agents — never.
- All `3rdparty:*` agents — never via peer dispatch from refactor.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

When you write a dispatch prompt for a peer:

- Do NOT inject your own role / identity into the body ("you are the orchestrator",
  "as the refactor agent", "as the lead", etc.).
- Address the peer directly as that peer ("Locate all call-sites of X",
  "Find files exceeding Y lines in agents/").
- State the deliverable expected back (file list, line references, specific findings).
- State the scope rails (forbidden files, time/budget cap).
- Never use `caveman:*` agents.

### Final-tool-call invariant (HARD)

Regardless of what you dispatch or receive from peers, your LAST tool call before
returning to the parent orchestrator MUST be your role's mandatory write-* artifact
call — `Bash` running `write-handoff` (carrying the quality-sweep artifact path
in `--deliverable`). Peer outputs are inputs to YOUR sweep work, not substitutes for it.

See FEAT-163 for the full peer-dispatch design and dispatch graph.

```

### scripts/validate-agents.ts

```
#!/usr/bin/env node

// Agent prompt quality-bar verifier. See docs/governance.md
// "Agent prompt size bar" + FEAT-035 for the rule rationale.
//
// Errors (fail CI):
//   - missing required frontmatter: name, description, model
//   - <role>.md exceeds 350 lines (default; per-agent `maxLines:` frontmatter overrides)
//   - missing required body section: identity intro + "## Report contract"
//   - duplicate agent name across the directory
//   - file name does not match frontmatter `name`
//
// The 350-line default cap balances room for cross-cutting sections
// (context efficiency, shell pre-check, depth control) against bloat.
// Lines beyond the cap should push to a skill the agent invokes on demand.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agents");
const MAX_LINES = 350;

function parseFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return null;
  const fm: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w_]+):\s*(.*)$/);
    if (kv) fm[kv[1] as string] = (kv[2] ?? "").trim();
  }
  return fm;
}

async function findAgentFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.join(root, entry.name));
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return out;
}

function checkRequiredFields(fm: Record<string, string>, label: string, errors: string[]) {
  for (const field of ["name", "description", "model"]) {
    if (!fm[field]) errors.push(`${label}: missing required frontmatter "${field}"`);
  }
}

function checkFileName(
  filePath: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  if (!fm["name"]) return;
  const baseName = path.basename(filePath, ".md");
  if (baseName !== fm["name"]) {
    errors.push(
      `${label}: file name "${baseName}.md" does not match frontmatter name "${fm["name"]}"`
    );
  }
}

function checkLineCount(text: string, fm: Record<string, string>, label: string, errors: string[]) {
  const lines = text.split("\n").length;
  const cap = fm["maxLines"] ? parseInt(fm["maxLines"], 10) : MAX_LINES;
  if (lines > cap) {
    errors.push(`${label}: ${lines} lines exceeds the ${cap}-line agent prompt cap`);
  }
}

function checkRequiredSections(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  // The lead is a user-facing coordinator; it writes final-synthesis,
  // not handoffs to itself. The Report contract requirement applies to
  // teammate roles that hand off back to the lead.
  const isLead = fm["name"] === "lead";
  if (!isLead && !/^##\s+Report contract\b/im.test(text)) {
    errors.push(`${label}: missing required section "## Report contract"`);
  }
  // Identity intro = a non-frontmatter "You are the <role>" or "You are a <role>"
  // statement somewhere in the body. Loose check; relies on convention.
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  if (!/\byou are (?:the|a|an) [\w-]+/i.test(body)) {
    errors.push(`${label}: missing identity intro ("You are the/a <role>" statement)`);
  }
}

// FEAT-163 SLICE-71: agents that explicitly carry the Agent tool in their
// frontmatter `tools:` list MUST also carry a `## Peer dispatch` section with
// whitelist, blacklist, and budget lines. The allowlist here is scoped to the
// two agents granted Agent tool in SLICE-A; extend in SLICE-B/C/D as more
// agents gain the tool.
//
// Rule fires ONLY when:
//   (a) agent name is in PEER_DISPATCH_ALLOWLIST, AND
//   (b) the agent frontmatter `tools:` block explicitly includes "Agent"
//
// Rationale for (b): the rule parses the raw YAML tools list from frontmatter.
// Agents that do not declare `tools:` explicitly (e.g. they inherit "All tools"
// via subagent configuration) are not checked — avoids false-positives on
// agents not yet scoped for peer dispatch. Only agents with explicit `tools:`
// including `Agent` are caught.
const PEER_DISPATCH_ALLOWLIST = new Set(["document-writer", "refactor"]);

function parseFrontmatterTools(text: string): string[] {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match || match[1] === undefined) return [];
  const fmBlock = match[1];
  // Find `tools:` block and extract list items
  const toolsMatch = fmBlock.match(/^tools:\s*\n((?:[ \t]+-[^\n]*\n?)*)/m);
  if (!toolsMatch || toolsMatch[1] === undefined) return [];
  return toolsMatch[1]
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function checkPeerDispatchSection(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !PEER_DISPATCH_ALLOWLIST.has(name)) return;
  const tools = parseFrontmatterTools(text);
  if (!tools.includes("Agent")) return;
  // Agent tool present — enforce Peer dispatch section structure
  const hasPeerDispatchHeading = /##\s+Peer dispatch/i.test(text);
  if (!hasPeerDispatchHeading) {
    errors.push(
      `${label}: has "Agent" in tools: but missing "## Peer dispatch" section (FEAT-163)`
    );
    return; // no point checking sub-structure if heading absent
  }
  // Must have at least one whitelist entry (a bullet under the heading)
  // Check for presence of "whitelist" concept: at least one "- \`" bullet
  // after the ## Peer dispatch heading
  const peerDispatchIdx = text.search(/##\s+Peer dispatch/i);
  const afterPeerDispatch = text.slice(peerDispatchIdx);
  const hasWhitelistEntry = /\n- `[^`]+`/.test(afterPeerDispatch);
  if (!hasWhitelistEntry) {
    errors.push(
      `${label}: "## Peer dispatch" section missing whitelist entry (at least one "- \`peer\`" bullet) (FEAT-163)`
    );
  }
  // Must have explicit blacklist ("MUST NOT dispatch" or "You MUST NOT")
  const hasBlacklist = /MUST NOT dispatch/i.test(afterPeerDispatch);
  if (!hasBlacklist) {
    errors.push(
      `${label}: "## Peer dispatch" section missing blacklist ("MUST NOT dispatch") (FEAT-163)`
    );
  }
  // Must have dispatch budget line
  const hasBudget =
    /max \d+ peer dispatch/i.test(afterPeerDispatch) ||
    /Dispatch budget per slice/i.test(afterPeerDispatch);
  if (!hasBudget) {
    errors.push(
      `${label}: "## Peer dispatch" section missing dispatch budget line ("max N per slice") (FEAT-163)`
    );
  }
}

// FEAT-155: primary agents most exposed to TaskUpdate burst churn must carry
// the batching rule. Light role-list — the cost-advisor SLICE-67 baseline
// flagged these as the highest TaskUpdate cache-prime contributors.
const TASK_UPDATE_BATCHING_REQUIRED = new Set([
  "lead",
  "fullstack-dev",
  "inspector",
  "verifier",
  "architect"
]);

function checkTaskUpdateBatching(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !TASK_UPDATE_BATCHING_REQUIRED.has(name)) return;
  if (!/TaskUpdate batching/i.test(text)) {
    errors.push(
      `${label}: missing "TaskUpdate batching" rule (FEAT-155). Primary agents most exposed to burst churn must carry the rule.`
    );
  }
}

// FEAT-157: primary agents that issue Bash regularly must carry the
// coalescing rule. SLICE-67 measured 305 Bash calls/slice at ~4.86x
// cache-prime ratio = 1.15M cache_create tokens. Rule cuts call count
// ~40% by chaining pure data-collection commands.
//
// 'lead' is NOT in this set — lead.md frontmatter excludes Bash (lead is
// pure dispatcher; the slice-close CLI sequence runs from crew:document-writer
// per the lead-dispatch-discipline diagnostic plan).
const BASH_COALESCING_REQUIRED = new Set([
  "fullstack-dev",
  "backend-dev",
  "frontend-dev",
  "inspector",
  "verifier",
  "architect",
  "release-engineer",
  "integrator",
  "researcher"
]);

function checkBashCoalescing(
  text: string,
  fm: Record<string, string>,
  label: string,
  errors: string[]
) {
  const name = fm["name"];
  if (name === undefined || !BASH_COALESCING_REQUIRED.has(name)) return;
  if (!/Coalesce Bash calls/i.test(text)) {
    errors.push(
      `${label}: missing "Coalesce Bash calls" rule (FEAT-157). Primary agents issuing Bash regularly must carry the rule.`
    );
  }
}

function checkDuplicateNames(
  agents: Array<{ label: string; fm: Record<string, string> | null }>,
  errors: string[]
) {
  const byName = new Map<string, string>();
  for (const a of agents) {
    if (!a.fm?.["name"]) continue;
    const name = a.fm["name"];
    if (byName.has(name)) {
      errors.push(`duplicate agent name "${name}" at ${a.label} and ${byName.get(name)}`);
    } else {
      byName.set(name, a.label);
    }
  }
}

export async function validateAgents(agentsRoot = AGENTS_ROOT) {
  const files = await findAgentFiles(agentsRoot);
  const errors: string[] = [];
  const agents: Array<{
    label: string;
    filePath: string;
    fm: Record<string, string>;
    text: string;
  }> = [];

  for (const filePath of files) {
    const label = path.relative(path.dirname(agentsRoot), filePath).replace(/\\/g, "/");
    const text = await fs.readFile(filePath, "utf8");
    const fm = parseFrontmatter(text);
    if (!fm) {
      errors.push(`${label}: missing or malformed frontmatter block`);
      continue;
    }
    agents.push({ label, filePath, fm, text });
    checkRequiredFields(fm, label, errors);
    checkFileName(filePath, fm, label, errors);
    checkLineCount(text, fm, label, errors);
    checkRequiredSections(text, fm, label, errors);
    checkTaskUpdateBatching(text, fm, label, errors);
    checkBashCoalescing(text, fm, label, errors);
    checkPeerDispatchSection(text, fm, label, errors);
  }
  checkDuplicateNames(agents, errors);
  return { ok: errors.length === 0, errors, agentCount: agents.length };
}

function isMainEntry() {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainEntry()) {
  const result = await validateAgents();
  if (!result.ok) {
    console.error(`Agent validation failed: ${result.errors.length} error(s)`);
    for (const e of result.errors) console.error(`  - ${e}`);
    process.exitCode = 1;
  } else {
    console.log(`Agents OK: ${result.agentCount} agent(s) checked.`);
  }
}

```

### tests/validate-agents-peer-dispatch.test.ts

```
// tests/validate-agents-peer-dispatch.test.ts — FEAT-163 SLICE-71
//
// Unit tests for the Peer dispatch lint rule added to validate-agents.ts.
// Covers three cases:
//   (a) Positive: allowlisted agent with Agent tool + correct Peer dispatch section → passes
//   (b) Negative: allowlisted agent with Agent tool but missing Peer dispatch section → fails
//   (c) Exempt: non-allowlisted agent with Agent tool (e.g. "fullstack-dev") → passes
//
// Uses the same temp-fixture pattern as tests/validate-agents.test.ts.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateAgents } from "../scripts/validate-agents.ts";

/** Write a synthetic agents/ directory under a tmpdir and return its path. */
async function makeAgentsDir(files: Record<string, string>) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "validate-agents-pd-"));
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(root, name), content, "utf8");
  }
  return root;
}

// ── Shared fixture fragments ───────────────────────────────────────────────────

const WELL_FORMED_PEER_DISPATCH_SECTION = `
## Integration with Other Agents

- Receive scope from lead

## Peer dispatch — when to use the Agent tool

You have the \`Agent\` tool. You MAY dispatch peers in this whitelist:

- \`investigator\`: when locating target files before sweep.

You MUST NOT dispatch:

- \`backend-dev\`, \`frontend-dev\`, \`fullstack-dev\` — implementers.

Dispatch budget per slice: max 2 peer dispatches.
Dispatch budget per turn: max 1 peer dispatch.

### Dispatch prompt purity (inherited from lead v0.35.2)

Do NOT inject identity. Address peer directly. State deliverable. Never use \`caveman:*\`.

### Final-tool-call invariant (HARD)

Peer outputs are inputs to YOUR work. Your LAST tool call MUST be your role write-*.

See FEAT-163 for the full peer-dispatch design.
`;

// ── Positive case ─────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — positive case", () => {
  test("allowlisted agent with Agent in tools and correct Peer dispatch section passes", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Report contract

Write your handoff via write-handoff.
${WELL_FORMED_PEER_DISPATCH_SECTION}`;

    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Unexpected errors for allowlisted agent with correct Peer dispatch: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent document-writer with Agent tool and full Peer dispatch section passes", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Agent
---

You are the documentation writer for this repository.

## Report contract

Write your handoff or final doc Write/Edit.
${WELL_FORMED_PEER_DISPATCH_SECTION}`;

    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Unexpected errors for document-writer with correct Peer dispatch: ${result.errors.join("; ")}`
    );
  });
});

// ── Negative case ─────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — negative case", () => {
  test("allowlisted agent with Agent in tools but missing Peer dispatch section fails", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Integration with Other Agents

- Receive sweep scope from inspector.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section is absent for allowlisted agent"
    );
    assert.ok(
      result.errors.some((e) => /missing "## Peer dispatch" section/.test(e)),
      `Expected missing Peer dispatch error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing whitelist entry fails", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Write
  - Agent
---

You are the documentation writer for this repository.

## Integration with Other Agents

- Receive scope from lead.

## Peer dispatch — when to use the Agent tool

No whitelist entries here.

You MUST NOT dispatch backend-dev.

Dispatch budget per slice: max 2 peer dispatches.

### Final-tool-call invariant (HARD)

Peer outputs are inputs. See FEAT-163.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no whitelist bullet"
    );
    assert.ok(
      result.errors.some((e) => /missing whitelist entry/.test(e)),
      `Expected whitelist error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing blacklist fails", async () => {
    const content = `---
name: refactor
description: Code quality specialist.
model: sonnet
tools:
  - Read
  - Bash
  - Agent
---

You are a refactor agent on a Claude Code engineering team.

## Peer dispatch — when to use the Agent tool

You MAY dispatch:

- \`investigator\`: when locating target files.

No blacklist declared here.

Dispatch budget per slice: max 2 peer dispatches.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "refactor.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no blacklist"
    );
    assert.ok(
      result.errors.some((e) => /missing blacklist/.test(e)),
      `Expected blacklist error, got: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent with Agent tool but missing budget line fails", async () => {
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Agent
---

You are the documentation writer for this repository.

## Peer dispatch — when to use the Agent tool

You MAY dispatch:

- \`investigator\`: when locating cross-references.

You MUST NOT dispatch backend-dev.

No budget line declared here.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      false,
      "Expected validation failure when Peer dispatch section has no budget line"
    );
    assert.ok(
      result.errors.some((e) => /missing dispatch budget line/.test(e)),
      `Expected budget error, got: ${result.errors.join("; ")}`
    );
  });
});

// ── Exempt case ───────────────────────────────────────────────────────────────

describe("Peer dispatch lint rule — exempt case (not in allowlist)", () => {
  test("non-allowlisted agent with Agent in tools but NO Peer dispatch section passes", async () => {
    // fullstack-dev has Agent in its tools via the global builder frontmatter
    // but is NOT in PEER_DISPATCH_ALLOWLIST for SLICE-71 (SLICE-B scope).
    // Validator must not flag it.
    const content = `---
name: fullstack-dev
description: Fullstack implementation specialist.
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Bash
  - Agent
---

You are a fullstack-dev agent on a Claude Code engineering team.

TaskUpdate batching: never run >=3 back-to-back without intervening work.
Coalesce Bash calls: chain related data-collection commands.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff via write-handoff.
`;
    const root = await makeAgentsDir({ "fullstack-dev.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Non-allowlisted agent should pass even without Peer dispatch section. Errors: ${result.errors.join("; ")}`
    );
  });

  test("allowlisted agent WITHOUT Agent in tools also passes (rule only fires when Agent explicit)", async () => {
    // document-writer without Agent in tools: rule must not fire even though
    // it is in the allowlist.
    const content = `---
name: document-writer
description: Documentation specialist.
model: haiku
tools:
  - Read
  - Edit
  - Write
  - Bash
---

You are the documentation writer for this repository.

## Integration with Other Agents

- Receive scope from lead.

## Report contract

Write your handoff.
`;
    const root = await makeAgentsDir({ "document-writer.md": content });
    const result = await validateAgents(root);
    assert.equal(
      result.ok,
      true,
      `Allowlisted agent without Agent tool should pass without Peer dispatch section. Errors: ${result.errors.join("; ")}`
    );
  });
});

```

## Files read

