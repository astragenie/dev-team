# Tailwind CSS v4 — Animation, Transitions & Component Extraction

Reference for `skills/domain/tailwind-patterns/`.

---

## Animation & Transitions

### Built-in Animations

| Class | Effect |
|---|---|
| `animate-spin` | Continuous rotation |
| `animate-ping` | Attention pulse |
| `animate-pulse` | Subtle opacity pulse |
| `animate-bounce` | Bouncing effect |

### Transition Patterns

| Pattern | Classes |
|---|---|
| All properties | `transition-all duration-200` |
| Specific property | `transition-colors duration-150` |
| With easing | `ease-out` or `ease-in-out` |
| Hover scale | `hover:scale-105 transition-transform` |

---

## Component Extraction

### When to Extract

| Signal | Action |
|---|---|
| Same class combo 3+ times | Extract component |
| Complex state variants | Extract component |
| Design system element | Extract + document |

### Extraction Methods

| Method | Use When |
|---|---|
| **React/Vue component** | Dynamic, JS needed |
| **@apply in CSS** | Static, no JS needed |
| **Design tokens** | Reusable values |

Prefer React/Vue components over `@apply`; `@apply` is discouraged in v4.

---

## Performance Principles

| Principle | Implementation |
|---|---|
| **Purge unused** | Automatic in v4 |
| **Avoid dynamism** | No template string classes |
| **Use Oxide** | Default in v4, 10x faster |
| **Cache builds** | CI/CD caching |

**Important**: Never construct class names via template strings (`bg-${color}-500`) —
Tailwind's scanner won't detect them and they'll be purged from the final bundle.
Use full class names or `safelist` in the config.
