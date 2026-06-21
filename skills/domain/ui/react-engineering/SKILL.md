---
name: react-engineering
prompt_id: react-engineering
version: 1.0.0
tier: domain
description: React 19+ engineering guidance covering hooks, state management, Server Components, Suspense, concurrent rendering, performance, testing, and modern build tooling.
source: aitmpl/web-tools/expert-react-frontend-engineer
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
additional_sources: aitmpl/development-team/frontend-developer
triggers: ["react", "*.tsx", "*.jsx", "hooks", "useState", "useEffect", "useContext", "useReducer", "useMemo", "useCallback", "useRef", "Suspense", "Server Components", "RSC", "Next.js", "Vite", "useOptimistic", "useActionState", "useFormStatus", "startTransition", "useDeferredValue", "TanStack Query", "Zustand", "Redux", "Jotai", "React Router", "framer-motion"]
---

# React Engineering

Modern React 19+ patterns: hooks composition, state management, Server Components, concurrent
rendering, performance optimization, testing, and build tooling. Covers React 19 and 19.2
features including `use()`, `useOptimistic`, `useActionState`, `useEffectEvent()`, `<Activity>`,
and `cacheSignal`. Build-tooling guidance folded from `frontend-developer` source.

## When to use

Consult this skill when:
- Authoring or refactoring React components (hooks, composition, ref patterns)
- Choosing a state management approach (Context vs Zustand vs Redux Toolkit vs Jotai)
- Implementing Server Components, client/server boundaries, or streaming SSR
- Using concurrent rendering features (`startTransition`, `useDeferredValue`, Suspense)
- Handling forms with the Actions API, `useFormStatus`, or `useActionState`
- Implementing optimistic UI updates with `useOptimistic`
- Tuning React rendering performance or analyzing bundle size
- Setting up a React project with Vite, Turbopack, TypeScript, and modern tooling
- Writing component tests with React Testing Library + Vitest

## Core principles

- **Functional components only** — class components are legacy; use hooks for all state and
  side effects.
- **React Compiler first** — React 19 Compiler handles memoization automatically; do not add
  `useMemo` / `useCallback` for performance when the compiler is enabled.
- **Server Components when appropriate** — prefer RSC for data fetching and bundle size
  reduction; push `"use client"` boundaries as far down the tree as possible.
- **TypeScript throughout** — strict mode, no implicit any, discriminated unions for variants.
- **Accessibility by default** — WCAG 2.1 AA; semantic HTML, ARIA only where native semantics
  are absent, keyboard navigation for all interactive elements.
- **Test alongside code** — React Testing Library for component behavior; avoid testing
  implementation details; target 85%+ coverage on components and custom hooks.
- **Modern build tooling** — Vite 6+ for standalone apps; Turbopack for Next.js; Biome v2
  or ESLint v9 flat config; pnpm as package manager.

## Subtopics

Detailed guidance lives in `references/`. Load a reference when the work matches its scope:

| Reference | Load when |
|---|---|
| [references/hooks-and-composition.md](references/hooks-and-composition.md) | Custom hooks, hook composition patterns, React 19 hooks (`use()`, `useEffectEvent()`, `useOptimistic`, `useActionState`), ref patterns |
| [references/state-management.md](references/state-management.md) | Choosing between Context / Zustand / Redux Toolkit / Jotai; server state with TanStack Query; form state with React Hook Form |
| [references/server-and-streaming.md](references/server-and-streaming.md) | React Server Components, `"use client"` boundaries, Suspense streaming, Next.js App Router, `cacheSignal`, Actions API |
| [references/performance-and-bundling.md](references/performance-and-bundling.md) | Bundle analysis, code splitting, lazy loading, Core Web Vitals (LCP/INP/CLS), Vite/Turbopack config, rendering strategy decision tree |
| [references/testing.md](references/testing.md) | React Testing Library patterns, Vitest setup, MSW for API mocking, Playwright e2e, coverage thresholds |

Each reference is self-contained — no prior context from this SKILL.md is required to use it.

## Cross-references

- TypeScript type patterns (generics, discriminated unions, utility types) → `skills/domain/typescript-pro/`
- General frontend patterns (CSS, browser APIs, multi-framework considerations) → `skills/domain/ui/react-engineering/`
- UX methodology for the components being built → `skills/domain/ui/ux-methodology/`
- AI app / LLM SDK integration in React contexts → `skills/domain/ai-engineering/`

## Done / Acceptance

A React component or feature is ready when:
- Functional components with hooks; no class components
- TypeScript strict mode passes (`tsc --noEmit` exits 0)
- All interactive elements keyboard-accessible; semantic HTML used
- Component tests cover primary behaviors and edge cases (≥85% coverage on components/hooks)
- No unnecessary `useMemo`/`useCallback` when React Compiler is active
- Server / client boundary explicitly marked with `"use client"` where required
- Core Web Vitals impact assessed: LCP <2.5s, INP <200ms, CLS <0.1
- Bundle size impact reviewed for significant additions
