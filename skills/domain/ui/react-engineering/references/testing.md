# Testing React Components

Vitest + React Testing Library patterns, MSW for API mocking, Playwright e2e, and coverage.

## Tooling stack

| Layer | Tool |
|---|---|
| Test runner | Vitest (not Jest for new projects) |
| Component testing | `@testing-library/react` + `@testing-library/user-event` |
| Browser component tests | Vitest Browser Mode with Playwright adapter |
| API mocking | MSW v2 (`msw`) |
| E2E | Playwright |
| Coverage | `@vitest/coverage-v8` |

## Coverage thresholds

- Components and custom hooks: **85%+**
- Utility modules: **70%+**
- Gate in CI: fail the build below threshold.

## React Testing Library principles

Test component behavior as users see it — not implementation details.

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePostForm } from "./CreatePostForm";

test("shows error when title is empty", async () => {
  const user = userEvent.setup();
  render(<CreatePostForm />);

  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(screen.getByRole("alert")).toHaveTextContent("Title required");
});

test("calls onSubmit with form data", async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<CreatePostForm onSubmit={onSubmit} />);

  await user.type(screen.getByLabelText(/title/i), "My post");
  await user.click(screen.getByRole("button", { name: /submit/i }));

  expect(onSubmit).toHaveBeenCalledWith({ title: "My post" });
});
```

### Query priority

1. `getByRole` — most accessible; tests semantic meaning.
2. `getByLabelText` — for form elements.
3. `getByPlaceholderText` — secondary; placeholder is not an accessible name.
4. `getByText` — for visible text content.
5. `getByTestId` — last resort; use `data-testid` attribute.

Avoid `container.querySelector`; it tests DOM structure, not user-visible behavior.

## API mocking with MSW v2

Define handlers once; reuse in tests and the development server.

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/:id", ({ params }) => {
    return HttpResponse.json({ id: params.id, name: "Alice" });
  }),
  http.post("/api/posts", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: "1", ...body }, { status: 201 });
  }),
];

// src/mocks/server.ts (for Node / Vitest)
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
export const server = setupServer(...handlers);

// vitest.setup.ts
import { server } from "@/mocks/server";
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

Override handlers in individual tests for error cases:

```typescript
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

test("shows error message on 500", async () => {
  server.use(
    http.get("/api/users/:id", () => HttpResponse.json({ message: "Error" }, { status: 500 }))
  );
  // … render and assert error state
});
```

## Vitest setup

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: { branches: 70, functions: 85, lines: 85 },
      exclude: ["src/mocks/**", "**/*.stories.*"],
    },
  },
});
```

## Playwright E2E

Scope to 3–5 critical user flows only. Mirror unit tests defeats the purpose.

```typescript
// e2e/create-post.spec.ts
import { test, expect } from "@playwright/test";

test("creates a post successfully", async ({ page }) => {
  await page.goto("/posts/new");
  await page.getByLabel("Title").fill("My post");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "My post" })).toBeVisible();
});
```

Selector priority for Playwright: ARIA roles → `data-testid` → CSS selector (last resort).

## Custom hook testing

Test hooks via a thin wrapper component or `renderHook`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { useFetch } from "./useFetch";

test("returns data after fetch resolves", async () => {
  const { result } = renderHook(() => useFetch<User[]>("/api/users"));
  expect(result.current.loading).toBe(true);
  await act(async () => {}); // flush effects
  expect(result.current.data).toEqual([{ id: 1, name: "Alice" }]);
  expect(result.current.loading).toBe(false);
});
```

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Testing implementation details (state variable names, method calls) | Test user-visible behavior |
| `waitFor` + `getByText` polling | Use `findBy*` queries (built-in async wait) |
| Mocking `fetch` directly in tests | Use MSW; keeps tests consistent with dev server |
| E2E tests mirroring unit tests | E2E covers critical paths only; unit tests cover edge cases |
| Snapshot tests for complex components | Behavior assertions are more maintainable |
