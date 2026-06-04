# Hooks and Composition Patterns

React 19+ hook patterns, custom hook design, ref handling, and composition strategies.

## React 19 hook additions

### `use()` — promise and context reading

```typescript
import { use, Suspense } from "react";

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends until resolved
  return <div>{user.name}</div>;
}

export function UserPage({ userId }: { userId: number }) {
  const userPromise = fetchUser(userId);
  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

`use()` can also read context conditionally (unlike `useContext`).

### `useActionState` — form action state management

```typescript
import { useActionState } from "react";

async function createPost(prevState: FormState, formData: FormData): Promise<FormState> {
  const title = formData.get("title") as string;
  if (!title) return { error: "Title required" };
  await api.posts.create({ title });
  return { success: true };
}

export function CreatePostForm() {
  const [state, formAction] = useActionState(createPost, {});
  return (
    <form action={formAction}>
      <input name="title" required />
      {state.error && <p role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
```

### `useFormStatus` — pending state within form

```typescript
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Submitting…" : "Submit"}
    </button>
  );
}
```

`useFormStatus` must be used inside a component that is a child of the `<form>` element.

### `useOptimistic` — optimistic UI updates

```typescript
import { useOptimistic, useTransition } from "react";

export function MessageList({ initialMessages }: { initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, newMsg: Message) => [...state, newMsg]
  );
  const [, startTransition] = useTransition();

  const send = (text: string) => {
    addOptimistic({ id: `temp-${Date.now()}`, text, sending: true });
    startTransition(async () => {
      const saved = await api.messages.send(text);
      setMessages((prev) => [...prev, saved]);
    });
  };

  return optimistic.map((m) => (
    <div key={m.id} style={{ opacity: m.sending ? 0.5 : 1 }}>{m.text}</div>
  ));
}
```

### `useEffectEvent()` — non-reactive logic in effects (React 19.2)

```typescript
import { useEffect, useEffectEvent } from "react";

export function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  // Extracts non-reactive logic — theme changes won't re-run the effect
  const onMessage = useEffectEvent((message: string) => {
    console.log(`[${theme}] ${message}`); // reads latest theme without dependency
  });

  useEffect(() => {
    const conn = connect(roomId);
    conn.on("message", onMessage);
    return () => conn.disconnect();
  }, [roomId]); // only roomId is reactive
}
```

## Ref patterns (React 19)

### Ref as prop — no more `forwardRef`

```typescript
// React 19: ref is a regular prop
function CustomInput({ placeholder, ref }: { placeholder?: string; ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} placeholder={placeholder} className="custom-input" />;
}
```

### Ref callback with cleanup (React 19)

```typescript
function VideoPlayer() {
  const videoRef = (element: HTMLVideoElement | null) => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      entry.isIntersecting ? element.play() : element.pause();
    });
    observer.observe(element);
    return () => observer.disconnect(); // cleanup called on unmount
  };
  return <video ref={videoRef} src="/video.mp4" />;
}
```

## Custom hook design

### Rules

1. Extract when the same stateful logic appears in 2+ components.
2. Name with `use` prefix; return a stable object or tuple.
3. Expose only what the consumer needs — don't leak internal state variables.
4. Make dependencies explicit in the parameter signature.

### Pattern: generic data fetcher

```typescript
export function useFetch<T>(url: string): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url, tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
```

## Context without Provider (React 19)

```typescript
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  // React 19: render context directly (no .Provider wrapper)
  return (
    <ThemeContext value={{ theme, toggle: () => setTheme((t) => t === "light" ? "dark" : "light") }}>
      <Main />
    </ThemeContext>
  );
}
```

## Anti-patterns

| Anti-pattern | Correct approach |
|---|---|
| `useEffect` for data fetching in React 19 + RSC | Use RSC for server data; `use()` + Suspense for client async |
| `useMemo` / `useCallback` everywhere (with React Compiler) | Let the compiler optimize; add manual memo only after profiling |
| Class components | Functional components with hooks |
| Direct DOM mutation in effects without cleanup | Return cleanup function from `useEffect` or ref callback |
| Sharing mutable refs between concurrent renders | Use state or stable derived values |
