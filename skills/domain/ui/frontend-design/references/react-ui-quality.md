# React UI quality checklist — pre-ship gates

Severity-tiered, concrete checks for React/Tailwind UI work. CRITICAL items are review blockers;
HIGH items need a stated reason to skip; MEDIUM are polish.

## CRITICAL — interaction & accessibility

- [ ] Touch targets ≥ **44×44px** on all clickables
- [ ] Body text contrast ≥ **4.5:1**; large text and UI components ≥ **3:1**
- [ ] Visible focus ring on every interactive element (no `outline: none` without replacement)
- [ ] `cursor-pointer` on all interactive elements; primary actions on click/tap, never hover-only
- [ ] Real elements: `<button>`, `<a>`, `<label for>` — no `<div onClick>`
- [ ] Async buttons disable during flight and show feedback; errors render adjacent to the failed
      field with `role="alert"`; destructive actions get a confirm step
- [ ] Heading levels sequential (no h1 → h4); landmarks (`<nav>`, `<main>`) present
- [ ] `@media (prefers-reduced-motion: reduce)` disables non-essential animation
- [ ] State never signaled by color alone — pair with icon or text

## HIGH — layout & visual stability

- [ ] **`dvh` not `100vh`** for full-height mobile layouts (browser chrome)
- [ ] Z-index uses a defined scale (10/20/30/50) — no `z-[9999]`
- [ ] No hover effects that change layout (scale/borders that shift neighbors)
- [ ] Space reserved for async content (aspect-ratio or fixed dims) — zero CLS from images
- [ ] No horizontal scroll at any breakpoint; floating bars get `top-4 left-4 right-4`, not `inset-x-0 top-0`
- [ ] Fixed elements don't stack/overlap (navbar vs bottom bar vs toasts)
- [ ] Body text ≥ 16px on mobile; line length capped (`max-w-prose`)
- [ ] Skeleton screens matching final layout — not spinners

## HIGH — performance affecting perceived quality

- [ ] Animate `transform`/`opacity` only; no `width`/`height`/`top` animation
- [ ] Images: modern format, `srcset`, `loading="lazy"` below the fold
- [ ] Fonts: `font-display: swap`; preload the display font
- [ ] Lists 100+ items virtualized (`react-window` or equivalent)
- [ ] No barrel imports of icon libraries — import icons directly
- [ ] Route-level code splitting; heavy components lazy + `<Suspense fallback={<Skeleton/>}>`
- [ ] `useMemo`/`useCallback` only where a memoized child or expensive derivation justifies it

## MEDIUM — craft polish

- [ ] Styled `::selection`; custom scrollbar where brand-appropriate
- [ ] Semantic CSS variables for theme (`--color-bg/-ink/-accent`), tokens not raw hex in JSX
- [ ] shadcn/ui: variants over inline conditional classes; `<Form>` + react-hook-form + Zod for forms;
      theme via CSS variables (`--primary`), components added via CLI not hand-copied
- [ ] Tailwind: theme colors directly (`bg-primary`), not `bg-[var(--primary)]`
- [ ] Consistent border-radius scale; consistent transition durations across like elements

## Scroll-driven UX (when the design calls for it)

Scroll enhances narrative — never hijack native scroll.

- **Parallax layer speeds:** background 0.2×, midground 0.5×, content 1.0×, floating accents 1.2×
- **Story beat structure:** hook (full viewport) → context → journey → climax reveal → resolution/CTA
- **Library choice:** Framer Motion for React component animation; GSAP ScrollTrigger for complex
  pinned narratives; native CSS `animation-timeline: view()` for simple reveals; Lenis for smooth
  scroll only
- **Implementation:** `IntersectionObserver` for reveal triggers (threshold ~0.15); `position: sticky`
  - `translateX` for horizontal dioramas; transform/opacity only to avoid jank
- Mobile: test real devices; degrade to simpler effects, keep content readable if JS fails

## Design-token discipline

Three layers — primitive (`--blue-500`) → semantic (`--color-primary`, `--color-surface`) →
component (`--button-bg`). Components reference semantic tokens only. Prefer OKLCH for new color
systems (perceptually uniform). Same utility-class combo 3+ times → extract a component.
