---
name: flutter-conventions
tier: domain
stack: flutter
description: Flutter conventions — widget patterns, state management, navigation, performance, approved packages. Use when touching Flutter UI code.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["*.dart", "pubspec.yaml", "flutter", "Widget", "BuildContext", "StatelessWidget", "StatefulWidget"]
---

# Flutter Conventions

Applies to Flutter UI code. For domain / business logic patterns, see `skills/domain/dart/dart-conventions`.

## When to Use

Lead: recommend when a builder adds Flutter widgets, screen layouts, navigation, or state management.

## Widget rules

- **Prefer `StatelessWidget`** over `StatefulWidget` when local mutable state isn't needed.
- Extract widgets early: a `build` method over ~60 lines is a split signal. Name the extracted widget for what it represents, not for where it sits (`OrderSummaryCard`, not `_OrderCardWidget`).
- `const` constructors on every widget that can be const. `const` call sites eliminate redundant rebuilds — the analyzer enforces `prefer_const_constructors`.
- Never put business logic inside `build`. Build methods render; logic lives in the view model, controller, or domain layer.
- Avoid deeply nested widget trees — extract intermediate widgets, use `Column` + `children` decomposition, or `Builder` for scope injection.

## State management

| Need | Package |
|---|---|
| Local ephemeral state | `StatefulWidget` / `ValueNotifier` |
| Screen-level state | `Riverpod` `StateNotifierProvider` or `Bloc` |
| Shared app-level state | `Riverpod` providers (preferred) or `Bloc` |
| Server cache | `Riverpod` `FutureProvider` / `StreamProvider` |
| `Provider` (legacy) | Maintain if present; do not introduce in new screens |
| `setState` for shared state | **Never** — use the layer above |

**Riverpod** is the default for new projects. `flutter_bloc` is acceptable when the team already uses it. Do not introduce both in the same project.

## Navigation

- Use `go_router` for declarative navigation. Named routes + type-safe parameters.
- Never access `Navigator` or `Router` in domain / business logic — pass callbacks or use a navigation service abstraction.
- Deep-link support is a first-class concern from day one.

## BuildContext safety

- Never store a `BuildContext` across async gaps without checking `mounted` first:

```dart
Future<void> onTap() async {
  final result = await doSomethingAsync();
  if (!mounted) return;   // <-- required after every async gap
  ScaffoldMessenger.of(context).showSnackBar(...);
}
```

- Do not pass `BuildContext` into domain objects or services.

## Keys

- Provide a `Key` (preferably `ValueKey`) whenever a widget can change position in a list, be replaced, or conditionally shown/hidden while retaining state.
- `GlobalKey` is a last resort — prefer inherited widgets or state hoisting.

## Performance

- `ListView.builder` / `GridView.builder` for lists — never `Column` wrapping a full list.
- `RepaintBoundary` around heavy custom-painted widgets or animated subtrees.
- Avoid rebuilding expensive subtrees: use `const`, `Consumer` (Riverpod) or `BlocSelector` to scope rebuilds to the data that changed.
- Profile on real device before declaring a performance fix done. Use `flutter run --profile` + DevTools.

## Theming

- All colours, text styles, and spacing via `Theme.of(context)`. No hardcoded `Color(0xFF...)` in widgets.
- Extend `ThemeExtension<T>` for custom design tokens.
- `MediaQuery` for responsive layout; `LayoutBuilder` when constraints are known only at build time.

## Accessibility

- Every interactive element has a `Semantics` label or inherits one from its child (most Material widgets do).
- `ExcludeSemantics` for purely decorative elements.
- Tap targets ≥ 48×48 dp.

## Approved packages

| Package | Use |
|---|---|
| `go_router` | Navigation |
| `flutter_riverpod` + `riverpod_annotation` | State management |
| `flutter_bloc` | State management (existing projects) |
| `freezed` + `freezed_annotation` | Immutable data classes + unions |
| `json_serializable` + `json_annotation` | JSON serialization |
| `dio` | HTTP client with interceptors |
| `shared_preferences` | Simple key-value persistence |
| `sqflite` / `drift` | Local relational storage |
| `flutter_secure_storage` | Secrets / tokens |
| `mocktail` | Mocking in tests |
| `flutter_test` | Widget + unit tests |
| `integration_test` | End-to-end on device |

**Banned:** `provider` for new screens (use Riverpod), `get` / `GetX` (implicit global state), `flutter_hooks` mixed with Riverpod (pick one mental model).

## Testing

- Widget tests for every non-trivial widget: `testWidgets`, `WidgetTester`, `pumpWidget`.
- Unit tests for business logic, view models, and Bloc/Notifiers — no Flutter dependency in these.
- Integration tests for full user flows.
- Never test Riverpod providers by reading them through a real widget tree — use `ProviderContainer` in unit tests.

## Done criteria

- `flutter analyze` clean.
- `dart format` applied.
- No `BuildContext` stored across async gaps without `mounted` check.
- No hardcoded colours or text styles — all via `Theme`.
- `const` constructors on all eligible widgets.
- Lists use `ListView.builder` / `GridView.builder`.
- State management consistent with project choice (Riverpod or Bloc — not both introduced).
