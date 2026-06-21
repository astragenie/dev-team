# Performance and Bundling

Core Web Vitals targets, rendering strategy, bundle optimization, and build tooling.
Includes build-tool guidance folded from the frontend-developer source.

## Core Web Vitals targets

| Metric | Target | Measured as |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | Time to render the largest visible element |
| INP (Interaction to Next Paint) | < 200ms | Response latency for all user interactions (replaced FID 2024) |
| CLS (Cumulative Layout Shift) | < 0.1 | Visual stability; unexpected layout shifts |

Always set explicit `width` and `height` on `<img>`, `<video>`, and `<iframe>` elements —
the single most impactful fix for CLS.

## Rendering strategy decision tree

```
Content type?
├─► Static content + selective interactivity  → Astro (Islands architecture)
├─► Data-heavy React app                      → RSC + App Router (Next.js 15),
│                                                 stream data with Suspense
├─► SPA without SSR                           → Vite 6 + route-based code splitting
│                                                 + Suspense fallbacks
└─► Next.js with both static and dynamic      → Partial Prerendering (PPR)
```

## React rendering optimizations

### React Compiler (React 19)

The React Compiler handles `useMemo` and `useCallback` automatically. When the compiler
is enabled (via `babel-plugin-react-compiler` or the Next.js built-in):
- Remove manual `useMemo` / `useCallback` wrappers; let the compiler decide.
- Keep `React.memo` for components with expensive renders that receive stable props.
- Profile before adding any manual optimization.

### `startTransition` for non-urgent updates

```typescript
import { startTransition, useState } from "react";

function SearchInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [inputValue, setInputValue] = useState("");

  const handleChange = (value: string) => {
    setInputValue(value);           // urgent: update input immediately
    startTransition(() => {
      onSearch(value);              // non-urgent: can be interrupted
    });
  };

  return <input value={inputValue} onChange={(e) => handleChange(e.target.value)} />;
}
```

### Lazy loading and code splitting

```typescript
import { lazy, Suspense } from "react";

const HeavyChart = lazy(() => import("./HeavyChart"));

export function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
  );
}
```

Route-level code splitting is the highest-yield split; split at the route boundary first,
then at large component boundaries (charts, editors, image galleries).

### Image optimization

- Use `<img loading="lazy">` for below-fold images.
- Serve WebP or AVIF formats (40–60% smaller than JPEG/PNG).
- Always provide `width` and `height` attributes to prevent CLS.
- Use a CDN with automatic format negotiation for production.

## Build tooling

### New projects

| Tool | Default |
|---|---|
| Bundler | Vite 6+ (non-Next.js) or Turbopack (`next dev --turbo`) |
| Linting | Biome v2 (preferred) or ESLint v9 flat config (`eslint.config.js`) |
| Formatting | Biome v2 or Prettier |
| Package manager | pnpm |
| CSS | Tailwind v4 (CSS-first config); CSS Modules outside Tailwind paradigm |
| TypeScript | Strict mode; ES2022 target |

### Vite 6 configuration tips

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
        },
      },
    },
  },
});
```

### Bundle analysis

```bash
# Vite bundle visualizer
npx vite-bundle-visualizer

# Rollup plugin visualizer (already common in Vite setups)
npx rollup-plugin-visualizer --open
```

Target: no single route chunk >150kB gzipped. Flag packages >50kB for review.

### TypeScript strict configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Run `tsc --noEmit` after any significant TypeScript generation before considering it done.

## INP optimization

INP measures all interactions, not just first input. Key techniques:
- **Break up long tasks**: use `scheduler.postTask()` or `startTransition` for long
  synchronous work to yield to the browser between chunks.
- **Avoid JS-driven hover animations**: use CSS `transition` / `animation` instead of
  JS `requestAnimationFrame` loops — JS animations block the main thread.
- **Defer non-critical scripts**: use `<script defer>` or dynamic import for analytics,
  chat widgets, and other non-critical code.
- **Lazy-load heavy components**: `React.lazy()` + Suspense keeps the initial parse budget low.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| `<img>` without `width`/`height` | Always specify dimensions to prevent CLS |
| `useMemo` on cheap computations (with React Compiler) | Remove; compiler handles this |
| Large synchronous renders on user interaction | `startTransition` or chunk the work |
| Single JS bundle for entire app | Route-level code splitting with `React.lazy` |
| Runtime CSS-in-JS libraries (emotion, styled-components) | Tailwind v4 or CSS Modules |
| Importing all of a library when only one function is needed | Named imports; check tree-shaking |
