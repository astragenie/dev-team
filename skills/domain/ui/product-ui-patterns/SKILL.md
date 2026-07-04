---
name: product-ui-patterns
prompt_id: product-ui-patterns
version: 1.0.0
tier: domain
description: Patterns for internal product UIs — dashboards, agent platforms, observability surfaces, admin tools, IDE-inspired layouts. Tables, command palettes, filter bars, status systems, activity feeds, timelines, tree views, empty states, dashboard composition, AI assistant panels. Distinct from frontend-design (which targets marketing/landing surfaces) — this is for INTERNAL product workflows where density, scannability, and keyboard-driven flow beat editorial flair.
owner: hero-crew
last_reviewed: 2026-06-21
triggers: ["dashboard", "admin", "observability", "agent platform", "command palette", "data table", "filter bar", "activity feed", "timeline", "tree view", "empty state", "AI assistant panel", "AstraRunner UI", "AstraMemory UI", "monitoring", "internal tool"]
---

# Product UI patterns

Internal-product UI guidance for dashboards, agent platforms, observability surfaces, admin tools, and developer-facing workflows. Sibling of `frontend-design/` (which targets marketing/landing/editorial surfaces) — load this skill when the slice is INTERNAL product UI where density + scannability + keyboard flow beat editorial polish.

## When to use

- Building or reviewing a dashboard / admin panel / internal tool.
- Observability surface (logs, traces, metrics, agent runs).
- Agent platform UI (AstraRunner, AstraMemory consoles, evaluation surfaces).
- Data table with sort / filter / column controls.
- Command palette / global search / keyboard-driven navigation.
- Empty state, error state, or loading state for a long-running async product workflow.

Skip for: marketing pages, landing pages, brand surfaces — those route to `frontend-design/`.

## Product-UI principles

- **Density over whitespace.** Internal tools optimize for information per pixel; editorial pacing belongs in marketing.
- **Keyboard-driven by default.** Every common action has a shortcut + cmd-palette entry. Power users live on the keyboard.
- **Scannability beats narrative.** Tables, lists, columns — no scroll-jacked storytelling.
- **State is the headline.** Status badges, last-updated stamps, environment labels are first-class UI, not decoration.
- **Empty states earn their pixels.** Tell the user what to do next, not what's missing.

## Tables (the backbone of product UI)

- Fixed first column (id / name) when horizontal scroll exists.
- Right-align numeric columns; left-align text; centered icons only.
- Inline actions (kebab menu) on row hover; bulk actions in a sticky header bar when ≥1 selected.
- Row click navigates to detail OR opens a side panel — pick one per surface, document.
- Sort indicators visible on hover for sortable columns, persistent for the active sort.
- Column virtualization (`react-window`) for ≥100 rows; never paginate before 50.
- Loading: skeleton rows matching final layout, not a spinner.
- Empty: explicit "no <thing> match these filters" with a clear-filters action AND a "create your first" CTA when the table is genuinely empty.

## Command palette (`cmd+k` / `ctrl+k`)

- Single global entry point. Open with `cmd+k` / `ctrl+k` and `/` when no input is focused.
- Three sections in priority order: **Actions** (verbs) → **Navigation** (places) → **Search** (entities).
- Fuzzy match (`fuse.js` or built-in). Recent items at the top when query is empty.
- Each entry shows: icon · label · scope hint · keyboard shortcut (when one exists).
- Esc closes; arrow keys navigate; Enter executes; `cmd+enter` opens in new tab where applicable.

## Filter bar

- Filters as chips, not dropdowns. Chips show value + clear button.
- "Add filter" opens a single dropdown listing all available filter dimensions.
- Active filter state is visible in the URL — sharable + back-button-restoreable.
- Saved filter views for power users — top-of-bar with "Save current view" affordance.
- "Clear all" link visible whenever ≥1 filter is active.

## Status systems

- Status colors mapped to semantic meaning, NEVER reused: `running` `success` `warning` `error` `pending` `disabled`.
- Status badge = icon + label + color, always all three. Color-only is an a11y bug (see `react-ui-quality`).
- Status changes animate via opacity, never via shifting layout.
- Last-updated timestamps in relative form ("2m ago") with absolute on hover.
- Long-running operations show progress (% or step count) — never indefinite spinners beyond 3s.

## Activity feed + timeline

- Reverse-chronological by default (newest top).
- Group by time bucket ("Today", "Yesterday", "Last week") only when feed spans >24h.
- Each entry: actor avatar · verb · object · timestamp. Actor and object link to their detail pages.
- Mark unread state with a small left-edge accent — not a heavy background.
- Pagination via "Load more" button OR infinite scroll with a sticky end-marker — never page numbers.

## Tree view (file explorers, hierarchies)

- Indentation: 16px per level. Chevron rotates on expand.
- Click toggles expand; double-click navigates; right-click opens context menu.
- Keyboard: arrow keys, `space` toggles, `enter` navigates.
- Lazy-load children on first expand for large trees.
- Path breadcrumb mirrors the selection above the tree.

## Empty states

- Three flavors — explicit, not interchangeable:
  - **First-use empty** ("You haven't created any X yet"): focus on the primary creation CTA + a 1-sentence pitch.
  - **Filtered empty** ("No X match these filters"): show the active filters + a "Clear filters" button.
  - **Loading empty** (transient): skeleton matching the final layout, not a spinner.
- One illustration max — minimal, monochrome, semantic. No stock vector clipart.

## Dashboard composition

- 12-column grid; widgets snap to 3 / 4 / 6 / 12 columns.
- Reading order: scan-Z pattern — most-critical metric top-left, supporting metrics top-right, deep dives below.
- Each widget: title · current value · trend indicator · context (time range / filter).
- Default time range: last 24h or last 7d; documented per surface.
- Drill-down: every widget links to a detail surface; never dead-end a metric.
- Real-time data: subtle pulse on update, NEVER full re-render flash.

## AI assistant / chat panels

- Side panel (collapsible right rail) or floating widget — never modal.
- Streaming response: typewriter effect on the active message ONLY; older messages settle instantly.
- Tool-call surfaces inline as collapsible blocks (`▶ Calling: searchMemory(...)`).
- Citations as superscript numbers linking to inline source previews on hover.
- Stop button visible during stream; Regenerate appears at the end.
- Empty state: 3-5 example prompts as clickable chips. Not a wall of marketing.

## Observability-specific patterns

- Log lines: monospace; level color in left gutter only; timestamp prefix.
- Trace view: waterfall with collapsible spans; click span → detail side panel with attributes.
- Metric chart: small-multiples over a single hero chart when comparing series.
- Alert state: persistent banner at top of surface — color matches severity from `react-ui-quality` status palette.

## IDE-inspired layouts

- Three-column shell: left rail (navigation) · main (work) · right panel (reviewer/details).
- Resizable splits with persistence (localStorage).
- Status bar at bottom: environment · build state · keyboard hint · user.
- Command palette IS the search bar — never two separate things.

## Done / Acceptance

- The right pattern is picked from this skill — no default-to-marketing-design for an internal tool.
- Density + keyboard + scannability respected (no scroll-jacked storytelling on a dashboard).
- Status colors map to the documented semantic meanings (not borrowed from brand palette).
- Empty / loading / error states all handled per the three-flavor rule.
- Quality checklist (`react-ui-quality`) passes on top of this skill.
