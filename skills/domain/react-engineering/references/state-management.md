# State Management

Choosing and implementing the right state solution for React applications.

## Decision matrix

| State type | Volume | Recommended solution |
|---|---|---|
| Server / remote data | Any | TanStack Query v5 |
| Lightweight global UI state | Small | Zustand |
| Complex global state with middleware | Large / team | Redux Toolkit |
| Atomic / fine-grained reactive state | Fine-grained | Jotai |
| Local component state | Any | `useState` / `useReducer` |
| Form state + validation | Any | React Hook Form + Zod |
| Shared across a small subtree | Small | React Context |

**Key rule**: Separate server state (remote / async data) from client state (UI interactions).
Mixing them in a single store creates synchronization complexity.

## TanStack Query v5 (server state)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Fetch with automatic caching, background refresh, and error handling
export function useUser(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => api.users.getById(userId),
    staleTime: 5 * 60 * 1000, // consider fresh for 5 minutes
  });
}

// Mutation with optimistic updates and cache invalidation
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: UserUpdate) => api.users.update(updates),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ["users", userId] });
    },
  });
}
```

Prefer TanStack Query over manual `useEffect` fetch patterns. It handles loading, error,
cache, deduplication, and background refresh automatically.

## Zustand (client state)

```typescript
import { create } from "zustand";

interface SidebarStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
```

Zustand is appropriate for: UI state shared across distant components, user preferences,
session state, feature flag overrides. It does not replace TanStack Query for async data.

## Redux Toolkit (complex client state)

Use Redux Toolkit when: large team, complex derived state, Redux DevTools needed for debug,
or the codebase already uses Redux. Do not introduce Redux in new projects without this
justification — Zustand + TanStack Query covers most cases.

```typescript
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const counterSlice = createSlice({
  name: "counter",
  initialState: { value: 0 },
  reducers: {
    increment: (state) => { state.value += 1; },
    setCount: (state, action: PayloadAction<number>) => { state.value = action.payload; },
  },
});
```

## React Context (subtree sharing)

Context is appropriate for: theming, locale, auth user, small subtree state. It is
inappropriate for high-frequency updates (every render re-renders all consumers).

Context optimization patterns:
- Split contexts: separate `UserContext` and `UserDispatchContext` — consumers that only
  dispatch do not re-render on user data changes.
- Memoize value objects: `useMemo` on the context value (or use Zustand instead).

## React Hook Form + Zod (form state)

```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

type FormData = z.infer<typeof schema>;

export function ProfileForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await api.profile.update(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("email")} aria-invalid={!!errors.email} />
      {errors.email && <p role="alert">{errors.email.message}</p>}
      <button type="submit" disabled={isSubmitting}>Save</button>
    </form>
  );
}
```

For server-side forms in React 19, use the Actions API with `useActionState` instead
(see hooks-and-composition reference). React Hook Form is best for client-side forms
with complex validation.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Storing server data in Redux / Zustand | Use TanStack Query; client stores are for UI state |
| Context for high-frequency state updates | Use Zustand or atom-level state (Jotai) |
| `useEffect` + `useState` for async data | Use TanStack Query `useQuery` |
| Prop drilling more than 2–3 levels | Lift to Zustand store or Context |
| Re-creating store on every render | Define stores outside components |
