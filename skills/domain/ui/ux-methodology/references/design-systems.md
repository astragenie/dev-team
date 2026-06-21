# Design Systems, Tokens, Typography, and Motion

Governance patterns for design systems and evidence-backed aesthetic guidance.

## Typography — choosing distinctively

Generic fonts signal low design investment. Users form credibility judgments in 50ms
(Lindgaard et al., 2006). Font choice is a primary credibility signal.

### Fonts to avoid (generic SaaS signals)

Inter, Roboto, Open Sans, Lato, Montserrat, default system fonts (Arial, Helvetica,
-apple-system). These are widely recognized as defaults — they signal "I didn't think
about this."

### Distinctive alternatives by aesthetic

| Aesthetic | Fonts |
|---|---|
| Code / technical | JetBrains Mono, Fira Code, Space Mono, IBM Plex Mono |
| Editorial / narrative | Playfair Display, Crimson Pro, Fraunces, Newsreader, Lora |
| Modern startup | Clash Display, Satoshi, Cabinet Grotesk, Bricolage Grotesque |
| Technical / systematic | IBM Plex family, Source Sans 3, Space Grotesk |
| Distinctive / distinctive | Obviously, Familjen Grotesk, Epilogue |

### Typography principles

- **High-contrast pairings**: display + monospace, or serif + geometric sans.
- **Weight extremes**: 100/200 vs 800/900 reads as intentional; 400 vs 600 reads as default.
- **Dramatic size jumps**: 3× or more between heading levels; 1.5× is forgettable.
- **One distinctive font used decisively** beats multiple safe fonts used timidly.

Always provide working CSS implementations when making typography recommendations.

## Color — commit fully

### Patterns to avoid

- Purple gradients on white — the generic SaaS template; signals commodity.
- Oversaturated primary colors (#0066FF blues) — ubiquitous, no visual identity.
- Timid evenly distributed palettes — no dominant color, no atmosphere.

### Creating atmosphere with CSS variables

```css
:root {
  --color-primary: #1a1a2e;    /* dominant: deep navy */
  --color-accent: #efd81d;     /* sharp accent: gold */
  --color-surface: #16213e;    /* surface: slightly lighter */
  --color-text: #f5f5f5;       /* off-white, not pure white */
}
```

- Dominant color + sharp accent beats balanced pastels.
- Draw from cultural aesthetics, IDE themes, or nature palettes.

### Dark mode done right

- Not a simple white-to-black inversion.
- Replace `#ffffff` with `#f0f0f0` or `#e8e8e8` (off-white reduces eye strain).
- Use `#121212` for backgrounds, not pure `#000000`.
- Use colored shadows for depth; pure black shadows look flat in dark mode.

## Design tokens

Tokens are the single source of truth for design decisions. Use CSS custom properties
as the delivery mechanism; generate from a token file if using a design tool.

### Token naming convention

```
--{category}-{property}-{variant}

Examples:
--color-text-primary
--color-background-surface
--spacing-4          /* 1rem */
--radius-card        /* 8px */
--font-size-heading-1
--shadow-elevation-2
```

### Token tier structure

1. **Global tokens** — raw values (`--color-blue-600: #2563eb`)
2. **Semantic tokens** — purpose-mapped (`--color-interactive: var(--color-blue-600)`)
3. **Component tokens** — scoped (`--button-primary-bg: var(--color-interactive)`)

Semantic tokens are the layer that design systems must enforce; component tokens enable
theming without breaking the semantic contract.

## Layout — breaking the grid thoughtfully

### Generic patterns to avoid

- Three-column feature sections (every SaaS site).
- Hero with centered text + image right.
- Alternating image-left / text-right sections.

### Creating visual interest

- **Asymmetric splits**: 2/3 + 1/3 instead of 50/50.
- **Overlapping elements**: cards slightly overlapping images.
- **Generous whitespace**: empty space creates premium perception.
- **Bold typography as layout element**: large headings as structural anchors.

### Maintaining usability

- F-pattern still applies — don't fight natural left-to-right reading.
- Mobile must remain logical — creative is not an excuse for confusing.
- Navigation must be immediately obvious — hide it for aesthetics only if the alternative
  is surfaced clearly.

## Motion and micro-interactions

### When to animate

- Page load staggered reveals (high-impact first impression).
- State transitions: button hover, form validation feedback, toggle states.
- Drawing attention: new message, error state, success confirmation.
- Loading and progress feedback.

### How to animate

```css
/* State transitions — fast, feel snappy */
.button {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Staggered reveal on load */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.feature-card:nth-child(1) { animation: slideUp 0.4s ease-out 0s both; }
.feature-card:nth-child(2) { animation: slideUp 0.4s ease-out 0.1s both; }
.feature-card:nth-child(3) { animation: slideUp 0.4s ease-out 0.2s both; }
```

### Anti-patterns

- Animating everything — annoying, not delightful.
- Slow animations (>300ms for UI feedback elements).
- JS-driven hover animations on every interactive element — hurts INP scores.
  Use CSS transitions for hover/state instead.
- Ignoring `prefers-reduced-motion` (see accessibility reference).

## Design system governance

- **Single source of truth**: tokens live in one file; all surfaces consume them.
- **Version and changelog**: breaking token renames are breaking changes; communicate them.
- **Contribution process**: new patterns enter the system via review, not ad hoc in features.
- **Deprecation policy**: old tokens get a deprecation warning before removal;
  provide a migration path.
- **Accessibility gate**: no new component ships without passing WCAG 2.2 AA contrast
  and keyboard navigation checks.
