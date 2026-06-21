# Tailwind CSS v4 — Color System & Typography

Reference for `skills/domain/tailwind-patterns/`.

---

## Color System

### OKLCH vs RGB/HSL

| Format | Advantage |
|---|---|
| **OKLCH** | Perceptually uniform, better for design |
| **HSL** | Intuitive hue/saturation |
| **RGB** | Legacy compatibility |

Tailwind v4 recommends OKLCH for design tokens: `oklch(0.7 0.15 250)`.

### Color Token Architecture

| Layer | Example | Purpose |
|---|---|---|
| **Primitive** | `--blue-500` | Raw color values |
| **Semantic** | `--color-primary` | Purpose-based naming |
| **Component** | `--button-bg` | Component-specific |

Use semantic tokens in `@theme`; reference them in utilities.

### Dark Mode Color Pattern

| Element | Light | Dark |
|---|---|---|
| Background | `bg-white` | `dark:bg-zinc-900` |
| Text | `text-zinc-900` | `dark:text-zinc-100` |
| Borders | `border-zinc-200` | `dark:border-zinc-700` |

---

## Typography System

### Font Stack Pattern

| Type | Recommended |
|---|---|
| Sans | `'Inter', 'SF Pro', system-ui, sans-serif` |
| Mono | `'JetBrains Mono', 'Fira Code', monospace` |
| Display | `'Outfit', 'Poppins', sans-serif` |

Define in `@theme`:
```css
@theme {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### Type Scale

| Class | Size | Use |
|---|---|---|
| `text-xs` | 0.75rem | Labels, captions |
| `text-sm` | 0.875rem | Secondary text |
| `text-base` | 1rem | Body text |
| `text-lg` | 1.125rem | Lead text |
| `text-xl`+ | 1.25rem+ | Headings |

### Extend vs Override

| Action | Use When |
|---|---|
| **Extend** | Adding new values alongside defaults |
| **Override** | Replacing default scale entirely |
| **Semantic tokens** | Project-specific naming (primary, surface) |
