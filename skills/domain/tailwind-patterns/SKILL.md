---
name: tailwind-patterns
prompt_id: tailwind-patterns
version: 1.0.0
tier: domain
description: Tailwind CSS v4 patterns and best practices — CSS-first configuration, container queries, dark mode, layout, typography, color system, animation, and component extraction. Use when authoring or reviewing Tailwind CSS v4 code.
source: davila7/claude-code-templates/cli-tool/components/skills/creative-design/tailwind-patterns
source_version: 2026-06-08
last_reviewed: 2026-06-08
owner: hero-crew
triggers: ["tailwind", "tailwindcss", "Tailwind CSS", "@theme", "container query", "@container", "utility-first CSS", "dark mode", "oklch", "Oxide engine", "tailwind.config", "tw:", "text-", "bg-", "flex ", "grid ", "hover:", "dark:"]
---

# Tailwind CSS Patterns (v4)

Modern utility-first CSS with CSS-native configuration. Tailwind v4 is CSS-first — embrace
CSS variables, container queries, and native features. The config file is now optional.

## When to use

Consult this skill when:
- Authoring or reviewing Tailwind CSS v4 utility classes
- Setting up CSS-first `@theme` configuration
- Implementing responsive layouts with breakpoints or container queries
- Configuring dark mode (class, media, or selector strategy)
- Designing color token architecture (primitive → semantic → component)
- Choosing between Flexbox and Grid patterns
- Auditing anti-patterns (arbitrary values, `!important`, duplicate class lists)
- Migrating from Tailwind v3 to v4 CSS-first approach

## v4 Architecture: What Changed from v3

| v3 (Legacy) | v4 (Current) |
|---|---|
| `tailwind.config.js` | CSS-based `@theme` directive |
| PostCSS plugin | Oxide engine (10x faster) |
| JIT mode | Native, always-on |
| Plugin system | CSS-native features |

## Core Concepts

| Concept | Description |
|---|---|
| **CSS-first** | Configuration in CSS, not JavaScript |
| **Oxide Engine** | Rust-based compiler, much faster |
| **Native Nesting** | CSS nesting without PostCSS |
| **CSS Variables** | All tokens exposed as `--*` vars |

## CSS-Based Configuration

```css
@theme {
  --color-primary: oklch(0.7 0.15 250);
  --color-surface: oklch(0.98 0 0);
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

## Container Queries vs Breakpoints

| Type | Responds To | Use When |
|---|---|---|
| Breakpoint (`md:`) | Viewport width | Page-level layouts |
| Container (`@container`) | Parent element width | Component-level responsive |

## Breakpoint System

| Prefix | Min Width | Target |
|---|---|---|
| (none) | 0px | Mobile-first base |
| `sm:` | 640px | Large phone / small tablet |
| `md:` | 768px | Tablet |
| `lg:` | 1024px | Laptop |
| `xl:` | 1280px | Desktop |
| `2xl:` | 1536px | Large desktop |

Write mobile styles first (no prefix), then add larger screen overrides: `w-full md:w-1/2 lg:w-1/3`.

## Dark Mode Strategies

| Method | Behavior | Use When |
|---|---|---|
| `class` | `.dark` class toggles | Manual theme switcher |
| `media` | Follows system preference | No user control |
| `selector` | Custom selector (v4) | Complex theming |

## Common Layout Patterns

**Flexbox**: `flex items-center justify-center` / `flex flex-col gap-4` / `flex justify-between`

**Grid**: `grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))]` for auto-fit responsive.
Prefer asymmetric/Bento layouts over symmetric 3-column grids.

## Key Anti-Patterns

| Don't | Do |
|---|---|
| Arbitrary values everywhere | Use design system scale |
| `!important` | Fix specificity properly |
| Inline `style=` | Use utilities |
| Duplicate long class lists | Extract component |
| Mix v3 config with v4 | Migrate fully to CSS-first |
| Use `@apply` heavily | Prefer components |

## Subtopics

Detailed reference lives in `references/`. Load when the work matches the scope:

| Reference | Load when |
|---|---|
| [references/color-and-typography.md](references/color-and-typography.md) | OKLCH color system, token architecture, font stacks, type scale |
| [references/animation-and-components.md](references/animation-and-components.md) | Built-in animations, transitions, component extraction rules, performance |

## Done / Acceptance

A Tailwind CSS implementation is ready when:
- `@theme` used for design tokens; no `tailwind.config.js` unless required for v3 compat
- Mobile-first: base styles have no prefix; larger screen overrides use `sm:` / `md:` etc.
- Container queries used for component-level responsiveness (not viewport breakpoints)
- Dark mode configured with one strategy; `dark:` variants applied consistently
- No arbitrary `[]` values without a comment justifying why the scale is insufficient
- Long class lists extracted into components when repeated 3+ times
- Build uses Oxide engine (v4 default); no legacy PostCSS pipeline unless intentional
