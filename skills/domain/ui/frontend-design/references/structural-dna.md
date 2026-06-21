# Structural DNA — layout concepts and nav patterns

Pick ONE primary structural concept per page/site, by name, before any code. The concept drives
section order, scroll behavior, and nav. Two sites with different palettes but the same DNA still
read as the same template — structure is the strongest differentiator.

## Layout concepts

| #   | Concept                               | Shape                                                                                     | Best for                                 |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | **Index Manuscript**                  | Single editorial column, one typographic rhythm top-to-bottom                             | Manifesto, menu, long-form product story |
| 2   | **Sticky Horizontal Diorama**         | Vertical scroll drives a horizontally panning scene (`position: sticky` + `translateX`)   | Timeline, process stages                 |
| 3   | **Two-Pane Permanent Split**          | 50/50 or 38/62; one pane sticky, the other scrolls                                        | Catalogue, archive + index, docs         |
| 4   | **Slide Sequence**                    | Full-viewport snap-scroll slides, each visually distinct                                  | Gallery, monograph, launch story         |
| 5   | **Staged Object on a Plinth**         | One centered hero object; marginalia orbits it                                            | Single-product (watch, bottle, device)   |
| 6   | **Pinned Narrative (scrollytelling)** | Section pinned 2–4 screens while contents advance through states                          | Mission profile, how-it-works            |
| 7   | **Horizontal Navigation**             | Primary scroll axis is horizontal; sections read left-to-right                            | Archive, museum-style collections        |
| 8   | **Sidebar + Column**                  | Persistent left sidebar (never scrolls) + scrolling right column                          | Research, legal, documentation           |
| 9   | **Chapter Gates**                     | Full-viewport dividers between tonal zones; page changes character per chapter            | Multi-discipline studio, retrospective   |
| 10  | **Ledger / Registry**                 | Tabular document rows instead of cards (manifest, registry)                               | Waiting lists, batches, releases         |
| 11  | **Collage / Grid-Breaker**            | Magazine-style asymmetric grid with ruptures; images bleed, quotes cross gutters          | Editorial, creative studio               |
| 12  | **Single Object, No Chrome**          | Just the subject + one sentence; no nav, no footer                                        | Single-piece release, teaser             |
| 13  | **Product UI Slate**                  | Hero is a realistic product-interface simulation (dashboard tiles, diff view, ⌘K palette) | AI tools, IDEs, dev tools                |
| 14  | **Dashboard Tile Grid**               | Entire page reads as a live dashboard — counters, sparklines, status pips                 | Infra, cybersecurity, observability      |
| 15  | **Conversation Timeline**             | Simulated transcript plays back on scroll; feature callouts anchor to moments             | Voice AI, chat products, support         |

Within any concept: break the grid intentionally, use asymmetric splits (60/40, 70/30), let
oversized images bleed off-screen, number sections to show progression, and prefer ledger rows
over card grids for list content.

## Nav patterns (don't default to top-bar)

- **No nav at all** — Single Object pages
- **Sticky sidebar nav** — baked into Sidebar + Column
- **Bottom-fixed command bar** — ⌘K-launcher style; tech brands
- **Centered wordmark + tabs beneath** — editorial
- **Full-width scroll index** — the section list IS the nav
- **Marquee ticker** — continuously scrolling strip (metrics, prices) + slim top bar
- **Left-vertical nav** — rotated text, written bottom-to-top
- **Status-bar nav** — live "operational" pip + links; infra/security brands

Top-bar three-column nav is allowed only when it is genuinely the right answer (dense product UI,
docs) — never as the unexamined default.

## Banned page skeletons

These orderings are instantly recognizable as template output:

1. Hero → 3-column features → testimonials → CTA → footer (default SaaS)
2. Hero → stats row → work grid → about split → CTA → footer ("premium AI" template)
3. Any page whose sections could be swapped with another site's without anyone noticing

## Field-direction guardrails

- **Tech / AI / dev tools:** pure-white or near-black grounds (not cream), neo-grotesque sans or
  monospace as _display_, keyboard-shortcut chips, code blocks or animated product UI as hero,
  gradient-glow edges. References: Vercel, Linear, Stripe, Cursor, Raycast, Supabase, Anthropic.
- **Luxury / editorial:** warm cream or near-black, serif display, monospace metadata, generous
  whitespace. Reserved for couture, fragrance, haute cuisine, horology — applying this register
  to a SaaS dashboard is itself a template smell.
- **Infra / security:** dark grounds, data density over whitespace, live-feeling status indicators,
  tessellated grids, green/amber operational pips.
