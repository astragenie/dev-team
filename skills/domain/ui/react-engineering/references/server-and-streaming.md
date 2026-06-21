# Server Components, Streaming, and the Actions API

React Server Components, client/server boundaries, Next.js App Router, and form Actions.

## React Server Components (RSC)

### When to use Server Components

- Data fetching components where the data is not user-interactive.
- Large components that would add significant bundle weight if client-rendered.
- Components that access backend resources directly (database, file system, internal APIs).
- Reducing the JavaScript sent to the browser is the primary benefit.

### When to use Client Components

- Components that use browser APIs (localStorage, geolocation, IntersectionObserver).
- Components with interactive state (`useState`, `useReducer`).
- Components using event listeners (`onClick`, `onChange`).
- Components using React hooks that require browser context.

### `"use client"` boundary rules

```typescript
// server-component.tsx — runs on server, never in browser
import { db } from "@/lib/db";

export async function ProductList() {
  const products = await db.products.findMany(); // direct DB access OK
  return (
    <ul>
      {products.map((p) => (
        // AddToCart is interactive — must be a Client Component
        <li key={p.id}><AddToCart product={p} /></li>
      ))}
    </ul>
  );
}

// add-to-cart.tsx
"use client"; // marks the boundary

export function AddToCart({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  return <button onClick={() => setAdded(true)}>{added ? "Added!" : "Add to cart"}</button>;
}
```

Push `"use client"` as far down the component tree as possible. A Server Component cannot
import a Client Component without marking the boundary; a Client Component can import
a Server Component only as a `children` prop (not as a direct import).

## Suspense and streaming

### Nested Suspense boundaries

```typescript
export function Dashboard() {
  return (
    <div>
      {/* Fast-loading header streams first */}
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      {/* Slow analytics loads independently */}
      <Suspense fallback={<ChartSkeleton />}>
        <Analytics />
      </Suspense>
    </div>
  );
}
```

Multiple Suspense boundaries stream independently — each resolves as soon as its
data is ready. This is preferable to a single boundary that waits for the slowest
component.

### `useDeferredValue` with initial value (React 19)

```typescript
import { useDeferredValue } from "react";

function SearchResults({ query }: { query: string }) {
  // Shows "Loading…" initially; deferred updates don't block urgent UI
  const deferredQuery = useDeferredValue(query, "Loading…");
  const results = useSearch(deferredQuery);
  return <ResultList results={results} />;
}
```

## Actions API

### Server Actions (Next.js App Router)

```typescript
// actions/posts.ts
"use server";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  if (!title) throw new Error("Title required");
  await db.posts.create({ title });
  revalidatePath("/posts");
}

// create-post-form.tsx
"use client";
import { createPost } from "@/actions/posts";

export function CreatePostForm() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

### Progressive enhancement

Server Actions work without JavaScript for the initial load. `useFormStatus` and
`useActionState` layer on client-side pending states progressively.

## `cacheSignal` for RSC resource cleanup (React 19.2)

```typescript
import { cache, cacheSignal } from "react";

const fetchUser = cache(async (userId: string) => {
  const controller = new AbortController();
  const signal = cacheSignal(); // aborts when cache entry expires
  signal.addEventListener("abort", () => controller.abort());

  const response = await fetch(`/api/users/${userId}`, { signal: controller.signal });
  return response.json();
});
```

`cacheSignal` ties the lifecycle of a `fetch` to the React cache entry. When the cache
expires or is invalidated, in-flight requests are automatically aborted.

## `<Activity>` component — state preservation (React 19.2)

```typescript
import { Activity } from "react";

export function TabPanel({ activeTab }: { activeTab: string }) {
  return (
    <>
      <Activity mode={activeTab === "home" ? "visible" : "hidden"}>
        <HomeTab />    {/* state is preserved when hidden */}
      </Activity>
      <Activity mode={activeTab === "settings" ? "visible" : "hidden"}>
        <SettingsTab />
      </Activity>
    </>
  );
}
```

`<Activity>` is preferable to conditional rendering (`{condition && <Component />}`) when
preserving component state across tab / route switches is important.

## Document metadata in components (React 19)

```typescript
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      {/* React hoists these to <head> automatically */}
      <title>{post.title} - My Blog</title>
      <meta name="description" content={post.excerpt} />
      <link rel="canonical" href={`/posts/${post.slug}`} />
      <h1>{post.title}</h1>
    </article>
  );
}
```

No need for a separate Helmet / Head component in React 19.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Fetching data in Client Components with `useEffect` | Use RSC for server data or TanStack Query for client-side |
| Importing Client Components from Server Components | Pass as `children` prop instead |
| Single Suspense boundary wrapping the whole page | Nest multiple boundaries; stream independently |
| `revalidatePath("/**")` on every mutation | Scope revalidation to the affected path |
