---
name: frontend-design
prompt_id: frontend-design
version: 1.0.0
tier: domain
description: Create distinctive, production-grade frontend interfaces with high design quality — use when building web components, pages, dashboards, landing pages, or any web UI that needs creative, polished aesthetics beyond generic AI output.
source: davila7/claude-code-templates/cli-tool/components/skills/creative-design/{frontend-design,premium-web-design,ui-ux-pro-max}
source_version: 2026-06-10
last_reviewed: 2026-06-10
owner: hero-crew
triggers: ["frontend", "UI design", "web component", "landing page", "dashboard", "HTML/CSS", "stylesheet", "visual design", "aesthetics", "layout", "typography", "color palette", "animation", "React component", "page design", "web app", "looks generic", "design quality"]
---

# Frontend Design

Create distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics.
The difference between generic and premium is not taste — it is structural intentionality,
research depth, typography craft, restraint, and obsessive micro-detail. Miss any one and the
result reverts to template.

## When to use

- Building web components, pages, dashboards, landing pages, or complete UI applications
- Styling or beautifying any web UI with creative intent
- The user asks for "beautiful," "polished," "premium," or complains the UI "looks generic"

## Process (in order, before coding)

1. **Field first.** Name the industry/product. Visual direction follows the field, never the reverse.
2. **Research references.** Study 3–5 real production sites in the space; for each note display font,
   palette, layout concept, and one signature move worth borrowing. Reference sets per industry:
   [references/style-selection.md](references/style-selection.md).
3. **Pick ONE structural layout concept by name** from
   [references/structural-dna.md](references/structural-dna.md). Never default to
   hero → 3-column features → testimonials → CTA.
4. **Write the design brief** before code: palette (4–6 hex with roles), font stack by name,
   nav pattern, motion plan (one entry animation + one scroll behavior + one micro-interaction),
   and an explicit banned-moves list.
5. **Build**, then **verify the render** — screenshot the page, check the hero is intact,
   spacing breathes, and nothing on the banned list crept in.

## Typography craft (exact values)

- Pair a characterful display font with a refined body font; add a monospace accent for labels,
  dates, and metadata. One font family for everything reads as template.
- **Banned default fonts:** Inter, Poppins, Montserrat, Raleway, Space Grotesk, Outfit as display.
  (Inter is acceptable as _body_ in dense product UI — never as the personality carrier.)
- Distinctive display options: Fraunces, Instrument Serif, DM Serif Display, Cormorant (editorial);
  Syne, Satoshi, Cabinet Grotesk, Inter Tight, IBM Plex Sans, Archivo (tech).
- Fluid scale with `clamp()`; dramatic contrast — hero headlines large (5–8vw desktop), not 48px.
- Large headlines: letter-spacing **-0.03em to -0.06em**, line-height **0.9–1.1**.
- Body: line-height **1.6–1.8**, max-width **45–75ch**, `text-wrap: balance` on headings.
- Micro-labels: uppercase, letter-spacing **0.1em+**, small size, mono or semibold sans.
- Weight contrast beats size contrast: 700–900 display next to 300–400 body.

## Color craft

- Start near-monochrome; let one hue earn its place. A single accent hits harder than a palette.
- Off-whites (#FAFAF8, #F5F0EB) and off-blacks (#1A1A1A, #0D0D0D) — pure #FFF/#000 only by intent.
- Define semantic CSS variables (`--color-bg`, `--color-ink`, `--color-accent`); never scatter hex.
- Contrast floors: 4.5:1 body text, 3:1 large text and UI components (WCAG AA).
- **Banned:** purple-to-blue gradients (the #1 AI cliché), indigo-as-default brand, decorative
  gradients on buttons/cards, neon-on-dark "developer portfolio" look, color-only state signaling.
- Industry palette table + product-type mapping: [references/style-selection.md](references/style-selection.md).

## Spatial composition

- Whitespace is a luxury signal: section padding 6–8rem+, `clamp(1rem, 2vw, 2rem)` spacing units.
- Asymmetric splits (60/40, 70/30) over centered max-width stacks; break the grid intentionally —
  full-bleed moments, overlapping elements, sticky rails, staggered grids.
- Border-radius is a system: either 0 (editorial) or one consistent scale — never default-8px everywhere.
- Banned layouts: equal-card 3-column feature rows, icon+heading+paragraph cards ×4, perfectly
  symmetric grids, hero with headline + subheadline + two side-by-side buttons.

## Motion craft (exact values)

- Micro-interactions 150–300ms; entrances 200–300ms with 500–800ms settles. Nothing over 500ms in
  product UI. Stagger reveals with `animation-delay` — nothing lands simultaneously.
- Easing: elegant `cubic-bezier(0.16, 1, 0.3, 1)`; snappy `cubic-bezier(0.77, 0, 0.175, 1)`.
- Animate `transform` and `opacity` only (GPU); never `width`/`height`/`top`.
- One or two animated key elements per view. Always honor `prefers-reduced-motion`.
- Skeleton screens matching layout, never generic spinners.
- Banned: uniform fade-in-from-below on every section (AOS look), hover = scale+shadow everywhere,
  hover effects that shift layout.
- Scroll-driven patterns (parallax speeds, pinned narrative, library choice):
  [references/react-ui-quality.md](references/react-ui-quality.md).

## Micro-details that signal craft

Styled `::selection`, considered focus rings, custom scrollbar, branded loading states, grain/noise
texture overlays for warmth, scroll-progress indicator, consistent hover/active/focus transitions.

## References

| Reference                                                        | Load when                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| [references/structural-dna.md](references/structural-dna.md)     | Choosing page structure or nav pattern                     |
| [references/style-selection.md](references/style-selection.md)   | Picking style direction, palette, fonts per product type   |
| [references/react-ui-quality.md](references/react-ui-quality.md) | Implementing in React/Tailwind; pre-ship quality checklist |

## Cross-references

- UX flows, IA, research → `skills/domain/ux-methodology/`
- Tailwind v4 implementation → `skills/domain/tailwind-patterns/`
- React implementation patterns → `skills/domain/react-engineering/`

## Done / Acceptance

- A named layout concept and explicit design brief exist before code
- Typography and palette are distinctive, context-appropriate, and use semantic CSS variables
- Nothing from the banned lists (fonts, colors, layouts, motion) is present
- Motion respects `prefers-reduced-motion`; durations/easings within the craft values above
- Accessibility floor: semantic HTML, contrast ratios met, keyboard-navigable, visible focus
- Render verified by screenshot — not assumed
